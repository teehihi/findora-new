import React, { useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const MapView = React.forwardRef(({ children, style, onRegionChangeComplete, ...props }: any, ref: any) => {
  const containerRef = useRef<View>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: any, duration?: number) => {
      if (typeof onRegionChangeComplete === 'function') {
        onRegionChangeComplete(region);
      }
    },
    fitToCoordinates: (coordinates: any[], options?: any) => {
      // Gracefully no-op on web
    },
    fitToElements: (options?: any) => {
      // Gracefully no-op on web
    },
    fitToSuppliedMarkers: (markers: string[], options?: any) => {
      // Gracefully no-op on web
    },
    animateCamera: (camera: any, options?: any) => {
      // Gracefully no-op on web
    },
    setCamera: (camera: any) => {
      // Gracefully no-op on web
    },
    getCamera: async () => ({
      center: { latitude: 10.8506, longitude: 106.7720 },
      heading: 0,
      pitch: 0,
      zoom: 15,
      altitude: 1000,
    }),
    getMapBoundaries: async () => ({
      northEast: { latitude: 10.86, longitude: 106.78 },
      southWest: { latitude: 10.84, longitude: 106.76 },
    }),
    pointForCoordinate: async () => ({ x: 0, y: 0 }),
    coordinateForPoint: async () => ({ latitude: 10.8506, longitude: 106.7720 }),
  }));

  return (
    <View ref={containerRef} style={[styles.mapMock, style]} {...props}>
      <View style={styles.mapGridPattern}>
        <Text style={styles.mapTitle}>🗺️ Bản đồ Findora (Web Interactive View)</Text>
        <Text style={styles.mapSubtitle}>Khu vực TP. Hồ Chí Minh &amp; ĐH Sư phạm Kỹ thuật (HCMUTE)</Text>
      </View>
      {children}
    </View>
  );
});

export const Marker = ({ children, style, onPress, ...props }: any) => (
  <View style={[styles.markerContainer, style]} {...props}>
    {children}
  </View>
);

export const Callout = ({ children, style, ...props }: any) => (
  <View style={[styles.calloutContainer, style]} {...props}>
    {children}
  </View>
);

export const Polygon = () => null;
export const Polyline = () => null;
export const Circle = () => null;
export const Overlay = () => null;
export const Heatmap = () => null;
export const Geojson = () => null;

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';

const styles = StyleSheet.create({
  mapMock: {
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  mapGridPattern: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  mapTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  mapSubtitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  markerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default MapView;
