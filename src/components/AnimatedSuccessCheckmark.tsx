import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

export function AnimatedSuccessCheckmark({ size = 88, delay = 250 }: { size?: number; delay?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.75)).current;

  // Radius = 42 -> Circumference = 2 * PI * 42 = 263.89 ≈ 264
  const CIRCLE_LENGTH = 264;
  const CHECK_LENGTH = 65;

  useEffect(() => {
    anim.setValue(0);
    scaleAnim.setValue(0.75);

    // Wait for the modal fade-in transition to complete before triggering the SVG animation
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 800,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: false,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  // Starts at 0 (full circle), animates to CIRCLE_LENGTH (100% completely hidden)
  const circleOffset = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, CIRCLE_LENGTH, CIRCLE_LENGTH],
  });

  // Checkmark begins drawing at 0.35 and completes at 1.0 (0 = fully drawn)
  const polyOffset = anim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [CHECK_LENGTH, CHECK_LENGTH, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Soft emerald background circle fill */}
        <Circle
          cx="50"
          cy="50"
          r="44"
          fill="#ECFDF5"
          stroke="#D1FAE5"
          strokeWidth="2.5"
        />

        {/* Dynamic unrolling circle border - unwraps 100% cleanly */}
        <AnimatedCircle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="#10B981"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRCLE_LENGTH}
          strokeDashoffset={circleOffset}
          origin="50, 50"
          rotation="-90"
        />

        {/* Perfectly centered checkmark that draws smoothly */}
        <AnimatedPolyline
          points="28,52 44,68 72,34"
          fill="none"
          stroke="#10B981"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_LENGTH}
          strokeDashoffset={polyOffset}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
});
