import { LocationPayload } from '../models/types';

export type VehicleMode = 'bike' | 'car' | 'walk';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: 'turn-straight' | 'turn-left' | 'turn-right' | 'arrive' | 'depart';
  streetName: string;
}

export interface RouteResult {
  coordinates: { latitude: number; longitude: number }[];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
  etaTime: string;
}

// Calculate distance in km between two GPS coordinates
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing in degrees (0 - 360) between two points
export function calculateBearing(startLat: number, startLng: number, endLat: number, endLng: number): number {
  const startLatRad = (startLat * Math.PI) / 180;
  const startLngRad = (startLng * Math.PI) / 180;
  const endLatRad = (endLat * Math.PI) / 180;
  const endLngRad = (endLng * Math.PI) / 180;

  const dLng = endLngRad - startLngRad;

  const y = Math.sin(dLng) * Math.cos(endLatRad);
  const x = Math.cos(startLatRad) * Math.sin(endLatRad) -
            Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(dLng);

  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

// Format arrival ETA clock time (e.g. "21:45")
export function formatEtaTime(durationSeconds: number): string {
  const now = new Date();
  const arrival = new Date(now.getTime() + durationSeconds * 1000);
  const hours = String(arrival.getHours()).padStart(2, '0');
  const minutes = String(arrival.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Format duration into friendly Vietnamese text (e.g. "12 phút", "1 giờ 30 phút")
export function formatDurationText(durationSeconds: number): string {
  const totalMins = Math.max(Math.round(durationSeconds / 60), 1);
  if (totalMins < 60) {
    return `${totalMins} phút`;
  }
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
}

// Format distance text (e.g. "500 m", "5.2 km")
export function formatDistanceText(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

// Fetch real street road route from OSRM Navigation API with turn-by-turn steps
export async function fetchFullNavigationRoute(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
  mode: VehicleMode = 'bike'
): Promise<RouteResult> {
  const fallbackDistKm = getDistanceKm(start.latitude, start.longitude, end.latitude, end.longitude);
  const fallbackMeters = Math.round(fallbackDistKm * 1000);
  
  // Speed profiles in km/h
  const speedKmH = mode === 'car' ? 35 : mode === 'bike' ? 25 : 4.5;
  const fallbackDurationSecs = Math.round((fallbackDistKm / speedKmH) * 3600);

  const fallbackResult: RouteResult = {
    coordinates: [start, end],
    distanceMeters: fallbackMeters,
    durationSeconds: fallbackDurationSecs,
    steps: [
      {
        instruction: 'Đi về hướng điểm hẹn',
        distanceMeters: fallbackMeters,
        durationSeconds: fallbackDurationSecs,
        maneuverType: 'turn-straight',
        streetName: 'Điểm hẹn gặp mặt',
      },
    ],
    etaTime: formatEtaTime(fallbackDurationSecs),
  };

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Findora-Navigation' } });
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const coords = route.geometry.coordinates.map((c: [number, number]) => ({
        latitude: c[1],
        longitude: c[0],
      }));

      // Adjust duration based on vehicle mode
      let adjustedDurationSecs = route.duration;
      if (mode === 'bike') {
        adjustedDurationSecs = Math.round(route.duration * 0.9); // Motorbike is agile in Vietnam traffic
      } else if (mode === 'walk') {
        adjustedDurationSecs = Math.round((route.distance / 1000 / 4.5) * 3600);
      }

      // Parse step maneuvers
      const steps: RouteStep[] = [];
      if (route.legs && route.legs[0] && route.legs[0].steps) {
        route.legs[0].steps.forEach((s: any) => {
          let mType: RouteStep['maneuverType'] = 'turn-straight';
          const modifier = s.maneuver?.modifier || '';
          const type = s.maneuver?.type || '';

          if (modifier.includes('sharp left') || modifier.includes('left')) {
            mType = 'turn-left';
          } else if (modifier.includes('sharp right') || modifier.includes('right')) {
            mType = 'turn-right';
          } else if (type === 'arrive') {
            mType = 'arrive';
          } else if (type === 'depart') {
            mType = 'depart';
          }

          const stName = s.name && s.name.trim() !== '' ? s.name : 'Đoạn đường phía trước';
          let inst = `Đi thẳng trên ${stName}`;
          if (mType === 'turn-left') {
            inst = modifier.includes('sharp') ? `Rẽ gắt sang trái vào ${stName}` : `Rẽ trái vào ${stName}`;
          } else if (mType === 'turn-right') {
            inst = modifier.includes('sharp') ? `Rẽ gắt sang phải vào ${stName}` : `Rẽ phải vào ${stName}`;
          } else if (mType === 'arrive') {
            inst = 'Bạn đã đến điểm hẹn';
          } else if (mType === 'depart') {
            inst = `Xuất phát trên ${stName}`;
          }

          steps.push({
            instruction: inst,
            distanceMeters: Math.round(s.distance),
            durationSeconds: Math.round(s.duration),
            maneuverType: mType,
            streetName: stName,
          });
        });
      }

      return {
        coordinates: coords,
        distanceMeters: route.distance,
        durationSeconds: adjustedDurationSecs,
        steps: steps.length > 0 ? steps : fallbackResult.steps,
        etaTime: formatEtaTime(adjustedDurationSecs),
      };
    }
  } catch (e) {
    console.log('Notice: OSRM route fetch notice:', e);
  }

  return fallbackResult;
}
