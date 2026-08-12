import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../config/firebase';
import { setupOnlinePresence } from '../services/presenceService';
import { GlobalCallListener } from '../components/GlobalCallListener';

LogBox.ignoreLogs([
  'FirebaseError: [code=permission-denied]',
  'Uncaught Error in snapshot listener',
  'Missing or insufficient permissions',
  '@firebase/firestore'
]);

export default function RootLayout() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setupOnlinePresence(user.uid);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="post/create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="post/my-posts" />
        <Stack.Screen name="chat/index" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="wallet/index" />
        <Stack.Screen name="wallet/vouchers" />
        <Stack.Screen name="wallet/leaderboard" />
        <Stack.Screen name="profile/edit" />
      </Stack>
      {/* Global In-App Call Receiver Listener */}
      {currentUser && <GlobalCallListener />}
    </>
  );
}
