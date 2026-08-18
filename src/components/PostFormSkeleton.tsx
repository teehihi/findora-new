import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Animated, Easing } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderBar } from './HeaderBar';

export function PostFormSkeleton({ title = 'Chỉnh Sửa Bài Đăng' }: { title?: string }) {
  const insets = useSafeAreaInsets();
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderBar title={title} showBack />

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Type Switcher Buttons Skeleton */}
        <View style={styles.typeSelectorRow}>
          <Animated.View style={[styles.typeBtn, { opacity: shimmerAnim }]} />
          <Animated.View style={[styles.typeBtn, { opacity: shimmerAnim }]} />
        </View>

        {/* 2. Image Upload Box Skeleton */}
        <View style={styles.sectionGroup}>
          <Animated.View style={[styles.labelLine, { width: 150, opacity: shimmerAnim }]} />
          <Animated.View style={[styles.imageBox, { opacity: shimmerAnim }]} />
        </View>

        {/* 3. Title Field Skeleton */}
        <View style={styles.sectionGroup}>
          <Animated.View style={[styles.labelLine, { width: 130, opacity: shimmerAnim }]} />
          <Animated.View style={[styles.inputBox, { opacity: shimmerAnim }]} />
        </View>

        {/* 4. Description Field Skeleton */}
        <View style={styles.sectionGroup}>
          <Animated.View style={[styles.labelLine, { width: 110, opacity: shimmerAnim }]} />
          <Animated.View style={[styles.inputBox, { height: 90, opacity: shimmerAnim }]} />
        </View>

        {/* 5. Location Field Skeleton */}
        <View style={styles.sectionGroup}>
          <Animated.View style={[styles.labelLine, { width: 90, opacity: shimmerAnim }]} />
          <View style={styles.locationRow}>
            <Animated.View style={[styles.inputBox, { flex: 1, marginRight: 8, opacity: shimmerAnim }]} />
            <Animated.View style={[styles.mapBtn, { opacity: shimmerAnim }]} />
          </View>
        </View>

        {/* 6. Phone / Points Row Skeleton */}
        <View style={styles.rowInputs}>
          <View style={[styles.sectionGroup, { flex: 1, marginRight: 8 }]}>
            <Animated.View style={[styles.labelLine, { width: 100, opacity: shimmerAnim }]} />
            <Animated.View style={[styles.inputBox, { opacity: shimmerAnim }]} />
          </View>
          <View style={[styles.sectionGroup, { flex: 1 }]}>
            <Animated.View style={[styles.labelLine, { width: 120, opacity: shimmerAnim }]} />
            <Animated.View style={[styles.inputBox, { opacity: shimmerAnim }]} />
          </View>
        </View>
      </ScrollView>

      {/* 7. Docked Save Button Skeleton */}
      <View style={[styles.dockedBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Animated.View style={[styles.saveBtn, { opacity: shimmerAnim }]} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  sectionGroup: {
    marginBottom: 16,
  },
  labelLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E2E8F0',
    marginBottom: 8,
  },
  imageBox: {
    width: '100%',
    height: 190,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  inputBox: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapBtn: {
    width: 44,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  rowInputs: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  dockedBottomBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  saveBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
});
