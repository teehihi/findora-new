// Safe loader for expo-av native module
let AudioModule: any = null;
try {
  AudioModule = require('expo-av').Audio;
} catch (e) {
  console.log('Notice: expo-av native module not linked in current build bundle:', e);
}

let ringingSound: any = null;

const OUTGOING_RING_URL = 'https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3';
const INCOMING_RING_URL = 'https://assets.mixkit.co/active_storage/sfx/1361/1361-preview.mp3';
const CALL_CONNECTED_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
const CALL_ENDED_URL = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';

export async function configureAudioSession() {
  if (!AudioModule) return;
  try {
    await AudioModule.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {
    console.log('Audio mode config error:', e);
  }
}

export async function playOutgoingRing() {
  if (!AudioModule) return;
  try {
    await stopAllRingtones();
    await configureAudioSession();

    const { sound } = await AudioModule.Sound.createAsync(
      { uri: OUTGOING_RING_URL },
      { shouldPlay: true, isLooping: true, volume: 0.8 }
    );
    ringingSound = sound;
  } catch (e) {
    console.log('Error playing outgoing ring:', e);
  }
}

export async function playIncomingRing() {
  if (!AudioModule) return;
  try {
    await stopAllRingtones();
    await configureAudioSession();

    const { sound } = await AudioModule.Sound.createAsync(
      { uri: INCOMING_RING_URL },
      { shouldPlay: true, isLooping: true, volume: 1.0 }
    );
    ringingSound = sound;
  } catch (e) {
    console.log('Error playing incoming ring:', e);
  }
}

export async function playConnectedTone() {
  if (!AudioModule) return;
  try {
    await stopAllRingtones();
    const { sound } = await AudioModule.Sound.createAsync(
      { uri: CALL_CONNECTED_URL },
      { shouldPlay: true, isLooping: false, volume: 0.9 }
    );
    setTimeout(() => {
      sound.unloadAsync().catch(() => {});
    }, 2000);
  } catch (e) {
    console.log('Error playing connected tone:', e);
  }
}

export async function playEndCallTone() {
  if (!AudioModule) return;
  try {
    await stopAllRingtones();
    const { sound } = await AudioModule.Sound.createAsync(
      { uri: CALL_ENDED_URL },
      { shouldPlay: true, isLooping: false, volume: 0.9 }
    );
    setTimeout(() => {
      sound.unloadAsync().catch(() => {});
    }, 1500);
  } catch (e) {
    console.log('Error playing end call tone:', e);
  }
}

export async function stopAllRingtones() {
  if (!AudioModule || !ringingSound) return;
  try {
    await ringingSound.stopAsync().catch(() => {});
    await ringingSound.unloadAsync().catch(() => {});
    ringingSound = null;
  } catch (e) {
    console.log('Error stopping ringtones:', e);
  }
}

export async function toggleSpeakerphone(enable: boolean) {
  if (!AudioModule) return;
  try {
    await AudioModule.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: !enable,
    });
  } catch (e) {
    console.log('Error toggling speakerphone:', e);
  }
}
