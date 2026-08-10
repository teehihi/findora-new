import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, ImageBackground, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    // 2-second splash delay matching SplashActivity.java in native Findora
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

        <View style={styles.footer}>
          <ActivityIndicator size="large" color="#00A896" />
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
    bottom: 60
  }
});
