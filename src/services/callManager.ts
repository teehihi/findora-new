import { CallStatus } from '../models/callTypes';
import { audioSessionManager } from './audioSessionManager';
import { callHistoryService } from './callHistoryService';
import { ensureCallPermissions } from './voiceCallService';
import {
    SignalingEvent,
    simpleSignalingService,
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

/**
 * SIMPLE CALL MANAGER - Based on Firebase WebRTC Reference Implementation
 * 
 * Key differences from complex version:
 * - 1 listener per user (not per call)
 * - Events dispatched via latestEvent (not separate collections)
 * - NO complex guards - simple callId matching
 * - UI handles call lifecycle
 */
class SimpleCallManager {
  private activeCallId: string | null = null;
  private currentStatus: CallStatus = 'IDLE';
  private webRTCClient: WebRTCClient | null = null;
  private eventUnsubscribe: (() => void) | null = null;
  private options: CallManagerOptions | null = null;
  private currentUserId: string | null = null;
  private callTimeout: any = null;
  private pendingOffer: any = null;
  private pendingIceCandidates: any[] = [];

  private statusListeners: Array<(status: CallStatus, callId: string | null) => void> = [];

  constructor() {
    console.log('[SimpleCallManager:INIT]');
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
    console.log(`[SimpleCallManager:${event}]`, {
      callId: this.activeCallId,
      status: this.currentStatus,
      time: new Date().toISOString(),
      ...details,
    });
  }

  private setStatus(status: CallStatus): void {
    if (this.currentStatus === status) return;

    // Clear 60s timeout when call is accepted or connected
    if ((status === 'CONNECTED' || status === 'CONNECTING' || status === 'ACCEPTING') && this.callTimeout) {
      clearTimeout(this.callTimeout);
      this.callTimeout = null;
    }

    this.currentStatus = status;
    this.log('STATUS_CHANGE', { newStatus: status });
    this.options?.onStatusChange?.(status);

    this.statusListeners.forEach((listener) => {
      try {
        listener(status, this.activeCallId);
      } catch (e) {
        console.error('[SimpleCallManager:LISTENER_ERROR]', e);
      }
    });

    // Handle audio feedback
    if (status !== 'RINGING' && status !== 'INCOMING_CALL') {
      audioSessionManager.stopRingtones();
    }

    if (status === 'RINGING') {
      audioSessionManager.playOutgoingRingTone();
    } else if (status === 'CONNECTED') {
      audioSessionManager.playConnectedTone();
    } else if (status === 'ENDED' || status === 'REJECTED' || status === 'CANCELLED' || status === 'FAILED') {
      audioSessionManager.playEndCallTone();
    }
  }

  /**
   * Initialize event listener for current user
   * Called once when user logs in
   */
  initializeForUser(userId: string): void {
    this.log('INIT_USER', { userId });
    
    if (this.eventUnsubscribe) {
      this.eventUnsubscribe();
    }

    this.currentUserId = userId;
    
    // Subscribe to latest events
    this.eventUnsubscribe = simpleSignalingService.subscribeToLatestEvent(
      userId,
      (event) => this.handleIncomingEvent(event)
    );
  }

  /**
   * Handle incoming signaling event
   */
  private async handleIncomingEvent(event: SignalingEvent | null): Promise<void> {
    if (!event) return;

    // Ignore events not for active call
    if (this.activeCallId && event.callId !== this.activeCallId) {
      this.log('IGNORE_EVENT_WRONG_CALL', { 
        eventType: event.type,
        eventCallId: event.callId,
        activeCallId: this.activeCallId 
      });
      return;
    }

    this.log('HANDLE_EVENT', { type: event.type, sender: event.sender, callId: event.callId });

    switch (event.type) {
      case 'StartAudioCall':
        await this.handleIncomingCall(event);
        break;

      case 'Offer':
        await this.handleOffer(event);
        break;

      case 'Answer':
        await this.handleAnswer(event);
        break;

      case 'IceCandidate':
        await this.handleIceCandidate(event);
        break;

      case 'EndCall':
        await this.handleEndCall(event);
        break;
    }
  }

  /**
   * Handle incoming call
   */
  private async handleIncomingCall(event: SignalingEvent): Promise<void> {
    if (this.activeCallId) {
      this.log('REJECT_INCOMING_BUSY');
      // TODO: Send busy signal
      return;
    }

    this.activeCallId = event.callId!;
    this.options = {
      callId: event.callId!,
      chatId: event.chatId!,
      callerId: event.sender!,
      callerName: event.data.callerName,
      callerAvatar: event.data.callerAvatar,
      receiverId: this.currentUserId!,
      isCaller: false,
    };

    this.setStatus('INCOMING_CALL');
    this.log('INCOMING_CALL', { from: event.sender });
    
    // Pre-warm camera & microphone permissions while phone is ringing
    ensureCallPermissions().catch(() => {});

    // Play incoming ringtone
    audioSessionManager.playIncomingRingTone();

    // Set 60s timeout for incoming call
    this.callTimeout = setTimeout(() => {
      if (this.currentStatus === 'INCOMING_CALL') {
        this.log('INCOMING_TIMEOUT');
        this.endCall();
      }
    }, 60000);
  }

  /**
   * Start outgoing call
   */
  async startCall(options: CallManagerOptions): Promise<void> {
    this.log('START_CALL', { callId: options.callId });

    if (this.activeCallId) {
      await this.endCall();
    }

    this.activeCallId = options.callId;
    this.options = options;
    this.setStatus('OUTGOING_CALL');

    try {
      await ensureCallPermissions();

      // Initialize WebRTC
      const client = new WebRTCClient({
        onIceCandidate: (candidate) => {
          simpleSignalingService.sendIceCandidate(
            options.callerId,
            options.receiverId,
            options.callId,
            options.chatId,
            candidate
          );
        },
        onRemoteStream: (stream) => {
          this.options?.onRemoteStream?.(stream);
          this.checkConnection();
        },
        onConnectionStateChange: (state) => {
          this.log('WEBRTC_STATE', { state });
          if (state === 'connected' || state === 'completed') {
            this.setStatus('CONNECTED');
          } else if (state === 'failed') {
            this.setStatus('FAILED');
            this.endCall();
          }
        },
      });
      this.webRTCClient = client;

      // Setup audio
      audioSessionManager.setupAudioForCall();
      await client.initializeAudioStream();

      // Send StartAudioCall non-blocking
      simpleSignalingService.sendStartAudioCall(
        options.callerId,
        options.receiverId,
        options.callId,
        options.chatId,
        options.callerName,
        options.callerAvatar
      ).catch((err) => this.log('SEND_START_CALL_ERROR', { error: err }));

      this.setStatus('RINGING');

      // Create and send offer
      const offer = await client.createOffer();
      simpleSignalingService.sendOffer(
        options.callerId,
        options.receiverId,
        options.callId,
        options.chatId,
        offer
      ).catch((err) => this.log('SEND_OFFER_ERROR', { error: err }));

      // Set 60s timeout
      this.callTimeout = setTimeout(() => {
        if (this.currentStatus === 'RINGING' || this.currentStatus === 'OUTGOING_CALL') {
          this.log('RINGING_TIMEOUT');
          this.cancelCall();
        }
      }, 60000);

    } catch (error) {
      this.log('START_ERROR', { error });
      this.setStatus('FAILED');
      this.options?.onError?.(error);
      await this.cleanup();
    }
  }

  /**
   * Accept incoming call
   */
  async acceptCall(): Promise<void> {
    if (!this.options || this.currentStatus !== 'INCOMING_CALL') {
      this.log('ACCEPT_INVALID_STATE');
      return;
    }

    this.log('ACCEPT_CALL');
    this.setStatus('ACCEPTING');

    try {
      await ensureCallPermissions();

      // Initialize WebRTC
      const client = new WebRTCClient({
        onIceCandidate: (candidate) => {
          simpleSignalingService.sendIceCandidate(
            this.options!.receiverId,
            this.options!.callerId,
            this.options!.callId,
            this.options!.chatId,
            candidate
          );
        },
        onRemoteStream: (stream) => {
          this.options?.onRemoteStream?.(stream);
          this.checkConnection();
        },
        onConnectionStateChange: (state) => {
          this.log('WEBRTC_STATE', { state });
          if (state === 'connected' || state === 'completed') {
            this.setStatus('CONNECTED');
          } else if (state === 'failed') {
            this.setStatus('FAILED');
            this.endCall();
          }
        },
      });
      this.webRTCClient = client;

      // Setup audio
      audioSessionManager.setupAudioForCall();
      await client.initializeAudioStream();

      // Clear my latestEvent in background
      simpleSignalingService.clearLatestEvent(this.currentUserId!).catch(() => {});

      // Process pending offer if already received
      if (this.pendingOffer) {
        this.log('PROCESSING_PENDING_OFFER');
        const offerData = this.pendingOffer;
        this.pendingOffer = null;

        await client.setRemoteDescription(offerData);
        const answer = await client.createAnswer();
        
        // Send Answer non-blocking
        simpleSignalingService.sendAnswer(
          this.options.receiverId,
          this.options.callerId,
          this.options.callId,
          this.options.chatId,
          answer
        ).catch((err) => this.log('SEND_ANSWER_ERROR', { error: err }));

        this.setStatus('CONNECTING');
      }

      // Process pending ICE candidates in parallel
      if (this.pendingIceCandidates.length > 0) {
        this.log('PROCESSING_PENDING_ICE', { count: this.pendingIceCandidates.length });
        const candidates = [...this.pendingIceCandidates];
        this.pendingIceCandidates = [];
        await Promise.all(candidates.map((c) => client.addIceCandidate(c).catch(() => {})));
      }

    } catch (error) {
      this.log('ACCEPT_ERROR', { error });
      this.setStatus('FAILED');
      this.options?.onError?.(error);
      await this.cleanup();
    }
  }

  /**
   * Handle received offer
   */
  private async handleOffer(event: SignalingEvent): Promise<void> {
    if (this.currentStatus === 'INCOMING_CALL') {
      this.log('STORE_PENDING_OFFER');
      this.pendingOffer = event.data;
      return;
    }

    if (!this.webRTCClient || (this.currentStatus !== 'ACCEPTING' && this.currentStatus !== 'CONNECTING')) {
      this.log('OFFER_INVALID_STATE', { status: this.currentStatus });
      return;
    }

    try {
      this.log('HANDLE_OFFER');
      await this.webRTCClient.setRemoteDescription(event.data);

      const answer = await this.webRTCClient.createAnswer();
      await simpleSignalingService.sendAnswer(
        this.options!.receiverId,
        this.options!.callerId,
        this.options!.callId,
        this.options!.chatId,
        answer
      );

      this.setStatus('CONNECTING');
    } catch (error) {
      this.log('OFFER_ERROR', { error });
      this.setStatus('FAILED');
      await this.cleanup();
    }
  }

  /**
   * Handle received answer
   */
  private async handleAnswer(event: SignalingEvent): Promise<void> {
    if (!this.webRTCClient) {
      this.log('ANSWER_NO_CLIENT');
      return;
    }

    try {
      this.log('HANDLE_ANSWER');
      await this.webRTCClient.setRemoteDescription(event.data);
      this.setStatus('CONNECTING');
    } catch (error) {
      this.log('ANSWER_ERROR', { error });
      this.setStatus('FAILED');
      await this.cleanup();
    }
  }

  /**
   * Handle received ICE candidate
   */
  private async handleIceCandidate(event: SignalingEvent): Promise<void> {
    if (!this.webRTCClient) {
      this.log('STORE_PENDING_ICE');
      this.pendingIceCandidates.push(event.data);
      return;
    }

    try {
      await this.webRTCClient.addIceCandidate(event.data);
    } catch (error) {
      this.log('ICE_ERROR', { error });
    }
  }

  /**
   * Handle end call event
   */
  private async handleEndCall(event: SignalingEvent): Promise<void> {
    this.log('HANDLE_END_CALL', { sender: event.sender });
    this.setStatus('ENDED');
    await this.cleanup();
  }

  /**
   * Check if connection is established
   */
  private checkConnection(): void {
    if (!this.webRTCClient) return;

    const state = this.webRTCClient.ConnectionState;
    if (state === 'connected' || state === 'completed') {
      this.setStatus('CONNECTED');
    }
  }

  /**
   * Cancel outgoing call
   */
  async cancelCall(): Promise<void> {
    if (!this.options) return;

    this.log('CANCEL_CALL');
    this.setStatus('CANCELLED');

    await simpleSignalingService.sendEndCall(
      this.options.callerId,
      this.options.receiverId,
      this.options.callId,
      this.options.chatId
    );

    await callHistoryService.saveCallRecord({
      callId: this.options.callId,
      chatId: this.options.chatId,
      callerId: this.options.callerId,
      callerName: this.options.callerName,
      callerAvatar: this.options.callerAvatar,
      receiverId: this.options.receiverId,
      callType: 'voice',
      status: 'cancelled',
    });

    await this.cleanup();
  }

  /**
   * Reject incoming call
   */
  async rejectCall(): Promise<void> {
    if (!this.options) return;

    this.log('REJECT_CALL');
    this.setStatus('REJECTED');

    await simpleSignalingService.sendEndCall(
      this.options.receiverId,
      this.options.callerId,
      this.options.callId,
      this.options.chatId
    );

    await callHistoryService.saveCallRecord({
      callId: this.options.callId,
      chatId: this.options.chatId,
      callerId: this.options.callerId,
      callerName: this.options.callerName,
      callerAvatar: this.options.callerAvatar,
      receiverId: this.options.receiverId,
      callType: 'voice',
      status: 'rejected',
    });

    await this.cleanup();
  }

  /**
   * End active call
   */
  async endCall(durationSecs: number = 0): Promise<void> {
    if (!this.options) {
      await this.cleanup();
      return;
    }

    this.log('END_CALL', { durationSecs });
    const currentOptions = this.options;
    this.setStatus('ENDED');

    await simpleSignalingService.sendEndCall(
      currentOptions.isCaller ? currentOptions.callerId : currentOptions.receiverId,
      currentOptions.isCaller ? currentOptions.receiverId : currentOptions.callerId,
      currentOptions.callId,
      currentOptions.chatId
    ).catch(() => {});

    await callHistoryService.saveCallRecord({
      callId: currentOptions.callId,
      chatId: currentOptions.chatId,
      callerId: currentOptions.callerId,
      callerName: currentOptions.callerName,
      callerAvatar: currentOptions.callerAvatar,
      receiverId: currentOptions.receiverId,
      callType: 'voice',
      status: 'ended',
      duration: durationSecs,
    }).catch(() => {});

    await this.cleanup();
  }

  /**
   * Get WebRTC client instance
   */
  getWebRTCClient(): WebRTCClient | null {
    return this.webRTCClient;
  }

  /**
   * Toggle microphone mute
   */
  setMicrophoneMuted(muted: boolean): void {
    this.webRTCClient?.setMicrophoneMuted(muted);
  }

  /**
   * Cleanup call resources
   */
  private async cleanup(): Promise<void> {
    this.log('CLEANUP');

    if (this.callTimeout) {
      clearTimeout(this.callTimeout);
      this.callTimeout = null;
    }

    if (this.webRTCClient) {
      this.webRTCClient.destroy();
      this.webRTCClient = null;
    }

    audioSessionManager.cleanup();

    // Clear my latestEvent
    if (this.currentUserId) {
      await simpleSignalingService.clearLatestEvent(this.currentUserId);
    }

    this.activeCallId = null;
    this.options = null;
    this.pendingOffer = null;
    this.pendingIceCandidates = [];
    this.setStatus('IDLE');
  }

  /**
   * Cleanup on logout
   */
  destroy(): void {
    this.log('DESTROY');
    
    if (this.eventUnsubscribe) {
      this.eventUnsubscribe();
      this.eventUnsubscribe = null;
    }

    this.cleanup();
    this.currentUserId = null;
  }
}

export const simpleCallManager = new SimpleCallManager();

// Export as callManager for backward compatibility
export const callManager = simpleCallManager;
