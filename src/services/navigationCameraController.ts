import { RouteStep } from './navigationService';

export type CameraMode =
  | 'IDLE'
  | 'FOLLOWING'
  | 'APPROACHING_MANEUVER'
  | 'MANEUVER'
  | 'MANUAL_EXPLORING'
  | 'ARRIVED';

export interface CameraState {
  latitude: number;
  longitude: number;
  pitch: number;
  heading: number;
  zoom: number;
  altitude?: number;
}

export interface CameraInput {
  currentLocation: { latitude: number; longitude: number; speed?: number; heading?: number };
  currentBearing: number;
  speedKmh: number;
  distanceToNextManeuverMeters: number;
  nextStep?: RouteStep | null;
  cameraMode: CameraMode;
  bottomSheetHeight: number;
  screenHeight: number;
}

// 1. Shortest Angular Path Difference (handles 358° -> 2° smoothly)
export function getShortestAngleDelta(fromAngle: number, toAngle: number): number {
  const diff = (toAngle - fromAngle) % 360;
  return ((diff + 540) % 360) - 180;
}

// Smoothly interpolate angle with shortest path
export function interpolateAngle(fromAngle: number, toAngle: number, factor: number): number {
  const delta = getShortestAngleDelta(fromAngle, toAngle);
  return (fromAngle + delta * factor + 360) % 360;
}

// 2. Project Coordinate Ahead along Bearing (in meters)
// To place user at ~38% screen height, camera center is projected FORWARD along user's movement heading
export function projectCoordinateAhead(
  lat: number,
  lng: number,
  headingDeg: number,
  distanceMeters: number
): { latitude: number; longitude: number } {
  const earthRadius = 6378137; // meters
  const rad = (headingDeg * Math.PI) / 180;
  const dLat = (distanceMeters * Math.cos(rad)) / earthRadius;
  const dLng =
    (distanceMeters * Math.sin(rad)) / (earthRadius * Math.cos((lat * Math.PI) / 180));

  return {
    latitude: lat + (dLat * 180) / Math.PI,
    longitude: lng + (dLng * 180) / Math.PI,
  };
}

export class NavigationCameraController {
  private lastSmoothedHeading = 0;
  private lastSmoothedSpeed = 0;
  private lastTargetCamera: CameraState | null = null;

  // Reset or initialize state
  public reset(initialHeading: number = 0) {
    this.lastSmoothedHeading = initialHeading;
    this.lastSmoothedSpeed = 0;
    this.lastTargetCamera = null;
  }

  // Calculate dynamic camera parameters based on speed, maneuver proximity, and framing
  public computeCameraTarget(input: CameraInput): CameraState {
    const {
      currentLocation,
      speedKmh,
      distanceToNextManeuverMeters,
      nextStep,
      cameraMode,
    } = input;

    // 1. Heading Smoothing (Noise Filter)
    const rawHeading = currentLocation.heading !== undefined && currentLocation.heading >= 0
      ? currentLocation.heading
      : input.currentBearing;
    
    // Smooth heading via shortest angle delta
    this.lastSmoothedHeading = interpolateAngle(this.lastSmoothedHeading, rawHeading, 0.45);

    // 2. Speed Smoothing (0-120 km/h)
    const safeSpeed = Math.max(speedKmh || 0, 0);
    this.lastSmoothedSpeed = this.lastSmoothedSpeed * 0.7 + safeSpeed * 0.3;

    // 3. Dynamic Zoom Calculation based on Speed & Maneuver Distance
    let targetZoom = 18.2;
    let lookaheadMeters = 35; // Default distance to offset camera ahead
    let targetTilt = 52;

    // Base zoom and tilt from speed
    if (this.lastSmoothedSpeed < 15) {
      targetZoom = 18.8; // Low speed: close, high-detail road
      targetTilt = 48;
      lookaheadMeters = 25;
    } else if (this.lastSmoothedSpeed < 35) {
      targetZoom = 17.8; // City driving: optimal balance
      targetTilt = 55;
      lookaheadMeters = 50;
    } else if (this.lastSmoothedSpeed < 65) {
      targetZoom = 16.8; // Fast avenue: wider preview
      targetTilt = 60;
      lookaheadMeters = 90;
    } else {
      targetZoom = 15.6; // Highway: long-range forward view
      targetTilt = 65;
      lookaheadMeters = 140;
    }

    // Maneuver Distance Proximity adjustments
    if (distanceToNextManeuverMeters < 120 && nextStep) {
      // In immediate intersection: zoom in for precise turn execution
      targetZoom = Math.max(targetZoom, 19.0);
      targetTilt = 45;
      lookaheadMeters = 18;
    } else if (distanceToNextManeuverMeters < 350) {
      // Approaching turn: zoom in moderately
      targetZoom = Math.max(targetZoom, 18.4);
      targetTilt = 50;
      lookaheadMeters = 35;
    } else if (distanceToNextManeuverMeters > 1500 && this.lastSmoothedSpeed > 40) {
      // Long straight route: allow slightly broader view
      targetZoom = Math.min(targetZoom, 16.5);
      lookaheadMeters = Math.min(lookaheadMeters * 1.2, 160);
    }

    // Special state adjustments
    if (cameraMode === 'ARRIVED') {
      targetZoom = 17.5;
      targetTilt = 30;
      lookaheadMeters = 0;
    }

    // 4. Predictive Viewpoint: Offset camera forward along vehicle heading
    // This positions the vehicle at ~38% of the viewport from bottom!
    const cameraCenter = projectCoordinateAhead(
      currentLocation.latitude,
      currentLocation.longitude,
      this.lastSmoothedHeading,
      lookaheadMeters
    );

    const calculatedState: CameraState = {
      latitude: cameraCenter.latitude,
      longitude: cameraCenter.longitude,
      pitch: Math.round(targetTilt),
      heading: Math.round(this.lastSmoothedHeading),
      zoom: Number(targetZoom.toFixed(1)),
      altitude: Math.round(120 + (19 - targetZoom) * 80),
    };

    this.lastTargetCamera = calculatedState;
    return calculatedState;
  }
}

export const navigationCamera = new NavigationCameraController();
