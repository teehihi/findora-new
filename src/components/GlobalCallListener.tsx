import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { auth } from '../config/firebase';
import { IncomingCallModal } from './IncomingCallModal';
import { signalingService, CallInvitePayload } from '../services/signalingService';
import { callManager } from '../services/callManager';

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

    console.log('[CALL_LISTENER:START]', {
      listenerInstanceId,
      currentUserId: currentUser.uid,
      listenerStartedAt,
    });

    const unsubscribe = signalingService.subscribeToUserInvites(
      currentUser.uid,
      (invite) => {
        if (!invite || !invite.callId) {
          setIsIncomingVisible(false);
          setActiveCallData(null);
          return;
        }

        const now = Date.now();
        const createdAt = invite.createdAtTimestamp || invite.timestamp || 0;
        const expiresAt = invite.expiresAtTimestamp || (createdAt + 30000);

        console.log('[CALL:INVITE_SNAPSHOT]', {
          callId: invite.callId,
          callerId: invite.callerId,
          calleeId: invite.receiverId,
          status: 'calling',
          timestamp: now,
        });

        // 1. Expiration Check (Ignore invitations older than 30s)
        if (now > expiresAt) {
          console.log('[CALL:EXPIRED]', {
            callId: invite.callId,
            createdAt,
            expiresAt,
            now,
          });
          setIsIncomingVisible(false);
          setActiveCallData(null);
          return;
        }

        // 2. Active CallId Check (Do not pop overlay if this call is already active in CallManager)
        if (callManager.ActiveCallId === invite.callId && callManager.CurrentStatus !== 'IDLE') {
          return;
        }

        // 3. Processed CallIds Check
        if (processedCallIdsRef.current.has(invite.callId)) {
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

    return () => {
      console.log('[CALL_LISTENER:STOP]', { listenerInstanceId });
      unsubscribe();
    };
  }, []);

  const handleAccept = async () => {
    if (!activeCallData) return;
    const { callId, chatId, callerId } = activeCallData;
    processedCallIdsRef.current.add(callId);

    setIsIncomingVisible(false);
    router.push(`/chat/${callerId}?chatId=${chatId}&activeCallId=${callId}&acceptCall=1` as any);
  };

  const handleReject = async () => {
    if (!activeCallData) return;
    const { callId } = activeCallData;
    processedCallIdsRef.current.add(callId);

    try {
      await callManager.rejectCall();
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
