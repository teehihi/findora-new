import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { 
  initializeDeviceNotifications, 
  triggerDeviceNotification 
} from '../services/deviceNotificationService';

export function GlobalNotificationListener() {
  const router = useRouter();
  const seenNotifIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // 1. Initialize notification channels & request permissions
    initializeDeviceNotifications();

    // 2. Listen to notification click events from system tray safely
    let responseSubscription: any = null;
    try {
      responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (!data) return;

        if (data.type === 'chat' && data.senderId) {
          router.push(`/chat/${data.senderId}`);
        } else if (data.postId) {
          router.push(`/post/${data.postId}`);
        } else if (data.senderId) {
          router.push(`/chat/${data.senderId}`);
        } else {
          router.push('/(tabs)/notifications');
        }
      });
    } catch (e) {
      console.log('Notice: Notifications response listener notice:', e);
    }

    return () => {
      try {
        if (responseSubscription && typeof responseSubscription.remove === 'function') {
          responseSubscription.remove();
        }
      } catch (err) {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 3. Realtime listener on Firestore notifications collection (matching native FirebaseMessagingService.java)
    let unsubscribe: (() => void) | null = null;
    try {
      const notifRef = collection(db, 'notifications');
      const q = query(
        notifRef,
        where('userId', '==', user.uid),
        where('read', '==', false)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const docId = change.doc.id;
            const data = change.doc.data();

            if (change.type === 'added') {
              // Populate seen on first snapshot without spamming notifications
              if (isFirstLoad.current) {
                seenNotifIds.current.add(docId);
              } else if (!seenNotifIds.current.has(docId)) {
                seenNotifIds.current.add(docId);

                const type = data.type || 'system';
                const title = data.title || 'Findora';
                const body = data.message || data.body || '';

                triggerDeviceNotification({
                  title,
                  body,
                  data: {
                    ...data,
                    id: docId,
                  },
                  type,
                });
              }
            }
          });

          if (isFirstLoad.current) {
            isFirstLoad.current = false;
          }
        },
        (error) => {
          console.log('Notice: Notification realtime listener notice:', error);
        }
      );
    } catch (err) {
      console.log('Notice: Setting up notifications listener notice:', err);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [auth.currentUser?.uid]);

  return null;
}
