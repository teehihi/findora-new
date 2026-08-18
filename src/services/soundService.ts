import { Platform } from 'react-native';

// Audio module loaded safely
let createAudioPlayerFn: any = null;
try {
  const expoAudio = require('expo-audio');
  createAudioPlayerFn = expoAudio?.createAudioPlayer;
} catch (e) {
  console.log('Notice: expo-audio module not loaded in current environment:', e);
}

// Pre-load audio sources from original Findora app
const SOUND_SOURCES = {
  chatNotification: require('../../assets/sounds/chat_noti_sound.mp3'),
  generalNotification: require('../../assets/sounds/sound_noti.mp3'),
  chatSend: require('../../assets/sounds/chat_send_sound.mp3'),
  like: require('../../assets/sounds/like_sound_x2.mp3'),
};

export type SoundEffect = keyof typeof SOUND_SOURCES;

/**
 * Play app sound effects (chat send, like, incoming notification)
 */
export async function playSoundEffect(effect: SoundEffect): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    if (typeof createAudioPlayerFn !== 'function') return;
    const source = SOUND_SOURCES[effect];
    if (!source) return;
    const player = createAudioPlayerFn(source);
    if (player && typeof player.play === 'function') {
      player.play();
    }
  } catch (error) {
    // Graceful fallback if audio engine is busy, in silent mode, or unlinked
    console.log('Audio playback notice:', error);
  }
}
