import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { playSoundEffect } from './soundService';

let isHandlerConfigured = false;

/**
 * Initialize Android notification channels with high priority & custom sounds
 * and request notification permissions on iOS and Android
 */
export async function initializeDeviceNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    // 1. Configure foreground notification presentation handler safely inside initialization
    if (!isHandlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      isHandlerConfigured = true;
    }

    if (Platform.OS === 'android') {
      // Channel 1: Messages (Chat incoming)
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Tin nhắn',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
        showBadge: true,
      });

      // Channel 2: General Notifications (AI Match, Like, Comment, Points, System)
      await Notifications.setNotificationChannelAsync('general', {
        name: 'Thông báo chung',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
        showBadge: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
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

    if (Platform.OS === 'web') return;

    // 2. Schedule immediate system notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          ...data,
          type,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, // show immediately
    });
  } catch (error) {
    console.log('Notice: Trigger device notification notice:', error);
  }
}
