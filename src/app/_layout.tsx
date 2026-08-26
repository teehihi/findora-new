import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { LogBox, Platform } from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { auth } from '../config/firebase';
import { callManager } from '../services/callManager';
import { setupOnlinePresence } from '../services/presenceService';
import { SimpleIncomingCallHandler } from '../components/SimpleIncomingCallHandler';
import { GlobalNotificationListener } from '../components/GlobalNotificationListener';

// Hide native OS splash screen immediately so React Native in-app splash is shown seamlessly
ExpoSplashScreen.hideAsync().catch(() => {});

LogBox.ignoreLogs([
  'FirebaseError: [code=permission-denied]',
  'Uncaught Error in snapshot listener',
  'Missing or insufficient permissions',
  '@firebase/firestore'
]);

export default function RootLayout() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Findora - Nền tảng Tìm kiếm & Trao trả Đồ Thất lạc AI';
    }
  }, []);

  useEffect(() => {
    ExpoSplashScreen.hideAsync().catch(() => {});
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setupOnlinePresence(user.uid);
        // Initialize call manager for user
        callManager.initializeForUser(user.uid);
      } else {
        // Cleanup on logout
        callManager.destroy();
      }
    });
    return unsubscribe;
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <GlobalNotificationListener />
      <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="post/create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="post/edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="post/select-location" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="post/confirm-map" options={{ presentation: 'fullScreenModal', animation: 'slide_from_right' }} />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="post/my-posts" />
        <Stack.Screen name="chat/index" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="wallet/index" />
        <Stack.Screen name="wallet/vouchers" />
        <Stack.Screen name="wallet/leaderboard" />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="settings/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings/change-password" options={{ animation: 'slide_from_right' }} />
      </Stack>
      {/* Simple Incoming Call Handler - Shows modal when CallManager receives incoming call */}
      {currentUser && <SimpleIncomingCallHandler />}
    </>
  );
}
