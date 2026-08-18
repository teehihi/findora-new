import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

export function PostCardSkeleton() {
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
    <View style={styles.cardContainer}>
      {/* 1. Header: Avatar + Poster Name + Time */}
      <View style={styles.headerRow}>
        <Animated.View style={[styles.avatar, { opacity: shimmerAnim }]} />
        <View style={styles.headerTextCol}>
          <Animated.View style={[styles.nameLine, { opacity: shimmerAnim }]} />
          <Animated.View style={[styles.timeLine, { opacity: shimmerAnim }]} />
        </View>
      </View>

      {/* 2. Title & Description Lines */}
      <View style={styles.contentCol}>
        <Animated.View style={[styles.titleLine, { opacity: shimmerAnim }]} />
        <Animated.View style={[styles.descLine1, { opacity: shimmerAnim }]} />
        <Animated.View style={[styles.descLine2, { opacity: shimmerAnim }]} />
      </View>

      {/* 3. Image Skeleton Box */}
      <Animated.View style={[styles.imageBox, { opacity: shimmerAnim }]} />

      {/* 4. Bottom Action Bar Skeleton */}
      <View style={styles.footerRow}>
        <Animated.View style={[styles.actionBtn, { opacity: shimmerAnim }]} />
        <Animated.View style={[styles.actionBtn, { opacity: shimmerAnim }]} />
        <Animated.View style={[styles.actionBtn, { opacity: shimmerAnim }]} />
      </View>
    </View>
  );
}

export function PostListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <PostCardSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingHorizontal: 0,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2E8F0',
  },
  headerTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  nameLine: {
    width: 140,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E2E8F0',
    marginBottom: 6,
  },
  timeLine: {
    width: 80,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
  },
  contentCol: {
    marginBottom: 12,
  },
  titleLine: {
    width: '80%',
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    marginBottom: 8,
  },
  descLine1: {
    width: '95%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    marginBottom: 6,
  },
  descLine2: {
    width: '65%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  imageBox: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  actionBtn: {
    width: '28%',
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
});
