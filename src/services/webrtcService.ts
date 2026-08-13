import {
  arrayUnion,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { CallStatus, SerializedCandidate } from '../models/callTypes';
import {
  configureAudioSession,
  ensureMicrophonePermission,
  playConnectedTone,
  playEndCallTone,
  playIncomingRing,
  playOutgoingRing,
  stopAllCallAudio,
} from './voiceCallService';

export type WebRTCCallOptions = {
  callId: string;
  chatId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  isCaller: boolean;
  onStatusChange?: (status: CallStatus) => void;
  onRemoteStream?: (stream: any) => void;
  onError?: (error: unknown) => void;
};

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

function serializeCandidate(candidate: any): SerializedCandidate | null {
  if (!candidate) return null;
  const payload = typeof candidate.toJSON === 'function' ? candidate.toJSON() : candidate;
  if (!payload?.candidate) return null;

  return {
    candidate: payload.candidate,
    sdpMid: payload.sdpMid ?? null,
    sdpMLineIndex: payload.sdpMLineIndex ?? null,
    usernameFragment: payload.usernameFragment ?? null,
  };
}

function candidateKey(candidate: SerializedCandidate): string {
  return [
    candidate.candidate,
    candidate.sdpMid ?? '',
    candidate.sdpMLineIndex ?? '',
  ].join('|');
}

let sessionCounter = 0;

class WebRTCSession {
  readonly instanceId: number;
  readonly callId: string;
  readonly chatId: string;
  readonly callerId: string;
  readonly receiverId: string;
  readonly isCaller: boolean;
  readonly options: WebRTCCallOptions;

  private pc: any = null;
  private localStream: any = null;
  private remoteStream: any = null;
  private signalingUnsubscribe: Unsubscribe | null = null;
  private remoteDescriptionSet = false;
  private isDestroyed = false;
  private pendingRemoteCandidates: SerializedCandidate[] = [];
  private appliedCandidateKeys = new Set<string>();
  private currentStatus: CallStatus = 'IDLE';
  private connectedMarked = false;

  // ICE Candidate Batching Buffer
  private pendingLocalCandidates: SerializedCandidate[] = [];
  private candidateFlushTimer: any = null;

  constructor(options: WebRTCCallOptions) {
    sessionCounter += 1;
    this.instanceId = sessionCounter;
    this.callId = options.callId;
    this.chatId = options.chatId;
    this.callerId = options.callerId;
    this.receiverId = options.receiverId;
    this.isCaller = options.isCaller;
    this.options = options;

    this.trace('WEBRTC_SESSION_CREATE', { instanceId: this.instanceId });
  }

  private trace(phase: string, details?: any) {
    console.log(`[CALL_TRACE] phase=${phase}`, {
      callId: this.callId,
      instanceId: this.instanceId,
      side: this.isCaller ? 'caller' : 'callee',
      status: this.currentStatus,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  setStatus(status: CallStatus) {
    if (this.isDestroyed || this.currentStatus === status) return;
    this.currentStatus = status;
    this.trace('STATE_CHANGE', { newStatus: status });
    this.options.onStatusChange?.(status);

    if (status === 'RINGING') {
      if (this.isCaller) playOutgoingRing();
      else playIncomingRing();
    } else if (status === 'CONNECTED') {
      playConnectedTone();
    } else if (status === 'ENDED' || status === 'REJECTED' || status === 'CANCELLED' || status === 'FAILED') {
      playEndCallTone();
    }
  }

  private queueLocalCandidate(candidate: SerializedCandidate) {
    if (this.isDestroyed) return;
    this.pendingLocalCandidates.push(candidate);
    this.trace('ICE_QUEUED_LOCAL', { count: this.pendingLocalCandidates.length, candidateKey: candidateKey(candidate) });

    if (this.candidateFlushTimer) clearTimeout(this.candidateFlushTimer);
    this.candidateFlushTimer = setTimeout(() => {
      this.flushLocalCandidates();
    }, 300);
  }

  private async flushLocalCandidates() {
    if (this.isDestroyed || this.pendingLocalCandidates.length === 0) return;
    const candidatesToFlush = [...this.pendingLocalCandidates];
    this.pendingLocalCandidates = [];

    const localCandidatesKey = this.isCaller ? 'callState.callerCandidates' : 'callState.receiverCandidates';
    this.trace('ICE_FLUSH_START', { count: candidatesToFlush.length });

    try {
      await updateDoc(doc(db, 'chats', this.chatId), {
        [localCandidatesKey]: arrayUnion(...candidatesToFlush),
        'callState.updatedAt': serverTimestamp(),
      });
      this.trace('ICE_FLUSH_DONE', { count: candidatesToFlush.length });
    } catch (err) {
      this.trace('ICE_FLUSH_ERROR', { error: err });
    }
  }

  async startSession() {
    this.trace('START_CALL', { callerId: this.callerId, calleeId: this.receiverId });

    try {
      let webrtcModule: any;
      try {
        webrtcModule = require('react-native-webrtc');
      } catch (e) {
        throw new Error('react-native-webrtc native module is not available in current build.');
      }

      const {
        RTCPeerConnection,
        RTCSessionDescription,
        RTCIceCandidate,
        mediaDevices,
      } = webrtcModule;

      if (!RTCPeerConnection || !mediaDevices?.getUserMedia) {
        throw new Error('WebRTC native APIs are unavailable.');
      }

      const hasMic = await ensureMicrophonePermission();
      if (!hasMic) {
        this.trace('MIC_PERMISSION_DENIED');
        throw new Error('Quyền Microphone chưa được cấp.');
      }

      await configureAudioSession(false);

      // Create PeerConnection instance bound immutably to this session
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

      const remoteCandidatesKey = this.isCaller ? 'receiverCandidates' : 'callerCandidates';

      // ICE Candidate Handler
      pc.onicecandidate = (event: any) => {
        if (this.isDestroyed || !event?.candidate) return;
        const candidate = serializeCandidate(event.candidate);
        if (!candidate) return;
        this.queueLocalCandidate(candidate);
      };

      // Remote Track Handler
      pc.ontrack = (event: any) => {
        if (this.isDestroyed) return;
        this.trace('REMOTE_TRACK', {
          kind: event.track?.kind,
          trackId: event.track?.id,
          enabled: event.track?.enabled,
          readyState: event.track?.readyState,
        });

        if (event.streams?.[0]) {
          this.remoteStream = event.streams[0];
        } else if (event.track) {
          this.remoteStream = { getTracks: () => [event.track] };
        }
        this.options.onRemoteStream?.(this.remoteStream);
        this.checkAndMarkConnected();
      };

      // Connection State Handler
      const handleConnectionStateChange = () => {
        if (this.isDestroyed) return;
        const connectionState = pc.connectionState;
        const iceState = pc.iceConnectionState;

        this.trace('PEER_CONNECTION_STATE', {
          connectionState,
          iceState,
          signalingState: pc.signalingState,
        });

        if (connectionState === 'connecting' || iceState === 'checking') {
          this.setStatus('CONNECTING');
        }

        if (connectionState === 'failed' || iceState === 'failed') {
          this.trace('WEBRTC_ERROR', { phase: 'CONNECTION_FAILED', connectionState, iceState });
          this.setStatus('FAILED');
          this.destroy('failed');
        }

        this.checkAndMarkConnected();
      };

      pc.onconnectionstatechange = handleConnectionStateChange;
      pc.oniceconnectionstatechange = handleConnectionStateChange;

      // Subscribe to real-time chat callState document
      const chatDocRef = doc(db, 'chats', this.chatId);
      this.signalingUnsubscribe = onSnapshot(chatDocRef, async (snapshot) => {
        if (this.isDestroyed || !snapshot.exists()) return;
        const chatData = snapshot.data();
        const data = chatData.callState || {};

        // Ignore events from older or mismatched call attempts
        if (data.callId && data.callId !== this.callId) return;

        this.trace('SIGNALING_EVENT', { status: data.status, callId: data.callId });

        // Handle Status Transitions from Remote
        if (data.status === 'cancelled') {
          this.setStatus('CANCELLED');
          this.destroy();
          return;
        }
        if (data.status === 'rejected') {
          this.setStatus('REJECTED');
          this.destroy();
          return;
        }
        if (data.status === 'ended') {
          this.setStatus('ENDED');
          this.destroy();
          return;
        }
        if (data.status === 'failed') {
          this.setStatus('FAILED');
          this.destroy();
          return;
        }

        if (this.isCaller && data.status === 'accepted' && this.currentStatus === 'RINGING') {
          this.setStatus('CONNECTING');
        }

        // Caller: Process SDP Answer cleanly
        if (
          this.isCaller &&
          data.sdpAnswer &&
          data.sdpAnswer.sdp &&
          !this.remoteDescriptionSet
        ) {
          try {
            if (this.pc && (this.pc.signalingState === 'have-local-offer' || this.pc.signalingState === 'stable')) {
              this.trace('ANSWER_RECEIVED', { callId: this.callId });
              await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdpAnswer));
              this.remoteDescriptionSet = true;
              this.trace('REMOTE_ANSWER_SET', { callId: this.callId, signalingState: this.pc.signalingState });
              await this.flushPendingCandidates(RTCIceCandidate);
              this.setStatus('CONNECTING');
            }
          } catch (err) {
            this.trace('WEBRTC_ERROR', { phase: 'SET_REMOTE_ANSWER', error: err });
          }
        }

        // Receiver: Process SDP Offer & Create Answer
        if (
          !this.isCaller &&
          data.sdpOffer &&
          data.sdpOffer.sdp &&
          !this.remoteDescriptionSet
        ) {
          try {
            if (this.pc && this.pc.signalingState === 'stable') {
              this.trace('OFFER_RECEIVED', { callId: this.callId });
              await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdpOffer));
              this.remoteDescriptionSet = true;
              this.trace('REMOTE_OFFER_SET', { callId: this.callId, signalingState: this.pc.signalingState });
              await this.flushPendingCandidates(RTCIceCandidate);

              if (this.pc && this.pc.signalingState === 'have-remote-offer') {
                const answer = await this.pc.createAnswer();
                await this.pc.setLocalDescription(answer);
                this.trace('ANSWER_CREATED', { callId: this.callId });

                await updateDoc(chatDocRef, {
                  'callState.sdpAnswer': { sdp: answer.sdp, type: answer.type },
                  'callState.status': 'connecting',
                  'callState.updatedAt': serverTimestamp(),
                });
                this.trace('ANSWER_WRITTEN', { callId: this.callId });
              }
            }
          } catch (err) {
            this.trace('WEBRTC_ERROR', { phase: 'SET_REMOTE_OFFER', error: err });
          }
        }

        // Process Remote ICE Candidates
        const remoteCandidates: SerializedCandidate[] = Array.isArray(data[remoteCandidatesKey])
          ? data[remoteCandidatesKey]
          : [];

        for (const candidate of remoteCandidates) {
          await this.addIceCandidate(candidate, RTCIceCandidate);
        }
      }, (error) => {
        console.log('[WebRTCSession] Signaling snapshot notice:', error?.message);
      });

      // Caller: Create and Publish SDP Offer
      if (this.isCaller) {
        this.setStatus('RINGING');
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);
        this.trace('OFFER_CREATED', { callId: this.callId });

        const initialCallPayload = {
          callId: this.callId,
          chatId: this.chatId,
          callerId: this.callerId,
          callerName: this.options.callerName,
          callerAvatar: this.options.callerAvatar,
          receiverId: this.receiverId,
          callType: 'voice',
          status: 'calling',
          sdpOffer: { sdp: offer.sdp, type: offer.type },
          sdpAnswer: null,
          callerCandidates: [],
          receiverCandidates: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(
          chatDocRef,
          { callState: initialCallPayload, participants: [this.callerId, this.receiverId] },
          { merge: true }
        );
        this.trace('CALL_STATE_WRITTEN', { callId: this.callId, status: 'calling' });
      }
    } catch (error) {
      this.trace('WEBRTC_ERROR', { phase: 'SESSION_START', error });
      this.setStatus('FAILED');
      this.options.onError?.(error);
      this.destroy('failed');
    }
  }

  private async addIceCandidate(candidate: SerializedCandidate, RTCIceCandidateClass: any) {
    if (this.isDestroyed || !this.pc) return;

    if (!this.remoteDescriptionSet) {
      this.pendingRemoteCandidates.push(candidate);
      this.trace('ICE_QUEUED', { side: this.isCaller ? 'caller' : 'callee', candidateKey: candidateKey(candidate) });
      return;
    }

    const key = candidateKey(candidate);
    if (this.appliedCandidateKeys.has(key)) return;

    this.appliedCandidateKeys.add(key);
    try {
      await this.pc.addIceCandidate(new RTCIceCandidateClass(candidate));
      this.trace('ICE_ADDED', { side: this.isCaller ? 'caller' : 'callee', key });
    } catch (e) {
      this.trace('WEBRTC_ERROR', { phase: 'ADD_ICE', key, error: e });
    }
  }

  private async flushPendingCandidates(RTCIceCandidateClass: any) {
    const candidates = [...this.pendingRemoteCandidates];
    this.pendingRemoteCandidates = [];
    this.trace('ICE_FLUSH_START', { count: candidates.length });
    for (const candidate of candidates) {
      await this.addIceCandidate(candidate, RTCIceCandidateClass);
    }
    this.trace('ICE_FLUSH_DONE', { count: candidates.length });
  }

  private checkAndMarkConnected() {
    if (this.isDestroyed || this.connectedMarked || !this.pc) return;

    const pcState = this.pc.connectionState;
    const iceState = this.pc.iceConnectionState;
    const isConnected = pcState === 'connected' || iceState === 'connected' || iceState === 'completed';

    if (isConnected || (this.remoteStream && (pcState === 'connecting' || iceState === 'checking'))) {
      this.connectedMarked = true;
      this.trace('PEER_CONNECTION_CONNECTED', { pcState, iceState });
      this.setStatus('CONNECTED');
      updateDoc(doc(db, 'chats', this.chatId), {
        'callState.status': 'connected',
        'callState.connectedAt': serverTimestamp(),
      }).catch(() => {});
    }
  }

  destroy(finalStatus?: string) {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.trace('WEBRTC_SESSION_DESTROY', { finalStatus, instanceId: this.instanceId });

    if (this.candidateFlushTimer) {
      clearTimeout(this.candidateFlushTimer);
      this.candidateFlushTimer = null;
    }
    this.flushLocalCandidates().catch(() => {});

    stopAllCallAudio();

    if (this.signalingUnsubscribe) {
      this.signalingUnsubscribe();
      this.signalingUnsubscribe = null;
    }

    if (this.localStream?.getTracks) {
      this.localStream.getTracks().forEach((track: any) => track.stop());
    }
    if (this.remoteStream?.getTracks) {
      this.remoteStream.getTracks().forEach((track: any) => track.stop());
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

    if (activeSession === this) {
      activeSession = null;
    }
  }
}

let activeSession: WebRTCSession | null = null;

export function getActiveSession() {
  return activeSession;
}

export async function startWebRTCCall(options: WebRTCCallOptions) {
  if (activeSession) {
    activeSession.destroy();
    activeSession = null;
  }

  const session = new WebRTCSession(options);
  activeSession = session;
  await session.startSession();
  return session;
}

export async function acceptWebRTCCall(callId: string, options: Omit<WebRTCCallOptions, 'callId' | 'isCaller'>) {
  if (activeSession) {
    activeSession.destroy();
    activeSession = null;
  }

  // Receiver accepts call: update signaling state in chats doc
  await updateDoc(doc(db, 'chats', options.chatId), {
    'callState.status': 'accepted',
    'callState.updatedAt': serverTimestamp(),
  }).catch(() => {});

  const session = new WebRTCSession({
    ...options,
    callId,
    isCaller: false,
  });
  activeSession = session;
  await session.startSession();
  return session;
}

export async function cancelWebRTCCall(callId: string, chatId: string) {
  stopAllCallAudio();
  if (activeSession && activeSession.callId === callId) {
    activeSession.setStatus('CANCELLED');
    activeSession.destroy('cancelled');
  }
  await updateDoc(doc(db, 'chats', chatId), {
    'callState.status': 'cancelled',
    'callState.sdpOffer': null,
    'callState.sdpAnswer': null,
    'callState.endedAt': serverTimestamp(),
  }).catch(() => {});
}

export async function rejectWebRTCCall(callId: string, chatId: string) {
  stopAllCallAudio();
  if (activeSession && activeSession.callId === callId) {
    activeSession.setStatus('REJECTED');
    activeSession.destroy('rejected');
  }
  await updateDoc(doc(db, 'chats', chatId), {
    'callState.status': 'rejected',
    'callState.sdpOffer': null,
    'callState.sdpAnswer': null,
    'callState.endedAt': serverTimestamp(),
  }).catch(() => {});
}

export async function endWebRTCCall(callId: string, chatId: string, durationSecs: number = 0) {
  stopAllCallAudio();
  if (activeSession && activeSession.callId === callId) {
    activeSession.setStatus('ENDED');
    activeSession.destroy('ended');
  }
  await updateDoc(doc(db, 'chats', chatId), {
    'callState.status': 'ended',
    'callState.duration': durationSecs,
    'callState.sdpOffer': null,
    'callState.sdpAnswer': null,
    'callState.endedAt': serverTimestamp(),
  }).catch(() => {});
}

export function setMicrophoneMuted(muted: boolean) {
  if (activeSession) {
    const localStream = (activeSession as any).localStream;
    localStream?.getAudioTracks?.().forEach((track: any) => {
      track.enabled = !muted;
    });
  }
}

export function stopWebRTCCall() {
  if (activeSession) {
    activeSession.destroy();
    activeSession = null;
  }
}
