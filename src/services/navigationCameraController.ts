import { Platform } from 'react-native';
import { RouteStep } from './navigationService';

export interface CameraTarget {
  center: {
    latitude: number;
    longitude: number;
  };
  pitch: number;
  heading: number;
  zoom: number;
  altitude: number;
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
  public computeCameraTarget(input: CameraInput): CameraTarget {
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

    this.lastSmoothedHeading = interpolateAngle(this.lastSmoothedHeading, rawHeading, 0.45);

    // 2. Speed Smoothing (0-120 km/h)
    const safeSpeed = Math.max(speedKmh || 0, 0);
    this.lastSmoothedSpeed = this.lastSmoothedSpeed * 0.7 + safeSpeed * 0.3;

    // 3. Platform-aware Zoom & Altitude
    // iOS (Apple Maps) responds best to altitude (meters)
    // Android (Google Maps) responds best to zoom levels (0-20)
    let targetZoom = 17.8;
    let targetAltitude = 380;
    let targetPitch = 48;

    if (this.lastSmoothedSpeed < 15) {
      // Stopped / Very slow
      targetZoom = 18.2;
      targetAltitude = 300;
      targetPitch = 45;
    } else if (this.lastSmoothedSpeed < 45) {
      // City driving
      targetZoom = 17.5;
      targetAltitude = 450;
      targetPitch = 50;
    } else {
      // Fast road / Highway
      targetZoom = 16.5;
      targetAltitude = 750;
      targetPitch = 55;
    }

    // Near turn maneuver (< 150m): zoom in close to show junction
    if (distanceToNextManeuverMeters < 150 && nextStep) {
      targetZoom = 18.5;
      targetAltitude = 260;
      targetPitch = 42;
    }

    return {
      center: {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      },
      pitch: Math.round(targetPitch),
      heading: Math.round(this.lastSmoothedHeading),
      zoom: Number(targetZoom.toFixed(1)),
      altitude: Math.round(targetAltitude),
    };
  }
}

export const navigationCamera = new NavigationCameraController();
