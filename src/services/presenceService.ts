import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { rtdb } from '../config/firebase';

export function setupOnlinePresence(userId: string) {
  if (!userId) return () => {};

  try {
    const userStatusDatabaseRef = ref(rtdb, `/status/${userId}`);

    const isOfflineForDatabase = {
      state: 'offline',
      last_changed: serverTimestamp(),
    };

    const isOnlineForDatabase = {
      state: 'online',
      last_changed: serverTimestamp(),
    };

    const connectedRef = ref(rtdb, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === false) {
        return;
      }

      onDisconnect(userStatusDatabaseRef)
        .set(isOfflineForDatabase)
        .then(() => {
          return set(userStatusDatabaseRef, isOnlineForDatabase);
        })
        .catch((e) => {
          // Silently handle Realtime Database rules/permission restrictions
          console.log('RTDB presence listener notice:', e?.message || e);
        });
    });

    return unsubscribe;
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
    const userStatusRef = ref(rtdb, `/status/${userId}`);
    const unsubscribe = onValue(
      userStatusRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          callback(data.state === 'online', data.last_changed);
        } else {
          callback(false);
        }
      },
      (error) => {
        console.log('RTDB subscribe error notice:', error?.message || error);
        callback(false);
      }
    );

    return unsubscribe;
  } catch (e) {
    return () => {};
  }
}
