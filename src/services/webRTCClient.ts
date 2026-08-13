import { SerializedCandidate } from '../models/callTypes';

const rtcConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:global.relay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
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
      webrtcModule = require('react-native-webrtc');
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

    // Obtain microphone audio stream
    const stream = await mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    if (this.isDestroyed) {
      stream.getTracks().forEach((track: any) => track.stop());
      return;
    }

    this.localStream = stream;
    stream.getTracks().forEach((track: any) => {
      pc.addTrack(track, stream);
    });

    // ICE Candidate Callback
    pc.onicecandidate = (event: any) => {
      if (this.isDestroyed || !event?.candidate) return;
      const cand = typeof event.candidate.toJSON === 'function' ? event.candidate.toJSON() : event.candidate;
      if (!cand?.candidate) return;

      const serialized: SerializedCandidate = {
        candidate: cand.candidate,
        sdpMid: cand.sdpMid ?? null,
        sdpMLineIndex: cand.sdpMLineIndex ?? null,
        usernameFragment: cand.usernameFragment ?? null,
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
        this.remoteStream = { getTracks: () => [event.track] };
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

    return stream;
  }

  async createOffer(): Promise<{ sdp: string; type: string }> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    this.log('CREATE_OFFER');

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
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

    const webrtcModule = require('react-native-webrtc');
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
    if (this.isDestroyed || !this.pc) return;

    if (!this.remoteDescriptionSet) {
      this.pendingRemoteCandidates.push(candidate);
      this.log('BUFFERED_REMOTE_CANDIDATE', { candidateKey: candidateKey(candidate) });
      return;
    }

    const key = candidateKey(candidate);
    if (this.appliedCandidateKeys.has(key)) return;

    this.appliedCandidateKeys.add(key);
    try {
      const CandidateClass = RTCIceCandidateClass || require('react-native-webrtc').RTCIceCandidate;
      await this.pc.addIceCandidate(new CandidateClass(candidate));
      this.log('ADD_ICE_SUCCESS', { key });
    } catch (e) {
      this.log('ADD_ICE_ERROR', { key, error: e });
    }
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
