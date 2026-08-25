import { Platform } from 'react-native';
import { RouteStep } from './navigationService';

export interface CameraTarget {
  center: {
    latitude: number;
    longitude: number;
  };
  pitch: number;
  heading: number;
  zoom?: number;
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

export class NavigationCameraController {
  private lastSmoothedHeading = 0;
  private lastSmoothedSpeed = 0;

  public reset(initialHeading: number = 0) {
    this.lastSmoothedHeading = initialHeading >= 0 ? initialHeading : 0;
    this.lastSmoothedSpeed = 0;
  }

  // Calculate rock-solid, non-spinning camera parameters
  public computeCameraTarget(input: CameraInput): CameraTarget {
    const {
      currentLocation,
      speedKmh,
      distanceToNextManeuverMeters,
      nextStep,
    } = input;

    // 1. Heading Stabilization (Anti-Spin Filter)
    // GPS heading fluctuates wildly when stationary or moving slowly.
    // We strictly LOCK heading when speed < 4 km/h to prevent dizzy rotation.
    const rawHeading =
      currentLocation.heading !== undefined && currentLocation.heading >= 0
        ? currentLocation.heading
        : input.currentBearing;

    const safeSpeed = Math.max(speedKmh || 0, 0);
    this.lastSmoothedSpeed = this.lastSmoothedSpeed * 0.7 + safeSpeed * 0.3;

    if (this.lastSmoothedSpeed >= 4.0 && rawHeading >= 0) {
      const delta = getShortestAngleDelta(this.lastSmoothedHeading, rawHeading);
      // Only adjust if directional change is meaningful (> 4 degrees)
      if (Math.abs(delta) > 4) {
        this.lastSmoothedHeading = (this.lastSmoothedHeading + delta * 0.35 + 360) % 360;
      }
    }

    // 2. Stable, Natural Driving Zoom & Pitch (Google Maps Standard)
    let targetZoom = 17.5;
    let targetAltitude = 420;
    let targetPitch = 45;

    if (this.lastSmoothedSpeed > 50) {
      // Fast road / Highway: wider view
      targetZoom = 16.5;
      targetAltitude = 700;
      targetPitch = 48;
    } else if (distanceToNextManeuverMeters < 100 && nextStep) {
      // Near turn maneuver: slightly closer
      targetZoom = 18.0;
      targetAltitude = 320;
      targetPitch = 42;
    }

    const center = {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    };

    if (Platform.OS === 'ios') {
      return {
        center,
        pitch: Math.round(targetPitch),
        heading: Math.round(this.lastSmoothedHeading),
        altitude: Math.round(targetAltitude),
      };
    } else {
      return {
        center,
        pitch: Math.round(targetPitch),
        heading: Math.round(this.lastSmoothedHeading),
        zoom: Number(targetZoom.toFixed(1)),
      };
    }
  }
}

export const navigationCamera = new NavigationCameraController();
