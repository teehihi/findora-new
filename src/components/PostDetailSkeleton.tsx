import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Animated, Easing, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export function PostDetailSkeleton() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* 1. Hero Image Banner Skeleton */}
        <View style={styles.heroBannerContainer}>
          <Animated.View style={[styles.heroImage, { opacity: shimmerAnim }]} />

          {/* Floating Top Action Bar */}
          <View style={[styles.floatingBar, { top: insets.top + 8 }]}>
            <TouchableOpacity 
              style={styles.circleBtn} 
              onPress={() => router.back()} 
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={24} color="#0F172A" />
            </TouchableOpacity>

            <View style={styles.rightFloatingCluster}>
              <View style={styles.circleBtnPlaceholder} />
              <View style={styles.circleBtnPlaceholder} />
            </View>
          </View>
        </View>

        {/* 2. Main Content Sheet Card Skeleton */}
        <View style={styles.sheetCard}>
          {/* Badge Pill */}
          <Animated.View style={[styles.typeBadgePill, { opacity: shimmerAnim }]} />

          {/* Title */}
          <Animated.View style={[styles.titleLine, { opacity: shimmerAnim }]} />
          <Animated.View style={[styles.subTitleLine, { opacity: shimmerAnim }]} />

          {/* Time Line */}
          <Animated.View style={[styles.dateLine, { opacity: shimmerAnim }]} />

          {/* Section: Description Title */}
          <Animated.View style={[styles.sectionTitleLine, { opacity: shimmerAnim }]} />

          {/* Description Paragraph */}
          <Animated.View style={[styles.descLine1, { opacity: shimmerAnim }]} />
          <Animated.View style={[styles.descLine2, { opacity: shimmerAnim }]} />
          <Animated.View style={[styles.descLine3, { opacity: shimmerAnim }]} />

          {/* 2 Info Cards (Time & Category) */}
          <View style={styles.infoCardsRow}>
            <Animated.View style={[styles.infoCardBox, { opacity: shimmerAnim }]} />
            <Animated.View style={[styles.infoCardBox, { opacity: shimmerAnim }]} />
          </View>

          {/* Location / Map Preview Skeleton */}
          <Animated.View style={[styles.sectionTitleLine, { width: 100, opacity: shimmerAnim }]} />
          <Animated.View style={[styles.addressLine, { opacity: shimmerAnim }]} />
          <Animated.View style={[styles.mapSkeleton, { opacity: shimmerAnim }]} />

          {/* Bottom Action Buttons Row */}
          <View style={styles.bottomBtnsRow}>
            <Animated.View style={[styles.bottomActionBtn, { opacity: shimmerAnim }]} />
            <Animated.View style={[styles.bottomActionBtn, { opacity: shimmerAnim }]} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  heroBannerContainer: {
    width: '100%',
    height: 310,
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#CBD5E1',
  },
  floatingBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  rightFloatingCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  circleBtnPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  typeBadgePill: {
    width: 95,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
  },
  titleLine: {
    width: '90%',
    height: 22,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    marginBottom: 6,
  },
  subTitleLine: {
    width: '60%',
    height: 22,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },
  dateLine: {
    width: 110,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    marginBottom: 20,
  },
  sectionTitleLine: {
    width: 110,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  descLine1: {
    width: '100%',
    height: 13,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    marginBottom: 6,
  },
  descLine2: {
    width: '95%',
    height: 13,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    marginBottom: 6,
  },
  descLine3: {
    width: '70%',
    height: 13,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    marginBottom: 20,
  },
  infoCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  infoCardBox: {
    flex: 1,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  addressLine: {
    width: '80%',
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
    marginBottom: 10,
  },
  mapSkeleton: {
    width: '100%',
    height: 130,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    marginBottom: 24,
  },
  bottomBtnsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bottomActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
});
