import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { auth } from '../config/firebase';
import { IncomingCallModal } from './IncomingCallModal';
import { signalingService, CallInvitePayload } from '../services/signalingService';
import { callManager } from '../services/callManager';

const activeListenerUsers = new Set<string>();

function inviteToCallOptions(invite: CallInvitePayload) {
  return {
    callId: invite.callId,
    chatId: invite.chatId,
    callerId: invite.callerId,
    callerName: invite.callerName || 'Người dùng Findora',
    callerAvatar: invite.callerAvatar || '',
    receiverId: invite.receiverId,
    isCaller: false,
  };
}

export function GlobalCallListener() {
  const router = useRouter();
  const [isIncomingVisible, setIsIncomingVisible] = useState(false);
  const [activeCallData, setActiveCallData] = useState<CallInvitePayload | null>(null);
  const processedCallIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const listenerInstanceId = Math.random().toString(36).substring(2, 9);
    const listenerStartedAt = Date.now();

    if (activeListenerUsers.has(currentUser.uid)) {
      console.log('[GLOBAL_CALL_LISTENER] DUPLICATE_LISTENER_DETECTED', {
        listenerId: listenerInstanceId,
        userId: currentUser.uid,
        timestamp: Date.now(),
      });
    }
    activeListenerUsers.add(currentUser.uid);

    console.log('[GLOBAL_CALL_LISTENER] MOUNT', {
      listenerInstanceId,
      currentUserId: currentUser.uid,
      listenerStartedAt,
    });
    console.log('[GLOBAL_CALL_LISTENER] SUBSCRIBE', {
      listenerId: listenerInstanceId,
      userId: currentUser.uid,
      currentCallState: callManager.CurrentStatus,
      timestamp: Date.now(),
    });

    const unsubscribeInvites = signalingService.subscribeToUserInvites(
      currentUser.uid,
      (invite) => {
        if (!invite || !invite.callId) {
          console.log('[GLOBAL_CALL_LISTENER] CLEARED_CALL', {
            listenerId: listenerInstanceId,
            userId: currentUser.uid,
            currentCallState: callManager.CurrentStatus,
            timestamp: Date.now(),
          });
          setIsIncomingVisible(false);
          setActiveCallData(null);
          return;
        }

        const now = Date.now();
        const createdAt = invite.createdAtTimestamp || invite.timestamp || 0;
        const expiresAt = invite.expiresAtTimestamp || (createdAt + 30000);

        console.log('[GLOBAL_CALL_LISTENER] INCOMING_EVENT', {
          listenerId: listenerInstanceId,
          callId: invite.callId,
          callerId: invite.callerId,
          receiverId: invite.receiverId,
          currentCallState: callManager.CurrentStatus,
          timestamp: now,
        });

        const status = invite.status || 'calling';
        const isCallingStatus = status === 'calling' || status === 'ringing';

        // If status is ended, cancelled, rejected, or failed, dismiss immediately!
        if (!isCallingStatus) {
          console.log('[GLOBAL_CALL_LISTENER] IGNORE_STALE_CALL', {
            listenerId: listenerInstanceId,
            callId: invite.callId,
            callerId: invite.callerId,
            receiverId: invite.receiverId,
            currentCallState: callManager.CurrentStatus,
            status,
            timestamp: now,
          });
          processedCallIdsRef.current.add(invite.callId);
          setIsIncomingVisible(false);
          setActiveCallData(null);
          return;
        }

        // 1. Expiration Check (ONLY ignore invitations older than 30s when still calling/ringing)
        if (now > expiresAt) {
          console.log('[GLOBAL_CALL_LISTENER] IGNORE_STALE_CALL', {
            listenerId: listenerInstanceId,
            callId: invite.callId,
            callerId: invite.callerId,
            receiverId: invite.receiverId,
            currentCallState: callManager.CurrentStatus,
            createdAt,
            expiresAt,
            timestamp: now,
          });
          setIsIncomingVisible(false);
          setActiveCallData(null);
          return;
        }

        // 2. Active CallId Check (Do not pop overlay if this call is already active in CallManager)
        if (callManager.ActiveCallId === invite.callId && callManager.CurrentStatus !== 'IDLE') {
          console.log('[GLOBAL_CALL_LISTENER] IGNORE_ACTIVE_CALL', {
            listenerId: listenerInstanceId,
            callId: invite.callId,
            callerId: invite.callerId,
            receiverId: invite.receiverId,
            currentCallState: callManager.CurrentStatus,
            timestamp: now,
          });
          return;
        }

        // 3. Processed CallIds Check
        if (processedCallIdsRef.current.has(invite.callId)) {
          console.log('[GLOBAL_CALL_LISTENER] IGNORE_STALE_CALL', {
            listenerId: listenerInstanceId,
            callId: invite.callId,
            callerId: invite.callerId,
            receiverId: invite.receiverId,
            currentCallState: callManager.CurrentStatus,
            reason: 'processed_call_id',
            timestamp: now,
          });
          return;
        }

        const latencyMs = now - createdAt;
        console.log('[CALL:INVITE_ACCEPTED_BY_LISTENER]', {
          callId: invite.callId,
          callerId: invite.callerId,
          calleeId: invite.receiverId,
        });
        console.log('[CALL:INVITE_LATENCY]', {
          callId: invite.callId,
          latencyMs,
          rating: latencyMs < 500 ? 'EXCELLENT (<500ms)' : latencyMs < 1000 ? 'GOOD (<1s)' : latencyMs < 2000 ? 'ACCEPTABLE (<2s)' : 'SLOW (>2s)',
        });
        console.log('[CALL:INCOMING_UI_ATTEMPT]', {
          callId: invite.callId,
          callerId: invite.callerId,
          calleeId: invite.receiverId,
          currentUserId: currentUser.uid,
          timestamp: now,
        });

        setActiveCallData(invite);
        setIsIncomingVisible(true);
      }
    );

    // TASK 2: Listen to CallManager status changes and aggressively dismiss modal on ENDED / FAILED states
    const unsubscribeStatus = callManager.addStatusListener((status, callId) => {
      console.log('[GLOBAL_CALL_LISTENER] ACCEPTED_CALL', {
        listenerId: listenerInstanceId,
        callId,
        userId: currentUser.uid,
        currentCallState: status,
        timestamp: Date.now(),
      });
      if (
        status === 'ACCEPTING' ||
        status === 'CONNECTING' ||
        status === 'CONNECTED' ||
        status === 'ENDED' ||
        status === 'FAILED' ||
        status === 'REJECTED' ||
        status === 'CANCELLED'
      ) {
        if (callId) {
          processedCallIdsRef.current.add(callId);
        }
        setIsIncomingVisible(false);
        setActiveCallData(null);
      }
    });

    return () => {
      console.log('[GLOBAL_CALL_LISTENER] UNSUBSCRIBE', {
        listenerId: listenerInstanceId,
        userId: currentUser.uid,
        currentCallState: callManager.CurrentStatus,
        timestamp: Date.now(),
      });
      activeListenerUsers.delete(currentUser.uid);
      unsubscribeInvites();
      unsubscribeStatus();
    };
  }, []);

  const handleAccept = async () => {
    if (!activeCallData) return;
    const { callId, chatId, callerId } = activeCallData;
    processedCallIdsRef.current.add(callId);
    callManager.claimIncomingCall(inviteToCallOptions(activeCallData), 'ACCEPTING');

    setIsIncomingVisible(false);
    router.push(`/chat/${callerId}?chatId=${chatId}&activeCallId=${callId}&acceptCall=1` as any);
  };

  const handleReject = async () => {
    if (!activeCallData) return;
    const { callId } = activeCallData;
    processedCallIdsRef.current.add(callId);

    try {
      await callManager.rejectIncomingCall(inviteToCallOptions(activeCallData));
    } catch (e) {
      console.log('Error rejecting call:', e);
    } finally {
      setIsIncomingVisible(false);
      setActiveCallData(null);
    }
  };

  if (!isIncomingVisible || !activeCallData) return null;

  return (
    <IncomingCallModal
      visible={isIncomingVisible}
      caller={{
        name: activeCallData.callerName || 'Người dùng Findora',
        avatarUrl: activeCallData.callerAvatar || '',
      }}
      onAccept={handleAccept}
      onReject={handleReject}
    />
  );
}
