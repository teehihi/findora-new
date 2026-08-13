let AudioModule: any = null;
try {
  AudioModule = require('expo-audio');
} catch (e) {
  console.log('Notice: expo-audio native module not linked in current build bundle:', e);
}

let ringingPlayer: any = null;
const transientPlayers = new Set<any>();

const OUTGOING_RING_URL = 'https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3';
const INCOMING_RING_URL = 'https://assets.mixkit.co/active_storage/sfx/1361/1361-preview.mp3';
const CALL_CONNECTED_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
const CALL_ENDED_URL = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';

export async function configureAudioSession(routeThroughEarpiece = false) {
  if (!AudioModule) return;
  try {
    await AudioModule.setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: routeThroughEarpiece,
    });
  } catch (e) {
    console.log('Audio mode config error:', e);
  }
}

export async function ensureMicrophonePermission() {
  if (!AudioModule) return true;
  try {
    if (AudioModule.getRecordingPermissionsAsync) {
      const current = await AudioModule.getRecordingPermissionsAsync();
      if (current?.granted) return true;
    }
    if (AudioModule.requestRecordingPermissionsAsync) {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      return !!permission?.granted;
    }
    return true;
  } catch (e) {
    console.log('Microphone permission error:', e);
    return false;
  }
}

async function playLoopingRing(uri: string, volume: number) {
  if (!AudioModule?.createAudioPlayer) return;
  try {
    await stopAllRingtones();
    await configureAudioSession(false);

    const player = AudioModule.createAudioPlayer({ uri });
    player.loop = true;
    player.volume = volume;
    player.play();
    ringingPlayer = player;
  } catch (e) {
    console.log('Error playing ringtone:', e);
  }
}

export async function playOutgoingRing() {
  await playLoopingRing(OUTGOING_RING_URL, 0.8);
}

export async function playIncomingRing() {
  await playLoopingRing(INCOMING_RING_URL, 1.0);
}

async function playTransientTone(uri: string, volume: number, releaseAfterMs: number) {
  if (!AudioModule?.createAudioPlayer) return;
  try {
    await stopAllRingtones();
    const player = AudioModule.createAudioPlayer({ uri });
    transientPlayers.add(player);
    player.loop = false;
    player.volume = volume;
    player.play();

    setTimeout(() => {
      try {
        player.pause?.();
        player.remove?.();
      } catch {}
      transientPlayers.delete(player);
    }, releaseAfterMs);
  } catch (e) {
    console.log('Error playing call tone:', e);
  }
}

export async function playConnectedTone() {
  await playTransientTone(CALL_CONNECTED_URL, 0.9, 2000);
}

export async function playEndCallTone() {
  await playTransientTone(CALL_ENDED_URL, 0.9, 1500);
}

export async function stopAllRingtones() {
  try {
    if (ringingPlayer) {
      ringingPlayer.pause?.();
      ringingPlayer.remove?.();
      ringingPlayer = null;
    }
  } catch (e) {
    console.log('Error stopping ringtone:', e);
  }
}

export async function stopAllCallAudio() {
  await stopAllRingtones();
  transientPlayers.forEach((player) => {
    try {
      player.pause?.();
      player.remove?.();
    } catch {}
  });
  transientPlayers.clear();
}

export async function toggleSpeakerphone(enable: boolean) {
  await configureAudioSession(!enable);
}
