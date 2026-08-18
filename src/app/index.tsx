import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, ImageBackground, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function SplashScreen() {
  const router = useRouter();
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Smooth progress bar animation over 1.8 seconds
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1800,
      useNativeDriver: false
    }).start();

    const timer = setTimeout(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/login');
        }
      });
      return () => unsubscribe();
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <ImageBackground
      source={require('../../assets/images/Splash_BG.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        {/* Centered Genuine Logo */}
        <Image
          source={require('../../assets/images/Logo_noBG.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Horizontal Loading Progress Bar */}
        <View style={styles.footer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%'
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  logo: {
    width: 280,
    height: 280
  },
  footer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center'
  },
  progressTrack: {
    width: 220,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 168, 150, 0.2)',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#00A896'
  }
});
