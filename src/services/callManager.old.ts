import { CallStatus } from '../models/callTypes';
import { audioSessionManager } from './audioSessionManager';
import { callHistoryService } from './callHistoryService';
import {
    CallInvitePayload,
    signalingService
} from './signalingService';
import { WebRTCClient } from './webRTCClient';

export type CallManagerOptions = {
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

const instanceId = Math.random().toString(36).substring(2, 9);
const singletonKey = '__findoraCallManagerSingleton';

declare global {
  // eslint-disable-next-line no-var
  var __findoraCallManagerSingleton: CallManager | undefined;
}

function isValidTransition(from: CallStatus, to: CallStatus): boolean {
  if (from === to) return true;
  if (from === 'IDLE') return to === 'OUTGOING_CALL' || to === 'INCOMING_CALL' || to === 'ACCEPTING';
  if (from === 'OUTGOING_CALL') return to === 'RINGING' || to === 'CANCELLED' || to === 'FAILED' || to === 'ENDED';
  if (from === 'INCOMING_CALL') return to === 'ACCEPTING' || to === 'REJECTED' || to === 'EXPIRED';
  if (from === 'RINGING' || from === 'ACCEPTING') return to === 'CONNECTING' || to === 'CANCELLED' || to === 'REJECTED' || to === 'EXPIRED' || to === 'FAILED' || to === 'ENDED';
  if (from === 'CONNECTING') return to === 'CONNECTED' || to === 'FAILED' || to === 'ENDED' || to === 'CANCELLED';
  if (from === 'CONNECTED') return to === 'ENDED' || to === 'FAILED';
  if (from === 'ENDED' || from === 'CANCELLED' || from === 'REJECTED' || from === 'FAILED' || from === 'EXPIRED') {
    return to === 'IDLE';
  }
  return true;
}

class CallManager {
  private activeCallId: string | null = null;
  private currentStatus: CallStatus = 'IDLE';
  private webRTCClient: WebRTCClient | null = null;
  private signalingUnsubscribe: (() => void) | null = null;
  private ringingTimeoutTimer: any = null;
  private negotiationTimeoutTimer: any = null;
  private options: CallManagerOptions | null = null;
  private isDestroyed = false;
  private connectedMarked = false;
  private lastCallTimestamp = 0;

  private statusListeners: Array<(status: CallStatus, callId: string | null) => void> = [];

  constructor() {
    console.log('[CALL_MANAGER:REGISTER]', { instanceId });
  }

  addStatusListener(listener: (status: CallStatus, callId: string | null) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  get ActiveCallId(): string | null {
    return this.activeCallId;
  }

  get CurrentStatus(): CallStatus {
    return this.currentStatus;
  }

  private log(event: string, details?: any) {
    console.log(`[CallManager:${event}]`, {
      callId: this.activeCallId,
      status: this.currentStatus,
      instanceId,
      time: new Date().toISOString(),
      ...details,
    });
  }

  private setStatus(status: CallStatus, force = false): boolean {
    if ((!force && this.isDestroyed) || this.currentStatus === status) return false;

    if (!force && !isValidTransition(this.currentStatus, status)) {
      console.log('[CALL:INVALID_STATE_TRANSITION]', {
        from: this.currentStatus,
        to: status,
        callId: this.activeCallId,
      });
      return false;
    }

    this.currentStatus = status;
    this.log('STATE_CHANGE', { newStatus: status });
    this.options?.onStatusChange?.(status);

    this.statusListeners.forEach((listener) => {
      try {
        listener(status, this.activeCallId);
      } catch (e) {
        console.error('[CallManager:STATUS_LISTENER_ERROR]', e);
      }
    });

    // TASK 1 FIX: Clear 30-second ringing timeout as soon as call is accepted or connecting!
    if (status === 'ACCEPTING' || status === 'CONNECTING' || status === 'CONNECTED') {
      if (this.ringingTimeoutTimer) {
        console.log('[CALL_MANAGER:CLEAR_RINGING_TIMEOUT]', { callId: this.activeCallId, status });
        clearTimeout(this.ringingTimeoutTimer);
        this.ringingTimeoutTimer = null;
      }
    }

    if (status === 'RINGING') {
      if (this.options?.isCaller) audioSessionManager.playOutgoingRingTone();
      else audioSessionManager.playIncomingRingTone();
    } else if (status === 'CONNECTED') {
      if (this.negotiationTimeoutTimer) {
        clearTimeout(this.negotiationTimeoutTimer);
        this.negotiationTimeoutTimer = null;
      }
      audioSessionManager.playConnectedTone();
    } else if (status === 'ENDED' || status === 'REJECTED' || status === 'CANCELLED' || status === 'FAILED' || status === 'EXPIRED') {
      if (this.ringingTimeoutTimer) {
        clearTimeout(this.ringingTimeoutTimer);
        this.ringingTimeoutTimer = null;
      }
      if (this.negotiationTimeoutTimer) {
        clearTimeout(this.negotiationTimeoutTimer);
        this.negotiationTimeoutTimer = null;
      }
      audioSessionManager.playEndCallTone();
    }

    return true;
  }

  private async handleRemoteTerminalStatus(status: 'rejected' | 'cancelled' | 'ended' | 'failed'): Promise<void> {
    const statusMap: Record<typeof status, CallStatus> = {
      rejected: 'REJECTED',
      cancelled: 'CANCELLED',
      ended: 'ENDED',
      failed: 'FAILED',
    };

    this.log('REMOTE_TERMINAL_STATUS', { remoteStatus: status });
    this.setStatus(statusMap[status]);
    await this.cleanup(`remote-${status}`, false);
  }

  claimIncomingCall(options: CallManagerOptions, status: 'INCOMING_CALL' | 'ACCEPTING' = 'INCOMING_CALL'): void {
    this.log('CLAIM_INCOMING_CALL', {
      claimedCallId: options.callId,
      callerId: options.callerId,
      receiverId: options.receiverId,
      nextStatus: status,
    });

    if (this.activeCallId && this.activeCallId !== options.callId) {
      this.log('CLAIM_REJECTED_ACTIVE_CALL', {
        incomingCallId: options.callId,
        activeCallId: this.activeCallId,
      });
      return;
    }

    this.isDestroyed = false;
    this.connectedMarked = false;
    this.activeCallId = options.callId;
    this.options = {
      ...this.options,
      ...options,
    };
    this.setStatus(status);
  }

  async rejectIncomingCall(options: CallManagerOptions): Promise<void> {
    this.claimIncomingCall(options, 'INCOMING_CALL');
    await this.rejectCall();
  }

  async startCall(options: CallManagerOptions): Promise<void> {
    this.log('START_CALL', { callId: options.callId });
    
    // GUARD: Prevent rapid successive calls (debounce 2 seconds)
    const now = Date.now();
    if (this.lastCallTimestamp && (now - this.lastCallTimestamp) < 2000) {
      console.log('[CALL:DEBOUNCE_REJECT]', {
        callId: options.callId,
        lastCallTime: this.lastCallTimestamp,
        cooldownRemaining: 2000 - (now - this.lastCallTimestamp),
      });
      return;
    }
    this.lastCallTimestamp = now;
    
    if (this.activeCallId) {
      await this.endCall();
    }

    // CRITICAL: Force clear any stale call state in Firestore before starting new call
    await signalingService.clearCallSession(options.chatId).catch(() => {});

    this.isDestroyed = false;
    this.connectedMarked = false;
    this.activeCallId = options.callId;
    this.options = options;
    this.setStatus('OUTGOING_CALL');

    try {
      // PHASE 0: INITIALIZE WEBRTC CLIENT FIRST
      const client = new WebRTCClient({
        onIceCandidate: (candidate) => {
          console.log('[WEBRTC:ICE_SENT]', { callId: options.callId, isCaller: true });
          signalingService.sendIceCandidate(options.chatId, options.callId, options.callerId, options.receiverId, true, candidate);
        },
        onRemoteStream: (stream) => {
          this.options?.onRemoteStream?.(stream);
          this.checkAndMarkConnected();
        },
        onConnectionStateChange: (state) => {
          this.log('WEBRTC_STATE_CHANGE', { state });
          if (state === 'connecting' || state === 'checking') {
            this.setStatus('CONNECTING');
          }
          if (state === 'failed') {
            this.setStatus('FAILED');
            this.endCall('failed');
          }
          this.checkAndMarkConnected();
        },
      });
      this.webRTCClient = client;

      // PHASE 1: SUBSCRIBE TO PEER EVENTS BEFORE SENDING ANYTHING
      this.signalingUnsubscribe = signalingService.subscribeToCallSession(
        options.callerId,
        options.callId,
        true,
        {
          onStatusChange: (status) => {
            if (status === 'accepted') {
              this.setStatus('CONNECTING');
            } else if (status === 'connected') {
              this.setStatus('CONNECTED');
            } else if (status === 'rejected' || status === 'cancelled' || status === 'ended' || status === 'failed') {
              this.handleRemoteTerminalStatus(status).catch(() => {});
            }
          },
          onAnswer: async (answer) => {
            console.log('[WEBRTC:ANSWER_RECEIVED]', { callId: options.callId });
            await client.setRemoteDescription(answer);
            console.log('[WEBRTC:REMOTE_DESCRIPTION_SET]', { callId: options.callId, isCaller: true });
            this.setStatus('CONNECTING');
          },
          onIceCandidate: (candidate) => {
            console.log('[WEBRTC:ICE_RECEIVED]', { callId: options.callId, isCaller: true });
            client.addIceCandidate(candidate);
            console.log('[WEBRTC:ICE_ADDED]', { callId: options.callId, isCaller: true });
          },
        }
      );

      // PHASE 2: DISPATCH CALL INVITE AFTER SUBSCRIBING
      const now = Date.now();
      const invitePayload: CallInvitePayload = {
        callId: options.callId,
        chatId: options.chatId,
        callerId: options.callerId,
        callerName: options.callerName,
        callerAvatar: options.callerAvatar,
        receiverId: options.receiverId,
        callType: 'voice',
        timestamp: now,
        createdAtTimestamp: now,
        expiresAtTimestamp: now + 60000,
      };

      console.log('[CALL:INVITE_CREATE]', {
        callId: options.callId,
        chatId: options.chatId,
        callerId: options.callerId,
        calleeId: options.receiverId,
        timestamp: now,
      });

      await signalingService.sendCallInvite(invitePayload);
      this.setStatus('RINGING');

      // PHASE 3: PARALLEL AUDIO INITIALIZATION & CREATE OFFER
      audioSessionManager.setupAudioForCall().catch((error) => {
        this.log('AUDIO_SETUP_WARNING', { error });
      });

      await client.initializeAudioStream();
      const offer = await client.createOffer();
      console.log('[WEBRTC:OFFER_CREATED]', { callId: options.callId });
      console.log('[WEBRTC:LOCAL_DESCRIPTION_SET]', { callId: options.callId });

      await signalingService.sendSdpOffer(options.receiverId, options.callerId, options.chatId, options.callId, offer);

      // Reference-style 60s validity window for slow emulator/device negotiation.
      this.ringingTimeoutTimer = setTimeout(() => {
        if (this.currentStatus === 'RINGING' || this.currentStatus === 'OUTGOING_CALL') {
          this.log('RINGING_TIMEOUT');
          this.cancelCall();
        }
      }, 60000);
    } catch (error) {
      this.log('START_CALL_ERROR', { error });
      this.setStatus('FAILED');
      this.options?.onError?.(error);
      await this.cleanup('failed');
    }
  }

  async acceptCall(options: CallManagerOptions): Promise<void> {
    this.log('ACCEPT_CALL', { callId: options.callId });
    if (this.activeCallId && this.activeCallId !== options.callId) {
      await this.endCall();
    }

    this.isDestroyed = false;
    this.connectedMarked = false;
    this.activeCallId = options.callId;
    this.options = options;
    this.setStatus('ACCEPTING');

    try {
      console.log('[CALL_CLAIMED]', { callId: options.callId, userId: options.receiverId, role: 'callee' });

      // PHASE 0: INITIALIZE WEBRTC CLIENT FIRST
      const client = new WebRTCClient({
        onIceCandidate: (candidate) => {
          console.log('[WEBRTC:ICE_SENT]', { callId: options.callId, isCaller: false });
          signalingService.sendIceCandidate(options.chatId, options.callId, options.receiverId, options.callerId, false, candidate);
        },
        onRemoteStream: (stream) => {
          this.options?.onRemoteStream?.(stream);
          this.checkAndMarkConnected();
        },
        onConnectionStateChange: (state) => {
          this.log('WEBRTC_STATE_CHANGE', { state });
          if (state === 'connecting' || state === 'checking') {
            this.setStatus('CONNECTING');
          }
          if (state === 'failed') {
            this.setStatus('FAILED');
            this.endCall('failed');
          }
          this.checkAndMarkConnected();
        },
      });
      this.webRTCClient = client;

      // PHASE 1: SUBSCRIBE TO PEER EVENTS BEFORE SENDING ACCEPTED
      this.signalingUnsubscribe = signalingService.subscribeToCallSession(
        options.receiverId,
        options.callId,
        false,
        {
          onStatusChange: (status) => {
            if (status === 'connected') {
              this.setStatus('CONNECTED');
            } else if (status === 'cancelled' || status === 'ended' || status === 'failed') {
              this.handleRemoteTerminalStatus(status).catch(() => {});
            }
          },
          onOffer: async (offer) => {
            // GUARD: Check if WebRTC client still exists before creating answer
            if (!this.webRTCClient || this.isDestroyed) {
              console.log('[WEBRTC:OFFER_IGNORED_DESTROYED]', { callId: options.callId });
              return;
            }
            
            console.log('[WEBRTC:OFFER_RECEIVED]', { callId: options.callId });
            await client.setRemoteDescription(offer);
            console.log('[WEBRTC:REMOTE_DESCRIPTION_SET]', { callId: options.callId, isCaller: false });
            const answer = await client.createAnswer();
            console.log('[WEBRTC:ANSWER_CREATED]', { callId: options.callId });
            await signalingService.sendSdpAnswer(options.callerId, options.receiverId, options.chatId, options.callId, answer);
            console.log('[WEBRTC:LOCAL_DESCRIPTION_SET]', { callId: options.callId, isCaller: false });
            this.setStatus('CONNECTING');
          },
          onIceCandidate: (candidate) => {
            console.log('[WEBRTC:ICE_RECEIVED]', { callId: options.callId, isCaller: false });
            client.addIceCandidate(candidate);
            console.log('[WEBRTC:ICE_ADDED]', { callId: options.callId, isCaller: false });
          },
        }
      );

      // PHASE 2: UPDATE STATUS & SEND ACCEPTED & CLEAR INVITE (in order)
      await signalingService.updateSessionStatus(options.chatId, options.callId, 'accepted');
      await signalingService.sendCallStatusEvent(options.callerId, options.receiverId, options.chatId, options.callId, 'accepted');
      
      console.log('[ACCEPTED_SENT]', { callId: options.callId, userId: options.receiverId, role: 'callee' });
      
      // CRITICAL: Clear user invite to stop subscribeToUserInvites from firing
      await signalingService.clearUserInvite(options.receiverId, options.callId);
      console.log('[INVITE_CLEARED]', { callId: options.callId, userId: options.receiverId, role: 'callee' });
      
      audioSessionManager.setupAudioForCall().catch((error) => {
        this.log('AUDIO_SETUP_WARNING', { error });
      });

      await client.initializeAudioStream();
    } catch (error) {
      this.log('ACCEPT_CALL_ERROR', { error });
      this.setStatus('FAILED');
      this.options?.onError?.(error);
      await this.cleanup('failed');
    }
  }

  private checkAndMarkConnected() {
    if (this.isDestroyed || this.connectedMarked || !this.webRTCClient) return;

    const pcState = this.webRTCClient.ConnectionState;
    const iceState = this.webRTCClient.IceConnectionState;
    const isConnected = pcState === 'connected' || iceState === 'connected' || iceState === 'completed';

    if (isConnected) {
      if (this.currentStatus === 'ACCEPTING' || this.currentStatus === 'RINGING' || this.currentStatus === 'OUTGOING_CALL') {
        this.setStatus('CONNECTING');
      }

      const didConnect = this.setStatus('CONNECTED');
      if (!didConnect) return;

      this.connectedMarked = true;
      console.log('[CALL_CONNECTED]', { callId: this.activeCallId });
      if (this.options?.chatId && this.activeCallId) {
        const targetUserId = this.options.isCaller ? this.options.receiverId : this.options.callerId;
        const senderId = this.options.isCaller ? this.options.callerId : this.options.receiverId;
        signalingService.sendCallStatusEvent(targetUserId, senderId, this.options.chatId, this.activeCallId, 'connected').catch(() => {});
        signalingService.updateSessionStatus(this.options.chatId, this.activeCallId, 'connected').catch(() => {});
      }
    }
  }

  async cancelCall(): Promise<void> {
    if (this.isDestroyed || this.currentStatus === 'CANCELLED' || this.currentStatus === 'ENDED') return;
    this.log('CANCEL_CALL');
    this.setStatus('CANCELLED');
    console.log('[CALL_CANCELLED]', { callId: this.activeCallId });
    if (this.options) {
      const opts = this.options;
      await signalingService.sendCallStatusEvent(opts.receiverId, opts.callerId, opts.chatId, opts.callId, 'cancelled');
      signalingService.updateSessionStatus(opts.chatId, opts.callId, 'cancelled').catch(() => {});
      await signalingService.clearUserInvite(opts.receiverId, opts.callId);
      await callHistoryService.saveCallRecord({
        callId: opts.callId,
        chatId: opts.chatId,
        callerId: opts.callerId,
        callerName: opts.callerName,
        callerAvatar: opts.callerAvatar,
        receiverId: opts.receiverId,
        callType: 'voice',
        status: 'cancelled',
      });
    }
    await this.cleanup('cancelled');
  }

  async rejectCall(): Promise<void> {
    if (this.isDestroyed || this.currentStatus === 'REJECTED' || this.currentStatus === 'ENDED') return;
    this.log('REJECT_CALL');
    this.setStatus('REJECTED');
    console.log('[CALL_REJECTED]', { callId: this.activeCallId });
    if (this.options) {
      const opts = this.options;
      await signalingService.sendCallStatusEvent(opts.callerId, opts.receiverId, opts.chatId, opts.callId, 'rejected');
      signalingService.updateSessionStatus(opts.chatId, opts.callId, 'rejected').catch(() => {});
      await signalingService.clearUserInvite(opts.receiverId, opts.callId);
      await callHistoryService.saveCallRecord({
        callId: opts.callId,
        chatId: opts.chatId,
        callerId: opts.callerId,
        callerName: opts.callerName,
        callerAvatar: opts.callerAvatar,
        receiverId: opts.receiverId,
        callType: 'voice',
        status: 'rejected',
      });
    }
    await this.cleanup('rejected');
  }

  async endCall(reason: string = 'ended', durationSecs: number = 0): Promise<void> {
    if (this.isDestroyed || this.currentStatus === 'ENDED') return;
    this.log('END_CALL', { reason, durationSecs });
    this.setStatus('ENDED');
    console.log('[CALL_ENDED]', { callId: this.activeCallId, reason, durationSecs });
    if (this.options) {
      const opts = this.options;
      const targetUserId = opts.isCaller ? opts.receiverId : opts.callerId;
      const senderId = opts.isCaller ? opts.callerId : opts.receiverId;
      await signalingService.sendCallStatusEvent(targetUserId, senderId, opts.chatId, opts.callId, 'ended');
      signalingService.updateSessionStatus(opts.chatId, opts.callId, 'ended').catch(() => {});
      await signalingService.clearUserInvite(opts.receiverId, opts.callId);
      await callHistoryService.saveCallRecord({
        callId: opts.callId,
        chatId: opts.chatId,
        callerId: opts.callerId,
        callerName: opts.callerName,
        callerAvatar: opts.callerAvatar,
        receiverId: opts.receiverId,
        callType: 'voice',
        status: 'ended',
        duration: durationSecs,
      });
    }
    await this.cleanup(reason);
  }

  setMicrophoneMuted(muted: boolean): void {
    this.webRTCClient?.setMicrophoneMuted(muted);
  }

  private async cleanup(reason: string, clearRemoteSession = true): Promise<void> {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.log('CLEANUP_CALL_MANAGER', { reason });

    const targetCallId = this.activeCallId;
    const targetChatId = this.options?.chatId;

    if (this.ringingTimeoutTimer) {
      clearTimeout(this.ringingTimeoutTimer);
      this.ringingTimeoutTimer = null;
    }
    if (this.negotiationTimeoutTimer) {
      clearTimeout(this.negotiationTimeoutTimer);
      this.negotiationTimeoutTimer = null;
    }

    if (this.signalingUnsubscribe) {
      this.signalingUnsubscribe();
      this.signalingUnsubscribe = null;
    }

    if (this.webRTCClient) {
      this.webRTCClient.destroy();
      this.webRTCClient = null;
    }

    audioSessionManager.cleanup();

    if (clearRemoteSession && targetChatId && targetCallId) {
      await signalingService.clearCallSession(targetChatId, targetCallId).catch(() => {});
    }

    this.activeCallId = null;
    this.options = null;
    this.setStatus('IDLE', true);
    console.log('[CALL_MANAGER:UNREGISTER]', { instanceId });
  }
}

export const callManager = globalThis[singletonKey] || new CallManager();
globalThis[singletonKey] = callManager;
