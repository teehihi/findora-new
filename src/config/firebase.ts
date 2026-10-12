import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth, 
  getAuth, 
  Auth 
} from 'firebase/auth';
import { initializeFirestore, getFirestore, memoryLocalCache, setLogLevel } from 'firebase/firestore';

setLogLevel('error');
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "findora-138a7.firebaseapp.com",
  projectId: "findora-138a7",
  storageBucket: "findora-138a7.firebasestorage.app",
  messagingSenderId: "32712775834",
  appId: Platform.OS === 'ios'
    ? "1:32712775834:ios:jvbe5dqn6vjvlj1cv9ot8qrmijjp8r3t"
    : "1:32712775834:android:f6083188748409b0c82723",
  databaseURL: "https://findora-138a7-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let auth: Auth;
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

try {
  const { getReactNativePersistence } = require('firebase/auth');
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  auth = getAuth(app);
}

export { auth };

let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: Platform.OS === 'android',
    localCache: memoryLocalCache(),
  });
} catch (e) {
  dbInstance = getFirestore(app);
}
export const db = dbInstance;
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
