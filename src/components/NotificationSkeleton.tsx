import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

export function NotificationSkeletonItem() {
  const shimmerAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 0.85,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.35,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => loop.stop();
  }, []);

  return (
    <View style={styles.itemRow}>
      {/* 1. Left Avatar Circle Skeleton */}
      <View style={styles.avatarContainer}>
        <Animated.View style={[styles.avatar, { opacity: shimmerAnim }]} />
        <Animated.View style={[styles.badge, { opacity: shimmerAnim }]} />
      </View>

      {/* 2. Text Column Skeleton */}
      <View style={styles.textCol}>
        <Animated.View style={[styles.lineTitle, { opacity: shimmerAnim }]} />
        <Animated.View style={[styles.lineDesc, { opacity: shimmerAnim }]} />
        <Animated.View style={[styles.lineTime, { opacity: shimmerAnim }]} />
      </View>

      {/* 3. Unread Dot Skeleton */}
      <Animated.View style={[styles.dot, { opacity: shimmerAnim }]} />
    </View>
  );
}

export function NotificationSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <NotificationSkeletonItem key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingHorizontal: 0,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E2E8F0',
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#CBD5E1',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  textCol: {
    flex: 1,
    justifyContent: 'center',
  },
  lineTitle: {
    width: '75%',
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E2E8F0',
    marginBottom: 6,
  },
  lineDesc: {
    width: '90%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    marginBottom: 6,
  },
  lineTime: {
    width: 60,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
    marginLeft: 10,
  },
});
