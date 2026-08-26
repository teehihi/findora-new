import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const MapView = React.forwardRef(({ children, style, ...props }: any, ref: any) => (
  <View ref={ref} style={[styles.mapMock, style]} {...props}>
    <Text style={styles.mapText}>Bản đồ Findora (Web)</Text>
    {children}
  </View>
));

export const Marker = ({ children, style, ...props }: any) => (
  <View style={style} {...props}>
    {children}
  </View>
);

export const Callout = ({ children, style, ...props }: any) => (
  <View style={style} {...props}>
    {children}
  </View>
);

export const Polygon = () => null;
export const Polyline = () => null;
export const Circle = () => null;
export const Overlay = () => null;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';

const styles = StyleSheet.create({
  mapMock: {
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mapText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default MapView;
