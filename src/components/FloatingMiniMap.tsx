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
import Svg, { Rect, Path } from 'react-native-svg';
import { LocationPayload } from '../models/types';

function MiniDirectionsIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect
        x="8"
        y="8"
        width="24"
        height="24"
        rx="5"
        ry="5"
        fill="#FFFFFF"
        transform="rotate(45 20 20)"
      />
      <Path
        d="M 14.5 25 V 20.5 C 14.5 18 16.5 16 19 16 H 22.5 V 12.5 L 28 18 L 22.5 23.5 V 20 H 19 C 18.7 20 18 20.7 18 21.5 V 25 H 14.5 Z"
        fill="#15803D"
      />
    </Svg>
  );
}

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
const WIDGET_WIDTH = 210;
const WIDGET_HEIGHT = 190;

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
    y: SCREEN_HEIGHT - WIDGET_HEIGHT - 130,
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
    if (visible && userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      }, 400);
    }
  }, [visible, userLocation]);

  if (!visible || !destination) return null;

  const centerLat = userLocation?.latitude || destination.latitude;
  const centerLng = userLocation?.longitude || destination.longitude;

  const initialRegion: Region = {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: 0.006,
    longitudeDelta: 0.006,
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
      {/* Full Bleed Map View */}
      <TouchableOpacity
        style={styles.mapTouchWrapper}
        activeOpacity={0.95}
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
          liteMode={Platform.OS === 'android'}
          pointerEvents="none"
        >
          {/* User Location Marker */}
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title="Vị trí của bạn"
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.userMarkerPulse}>
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
              <Ionicons name="location" size={24} color="#EF4444" />
            </View>
          </Marker>

          {/* Route Polyline */}
          {userLocation && (
            <Polyline
              coordinates={[
                userLocation,
                { latitude: destination.latitude, longitude: destination.longitude },
              ]}
              strokeColor="#1A73E8"
              strokeWidth={4}
            />
          )}
        </MapView>

        {/* Top Floating Controls Overlay */}
        <View style={styles.topFloatingBar}>
          {/* Left Navigation Pill (Google Maps Green) */}
          <View style={styles.navGreenPill}>
            <MiniDirectionsIcon size={14} />
            <Text style={styles.navDistanceText} numberOfLines={1}>
              {distanceText || 'Chỉ đường'}
            </Text>
          </View>

          {/* Right Action Circle Buttons */}
          <View style={styles.topActionsRow}>
            <TouchableOpacity
              style={styles.actionCircleBtn}
              onPress={onExpand}
              activeOpacity={0.75}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="expand" size={12} color="#0F172A" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCircleBtn, { marginLeft: 6 }]}
              onPress={onClose}
              activeOpacity={0.75}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="close" size={13} color="#0F172A" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Floating Glass Banner */}
        <View style={styles.bottomGlassBanner}>
          <Text style={styles.addressText} numberOfLines={1}>
            {destination.name || destination.address || 'Điểm hẹn gặp mặt'}
          </Text>
          <View style={styles.expandHintRow}>
            <Ionicons name="locate" size={10} color="#0284C7" />
            <Text style={styles.expandHintText}>Chạm để mở toàn màn hình</Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  mapTouchWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  topFloatingBar: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  navGreenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15803D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  navDistanceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionCircleBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userMarkerPulse: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  bottomGlassBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  addressText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  expandHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  expandHintText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#0284C7',
    marginLeft: 3,
  },
});
