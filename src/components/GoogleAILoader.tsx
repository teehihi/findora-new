import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

export function GoogleAILoader({ size = 76 }: { size?: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();

    return () => loop.stop();
  }, []);

  // 360 degree rotation
  const spin = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Distance from center (converge to 0 at 60%, expand back out at 100%)
  const distance = anim.interpolate({
    inputRange: [0, 0.15, 0.58, 0.72, 1],
    outputRange: [22, 22, 0, 0, 22],
  });

  // Inverse distance for negative directions
  const negDistance = anim.interpolate({
    inputRange: [0, 0.15, 0.58, 0.72, 1],
    outputRange: [-22, -22, 0, 0, -22],
  });

  // Scale of dots when merging
  const dotScale = anim.interpolate({
    inputRange: [0, 0.5, 0.62, 0.75, 1],
    outputRange: [1, 0.75, 0.5, 0.8, 1],
  });

  // Central glow flash when dots collide in the middle
  const flashOpacity = anim.interpolate({
    inputRange: [0, 0.45, 0.6, 0.72, 1],
    outputRange: [0, 0, 0.8, 0, 0],
  });

  const flashScale = anim.interpolate({
    inputRange: [0, 0.45, 0.6, 0.72, 1],
    outputRange: [0.5, 0.6, 1.3, 0.5, 0.5],
  });

  const scaleRatio = size / 76;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ rotate: spin }, { scale: scaleRatio }],
          },
        ]}
      >
        {/* Center Flash Glow */}
        <Animated.View
          style={[
            styles.flashCircle,
            {
              opacity: flashOpacity,
              transform: [{ scale: flashScale }],
            },
          ]}
        />

        {/* 1. Top: Google Red */}
        <Animated.View
          style={[
            styles.dot,
            styles.redDot,
            {
              transform: [{ translateY: negDistance }, { scale: dotScale }],
            },
          ]}
        />

        {/* 2. Right: Google Green */}
        <Animated.View
          style={[
            styles.dot,
            styles.greenDot,
            {
              transform: [{ translateX: distance }, { scale: dotScale }],
            },
          ]}
        />

        {/* 3. Bottom: Google Blue */}
        <Animated.View
          style={[
            styles.dot,
            styles.blueDot,
            {
              transform: [{ translateY: distance }, { scale: dotScale }],
            },
          ]}
        />

        {/* 4. Left: Google Yellow */}
        <Animated.View
          style={[
            styles.dot,
            styles.yellowDot,
            {
              transform: [{ translateX: negDistance }, { scale: dotScale }],
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  container: {
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  flashCircle: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  dot: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  redDot: {
    backgroundColor: '#EA4335',
    shadowColor: '#EA4335',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  greenDot: {
    backgroundColor: '#34A853',
    shadowColor: '#34A853',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  blueDot: {
    backgroundColor: '#4285F4',
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  yellowDot: {
    backgroundColor: '#FBBC05',
    shadowColor: '#FBBC05',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
});
