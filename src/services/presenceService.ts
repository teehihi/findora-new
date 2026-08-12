import { AppState, AppStateStatus } from 'react-native';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtdbTimestamp } from 'firebase/database';
import { doc, updateDoc, onSnapshot, serverTimestamp as firestoreTimestamp } from 'firebase/firestore';
import { db, rtdb } from '../config/firebase';

export function setupOnlinePresence(userId: string) {
  if (!userId) return () => {};

  try {
    const userDocRef = doc(db, 'users', userId);
    const userStatusDatabaseRef = ref(rtdb, `/status/${userId}`);

    const isOfflineForDatabase = {
      state: 'offline',
      last_changed: rtdbTimestamp(),
    };

    const isOnlineForDatabase = {
      state: 'online',
      last_changed: rtdbTimestamp(),
    };

    // Mark online in Firestore & RTDB
    const markOnline = () => {
      updateDoc(userDocRef, {
        isOnline: true,
        lastActive: firestoreTimestamp()
      }).catch(() => {});

      set(userStatusDatabaseRef, isOnlineForDatabase).catch(() => {});
    };

    // Mark offline in Firestore & RTDB
    const markOffline = () => {
      updateDoc(userDocRef, {
        isOnline: false,
        lastActive: firestoreTimestamp()
      }).catch(() => {});

      set(userStatusDatabaseRef, isOfflineForDatabase).catch(() => {});
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

    // RTDB Disconnect hook
    const connectedRef = ref(rtdb, '.info/connected');
    const rtdbSub = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        onDisconnect(userStatusDatabaseRef)
          .set(isOfflineForDatabase)
          .then(() => {
            set(userStatusDatabaseRef, isOnlineForDatabase).catch(() => {});
          })
          .catch(() => {});
      }
    });

    return () => {
      appStateSub.remove();
      rtdbSub();
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

    // 2. Secondary listener: RTDB /status/{userId}
    const userStatusRef = ref(rtdb, `/status/${userId}`);
    const unsubRTDB = onValue(
      userStatusRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data && data.state) {
          callback(data.state === 'online', data.last_changed);
        }
      },
      () => {}
    );

    return () => {
      unsubFirestore();
      unsubRTDB();
    };
  } catch (e) {
    return () => {};
  }
}
