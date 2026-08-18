import { Platform } from 'react-native';
import { playSoundEffect } from './soundService';

// Safely obtain expo-notifications without crashing module load if native module is unlinked
let NotificationsModule: any = null;
try {
  NotificationsModule = require('expo-notifications');
} catch (e) {
  console.log('Notice: expo-notifications native module not linked:', e);
}

let isHandlerConfigured = false;

/**
 * Initialize Android notification channels with high priority & custom sounds
 * and request notification permissions on iOS and Android
 */
export async function initializeDeviceNotifications(): Promise<boolean> {
  if (Platform.OS === 'web' || !NotificationsModule) return false;

  try {
    // 1. Configure foreground notification presentation handler safely inside initialization
    if (!isHandlerConfigured && typeof NotificationsModule.setNotificationHandler === 'function') {
      NotificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      isHandlerConfigured = true;
    }

    if (Platform.OS === 'android' && typeof NotificationsModule.setNotificationChannelAsync === 'function') {
      // Channel 1: Messages (Chat incoming)
      await NotificationsModule.setNotificationChannelAsync('messages', {
        name: 'Tin nhắn',
        importance: NotificationsModule.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
        showBadge: true,
      });

      // Channel 2: General Notifications (AI Match, Like, Comment, Points, System)
      await NotificationsModule.setNotificationChannelAsync('general', {
        name: 'Thông báo chung',
        importance: NotificationsModule.AndroidImportance?.HIGH ?? 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
        showBadge: true,
      });
    }

    if (typeof NotificationsModule.getPermissionsAsync === 'function') {
      const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted' && typeof NotificationsModule.requestPermissionsAsync === 'function') {
        const { status } = await NotificationsModule.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    }

    return true;
  } catch (error) {
    console.log('Notice: Device notifications init notice:', error);
    return false;
  }
}

/**
 * Trigger heads-up banner notification on the device with sound
 */
export async function triggerDeviceNotification({
  title,
  body,
  data = {},
  type = 'system',
}: {
  title: string;
  body: string;
  data?: Record<string, any>;
  type?: 'chat' | 'comment' | 'like' | 'match' | 'points' | 'resolve' | 'system';
}): Promise<void> {
  try {
    // 1. Play in-app audio cue
    if (type === 'chat') {
      playSoundEffect('chatNotification');
    } else {
      playSoundEffect('generalNotification');
    }

    if (Platform.OS === 'web' || !NotificationsModule) return;

    // 2. Schedule immediate system notification
    if (typeof NotificationsModule.scheduleNotificationAsync === 'function') {
      await NotificationsModule.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            ...data,
            type,
          },
          sound: true,
          priority: NotificationsModule.AndroidNotificationPriority?.MAX ?? 'max',
        },
        trigger: null, // show immediately
      });
    }
  } catch (error) {
    console.log('Notice: Trigger device notification notice:', error);
  }
}
