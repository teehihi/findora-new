import React, { useImperativeHandle, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

export const MapView = React.forwardRef(({ children, style, onRegionChangeComplete, ...props }: any, ref: any) => {
  const containerRef = useRef<View>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: any) => {
      if (typeof onRegionChangeComplete === 'function') {
        onRegionChangeComplete(region);
      }
    },
    fitToCoordinates: () => {},
    fitToElements: () => {},
    fitToSuppliedMarkers: () => {},
    animateCamera: () => {},
    setCamera: () => {},
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

  if (Platform.OS === 'web') {
    return (
      <View ref={containerRef} style={[styles.container, style]} {...props}>
        {/* Real Interactive Google Maps Embed for Web */}
        <iframe
          src="https://maps.google.com/maps?q=10.8506,106.7720&z=15&output=embed"
          style={{
            width: '100%',
            height: '100%',
            border: 0,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          } as any}
          title="Findora Live Web Map"
        />
        <View style={styles.overlay} pointerEvents="box-none">
          {children}
        </View>
      </View>
    );
  }

  return (
    <View ref={containerRef} style={[styles.container, style]} {...props}>
      {children}
    </View>
  );
});

export const Marker = ({ children, style, onPress, ...props }: any) => {
  return (
    <View style={[styles.markerContainer, style]} pointerEvents="box-none" {...props}>
      {children}
    </View>
  );
};

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
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
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
