import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { SerializedCandidate } from '../models/callTypes';

export type CallInvitePayload = {
  callId: string;
  chatId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  callType: 'voice';
  timestamp: number;
  createdAtTimestamp: number;
  expiresAtTimestamp: number;
};

export type SdpPayload = {
  sdp: string;
  type: string;
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
    const expiresAt = payload.expiresAtTimestamp || (createdAt + 30000); // 30s TTL

    console.log('[CALL_CREATED]', { callId: payload.callId, chatId: payload.chatId, createdAt });
    console.log('[CALL_INVITE_SENT]', { callId: payload.callId, receiverId: payload.receiverId, expiresAt });

    const chatDocRef = doc(db, 'chats', payload.chatId);
    
    const initialCallPayload = {
      callId: payload.callId,
      chatId: payload.chatId,
      callerId: payload.callerId,
      callerName: payload.callerName,
      callerAvatar: payload.callerAvatar,
      receiverId: payload.receiverId,
      callType: payload.callType,
      status: 'calling',
      sdpOffer: null,
      sdpAnswer: null,
      callerCandidates: [],
      receiverCandidates: [],
      createdAtTimestamp: createdAt,
      expiresAtTimestamp: expiresAt,
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

    await setDoc(
      chatDocRef,
      { callState: initialCallPayload, participants: [payload.callerId, payload.receiverId] },
      { merge: true }
    );

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
    console.log('[CALL:LISTENER_READY]', { userId, listenerInstanceId });
    console.log('[CALL:LISTENER_QUERY_CREATED]', {
      userId,
      queryPath: 'chats',
      queryType: 'participants-array-contains',
    });

    const qChats = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId)
    );

    // TASK 4: Initial getDocs verification
    getDocs(qChats).then((initialSnaps) => {
      console.log('[CALL:LISTENER_INITIAL_QUERY]', {
        count: initialSnaps.size,
        docs: initialSnaps.docs.map((d) => ({
          id: d.id,
          callStateStatus: d.data().callState?.status,
          callId: d.data().callState?.callId,
        })),
      });
    }).catch((e) => console.log('[CALL:LISTENER_INITIAL_QUERY_ERROR]', e));

    let lastInviteCallId: string | null = null;

    return onSnapshot(
      qChats,
      (snapshot) => {
        let activeCallDoc: CallInvitePayload | null = null;
        const now = Date.now();

        // TASK 6 DIAGNOSTIC: Log every raw doc change BEFORE any filter
        snapshot.docChanges().forEach((change) => {
          const docData = change.doc.data();
          console.log('[CALL:RAW_DOC_CHANGE]', {
            type: change.type,
            docId: change.doc.id,
            hasCallState: !!docData?.callState,
            callState: docData?.callState,
            participants: docData?.participants,
            fromCache: snapshot.metadata.fromCache,
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
            timestamp: Date.now(),
          });
        });

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const callState = data.callState;

          const calleeId = callState?.receiverId || callState?.calleeId;
          const callerId = callState?.callerId;
          const status = callState?.status;
          const createdAt = callState?.createdAtTimestamp || callState?.timestamp || 0;
          const expiresAt = callState?.expiresAtTimestamp || (createdAt + 30000);
          const isExpired = now > expiresAt;
          const isCurrentUserCaller = callerId === userId;
          const isCurrentUserCallee = calleeId === userId;
          const isCalling = status === 'calling' || status === 'ringing';

          console.log('[CALL:CHAT_SNAPSHOT]', {
            chatId: docSnap.id,
            hasCallState: !!callState,
            callId: callState?.callId,
            callerId,
            calleeId,
            status,
            participants: data.participants,
            fromCache: docSnap.metadata.fromCache,
            hasPendingWrites: docSnap.metadata.hasPendingWrites,
          });

          console.log('[CALL:GUARD_CHECK]', {
            callId: callState?.callId,
            status,
            currentUserId: userId,
            callerId,
            calleeId,
            expiresAtTimestamp: expiresAt,
            now,
            isExpired,
            isCurrentUserCaller,
            isCurrentUserCallee,
            isCalling,
          });

          if (!callState || !callState.callId) {
            console.log('[CALL:GUARD_REJECT]', { reason: 'NO_CALL_STATE', chatId: docSnap.id });
            return;
          }

          if (!isCalling) {
            console.log('[CALL:GUARD_REJECT]', { reason: 'NOT_CALLING', callId: callState.callId, status });
            return;
          }

          if (!isCurrentUserCallee) {
            console.log('[CALL:GUARD_REJECT]', { reason: 'NOT_CALLEE', callId: callState.callId, currentUserId: userId, calleeId });
            return;
          }

          if (isCurrentUserCaller) {
            console.log('[CALL:GUARD_REJECT]', { reason: 'IS_CALLER', callId: callState.callId, currentUserId: userId, callerId });
            return;
          }

          if (isExpired) {
            console.log('[CALL:GUARD_REJECT]', { reason: 'EXPIRED', callId: callState.callId, createdAt, expiresAt, now });
            return;
          }

          console.log('[CALL:INVITE_ACCEPTED_BY_LISTENER]', {
            callId: callState.callId,
            callerId,
            calleeId,
            timestamp: now,
          });

          activeCallDoc = {
            callId: callState.callId,
            chatId: docSnap.id,
            callerId,
            callerName: callState.callerName || 'Người dùng Findora',
            callerAvatar: callState.callerAvatar || '',
            receiverId: calleeId,
            callType: 'voice',
            timestamp: createdAt,
            createdAtTimestamp: createdAt,
            expiresAtTimestamp: expiresAt,
          };
        });

        if (activeCallDoc) {
          lastInviteCallId = (activeCallDoc as CallInvitePayload).callId;
          console.log('[CALL_INVITE_RECEIVED]', { callId: (activeCallDoc as CallInvitePayload).callId, receiverId: userId });
          callback(activeCallDoc);
        } else {
          if (lastInviteCallId) {
            lastInviteCallId = null;
            callback(null);
          }
        }
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

  async clearUserInvite(userId: string): Promise<void> {
    // Active status change handles invite clearance on chats/{chatId}
  }

  // Send SDP Offer
  async sendSdpOffer(chatId: string, offer: SdpPayload): Promise<void> {
    this.log('SEND_SDP_OFFER', { chatId });
    const chatDocRef = doc(db, 'chats', chatId);
    await updateDoc(chatDocRef, {
      'callState.sdpOffer': offer,
      'callState.status': 'calling',
      'callState.updatedAt': serverTimestamp(),
    }).catch((err) => this.log('SEND_SDP_OFFER_ERROR', { error: err }));
  }

  // Send SDP Answer
  async sendSdpAnswer(chatId: string, answer: SdpPayload): Promise<void> {
    this.log('SEND_SDP_ANSWER', { chatId });
    const chatDocRef = doc(db, 'chats', chatId);
    await updateDoc(chatDocRef, {
      'callState.sdpAnswer': answer,
      'callState.status': 'connecting',
      'callState.updatedAt': serverTimestamp(),
    }).catch((err) => this.log('SEND_SDP_ANSWER_ERROR', { error: err }));
  }

  // Send ICE candidate
  async sendIceCandidate(chatId: string, isCaller: boolean, candidate: SerializedCandidate): Promise<void> {
    const localCandidatesKey = isCaller ? 'callState.callerCandidates' : 'callState.receiverCandidates';
    const chatDocRef = doc(db, 'chats', chatId);
    await updateDoc(chatDocRef, {
      [localCandidatesKey]: arrayUnion(candidate),
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
    chatId: string,
    callId: string,
    isCaller: boolean,
    handlers: {
      onStatusChange?: (status: string) => void;
      onOffer?: (offer: SdpPayload) => void;
      onAnswer?: (answer: SdpPayload) => void;
      onIceCandidate?: (candidate: SerializedCandidate) => void;
    }
  ): Unsubscribe {
    this.log('SUBSCRIBE_CALL_SESSION', { chatId, callId, isCaller });
    const chatDocRef = doc(db, 'chats', chatId);
    const remoteCandidatesKey = isCaller ? 'receiverCandidates' : 'callerCandidates';

    let lastHandledStatus: string | null = null;
    let offerHandled = false;
    let answerHandled = false;
    const handledCandidates = new Set<string>();

    return onSnapshot(
      chatDocRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const chatData = snapshot.data();
        const data = chatData.callState || {};

        // Strict CallId Guard: Reject snapshots for previous or different callIds
        if (!data.callId || data.callId !== callId) {
          console.log('[CALL_STALE_SNAPSHOT_IGNORED]', {
            expectedCallId: callId,
            receivedCallId: data.callId,
          });
          return;
        }

        // Deduplicate Status Changes (Fire EXACTLY ONCE per status transition)
        if (data.status && data.status !== lastHandledStatus) {
          lastHandledStatus = data.status;
          this.log('STATUS_CHANGE_DISPATCH', { status: data.status });
          handlers.onStatusChange?.(data.status);
        }

        // Deduplicate SDP Offer (Fire EXACTLY ONCE)
        if (data.sdpOffer && !offerHandled) {
          offerHandled = true;
          this.log('OFFER_DISPATCH');
          handlers.onOffer?.(data.sdpOffer);
        }

        // Deduplicate SDP Answer (Fire EXACTLY ONCE)
        if (data.sdpAnswer && !answerHandled) {
          answerHandled = true;
          this.log('ANSWER_DISPATCH');
          handlers.onAnswer?.(data.sdpAnswer);
        }

        // Deduplicate ICE Candidates (Fire EXACTLY ONCE per candidate key)
        const remoteCandidates: SerializedCandidate[] = Array.isArray(data[remoteCandidatesKey])
          ? data[remoteCandidatesKey]
          : [];

        for (const cand of remoteCandidates) {
          if (!cand) continue;
          const key = candidateKey(cand);
          if (!handledCandidates.has(key)) {
            handledCandidates.add(key);
            handlers.onIceCandidate?.(cand);
          }
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
}

export const signalingService = new SignalingService();
