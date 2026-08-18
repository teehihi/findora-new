import {
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    serverTimestamp,
    setDoc,
    Unsubscribe,
    updateDoc,
    writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { SerializedCandidate } from '../models/callTypes';

export type CallInvitePayload = {
  eventType?: 'invite';
  callId: string;
  chatId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  callType: 'voice';
  status?: string;
  timestamp: number;
  createdAtTimestamp: number;
  expiresAtTimestamp: number;
};

export type SdpPayload = {
  sdp: string;
  type: string;
};

type PeerEvent =
  | (CallInvitePayload & { eventType: 'invite' })
  | {
      eventType: 'accepted' | 'rejected' | 'cancelled' | 'ended' | 'failed' | 'connected';
      callId: string;
      chatId: string;
      senderId: string;
      targetId: string;
      timestamp: number;
    }
  | {
      eventType: 'offer' | 'answer';
      callId: string;
      chatId: string;
      senderId: string;
      targetId: string;
      sdp: SdpPayload;
      timestamp: number;
    }
  | {
      eventType: 'ice';
      callId: string;
      chatId: string;
      senderId: string;
      targetId: string;
      candidate: SerializedCandidate;
      timestamp: number;
    };

function candidateKey(candidate: SerializedCandidate): string {
  return [
    candidate.candidate,
    candidate.sdpMid ?? '',
    candidate.sdpMLineIndex ?? '',
  ].join('|');
}

class SignalingService {
  private log(event: string, details?: any) {
    console.log(`[SignalingService:${event}]`, {
      time: new Date().toISOString(),
      ...details,
    });
  }

  // Send instant CALL_INVITE payload via chats/{chatId}.callState with 30s TTL
  async sendCallInvite(payload: CallInvitePayload): Promise<void> {
    const now = Date.now();
    const createdAt = payload.createdAtTimestamp || now;
    const expiresAt = payload.expiresAtTimestamp || (createdAt + 60000);

    console.log('[CALL_CREATED]', { callId: payload.callId, chatId: payload.chatId, createdAt });
    console.log('[CALL_INVITE_SENT]', { callId: payload.callId, receiverId: payload.receiverId, expiresAt });

    const chatDocRef = doc(db, 'chats', payload.chatId);
    const receiverEventRef = doc(db, 'callEvents', payload.receiverId);
    
    // TASK 1: Sanitize Payload - Explicitly ensure NO fields in the payload are undefined
    const initialCallPayload = {
      callId: payload.callId || '',
      chatId: payload.chatId || '',
      callerId: payload.callerId || '',
      callerName: payload.callerName || 'Người dùng Findora',
      callerAvatar: payload.callerAvatar || '',
      receiverId: payload.receiverId || '',
      callType: payload.callType || 'voice',
      status: 'calling',
      sdpOffer: null,
      sdpAnswer: null,
      callerCandidates: [],
      receiverCandidates: [],
      createdAtTimestamp: createdAt || now,
      expiresAtTimestamp: expiresAt || (now + 60000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    console.log('[CALL:BEFORE_WRITE]', {
      path: `chats/${payload.chatId}`,
      callId: payload.callId,
      callerId: payload.callerId,
      calleeId: payload.receiverId,
      receiverId: payload.receiverId,
      status: 'calling',
      timestamp: Date.now(),
    });

    try {
      await setDoc(receiverEventRef, {
        latestEvent: {
          ...initialCallPayload,
          eventType: 'invite',
        },
        updatedAt: serverTimestamp(),
      });

      setDoc(
        chatDocRef,
        {
          callState: initialCallPayload,
          participants: [payload.callerId, payload.receiverId],
        },
        { merge: true }
      ).catch((err) => this.log('CHAT_CALLSTATE_BACKUP_ERROR', { error: err }));

      console.log('[CALL:AFTER_WRITE]', {
        path: `chats/${payload.chatId}`,
        callId: payload.callId,
        callerId: payload.callerId,
        calleeId: payload.receiverId,
        receiverId: payload.receiverId,
        status: 'calling',
        timestamp: Date.now(),
      });

      console.log('[CALL:INVITE_WRITTEN]', {
        callId: payload.callId,
        path: `chats/${payload.chatId}`,
        timestamp: Date.now(),
      });
    } catch (writeError) {
      console.error('[CALL:WRITE_ERROR]', writeError);
      throw writeError;
    }

    // TASK 1: VERIFY FIRESTORE WRITE IMMEDIATELY
    getDoc(chatDocRef).then((verifySnap) => {
      console.log('[CALL:INVITE_WRITE_VERIFY]', {
        callId: payload.callId,
        chatId: payload.chatId,
        status: verifySnap.data()?.callState?.status,
        callerId: payload.callerId,
        calleeId: payload.receiverId,
        createdAtTimestamp: payload.createdAtTimestamp,
        expiresAtTimestamp: payload.expiresAtTimestamp,
        exists: verifySnap.exists(),
      });
    }).catch((err) => {
      console.log('[CALL:INVITE_WRITE_VERIFY_ERROR]', err);
    });
  }

  // Subscribe to user incoming call invitations with expiration guard
  subscribeToUserInvites(userId: string, callback: (invite: CallInvitePayload | null) => void): Unsubscribe {
    const listenerInstanceId = Math.random().toString(36).substring(2, 9);
    const listenerStartedAt = Date.now();
    console.log('[CALL:LISTENER_READY]', { userId, listenerInstanceId, listenerStartedAt });
    console.log('[CALL:LISTENER_QUERY_CREATED]', {
      userId,
      queryPath: `callEvents/${userId}`,
      queryType: 'direct-user-latest-event',
    });

    let lastInviteCallId: string | null = null;
    const latestEventRef = doc(db, 'callEvents', userId);

    return onSnapshot(
      latestEventRef,
      (snapshot) => {
        const data = snapshot.data();
        const callState = data?.latestEvent;
        const now = Date.now();

        const calleeId = callState?.receiverId || callState?.calleeId;
        const callerId = callState?.callerId;
        const status = callState?.status;
        const createdAt = callState?.createdAtTimestamp || callState?.timestamp || 0;
        const expiresAt = callState?.expiresAtTimestamp || (createdAt + 60000);
        const eventType = callState?.eventType || 'invite';
        const isCalling = eventType === 'invite' && (status === 'calling' || status === 'ringing');
        const isExpired = isCalling && now > expiresAt;
        const isCurrentUserCaller = callerId === userId;
        const isCurrentUserCallee = calleeId === userId;

        console.log('[CALL:USER_EVENT_SNAPSHOT]', {
          callId: callState?.callId,
          callerId,
          calleeId,
          status,
          currentUserId: userId,
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
          timestamp: now,
        });

        if (!callState || !callState.callId) {
          console.log('[CALL:GUARD_REJECT]', { reason: 'NO_CALL_EVENT', userId });
          callback(null);
          return;
        }

        // Don't clear UI if call is already accepted/connecting/connected (user is in active call)
        if (status === 'accepted' || status === 'connecting' || status === 'connected') {
          console.log('[CALL:GUARD_SKIP_ACTIVE]', { reason: 'CALL_ACTIVE', callId: callState.callId, status });
          return; // Keep UI visible, don't callback(null)
        }

        if (!isCalling) {
          console.log('[CALL:GUARD_REJECT]', { reason: 'NOT_RINGING_INVITE', callId: callState.callId, status });
          lastInviteCallId = null;
          callback(null);
          return;
        }

        if (!isCurrentUserCallee || isCurrentUserCaller) {
          console.log('[CALL:GUARD_REJECT]', { reason: 'NOT_TARGET_USER', callId: callState.callId, userId, callerId, calleeId });
          callback(null);
          return;
        }

        if (isExpired) {
          console.log('[CALL:GUARD_REJECT]', { reason: 'EXPIRED', callId: callState.callId, createdAt, expiresAt, now });
          this.clearCallSession(callState.chatId, callState.callId).catch(() => {});
          this.clearUserInvite(userId, callState.callId).catch(() => {});
          callback(null);
          return;
        }

        console.log('[CALL:INVITE_ACCEPTED_BY_LISTENER]', {
          callId: callState.callId,
          callerId,
          calleeId,
          timestamp: now,
        });

        lastInviteCallId = callState.callId;
        console.log('[CALL_INVITE_RECEIVED]', { callId: callState.callId, receiverId: userId });
        callback({
          callId: callState.callId,
          chatId: callState.chatId,
          callerId,
          callerName: callState.callerName || 'Người dùng Findora',
          callerAvatar: callState.callerAvatar || '',
          receiverId: calleeId,
          callType: 'voice',
          status: callState.status,
          timestamp: createdAt,
          createdAtTimestamp: createdAt,
          expiresAtTimestamp: expiresAt,
        });
      },
      (error) => {
        // TASK 7: Log exact error code and message
        console.log('[CALL:LISTENER_ERROR]', {
          code: error?.code,
          message: error?.message,
        });
      }
    );
  }

  async clearUserInvite(userId: string, targetCallId?: string): Promise<void> {
    const latestEventRef = doc(db, 'callEvents', userId);
    try {
      const snap = await getDoc(latestEventRef);
      const currentCallId = snap.data()?.latestEvent?.callId;
      if (targetCallId && currentCallId && currentCallId !== targetCallId) return;
      await setDoc(latestEventRef, {
        latestEvent: null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      this.log('CLEAR_USER_INVITE_ERROR', { userId, targetCallId, error: e });
    }
  }

  async sendCallEvent(targetUserId: string, event: PeerEvent): Promise<void> {
    this.log('SEND_CALL_EVENT', {
      targetUserId,
      eventType: event.eventType,
      callId: event.callId,
    });
    try {
      await setDoc(doc(db, 'callEvents', targetUserId), {
        latestEvent: event,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      this.log('SEND_CALL_EVENT_SUCCESS', {
        targetUserId,
        eventType: event.eventType,
      });
      
      // Verify write immediately
      const verifySnap = await getDoc(doc(db, 'callEvents', targetUserId));
      this.log('SEND_CALL_EVENT_VERIFY', {
        targetUserId,
        eventType: event.eventType,
        storedEventType: verifySnap.data()?.latestEvent?.eventType,
        storedCallId: verifySnap.data()?.latestEvent?.callId,
      });
    } catch (error) {
      console.error('[SEND_CALL_EVENT_ERROR]', {
        targetUserId,
        eventType: event.eventType,
        error,
      });
      throw error;
    }
  }

  async sendCallStatusEvent(
    targetUserId: string,
    senderId: string,
    chatId: string,
    callId: string,
    status: 'accepted' | 'rejected' | 'cancelled' | 'ended' | 'failed' | 'connected'
  ): Promise<void> {
    await this.sendCallEvent(targetUserId, {
      eventType: status,
      callId,
      chatId,
      senderId,
      targetId: targetUserId,
      timestamp: Date.now(),
    });
  }

  // Send SDP Offer
  async sendSdpOffer(targetUserId: string, senderId: string, chatId: string, callId: string, offer: SdpPayload): Promise<void> {
    this.log('SEND_SDP_OFFER', { chatId, callId, targetUserId });
    await this.sendCallEvent(targetUserId, {
      eventType: 'offer',
      callId,
      chatId,
      senderId,
      targetId: targetUserId,
      sdp: offer,
      timestamp: Date.now(),
    });
    const chatDocRef = doc(db, 'chats', chatId);
    updateDoc(chatDocRef, {
      'callState.sdpOffer': offer,
      'callState.updatedAt': serverTimestamp(),
    }).catch((err) => this.log('SEND_SDP_OFFER_ERROR', { error: err }));
  }

  // Send SDP Answer
  async sendSdpAnswer(targetUserId: string, senderId: string, chatId: string, callId: string, answer: SdpPayload): Promise<void> {
    this.log('SEND_SDP_ANSWER', { chatId, callId, targetUserId });
    await this.sendCallEvent(targetUserId, {
      eventType: 'answer',
      callId,
      chatId,
      senderId,
      targetId: targetUserId,
      sdp: answer,
      timestamp: Date.now(),
    });
    const chatDocRef = doc(db, 'chats', chatId);
    updateDoc(chatDocRef, {
      'callState.sdpAnswer': answer,
      'callState.status': 'connecting',
      'callState.updatedAt': serverTimestamp(),
    }).catch((err) => this.log('SEND_SDP_ANSWER_ERROR', { error: err }));
  }

  // Send ICE candidate
  async sendIceCandidate(chatId: string, callId: string, senderId: string, targetUserId: string, isCaller: boolean, candidate: SerializedCandidate): Promise<void> {
    const localCandidatesKey = isCaller ? 'callState.callerCandidates' : 'callState.receiverCandidates';
    await this.sendCallEvent(targetUserId, {
      eventType: 'ice',
      callId,
      chatId,
      senderId,
      targetId: targetUserId,
      candidate: { ...candidate, callId },
      timestamp: Date.now(),
    });
    const chatDocRef = doc(db, 'chats', chatId);
    updateDoc(chatDocRef, {
      [localCandidatesKey]: arrayUnion({ ...candidate, callId }),
      'callState.updatedAt': serverTimestamp(),
    }).catch(() => {});
  }

  // Atomic/Conditional Status Update (Verifies targetCallId matches current document callId)
  async updateSessionStatus(chatId: string, targetCallId: string, status: string): Promise<void> {
    this.log('UPDATE_SESSION_STATUS', { chatId, targetCallId, status });
    const chatDocRef = doc(db, 'chats', chatId);

    try {
      const snap = await getDoc(chatDocRef);
      if (snap.exists()) {
        const currentData = snap.data();
        const currentCallId = currentData?.callState?.callId;

        // Atomic Guard: Do NOT overwrite callState if a NEW call (Call 2) has already started!
        if (currentCallId && currentCallId !== targetCallId) {
          console.log('[CALL_CLEANUP_IGNORED]', {
            cleanupCallId: targetCallId,
            currentCallId,
            reason: 'Target callId mismatch with active call document',
          });
          return;
        }
      }

      await updateDoc(chatDocRef, {
        'callState.status': status,
        'callState.updatedAt': serverTimestamp(),
      });
      console.log('[CALL_STATE_CHANGE]', { chatId, targetCallId, status });
    } catch (e) {
      console.log('[SignalingService] Error in updateSessionStatus:', e);
    }
  }

  // Subscribe to call session signaling events (DEDUPLICATED ONCE PER EVENT & STRICT CALLID GUARD)
  subscribeToCallSession(
    userId: string,
    callId: string,
    isCaller: boolean,
    handlers: {
      onStatusChange?: (status: string) => void;
      onOffer?: (offer: SdpPayload) => void;
      onAnswer?: (answer: SdpPayload) => void;
      onIceCandidate?: (candidate: SerializedCandidate) => void;
    }
  ): Unsubscribe {
    this.log('SUBSCRIBE_CALL_SESSION', { userId, callId, isCaller });

    let lastHandledStatus: string | null = null;
    let offerHandled = false;
    let answerHandled = false;
    const handledCandidates = new Set<string>();

    return onSnapshot(
      doc(db, 'callEvents', userId),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data()?.latestEvent || {};

        // Strict CallId Guard: Reject snapshots for previous or different callIds
        if (!data.callId || data.callId !== callId) {
          console.log('[CALL_STALE_SNAPSHOT_IGNORED]', {
            expectedCallId: callId,
            receivedCallId: data.callId,
          });
          return;
        }

        if (data.eventType === 'offer' && data.sdp && !offerHandled) {
          offerHandled = true;
          this.log('OFFER_DISPATCH');
          handlers.onOffer?.(data.sdp);
          return;
        }

        if (data.eventType === 'answer' && data.sdp && !answerHandled) {
          answerHandled = true;
          this.log('ANSWER_DISPATCH');
          handlers.onAnswer?.(data.sdp);
          return;
        }

        if (data.eventType === 'ice' && data.candidate) {
          const cand = data.candidate as SerializedCandidate;
          const key = candidateKey(cand);
          if (!handledCandidates.has(key)) {
            handledCandidates.add(key);
            handlers.onIceCandidate?.(cand);
          }
          return;
        }

        const statusFromEvent = ['accepted', 'rejected', 'cancelled', 'ended', 'failed', 'connected'].includes(data.eventType)
          ? data.eventType
          : data.status;

        // Deduplicate Status Changes (Fire EXACTLY ONCE per status transition)
        if (statusFromEvent && statusFromEvent !== lastHandledStatus) {
          lastHandledStatus = statusFromEvent;
          this.log('STATUS_CHANGE_DISPATCH', { status: statusFromEvent });
          handlers.onStatusChange?.(statusFromEvent);
        }
      },
      (error) => {
        console.log('[SignalingService] Call session snapshot notice:', error?.message);
      }
    );
  }

  // Atomic/Conditional Session Cleanup (Verifies targetCallId matches current document callId)
  async clearCallSession(chatId: string, targetCallId?: string): Promise<void> {
    console.log('[CALL_CLEANUP]', { chatId, targetCallId });
    const chatDocRef = doc(db, 'chats', chatId);

    try {
      if (targetCallId) {
        const snap = await getDoc(chatDocRef);
        if (snap.exists()) {
          const currentData = snap.data();
          const currentCallId = currentData?.callState?.callId;

          // Atomic Guard: Do NOT clear callState if a NEW call (Call 2) has already started!
          if (currentCallId && currentCallId !== targetCallId) {
            console.log('[CALL_CLEANUP_IGNORED]', {
              cleanupCallId: targetCallId,
              currentCallId,
              reason: 'Target callId mismatch with active call document during clearCallSession',
            });
            return;
          }
        }
      }

      await updateDoc(chatDocRef, {
        'callState.sdpOffer': null,
        'callState.sdpAnswer': null,
        'callState.status': 'ended',
        'callState.endedAt': serverTimestamp(),
      });
    } catch (e) {
      console.log('[SignalingService] Error in clearCallSession:', e);
    }
  }

  // TASK 3: Deep Delete Utility for Chats (Deletes messages subcollection before deleting parent doc)
  async deleteChatCompletely(chatId: string): Promise<void> {
    console.log('[CHAT_DELETE:START]', { chatId });
    const chatDocRef = doc(db, 'chats', chatId);
    const messagesCollRef = collection(db, 'chats', chatId, 'messages');

    try {
      const messagesSnap = await getDocs(messagesCollRef);
      console.log('[CHAT_DELETE:MESSAGES_FOUND]', { count: messagesSnap.size, chatId });

      // Delete all messages in batches of 500
      let batch = writeBatch(db);
      let count = 0;

      for (const msgDoc of messagesSnap.docs) {
        batch.delete(msgDoc.ref);
        count++;
        if (count % 500 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }

      if (count % 500 !== 0 || count === 0) {
        await batch.commit();
      }

      // Delete parent chat document
      await deleteDoc(chatDocRef);
      console.log('[CHAT_DELETE:SUCCESS]', { chatId, deletedMessagesCount: count });
    } catch (error) {
      console.error('[CHAT_DELETE:ERROR]', { chatId, error });
      throw error;
    }
  }
}

export const signalingService = new SignalingService();
export const deleteChatCompletely = (chatId: string) => signalingService.deleteChatCompletely(chatId);
