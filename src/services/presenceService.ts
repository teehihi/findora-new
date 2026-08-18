import { AppState, AppStateStatus } from 'react-native';
import { doc, updateDoc, onSnapshot, serverTimestamp as firestoreTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export function setupOnlinePresence(userId: string) {
  if (!userId) return () => {};

  try {
    const userDocRef = doc(db, 'users', userId);

    // Mark online in Firestore. RTDB presence is disabled because current database rules deny /status writes.
    const markOnline = () => {
      updateDoc(userDocRef, {
        isOnline: true,
        lastActive: firestoreTimestamp()
      }).catch(() => {});
    };

    // Mark offline in Firestore.
    const markOffline = () => {
      updateDoc(userDocRef, {
        isOnline: false,
        lastActive: firestoreTimestamp()
      }).catch(() => {});
    };

    // Initial mark online when entering app
    markOnline();

    // Listen to AppState (Active foreground vs Background)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        markOnline();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        markOffline();
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateSub.remove();
      markOffline();
    };
  } catch (e) {
    console.log('Presence setup skipped:', e);
    return () => {};
  }
}

export function subscribeUserPresence(
  userId: string,
  callback: (isOnline: boolean, lastChanged?: number) => void
) {
  if (!userId) return () => {};

  try {
    // 1. Primary listener: Firestore users/{userId} (100% permitted & reliable)
    const unsubFirestore = onSnapshot(
      doc(db, 'users', userId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const isOnline = data.isOnline === true;
          let lastActiveMillis: number | undefined = undefined;

          if (data.lastActive) {
            if (data.lastActive.seconds) {
              lastActiveMillis = data.lastActive.seconds * 1000;
            } else if (typeof data.lastActive === 'number') {
              lastActiveMillis = data.lastActive;
            } else {
              const parsed = new Date(data.lastActive).getTime();
              if (!isNaN(parsed)) lastActiveMillis = parsed;
            }
          }

          callback(isOnline, lastActiveMillis);
        }
      },
      () => {}
    );

    return () => {
      unsubFirestore();
    };
  } catch (e) {
    return () => {};
  }
}
