import { ref, push, onChildAdded, remove, Unsubscribe } from 'firebase/database';
import { collection, addDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { rtdb, db } from '../config/firebase';
import { SerializedCandidate } from '../models/callTypes';

export type EventType = 'StartAudioCall' | 'Offer' | 'Answer' | 'IceCandidate' | 'EndCall';

export interface SignalingEvent {
  id?: string;
  sender: string;
  target: string;
  type: EventType;
  data?: any;
  timestamp: number;
  callId?: string;
  chatId?: string;
}

class SimpleSignalingService {
  private log(event: string, details?: any) {
    console.log(`[SimpleSignaling:${event}]`, {
      time: new Date().toISOString(),
      ...details,
    });
  }

  isEventValid(event: SignalingEvent): boolean {
    if (!event.timestamp) return true;
    return Math.abs(Date.now() - event.timestamp) < 120000;
  }

  /**
   * Subscribe to incoming events for current user using RTDB and Firestore fallback
   */
  subscribeToLatestEvent(userId: string, onEvent: (event: SignalingEvent | null) => void): Unsubscribe {
    if (!userId) return () => {};
    this.log('SUBSCRIBE', { userId });
    
    // 1. Listen on RTDB
    const userEventsRef = ref(rtdb, `callEvents/${userId}`);
    const unsubRtdb = onChildAdded(
      userEventsRef,
      (snapshot) => {
        const event = snapshot.val() as SignalingEvent;
        if (event && event.type) {
          remove(snapshot.ref).catch(() => {});
          this.log('EVENT_RECEIVED_RTDB', { type: event.type, sender: event.sender, callId: event.callId });
          onEvent(event);
        }
      },
      () => {}
    );

    // 2. Listen on Firestore fallback
    const firestoreRef = collection(db, 'callEvents', userId, 'events');
    const unsubFs = onSnapshot(
      firestoreRef,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const event = { id: change.doc.id, ...change.doc.data() } as SignalingEvent;
            if (event && event.type) {
              deleteDoc(change.doc.ref).catch(() => {});
              this.log('EVENT_RECEIVED_FS', { type: event.type, sender: event.sender, callId: event.callId });
              onEvent(event);
            }
          }
        });
      },
      () => {}
    );

    return () => {
      if (typeof unsubRtdb === 'function') unsubRtdb();
      if (typeof unsubFs === 'function') unsubFs();
    };
  }

  /**
   * Send event to another user by pushing to RTDB node with Firestore fallback on PERMISSION_DENIED
   */
  async sendEventToUser(event: SignalingEvent): Promise<void> {
    if (!event.target) return;
    this.log('SEND_EVENT', { type: event.type, target: event.target });

    try {
      const targetRef = ref(rtdb, `callEvents/${event.target}`);
      await push(targetRef, {
        ...event,
        timestamp: Date.now(),
      });
      this.log('EVENT_SENT_SUCCESS', { type: event.type, target: event.target });
    } catch (error: any) {
      if (error?.message?.includes('PERMISSION_DENIED') || error?.code === 'PERMISSION_DENIED') {
        // Fallback to Firestore when RTDB rules restrict cross-user writes
        try {
          const firestoreTargetRef = collection(db, 'callEvents', event.target, 'events');
          await addDoc(firestoreTargetRef, {
            ...event,
            timestamp: Date.now(),
          });
          this.log('FIRESTORE_FALLBACK_SUCCESS', { type: event.type, target: event.target });
          return;
        } catch (fsError: any) {
          // Ignore permission denied on fallback
          return;
        }
      }
      this.log('SEND_WARNING', { error: error?.message });
    }
  }

  /**
   * Clear all pending events for user safely
   */
  async clearLatestEvent(userId: string): Promise<void> {
    if (!userId) return;
    this.log('CLEAR_EVENT', { userId });
    
    try {
      const userEventsRef = ref(rtdb, `callEvents/${userId}`);
      await remove(userEventsRef).catch(() => {});
    } catch (error: any) {
      // Ignore cleanup error
    }
  }

  /**
   * Helper: Send StartAudioCall event
   */
  async sendStartAudioCall(
    senderId: string,
    targetId: string,
    callId: string,
    chatId: string,
    senderName: string,
    senderAvatar: string
  ): Promise<void> {
    await this.sendEventToUser({
      sender: senderId,
      target: targetId,
      type: 'StartAudioCall',
      callId,
      chatId,
      data: {
        callerName: senderName,
        callerAvatar: senderAvatar,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Helper: Send Offer
   */
  async sendOffer(
    senderId: string,
    targetId: string,
    callId: string,
    chatId: string,
    sdp: { sdp: string; type: string }
  ): Promise<void> {
    await this.sendEventToUser({
      sender: senderId,
      target: targetId,
      type: 'Offer',
      callId,
      chatId,
      data: sdp,
      timestamp: Date.now(),
    });
  }

  /**
   * Helper: Send Answer
   */
  async sendAnswer(
    senderId: string,
    targetId: string,
    callId: string,
    chatId: string,
    sdp: { sdp: string; type: string }
  ): Promise<void> {
    await this.sendEventToUser({
      sender: senderId,
      target: targetId,
      type: 'Answer',
      callId,
      chatId,
      data: sdp,
      timestamp: Date.now(),
    });
  }

  /**
   * Helper: Send ICE Candidate
   */
  async sendIceCandidate(
    senderId: string,
    targetId: string,
    callId: string,
    chatId: string,
    candidate: SerializedCandidate
  ): Promise<void> {
    await this.sendEventToUser({
      sender: senderId,
      target: targetId,
      type: 'IceCandidate',
      callId,
      chatId,
      data: candidate,
      timestamp: Date.now(),
    });
  }

  /**
   * Helper: Send EndCall
   */
  async sendEndCall(
    senderId: string,
    targetId: string,
    callId: string,
    chatId: string
  ): Promise<void> {
    await this.sendEventToUser({
      sender: senderId,
      target: targetId,
      type: 'EndCall',
      callId,
      chatId,
      timestamp: Date.now(),
    });
  }
}

export const simpleSignalingService = new SimpleSignalingService();

// Export as signalingService for backward compatibility
export const signalingService = simpleSignalingService;
