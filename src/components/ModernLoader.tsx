import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  Animated, 
  Easing 
} from 'react-native';

interface ModernLoaderProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  accentColor?: string;
}

export function ModernLoader({
  visible,
  title = 'Đang xử lý...',
  subtitle = 'Vui lòng chờ trong giây lát',
  accentColor = '#00C853'
}: ModernLoaderProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      const animation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true
        })
      );
      animation.start();
      return () => animation.stop();
    }
  }, [visible]);

  if (!visible) return null;

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      hardwareAccelerated
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Sleek Minimalist Single Ring Spinner */}
          <View style={styles.spinnerContainer}>
            <View style={[styles.backgroundRing, { borderColor: `${accentColor}25` }]} />
            <Animated.View 
              style={[
                styles.activeRing, 
                { 
                  borderTopColor: accentColor,
                  borderRightColor: accentColor,
                  transform: [{ rotate: spin }] 
                }
              ]} 
            />
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.titleText}>{title}</Text>
          {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  card: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
  },
  spinnerContainer: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14
  },
  backgroundRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3.5
  },
  activeRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3.5,
    borderColor: 'transparent'
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4
  },
  subtitleText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center'
  }
});
