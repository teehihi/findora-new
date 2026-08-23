import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LocationPayload } from '../models/types';
import { ExternalMapsPickerModal } from './ExternalMapsPickerModal';
import {
  VehicleMode,
  RouteResult,
  fetchFullNavigationRoute,
  formatDistanceText,
  formatDurationText,
  getDistanceKm,
} from '../services/navigationService';
import { enterPipMode, setAutoPip } from '../services/pipService';

interface NavigationMapModalProps {
  visible: boolean;
  destination: LocationPayload | null;
  onClose: () => void;
  onMinimize: (userLoc: { latitude: number; longitude: number } | null, distStr: string, durStr: string) => void;
}

type NavState = 'PREVIEW' | 'STARTING' | 'NAVIGATING' | 'ARRIVED';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const NavigationMapModal: React.FC<NavigationMapModalProps> = ({
  visible,
  destination,
  onClose,
  onMinimize,
}) => {
  const mapRef = useRef<MapView>(null);
  const [navState, setNavState] = useState<NavState>('PREVIEW');
  const [vehicleMode, setVehicleMode] = useState<VehicleMode>('bike');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; heading?: number } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [routeData, setRouteData] = useState<RouteResult | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isExternalPickerVisible, setIsExternalPickerVisible] = useState(false);

  // 1. Initial Route Loading and Realtime GPS Tracking
  useEffect(() => {
    if (!visible || !destination) {
      setNavState('PREVIEW');
      return;
    }

    let isMounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;

    const loadRoute = async (coords: { latitude: number; longitude: number }) => {
      if (!isMounted) return;
      const res = await fetchFullNavigationRoute(coords, {
        latitude: destination.latitude,
        longitude: destination.longitude,
      }, vehicleMode);

      if (!isMounted) return;
      setRouteData(res);
      setLoadingRoute(false);

      // Check arrival condition (< 25m)
      if (res.distanceMeters <= 25 && navState === 'NAVIGATING') {
        setNavState('ARRIVED');
      }
    };

    (async () => {
      try {
        setLoadingRoute(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Quyền vị trí', 'Vui lòng cấp quyền truy cập vị trí để chỉ đường.');
          setLoadingRoute(false);
          return;
        }

        // Get initial position
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (isMounted) {
          const userCoords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading || 0,
          };
          setUserLocation(userCoords);
          await loadRoute(userCoords);

          // Fit full overview in preview mode
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.fitToCoordinates(
                [userCoords, { latitude: destination.latitude, longitude: destination.longitude }],
                {
                  edgePadding: { top: 180, right: 60, bottom: 260, left: 60 },
                  animated: true,
                }
              );
            }
          }, 500);
        }

        // Subscribe to live GPS tracking
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 2500,
            distanceInterval: 5,
          },
          (newLoc) => {
            if (!isMounted) return;
            const updatedCoords = {
              latitude: newLoc.coords.latitude,
              longitude: newLoc.coords.longitude,
              heading: newLoc.coords.heading || 0,
            };
            setUserLocation(updatedCoords);
            loadRoute(updatedCoords);

            // In active navigation mode: smooth 3D camera follow
            if (navState === 'NAVIGATING' && mapRef.current) {
              mapRef.current.animateCamera({
                center: {
                  latitude: updatedCoords.latitude,
                  longitude: updatedCoords.longitude,
                },
                pitch: 50,
                heading: updatedCoords.heading || 0,
                zoom: 18,
              }, { duration: 800 });
            }
          }
        );

        setAutoPip(true);
      } catch (e) {
        console.log('Error in navigation setup:', e);
        setLoadingRoute(false);
      }
    })();

    return () => {
      isMounted = false;
      setAutoPip(false);
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [visible, destination, vehicleMode, navState]);

  // Recenter map camera
  const handleRecenter = () => {
    if (!mapRef.current) return;
    if (navState === 'NAVIGATING' && userLocation) {
      mapRef.current.animateCamera({
        center: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        },
        pitch: 50,
        heading: userLocation.heading || 0,
        zoom: 18,
      }, { duration: 600 });
    } else if (userLocation && destination) {
      mapRef.current.fitToCoordinates(
        [userLocation, { latitude: destination.latitude, longitude: destination.longitude }],
        {
          edgePadding: { top: 180, right: 60, bottom: 260, left: 60 },
          animated: true,
        }
      );
    }
  };

  // Start Realtime Navigation
  const handleStartNavigation = () => {
    setNavState('STARTING');
    setTimeout(() => {
      setNavState('NAVIGATING');
      if (userLocation && mapRef.current) {
        mapRef.current.animateCamera({
          center: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          },
          pitch: 50,
          heading: userLocation.heading || 0,
          zoom: 18,
        }, { duration: 1000 });
      }
    }, 400);
  };

  // In-App PiP Minimize Handler
  const handleMinimizePress = async () => {
    const distText = routeData ? formatDistanceText(routeData.distanceMeters) : '';
    const durText = routeData ? formatDurationText(routeData.durationSeconds) : '';
    if (Platform.OS === 'android') {
      const entered = await enterPipMode(16, 9);
      if (!entered) {
        onMinimize(userLocation, distText, durText);
      }
    } else {
      onMinimize(userLocation, distText, durText);
    }
  };

  if (!destination) return null;

  const currentStep = routeData?.steps[currentStepIndex] || routeData?.steps[0];
  const distanceStr = routeData ? formatDistanceText(routeData.distanceMeters) : '...';
  const durationStr = routeData ? formatDurationText(routeData.durationSeconds) : '...';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Map View */}
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: destination.latitude,
            longitude: destination.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }}
          showsCompass={false}
          showsUserLocation={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          {/* User Location Marker */}
          {userLocation && (
            <Marker
              coordinate={userLocation}
              anchor={{ x: 0.5, y: 0.5 }}
              flat={navState === 'NAVIGATING'}
              rotation={navState === 'NAVIGATING' ? (userLocation.heading || 0) : 0}
            >
              {navState === 'NAVIGATING' ? (
                /* 3D Navigation Arrow Puck */
                <View style={styles.navPuckOuter}>
                  <View style={styles.navPuckInner}>
                    <Ionicons name="navigate" size={20} color="#FFFFFF" />
                  </View>
                </View>
              ) : (
                /* Standard Blue GPS Dot */
                <View style={styles.userDotRing}>
                  <View style={styles.userDotCore} />
                </View>
              )}
            </Marker>
          )}

          {/* Destination Pin Marker */}
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            title={destination.name || 'Điểm hẹn'}
          >
            <View style={styles.destPinBox}>
              <View style={styles.destPinBadge}>
                <Ionicons name="flag" size={10} color="#FFFFFF" style={{ marginRight: 2 }} />
                <Text style={styles.destPinText}>Điểm hẹn</Text>
              </View>
              <Ionicons name="location" size={32} color="#EF4444" />
            </View>
          </Marker>

          {/* Route Polyline */}
          {routeData && routeData.coordinates.length > 0 && (
            <Polyline
              coordinates={routeData.coordinates}
              strokeColor={navState === 'NAVIGATING' ? '#2563EB' : '#0284C7'}
              strokeWidth={navState === 'NAVIGATING' ? 6 : 5}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>

        {/* ========================================================================= */}
        {/* STAGE 1: ROUTE PREVIEW MODE UI                                            */}
        {/* ========================================================================= */}
        {navState === 'PREVIEW' && (
          <>
            {/* Top Route Information Card */}
            <SafeAreaView style={styles.previewTopOverlay} edges={['top', 'left', 'right']}>
              <View style={styles.previewCard}>
                <TouchableOpacity
                  style={styles.closeRoundBtn}
                  onPress={onClose}
                  activeOpacity={0.75}
                >
                  <Ionicons name="close" size={20} color="#0F172A" />
                </TouchableOpacity>

                <View style={styles.routeCol}>
                  {/* Origin */}
                  <View style={styles.pointRow}>
                    <View style={styles.originDot} />
                    <Text style={styles.pointText} numberOfLines={1}>Vị trí của bạn</Text>
                  </View>
                  <View style={styles.routeDottedLine} />
                  {/* Destination */}
                  <View style={styles.pointRow}>
                    <View style={styles.destDot} />
                    <Text style={[styles.pointText, styles.pointTextBold]} numberOfLines={1}>
                      {destination.name || destination.address || 'Điểm hẹn'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.pipRoundBtn}
                  onPress={handleMinimizePress}
                  activeOpacity={0.75}
                >
                  <Ionicons name="contract" size={16} color="#0F172A" />
                </TouchableOpacity>
              </View>

              {/* Vehicle Mode Tabs */}
              <View style={styles.vehicleTabsRow}>
                <TouchableOpacity
                  style={[styles.vehicleTab, vehicleMode === 'bike' && styles.vehicleTabActive]}
                  onPress={() => setVehicleMode('bike')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="bicycle"
                    size={16}
                    color={vehicleMode === 'bike' ? '#0D9488' : '#64748B'}
                  />
                  <Text style={[styles.vehicleTabText, vehicleMode === 'bike' && styles.vehicleTabTextActive]}>
                    Xe máy
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.vehicleTab, vehicleMode === 'car' && styles.vehicleTabActive]}
                  onPress={() => setVehicleMode('car')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="car"
                    size={16}
                    color={vehicleMode === 'car' ? '#0D9488' : '#64748B'}
                  />
                  <Text style={[styles.vehicleTabText, vehicleMode === 'car' && styles.vehicleTabTextActive]}>
                    Ô tô
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.vehicleTab, vehicleMode === 'walk' && styles.vehicleTabActive]}
                  onPress={() => setVehicleMode('walk')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="walk"
                    size={16}
                    color={vehicleMode === 'walk' ? '#0D9488' : '#64748B'}
                  />
                  <Text style={[styles.vehicleTabText, vehicleMode === 'walk' && styles.vehicleTabTextActive]}>
                    Đi bộ
                  </Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>

            {/* Bottom Route Preview Sheet */}
            <SafeAreaView style={styles.previewBottomOverlay} edges={['bottom', 'left', 'right']}>
              <View style={styles.previewBottomCard}>
                {loadingRoute ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#0D9488" />
                    <Text style={styles.loadingText}>Đang tính toán tuyến đường tối ưu...</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.routeSummaryRow}>
                      <View>
                        <Text style={styles.durationBig}>{durationStr}</Text>
                        <Text style={styles.distanceSub}>
                          {distanceStr} • Đến nơi lúc {routeData?.etaTime || '--:--'}
                        </Text>
                      </View>
                      <View style={styles.ecoBadge}>
                        <Ionicons name="leaf" size={12} color="#15803D" />
                        <Text style={styles.ecoBadgeText}>Tiết kiệm</Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtonsRow}>
                      {/* Primary "Bắt đầu" Button */}
                      <TouchableOpacity
                        style={styles.startNavBtn}
                        onPress={handleStartNavigation}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="navigate" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.startNavBtnText}>Bắt đầu</Text>
                      </TouchableOpacity>

                      {/* Secondary "Mở bản đồ ngoài" Button */}
                      <TouchableOpacity
                        style={styles.externalMapBtn}
                        onPress={() => setIsExternalPickerVisible(true)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="open-outline" size={18} color="#0F172A" style={{ marginRight: 6 }} />
                        <Text style={styles.externalMapBtnText}>Bản đồ ngoài</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </SafeAreaView>
          </>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2: REALTIME 3D NAVIGATION MODE UI                                   */}
        {/* ========================================================================= */}
        {navState === 'NAVIGATING' && (
          <>
            {/* Top Large Green Navigation Instruction Card */}
            <SafeAreaView style={styles.navTopOverlay} edges={['top', 'left', 'right']}>
              <View style={styles.turnCard}>
                <View style={styles.turnIconSquircle}>
                  <Ionicons
                    name={
                      currentStep?.maneuverType === 'turn-left'
                        ? 'arrow-back'
                        : currentStep?.maneuverType === 'turn-right'
                        ? 'arrow-forward'
                        : 'arrow-up'
                    }
                    size={28}
                    color="#FFFFFF"
                  />
                </View>

                <View style={styles.turnInfoCol}>
                  <Text style={styles.turnHeading} numberOfLines={1}>
                    {currentStep?.instruction || 'Đi thẳng về hướng điểm hẹn'}
                  </Text>
                  <Text style={styles.turnSubline} numberOfLines={1}>
                    Trong {formatDistanceText(currentStep?.distanceMeters || 0)} • {destination.address}
                  </Text>
                </View>

                {/* Top Action Buttons (In-App PiP & Close) */}
                <View style={styles.topNavActions}>
                  <TouchableOpacity
                    style={styles.navActionCircle}
                    onPress={handleMinimizePress}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="contract" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.navActionCircle, { marginTop: 6 }]}
                    onPress={onClose}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>

            {/* Floating Side Controls */}
            <View style={styles.sideControls}>
              {/* Compass / Recenter */}
              <TouchableOpacity
                style={styles.sideCircleBtn}
                onPress={handleRecenter}
                activeOpacity={0.85}
              >
                <Ionicons name="locate" size={22} color="#0084FF" />
              </TouchableOpacity>

              {/* Sound Toggle */}
              <TouchableOpacity
                style={[styles.sideCircleBtn, { marginTop: 10 }]}
                onPress={() => setIsVoiceEnabled(!isVoiceEnabled)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={isVoiceEnabled ? 'volume-high' : 'volume-mute'}
                  size={22}
                  color={isVoiceEnabled ? '#0D9488' : '#94A3B8'}
                />
              </TouchableOpacity>
            </View>

            {/* Bottom Dark Navigation HUD Panel */}
            <SafeAreaView style={styles.navBottomOverlay} edges={['bottom', 'left', 'right']}>
              <View style={styles.navBottomCard}>
                <View style={styles.hudEtaCol}>
                  <View style={styles.hudEtaRow}>
                    <Text style={styles.hudEtaNumber}>{durationStr}</Text>
                    <View style={styles.ecoPill}>
                      <Ionicons name="leaf" size={10} color="#22C55E" />
                    </View>
                  </View>
                  <Text style={styles.hudMetaSub}>
                    {distanceStr} • Đến nơi lúc {routeData?.etaTime || '--:--'}
                  </Text>
                </View>

                {/* Exit Button */}
                <TouchableOpacity
                  style={styles.exitBtn}
                  onPress={onClose}
                  activeOpacity={0.85}
                >
                  <Text style={styles.exitBtnText}>Thoát</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </>
        )}

        {/* ========================================================================= */}
        {/* STAGE 3: ARRIVED AT DESTINATION MODAL                                     */}
        {/* ========================================================================= */}
        {navState === 'ARRIVED' && (
          <SafeAreaView style={styles.arrivedOverlay}>
            <View style={styles.arrivedCard}>
              <View style={styles.arrivedIconBox}>
                <Ionicons name="checkmark-circle" size={54} color="#10B981" />
              </View>
              <Text style={styles.arrivedTitle}>Bạn đã đến nơi!</Text>
              <Text style={styles.arrivedDesc}>
                Bạn đang ở ngay tại điểm hẹn {destination.name || destination.address}.
              </Text>
              <TouchableOpacity
                style={styles.arrivedDoneBtn}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={styles.arrivedDoneText}>Hoàn tất</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}

        {/* External Maps Chooser Modal */}
        <ExternalMapsPickerModal
          visible={isExternalPickerVisible}
          destination={destination}
          userLocation={userLocation}
          onClose={() => setIsExternalPickerVisible(false)}
        />
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
  // STAGE 1 PREVIEW STYLES
  previewTopOverlay: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    zIndex: 100,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closeRoundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pipRoundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  routeCol: {
    flex: 1,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  originDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0284C7',
    marginRight: 8,
  },
  destDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  routeDottedLine: {
    width: 2,
    height: 10,
    backgroundColor: '#CBD5E1',
    marginLeft: 4,
    marginVertical: 2,
  },
  pointText: {
    fontSize: 13,
    color: '#475569',
  },
  pointTextBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  vehicleTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  vehicleTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  vehicleTabActive: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  vehicleTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 6,
  },
  vehicleTabTextActive: {
    color: '#0D9488',
    fontWeight: '800',
  },
  previewBottomOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    zIndex: 100,
  },
  previewBottomCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#0D9488',
    fontWeight: '600',
    marginLeft: 8,
  },
  routeSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  durationBig: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  distanceSub: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  ecoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  ecoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    marginLeft: 3,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  startNavBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    height: 48,
    borderRadius: 16,
    marginRight: 10,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  startNavBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  externalMapBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  externalMapBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },

  // STAGE 2 ACTIVE NAVIGATION STYLES
  navTopOverlay: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    zIndex: 100,
  },
  turnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00594C',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  turnIconSquircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  turnInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  turnHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  turnSubline: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  topNavActions: {
    alignItems: 'center',
    marginLeft: 8,
  },
  navActionCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideControls: {
    position: 'absolute',
    right: 16,
    bottom: 110,
    zIndex: 90,
  },
  sideCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  },
  navBottomOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 100,
  },
  navBottomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  hudEtaCol: {
    flex: 1,
  },
  hudEtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hudEtaNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  ecoPill: {
    marginLeft: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
  },
  hudMetaSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  exitBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  exitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // MARKER & PUCK STYLES
  userDotRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDotCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0284C7',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  navPuckOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(37, 99, 235, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navPuckInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  destPinBox: {
    alignItems: 'center',
  },
  destPinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: -4,
  },
  destPinText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // STAGE 3 ARRIVED STYLES
  arrivedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: 24,
  },
  arrivedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  arrivedIconBox: {
    marginBottom: 12,
  },
  arrivedTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
  },
  arrivedDesc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  arrivedDoneBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  arrivedDoneText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
