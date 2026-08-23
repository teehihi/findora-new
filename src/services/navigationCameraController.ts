import { RouteStep } from './navigationService';

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
}

// Shortest Angular Path Difference (handles 358° -> 2° smoothly)
export function getShortestAngleDelta(fromAngle: number, toAngle: number): number {
  const diff = (toAngle - fromAngle) % 360;
  return ((diff + 540) % 360) - 180;
}

// Smoothly interpolate angle with shortest path
export function interpolateAngle(fromAngle: number, toAngle: number, factor: number): number {
  const delta = getShortestAngleDelta(fromAngle, toAngle);
  return (fromAngle + delta * factor + 360) % 360;
}

export class NavigationCameraController {
  private lastSmoothedHeading = 0;
  private lastSmoothedSpeed = 0;

  public reset(initialHeading: number = 0) {
    this.lastSmoothedHeading = initialHeading || 0;
    this.lastSmoothedSpeed = 0;
  }

  // Calculate reliable, stable camera parameters centered directly on userLocation
  public computeCameraTarget(input: CameraInput): CameraState {
    const {
      currentLocation,
      speedKmh,
      distanceToNextManeuverMeters,
      nextStep,
    } = input;

    // 1. Heading Smoothing (Noise Filter)
    const rawHeading =
      currentLocation.heading !== undefined && currentLocation.heading >= 0
        ? currentLocation.heading
        : input.currentBearing;

    this.lastSmoothedHeading = interpolateAngle(this.lastSmoothedHeading, rawHeading, 0.4);

    // 2. Speed Smoothing (0-120 km/h)
    const safeSpeed = Math.max(speedKmh || 0, 0);
    this.lastSmoothedSpeed = this.lastSmoothedSpeed * 0.7 + safeSpeed * 0.3;

    // 3. Stable, Natural Zoom (16.8 to 18.0) - Never over-zoom to avoid tile distortion
    let targetZoom = 17.6;
    let targetTilt = 46;

    if (this.lastSmoothedSpeed < 20) {
      targetZoom = 17.8; // Low speed / stopped: clear road view
      targetTilt = 45;
    } else if (this.lastSmoothedSpeed < 50) {
      targetZoom = 17.2; // City driving
      targetTilt = 50;
    } else {
      targetZoom = 16.5; // Highway / fast driving
      targetTilt = 54;
    }

    // Near turn maneuver: slightly zoom in to highlight junction
    if (distanceToNextManeuverMeters < 150 && nextStep) {
      targetZoom = 18.0;
      targetTilt = 44;
    }

    // Camera center is locked squarely onto user's real location
    return {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      pitch: Math.round(targetTilt),
      heading: Math.round(this.lastSmoothedHeading),
      zoom: Number(targetZoom.toFixed(1)),
      altitude: 200,
    };
  }
}

export const navigationCamera = new NavigationCameraController();
