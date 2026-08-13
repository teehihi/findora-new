import { CallStatus, SerializedCandidate } from '../models/callTypes';
import { audioSessionManager } from './audioSessionManager';
import { callHistoryService } from './callHistoryService';
import {
  CallInvitePayload,
  SdpPayload,
  signalingService,
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

  constructor() {
    console.log('[CALL_MANAGER:REGISTER]', { instanceId });
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

  private setStatus(status: CallStatus) {
    if (this.isDestroyed || this.currentStatus === status) return;

    if (!isValidTransition(this.currentStatus, status)) {
      console.log('[CALL:INVALID_STATE_TRANSITION]', {
        from: this.currentStatus,
        to: status,
        callId: this.activeCallId,
      });
      return;
    }

    this.currentStatus = status;
    this.log('STATE_CHANGE', { newStatus: status });
    this.options?.onStatusChange?.(status);

    if (status === 'RINGING') {
      if (this.options?.isCaller) audioSessionManager.playOutgoingRingTone();
      else audioSessionManager.playIncomingRingTone();
    } else if (status === 'CONNECTED') {
      audioSessionManager.playConnectedTone();
    } else if (status === 'ENDED' || status === 'REJECTED' || status === 'CANCELLED' || status === 'FAILED' || status === 'EXPIRED') {
      audioSessionManager.playEndCallTone();
    }
  }

  async startCall(options: CallManagerOptions): Promise<void> {
    this.log('START_CALL', { callId: options.callId });
    if (this.activeCallId) {
      await this.endCall();
    }

    this.isDestroyed = false;
    this.connectedMarked = false;
    this.activeCallId = options.callId;
    this.options = options;
    this.setStatus('OUTGOING_CALL');

    try {
      // PHASE 1: DISPATCH CALL INVITE IMMEDIATELY (T+0ms) BEFORE NATIVE AUDIO SETUP
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
        expiresAtTimestamp: now + 30000,
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

      // PHASE 2: PARALLEL AUDIO & WEBRTC INITIALIZATION AFTER INVITE SENT
      await audioSessionManager.setupAudioForCall();

      const client = new WebRTCClient({
        onIceCandidate: (candidate) => {
          console.log('[WEBRTC:ICE_SENT]', { callId: options.callId, isCaller: true });
          signalingService.sendIceCandidate(options.chatId, true, candidate);
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

      await client.initializeAudioStream();
      const offer = await client.createOffer();
      console.log('[WEBRTC:OFFER_CREATED]', { callId: options.callId });
      console.log('[WEBRTC:LOCAL_DESCRIPTION_SET]', { callId: options.callId });

      await signalingService.sendSdpOffer(options.chatId, offer);

      this.signalingUnsubscribe = signalingService.subscribeToCallSession(
        options.chatId,
        options.callId,
        true,
        {
          onStatusChange: (status) => {
            if (status === 'accepted') {
              this.setStatus('CONNECTING');
            } else if (status === 'rejected') {
              this.setStatus('REJECTED');
              this.endCall('rejected');
            } else if (status === 'cancelled') {
              this.setStatus('CANCELLED');
              this.endCall('cancelled');
            } else if (status === 'ended') {
              this.setStatus('ENDED');
              this.endCall('ended');
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

      // Set 30s ringing timeout
      this.ringingTimeoutTimer = setTimeout(() => {
        if (this.currentStatus === 'RINGING' || this.currentStatus === 'OUTGOING_CALL') {
          this.log('RINGING_TIMEOUT');
          this.cancelCall();
        }
      }, 30000);
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
      await audioSessionManager.setupAudioForCall();
      await signalingService.clearUserInvite(options.receiverId);
      await signalingService.updateSessionStatus(options.chatId, options.callId, 'accepted');

      const client = new WebRTCClient({
        onIceCandidate: (candidate) => {
          console.log('[WEBRTC:ICE_SENT]', { callId: options.callId, isCaller: false });
          signalingService.sendIceCandidate(options.chatId, false, candidate);
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

      await client.initializeAudioStream();

      this.signalingUnsubscribe = signalingService.subscribeToCallSession(
        options.chatId,
        options.callId,
        false,
        {
          onStatusChange: (status) => {
            if (status === 'cancelled') {
              this.setStatus('CANCELLED');
              this.endCall('cancelled');
            } else if (status === 'ended') {
              this.setStatus('ENDED');
              this.endCall('ended');
            }
          },
          onOffer: async (offer) => {
            console.log('[WEBRTC:OFFER_RECEIVED]', { callId: options.callId });
            await client.setRemoteDescription(offer);
            console.log('[WEBRTC:REMOTE_DESCRIPTION_SET]', { callId: options.callId, isCaller: false });
            const answer = await client.createAnswer();
            console.log('[WEBRTC:ANSWER_CREATED]', { callId: options.callId });
            await signalingService.sendSdpAnswer(options.chatId, answer);
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

    if (isConnected || (this.webRTCClient.RemoteStream && (pcState === 'connecting' || iceState === 'checking'))) {
      this.connectedMarked = true;
      this.setStatus('CONNECTED');
      console.log('[CALL_CONNECTED]', { callId: this.activeCallId });
      if (this.options?.chatId && this.activeCallId) {
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
      await signalingService.updateSessionStatus(opts.chatId, opts.callId, 'cancelled');
      await signalingService.clearUserInvite(opts.receiverId);
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
      await signalingService.updateSessionStatus(opts.chatId, opts.callId, 'rejected');
      await signalingService.clearUserInvite(opts.receiverId);
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
      await signalingService.updateSessionStatus(opts.chatId, opts.callId, 'ended');
      await signalingService.clearUserInvite(opts.receiverId);
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

  private async cleanup(reason: string): Promise<void> {
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

    if (targetChatId && targetCallId) {
      await signalingService.clearCallSession(targetChatId, targetCallId).catch(() => {});
    }

    this.activeCallId = null;
    this.options = null;
    this.setStatus('IDLE');
    console.log('[CALL_MANAGER:UNREGISTER]', { instanceId });
  }
}

export const callManager = new CallManager();
