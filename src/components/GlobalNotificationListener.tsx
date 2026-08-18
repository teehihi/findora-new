import React, { useEffect, useRef } from 'react';
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
    // 1. Initialize notification channels & request permissions
    initializeDeviceNotifications();

    // 2. Listen to notification click events from system tray
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
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

    return () => {
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 3. Realtime listener on Firestore notifications collection (matching native FirebaseMessagingService.java)
    const notifRef = collection(db, 'notifications');
    const q = query(
      notifRef,
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(
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

    return () => {
      unsubscribe();
    };
  }, [auth.currentUser?.uid]);

  return null;
}
