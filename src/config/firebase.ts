import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth, 
  getAuth, 
  Auth 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const firebaseConfig = {
  apiKey: "AIzaSyCt5kh9H1vwiIyGaCZzzBb9sUf5yJOkK5s",
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
export const db = getFirestore(app);
export const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);
export const rtdb = getDatabase(app);
export const GEMINI_API_KEY = "AIzaSyAWK3VVS3DCfs05EptzcmaYjnu2WXhDo50";
