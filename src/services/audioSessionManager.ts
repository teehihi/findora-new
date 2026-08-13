import {
  configureAudioSession,
  playConnectedTone,
  playEndCallTone,
  playIncomingRing,
  playOutgoingRing,
  stopAllCallAudio,
} from './voiceCallService';

class AudioSessionManager {
  private isMuted = false;
  private isSpeaker = false;

  async setupAudioForCall(): Promise<void> {
    console.log('[AudioSessionManager] SETUP_CALL_AUDIO');
    await configureAudioSession(false);
  }

  playOutgoingRingTone(): void {
    console.log('[AudioSessionManager] PLAY_OUTGOING_RING');
    playOutgoingRing();
  }

  playIncomingRingTone(): void {
    console.log('[AudioSessionManager] PLAY_INCOMING_RING');
    playIncomingRing();
  }

  playConnectedTone(): void {
    console.log('[AudioSessionManager] PLAY_CONNECTED_TONE');
    playConnectedTone();
  }

  playEndCallTone(): void {
    console.log('[AudioSessionManager] PLAY_END_TONE');
    playEndCallTone();
  }

  stopRingtones(): void {
    console.log('[AudioSessionManager] STOP_AUDIO');
    stopAllCallAudio();
  }

  async setSpeakerphone(speaker: boolean): Promise<void> {
    this.isSpeaker = speaker;
    console.log('[AudioSessionManager] TOGGLE_SPEAKER', { speaker });
    await configureAudioSession(speaker);
  }

  cleanup(): void {
    console.log('[AudioSessionManager] CLEANUP');
    this.isMuted = false;
    this.isSpeaker = false;
    stopAllCallAudio();
  }
}

export const audioSessionManager = new AudioSessionManager();
