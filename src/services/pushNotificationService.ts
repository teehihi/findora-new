import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

let NotificationsModule: any = null;
try {
  NotificationsModule = require('expo-notifications');
} catch (e) {
  console.log('Notice: expo-notifications not loaded in pushNotificationService:', e);
}

/**
 * Register current device's push token with Firestore user profile
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  if (Platform.OS === 'web' || !NotificationsModule || !userId) return null;

  try {
    if (typeof NotificationsModule.getPermissionsAsync === 'function') {
      const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted' && typeof NotificationsModule.requestPermissionsAsync === 'function') {
        const { status } = await NotificationsModule.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return null;
      }
    }

    let token: string | null = null;
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      'findora-138a7';

    if (typeof NotificationsModule.getExpoPushTokenAsync === 'function') {
      try {
        const tokenData = await NotificationsModule.getExpoPushTokenAsync({ projectId });
        token = tokenData?.data || null;
      } catch (expoErr) {
        console.log('Notice: Could not obtain Expo push token, trying device token:', expoErr);
      }
    }

    if (!token && typeof NotificationsModule.getDevicePushTokenAsync === 'function') {
      try {
        const deviceTokenData = await NotificationsModule.getDevicePushTokenAsync();
        token = deviceTokenData?.data || null;
      } catch (devErr) {
        console.log('Notice: Could not obtain device push token:', devErr);
      }
    }

    if (token) {
      console.log('[PUSH_TOKEN] Registered token successfully:', token);
      await updateDoc(doc(db, 'users', userId), {
        pushToken: token,
        fcmToken: token,
        pushTokenUpdatedAt: new Date().toISOString(),
      }).catch((err) => {
        console.log('Notice: Could not save push token to user doc:', err);
      });
      return token;
    }
  } catch (error) {
    console.log('Notice: Register push token notice:', error);
  }
  return null;
}

/**
 * Send remote push notification to another user's device via Expo Push Notification API
 * Automatically wakes up device & delivers heads-up notification in background / killed state!
 */
export async function sendRemotePushNotification({
  targetUserId,
  title,
  body,
  data = {},
  type = 'chat'
}: {
  targetUserId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  type?: 'chat' | 'comment' | 'like' | 'match' | 'points' | 'resolve' | 'system';
}): Promise<void> {
  if (!targetUserId) return;

  try {
    // 1. Fetch recipient's push token from Firestore
    const userDoc = await getDoc(doc(db, 'users', targetUserId));
    if (!userDoc.exists()) return;

    const userData = userDoc.data();
    const pushToken = userData?.pushToken || userData?.fcmToken;
    if (!pushToken) {
      console.log(`[PUSH] User ${targetUserId} has no pushToken`);
      return;
    }

    // 2. Select appropriate sound & channel based on notification type
    const isChat = type === 'chat';
    const soundFile = isChat ? 'chat_noti_sound.mp3' : 'sound_noti.mp3';
    const channelId = isChat ? 'messages' : 'general';

    // 3. Post to Expo Push Notification Service
    const messagePayload = {
      to: pushToken,
      sound: soundFile,
      title: title,
      body: body,
      data: {
        ...data,
        type,
      },
      channelId: channelId,
      priority: 'high',
      badge: 1,
      _displayInForeground: true
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const resJson = await response.json();
    console.log('[PUSH_SENT] Push response:', resJson);
  } catch (error) {
    console.log('Notice: sendRemotePushNotification notice:', error);
  }
}
