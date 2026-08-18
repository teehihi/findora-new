import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { playSoundEffect } from './soundService';

// Configure foreground notification presentation handler for Expo SDK 57
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Initialize Android notification channels with high priority & custom sounds
 * and request notification permissions on iOS and Android
 */
export async function initializeDeviceNotifications(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      // Channel 1: Messages (Chat incoming)
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Tin nhắn',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
        showBadge: true,
        sound: 'chat_noti_sound',
      });

      // Channel 2: General Notifications (AI Match, Like, Comment, Points, System)
      await Notifications.setNotificationChannelAsync('general', {
        name: 'Thông báo chung',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
        showBadge: true,
        sound: 'sound_noti',
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
    console.log('Error initializing device notifications:', error);
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
    console.log('Error triggering device notification:', error);
  }
}
