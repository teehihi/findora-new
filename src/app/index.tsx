import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../config/firebase';
import { COLORS } from '../constants/theme';

export default function SplashScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // 2-second splash delay matching SplashActivity.java in native Findora
    const timer = setTimeout(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setChecking(false);
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
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="search" size={60} color="#FFFFFF" />
        </View>
        <Text style={styles.brandTitle}>Findora</Text>
        <Text style={styles.brandSubtitle}>Nền tảng tìm đồ thất lạc AI</Text>
      </View>

      <View style={styles.footerContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.versionText}>Phiên bản 1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 120
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginBottom: 20
  },
  brandTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2
  },
  brandSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 6,
    fontWeight: '500'
  },
  footerContainer: {
    alignItems: 'center'
  },
  versionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 12
  }
});
