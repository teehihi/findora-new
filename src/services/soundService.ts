import { createAudioPlayer } from 'expo-audio';

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
  try {
    const source = SOUND_SOURCES[effect];
    if (!source) return;
    const player = createAudioPlayer(source);
    player.play();
  } catch (error) {
    // Graceful fallback if audio engine is busy or in silent mode
    console.log('Audio playback notice:', error);
  }
}
