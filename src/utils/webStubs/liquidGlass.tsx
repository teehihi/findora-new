import React from 'react';
import { View } from 'react-native';

export const LiquidGlassView = ({ children, style, ...props }: any) => (
  <View style={style} {...props}>
    {children}
  </View>
);

export const LiquidGlassContainerView = ({ children, style, ...props }: any) => (
  <View style={style} {...props}>
    {children}
  </View>
);

export const isLiquidGlassAvailable = () => false;

export default {
  LiquidGlassView,
  LiquidGlassContainerView,
  isLiquidGlassAvailable,
};
