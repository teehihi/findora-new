import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LocationPayload } from '../models/types';

interface NavigationMapModalProps {
  visible: boolean;
  destination: LocationPayload | null;
  onClose: () => void;
  onMinimize: (userLoc: { latitude: number; longitude: number } | null, distStr: string, durStr: string) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Calculate distance in km between two GPS coordinates (Haversine formula)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
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

// Fetch real street road route from OSRM Navigation API
async function fetchRealStreetRoute(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
): Promise<{ coordinates: { latitude: number; longitude: number }[]; distanceMeters: number; durationSeconds: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Findora-App' } });
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const coords = route.geometry.coordinates.map((c: [number, number]) => ({
        latitude: c[1],
        longitude: c[0],
      }));
      return {
        coordinates: coords,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
      };
    }
  } catch (e) {
    console.log('Notice: OSRM route fetch notice:', e);
  }
  return null;
}

export const NavigationMapModal: React.FC<NavigationMapModalProps> = ({
  visible,
  destination,
  onClose,
  onMinimize,
}) => {
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [distanceText, setDistanceText] = useState('');
  const [durationText, setDurationText] = useState('');
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);

  // Real-time GPS Position Tracking and Route Recalculation
  useEffect(() => {
    if (!visible || !destination) return;

    let isMounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;

    const updateRouteForLocation = async (userCoords: { latitude: number; longitude: number }) => {
      if (!isMounted) return;
      setUserLocation(userCoords);

      // Try fetching real street road route first
      const realRoute = await fetchRealStreetRoute(userCoords, {
        latitude: destination.latitude,
        longitude: destination.longitude,
      });

      if (!isMounted) return;

      let distMeters = 0;
      let durSecs = 0;
      let finalCoords: { latitude: number; longitude: number }[] = [];

      if (realRoute && realRoute.coordinates.length > 0) {
        finalCoords = realRoute.coordinates;
        distMeters = realRoute.distanceMeters;
        durSecs = realRoute.durationSeconds;
      } else {
        // Direct linear path fallback
        const distKm = getDistanceKm(
          userCoords.latitude,
          userCoords.longitude,
          destination.latitude,
          destination.longitude
        );
        distMeters = distKm * 1000;
        durSecs = (distKm / 25) * 3600;
        finalCoords = [userCoords, { latitude: destination.latitude, longitude: destination.longitude }];
      }

      // Format distance
      let distStr = '';
      if (distMeters < 1000) {
        distStr = `${Math.round(distMeters)} m`;
      } else {
        distStr = `${(distMeters / 1000).toFixed(1)} km`;
      }

      // Format estimated travel times (bike & walking)
      const bikeMins = Math.max(Math.round(durSecs > 0 ? durSecs / 60 : (distMeters / 1000 / 25) * 60), 1);
      const walkMins = Math.max(Math.round((distMeters / 1000 / 4.5) * 60), 1);
      const durStr = `~${bikeMins} ph (xe) • ~${walkMins} ph (đi bộ)`;

      setDistanceText(distStr);
      setDurationText(durStr);
      setRouteCoordinates(finalCoords);
      setLoadingLocation(false);
    };

    (async () => {
      try {
        setLoadingLocation(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Quyền vị trí', 'Vui lòng cấp quyền vị trí để chỉ đường.');
          setLoadingLocation(false);
          return;
        }

        // 1. Get initial GPS position
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (isMounted) {
          const userCoords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          await updateRouteForLocation(userCoords);

          // Fit camera to both user location and destination
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.fitToCoordinates(
                [userCoords, { latitude: destination.latitude, longitude: destination.longitude }],
                {
                  edgePadding: { top: 120, right: 60, bottom: 200, left: 60 },
                  animated: true,
                }
              );
            }
          }, 600);
        }

        // 2. Subscribe to live position updates
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
            distanceInterval: 10,
          },
          (newLoc) => {
            const coords = {
              latitude: newLoc.coords.latitude,
              longitude: newLoc.coords.longitude,
            };
            updateRouteForLocation(coords);
          }
        );
      } catch (err) {
        console.log('Error in live navigation tracking:', err);
        setLoadingLocation(false);
      }
    })();

    return () => {
      isMounted = false;
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [visible, destination]);

  // Open Native Maps (Google Maps on Android, Apple Maps / Google Maps on iOS)
  const openExternalMapsApp = () => {
    if (!destination) return;
    const lat = destination.latitude;
    const lng = destination.longitude;
    const label = encodeURIComponent(destination.name || destination.address || 'Điểm hẹn');

    const appleMapsUrl = `maps:0,0?q=${label}@${lat},${lng}`;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    if (Platform.OS === 'ios') {
      Linking.canOpenURL('maps://').then((supported) => {
        if (supported) {
          Linking.openURL(appleMapsUrl);
        } else {
          Linking.openURL(googleMapsUrl);
        }
      });
    } else {
      const androidGoogleNav = `google.navigation:q=${lat},${lng}`;
      Linking.canOpenURL(androidGoogleNav).then((supported) => {
        if (supported) {
          Linking.openURL(androidGoogleNav);
        } else {
          Linking.openURL(googleMapsUrl);
        }
      });
    }
  };

  const handleRecenter = () => {
    if (userLocation && destination && mapRef.current) {
      mapRef.current.fitToCoordinates([
        userLocation,
        { latitude: destination.latitude, longitude: destination.longitude },
      ], {
        edgePadding: { top: 120, right: 60, bottom: 200, left: 60 },
        animated: true,
      });
    }
  };

  if (!destination) return null;

  const initialRegion: Region = {
    latitude: destination.latitude,
    longitude: destination.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Fullscreen Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsCompass={true}
          toolbarEnabled={false}
        >
          {/* User Location Marker */}
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title="Vị trí của bạn"
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.userPulseRing}>
                <View style={styles.userMarkerDot} />
              </View>
            </Marker>
          )}

          {/* Destination Meeting Point Marker */}
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            title={destination.name || 'Điểm hẹn'}
            description={destination.address}
          >
            <View style={styles.destMarkerBox}>
              <View style={styles.destMarkerBadge}>
                <Ionicons name="flag" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                <Text style={styles.destMarkerText}>Điểm hẹn</Text>
              </View>
              <Ionicons name="location" size={32} color="#EF4444" />
            </View>
          </Marker>

          {/* Route Polyline */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#0084FF"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>

        {/* Top Header Floating Guidance Card */}
        <SafeAreaView style={styles.topOverlay} edges={['top', 'left', 'right']}>
          <View style={styles.guidanceCard}>
            <View style={styles.guidanceIconBox}>
              <Ionicons name="navigate" size={24} color="#0084FF" />
            </View>

            <View style={styles.guidanceInfoCol}>
              <Text style={styles.guidanceTitle} numberOfLines={1}>
                {destination.name || 'Điểm hẹn gặp mặt'}
              </Text>
              <Text style={styles.guidanceAddress} numberOfLines={1}>
                {destination.address || `${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)}`}
              </Text>

              {loadingLocation ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#0084FF" />
                  <Text style={styles.loadingText}>Đang định vị lộ trình...</Text>
                </View>
              ) : (
                <View style={styles.metaRow}>
                  <View style={styles.distancePill}>
                    <Text style={styles.distancePillText}>{distanceText}</Text>
                  </View>
                  <Text style={styles.durationText}>{durationText}</Text>
                </View>
              )}
            </View>

            {/* Top Action Buttons (Close on top, Minimize PiP below) */}
            <View style={styles.topActionsCol}>
              <TouchableOpacity
                style={styles.actionCircleBtn}
                onPress={onClose}
                activeOpacity={0.8}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color="#0F172A" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionCircleBtn, { marginTop: 8 }]}
                onPress={() => onMinimize(userLocation, distanceText, durationText)}
                activeOpacity={0.8}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="contract" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        {/* Bottom Floating Control Bar */}
        <SafeAreaView style={styles.bottomOverlay} edges={['bottom', 'left', 'right']}>
          <View style={styles.bottomControls}>
            {/* Recenter Button */}
            <TouchableOpacity
              style={styles.recenterBtn}
              onPress={handleRecenter}
              activeOpacity={0.8}
            >
              <Ionicons name="locate" size={22} color="#0084FF" />
            </TouchableOpacity>

            {/* Native Maps Deep Link Button */}
            <TouchableOpacity
              style={styles.openMapsBtn}
              onPress={openExternalMapsApp}
              activeOpacity={0.85}
            >
              <Ionicons
                name={Platform.OS === 'ios' ? 'map' : 'navigate-circle'}
                size={22}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.openMapsBtnText}>
                {Platform.OS === 'ios' ? 'Mở trong Apple Maps' : 'Mở chỉ đường Google Maps'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  topOverlay: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  guidanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guidanceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  guidanceInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  guidanceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  guidanceAddress: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  loadingText: {
    fontSize: 12,
    color: '#0084FF',
    fontWeight: '600',
    marginLeft: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  distancePill: {
    backgroundColor: '#0084FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  distancePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  durationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0D9488',
  },
  topActionsCol: {
    alignItems: 'center',
    marginLeft: 8,
  },
  actionCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userPulseRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 132, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0084FF',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  destMarkerBox: {
    alignItems: 'center',
  },
  destMarkerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: -4,
  },
  destMarkerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recenterBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 12,
  },
  openMapsBtn: {
    flex: 1,
    height: 52,
    backgroundColor: '#0084FF',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0084FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  openMapsBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
