import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { LocationPayload } from '../models/types';

interface FloatingMiniMapProps {
  visible: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  destination: LocationPayload | null;
  distanceText?: string;
  durationText?: string;
  onExpand: () => void;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const WIDGET_WIDTH = 220;
const WIDGET_HEIGHT = 200;

export const FloatingMiniMap: React.FC<FloatingMiniMapProps> = ({
  visible,
  userLocation,
  destination,
  distanceText,
  durationText,
  onExpand,
  onClose,
}) => {
  const pan = useRef(new Animated.ValueXY({
    x: SCREEN_WIDTH - WIDGET_WIDTH - 16,
    y: SCREEN_HEIGHT - WIDGET_HEIGHT - 120,
  })).current;

  const mapRef = useRef<MapView>(null);

  // PanResponder to drag the mini map anywhere
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        // Snap to safe bounds
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;
        const minX = 12;
        const maxX = SCREEN_WIDTH - WIDGET_WIDTH - 12;
        const minY = 60;
        const maxY = SCREEN_HEIGHT - WIDGET_HEIGHT - 80;

        let targetX = currentX;
        let targetY = currentY;

        if (currentX < minX) targetX = minX;
        if (currentX > maxX) targetX = maxX;
        if (currentY < minY) targetY = minY;
        if (currentY > maxY) targetY = maxY;

        Animated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          bounciness: 6,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (visible && userLocation && destination && mapRef.current) {
      const midLat = (userLocation.latitude + destination.latitude) / 2;
      const midLng = (userLocation.longitude + destination.longitude) / 2;
      const latDelta = Math.max(Math.abs(userLocation.latitude - destination.latitude) * 1.5, 0.01);
      const lngDelta = Math.max(Math.abs(userLocation.longitude - destination.longitude) * 1.5, 0.01);

      mapRef.current.animateToRegion({
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      }, 500);
    }
  }, [visible, userLocation, destination]);

  if (!visible || !destination) return null;

  const initialRegion: Region = {
    latitude: destination.latitude,
    longitude: destination.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Top Header Card with Distance & Controls */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.livePulseDot} />
          <Text style={styles.distanceBadge} numberOfLines={1}>
            {distanceText || 'Đang chỉ đường'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={onExpand}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="expand" size={14} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, { marginLeft: 6 }]}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Mini Map View */}
      <TouchableOpacity
        style={styles.mapTouchWrapper}
        activeOpacity={0.9}
        onPress={onExpand}
      >
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          showsUserLocation={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {/* User Location Marker */}
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title="Vị trí của bạn"
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.userMarkerCircle}>
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
          >
            <View style={styles.destMarkerPin}>
              <Ionicons name="location" size={20} color="#EF4444" />
            </View>
          </Marker>

          {/* Route Polyline */}
          {userLocation && (
            <Polyline
              coordinates={[
                userLocation,
                { latitude: destination.latitude, longitude: destination.longitude },
              ]}
              strokeColor="#0084FF"
              strokeWidth={3.5}
              lineDashPattern={[6, 4]}
            />
          )}
        </MapView>

        {/* Bottom Bar: Address & Expand Banner */}
        <View style={styles.bottomBar}>
          <Text style={styles.addressText} numberOfLines={1}>
            {destination.name || destination.address || 'Điểm hẹn'}
          </Text>
          <View style={styles.expandRow}>
            <Ionicons name="navigate-circle" size={12} color="#0084FF" />
            <Text style={styles.expandText}>Chạm để mở to</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#0084FF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 9999,
  },
  header: {
    height: 34,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  distanceBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapTouchWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  userMarkerCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 132, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0084FF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  destMarkerPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  addressText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  expandText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
    marginLeft: 3,
  },
});
