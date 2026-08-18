import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { auth } from '../config/firebase';
import { CallStatus } from '../models/callTypes';
import { callManager } from '../services/callManager';
import { InAppCallModal } from './InAppCallModal';
import { IncomingCallModal } from './IncomingCallModal';

/**
 * Simple Global Call Handler - Based on Firebase WebRTC Reference
 * 
 * Listens to callManager status and shows:
 * - IncomingCallModal when status = INCOMING_CALL
 * - InAppCallModal when status = OUTGOING_CALL, RINGING, ACCEPTING, CONNECTING, CONNECTED, etc.
 */
export function SimpleIncomingCallHandler() {
  const router = useRouter();
  const [isIncomingVisible, setIsIncomingVisible] = useState(false);
  const [isInAppVisible, setIsInAppVisible] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<CallStatus>('IDLE');

  const [otherUser, setOtherUser] = useState({ name: 'Người dùng Findora', avatarUrl: '' });
  const [callId, setCallId] = useState('');
  const [chatId, setChatId] = useState('');
  const [callerId, setCallerId] = useState('');

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    console.log('[SimpleIncomingCallHandler] INIT', { userId: currentUser.uid });

    // Listen to call manager status changes
    const unsubscribe = callManager.addStatusListener((status, activeCallId) => {
      console.log('[SimpleIncomingCallHandler] STATUS_CHANGE', { status, callId: activeCallId });
      setCurrentStatus(status);

      const options = callManager['options'];
      if (options) {
        setCallId(options.callId);
        setChatId(options.chatId);
        setCallerId(options.callerId);

        const isMeCaller = options.isCaller;
        const name = isMeCaller ? (options.receiverName || options.callerName) : options.callerName;
        const avatar = isMeCaller ? (options.receiverAvatar || options.callerAvatar) : options.callerAvatar;
        setOtherUser({ name: name || 'Người dùng Findora', avatarUrl: avatar || '' });
      }

      if (status === 'INCOMING_CALL') {
        setIsIncomingVisible(true);
        setIsInAppVisible(false);
      } else if (
        status === 'OUTGOING_CALL' ||
        status === 'RINGING' ||
        status === 'ACCEPTING' ||
        status === 'CONNECTING' ||
        status === 'CONNECTED' ||
        status === 'ENDING' ||
        status === 'FAILED' ||
        status === 'REJECTED' ||
        status === 'CANCELLED' ||
        status === 'ENDED'
      ) {
        setIsIncomingVisible(false);
        setIsInAppVisible(true);
      } else {
        setIsIncomingVisible(false);
        setIsInAppVisible(false);
      }
    });

    return () => {
      console.log('[SimpleIncomingCallHandler] CLEANUP');
      unsubscribe();
    };
  }, []);

  const handleAccept = async () => {
    console.log('[SimpleIncomingCallHandler] ACCEPT', { callId });
    setIsIncomingVisible(false);

    // Accept call
    await callManager.acceptCall();
  };

  const handleReject = async () => {
    console.log('[SimpleIncomingCallHandler] REJECT', { callId });
    setIsIncomingVisible(false);

    // Reject call
    await callManager.rejectCall();
  };

  const handleEndCall = async () => {
    console.log('[SimpleIncomingCallHandler] END_CALL');
    setIsInAppVisible(false);

    // End call
    await callManager.endCall();
  };

  return (
    <>
      <IncomingCallModal
        visible={isIncomingVisible}
        caller={{
          name: otherUser.name,
          avatarUrl: otherUser.avatarUrl,
        }}
        onAccept={handleAccept}
        onReject={handleReject}
      />
      <InAppCallModal
        visible={isInAppVisible}
        otherUser={otherUser}
        status={currentStatus}
        onClose={handleEndCall}
      />
    </>
  );
}
