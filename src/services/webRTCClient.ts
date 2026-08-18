import { NativeModules } from 'react-native';
import { SerializedCandidate } from '../models/callTypes';

function getWebRTCModule(): any {
  if (!NativeModules.WebRTCModule) {
    throw new Error('react-native-webrtc native module is not compiled in the current Android build APK.');
  }
  return require('react-native-webrtc');
}

const rtcConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:a.relay.metered.ca:443?transport=tcp',
      username: '83eebabf8b4cce9d5dbcb649',
      credential: '2D7JvfkOQtBdYW3R',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 2,
};

function candidateKey(candidate: SerializedCandidate): string {
  return [
    candidate.candidate,
    candidate.sdpMid ?? '',
    candidate.sdpMLineIndex ?? '',
  ].join('|');
}

export type WebRTCClientEvents = {
  onIceCandidate?: (candidate: SerializedCandidate) => void;
  onRemoteStream?: (stream: any) => void;
  onConnectionStateChange?: (state: string) => void;
  onError?: (error: unknown) => void;
};

export class WebRTCClient {
  private pc: any = null;
  private localStream: any = null;
  private remoteStream: any = null;
  private isDestroyed = false;
  private remoteDescriptionSet = false;
  private pendingRemoteCandidates: SerializedCandidate[] = [];
  private appliedCandidateKeys = new Set<string>();
  private events: WebRTCClientEvents;

  constructor(events: WebRTCClientEvents) {
    this.events = events;
  }

  private log(event: string, details?: any) {
    console.log(`[WebRTCClient:${event}]`, {
      time: new Date().toISOString(),
      ...details,
    });
  }

  async initializeAudioStream(): Promise<any> {
    if (this.isDestroyed) return;

    let webrtcModule: any;
    try {
      webrtcModule = getWebRTCModule();
    } catch (e) {
      throw new Error('react-native-webrtc module is missing from current build.');
    }

    const { RTCPeerConnection, mediaDevices } = webrtcModule;
    if (!RTCPeerConnection || !mediaDevices?.getUserMedia) {
      throw new Error('WebRTC native APIs are unavailable.');
    }

    this.log('INIT_PEER_CONNECTION');
    const pc = new RTCPeerConnection(rtcConfiguration);
    this.pc = pc;

    try {
      this.log('GET_USER_MEDIA');
      let stream: any;
      try {
        stream = await mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
      } catch (videoErr) {
        this.log('GET_USER_MEDIA_AUDIO_ONLY_FALLBACK', { error: videoErr });
        stream = await mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }

      if (this.isDestroyed) {
        stream.getTracks().forEach((track: any) => track.stop());
        return;
      }

      this.localStream = stream;
      stream.getTracks().forEach((track: any) => {
        pc.addTrack(track, stream);
      });
      this.log('LOCAL_MEDIA_ADDED', { tracksCount: stream.getTracks()?.length });
    } catch (err) {
      this.log('GET_USER_MEDIA_ERROR', { error: err });
    }

    // ICE Candidate Callback
    pc.onicecandidate = (event: any) => {
      if (this.isDestroyed || !event?.candidate) return;
      const cand = typeof event.candidate.toJSON === 'function' ? event.candidate.toJSON() : event.candidate;
      if (!cand?.candidate) return;

      const serialized: SerializedCandidate = {
        candidate: cand.candidate,
        sdpMid: cand.sdpMid ?? undefined,
        sdpMLineIndex: cand.sdpMLineIndex ?? undefined,
      };

      this.log('ICE_CANDIDATE_GENERATED', { key: candidateKey(serialized) });
      this.events.onIceCandidate?.(serialized);
    };

    // Remote Track Callback
    pc.ontrack = (event: any) => {
      if (this.isDestroyed) return;
      this.log('REMOTE_TRACK', { kind: event.track?.kind, readyState: event.track?.readyState });

      if (event.streams?.[0]) {
        this.remoteStream = event.streams[0];
      } else if (event.track) {
        try {
          const { MediaStream } = getWebRTCModule();
          if (!this.remoteStream || typeof this.remoteStream.addTrack !== 'function') {
            this.remoteStream = new MediaStream([event.track]);
          } else {
            // Add track to existing remoteStream
            try {
              this.remoteStream.addTrack(event.track);
            } catch (addErr) {
              this.remoteStream = new MediaStream([event.track]);
            }
          }
        } catch (e) {
          if (!this.remoteStream) {
            this.remoteStream = {
              getTracks: () => [event.track],
              getAudioTracks: () => (event.track?.kind === 'audio' ? [event.track] : []),
              getVideoTracks: () => (event.track?.kind === 'video' ? [event.track] : []),
            };
          }
        }
      }
      this.events.onRemoteStream?.(this.remoteStream);
    };

    // Connection State Changes
    const handleStateChange = () => {
      if (this.isDestroyed) return;
      const connectionState = pc.connectionState;
      const iceConnectionState = pc.iceConnectionState;
      const iceGatheringState = pc.iceGatheringState;
      const signalingState = pc.signalingState;

      console.log('[CALL_TRACE:PEER_CONNECTION_STATE]', {
        signalingState,
        iceGatheringState,
        iceConnectionState,
        connectionState,
        localAudioTracks: this.localStream?.getAudioTracks?.()?.map((t: any) => ({
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted,
        })),
        remoteAudioTracks: this.remoteStream?.getAudioTracks?.()?.map((t: any) => ({
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted,
        })),
      });

      this.events.onConnectionStateChange?.(connectionState || iceConnectionState);
    };

    pc.onconnectionstatechange = handleStateChange;
    pc.oniceconnectionstatechange = handleStateChange;

    return this.localStream;
  }

  async createOffer(): Promise<{ sdp: string; type: string }> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    this.log('CREATE_OFFER');

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc.setLocalDescription(offer);
    this.log('LOCAL_OFFER_SET', { signalingState: this.pc.signalingState });
    return { sdp: offer.sdp, type: offer.type };
  }

  async createAnswer(): Promise<{ sdp: string; type: string }> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    this.log('CREATE_ANSWER');

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.log('LOCAL_ANSWER_SET', { signalingState: this.pc.signalingState });
    return { sdp: answer.sdp, type: answer.type };
  }

  async setRemoteDescription(sdpPayload: { sdp: string; type: string }): Promise<void> {
    if (!this.pc || this.remoteDescriptionSet) return;
    this.log('SET_REMOTE_DESCRIPTION', { type: sdpPayload.type });

    const webrtcModule = getWebRTCModule();
    const { RTCSessionDescription, RTCIceCandidate } = webrtcModule;

    await this.pc.setRemoteDescription(new RTCSessionDescription(sdpPayload));
    this.remoteDescriptionSet = true;
    this.log('REMOTE_DESCRIPTION_SET_SUCCESS', { signalingState: this.pc.signalingState });

    // Flush pending remote candidates
    const candidates = [...this.pendingRemoteCandidates];
    this.pendingRemoteCandidates = [];
    this.log('FLUSH_REMOTE_CANDIDATES', { count: candidates.length });
    for (const cand of candidates) {
      await this.addIceCandidate(cand, RTCIceCandidate);
    }
  }

  async addIceCandidate(candidate: SerializedCandidate, RTCIceCandidateClass?: any): Promise<void> {
    if (!this.pc) return;
    if (!this.remoteDescriptionSet) {
      this.log('BUFFERING_REMOTE_CANDIDATE', { candidateKey: candidateKey(candidate) });
      this.pendingRemoteCandidates.push(candidate);
      return;
    }

    try {
      const cls = RTCIceCandidateClass || getWebRTCModule().RTCIceCandidate;
      await this.pc.addIceCandidate(new cls(candidate));
      this.log('ADD_ICE_SUCCESS', { key: candidateKey(candidate) });
    } catch (err) {
      this.log('ADD_ICE_ERROR', { error: err });
    }
  }

  get LocalStream(): any {
    return this.localStream;
  }

  get RemoteStream(): any {
    return this.remoteStream;
  }

  get ConnectionState(): string {
    return this.pc?.connectionState || 'new';
  }

  get IceConnectionState(): string {
    return this.pc?.iceConnectionState || 'new';
  }

  get RemoteStream(): any {
    return this.remoteStream;
  }

  setMicrophoneMuted(muted: boolean): void {
    this.localStream?.getAudioTracks?.()?.forEach((track: any) => {
      track.enabled = !muted;
    });
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.log('DESTROY_WEBRTC_CLIENT');

    if (this.localStream?.getTracks) {
      this.localStream.getTracks().forEach((t: any) => t.stop());
    }
    if (this.remoteStream?.getTracks) {
      this.remoteStream.getTracks().forEach((t: any) => t.stop());
    }

    if (this.pc) {
      try {
        this.pc.onicecandidate = null;
        this.pc.ontrack = null;
        this.pc.onconnectionstatechange = null;
        this.pc.oniceconnectionstatechange = null;
        this.pc.close();
      } catch {}
      this.pc = null;
    }

    this.localStream = null;
    this.remoteStream = null;
  }
}
