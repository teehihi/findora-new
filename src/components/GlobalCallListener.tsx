import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { IncomingCallModal } from './IncomingCallModal';
import { stopAllRingtones } from '../services/voiceCallService';

export function GlobalCallListener() {
  const router = useRouter();
  const [isIncomingVisible, setIsIncomingVisible] = useState(false);
  const [activeCallData, setActiveCallData] = useState<{
    chatId: string;
    callerId: string;
    callerName: string;
    callerAvatar: string;
  } | null>(null);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Listen globally across all user chats for incoming calls
    const qChats = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      qChats,
      (snapshot) => {
        let hasActiveCalling = false;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const callState = data.callState;

          if (
            callState &&
            callState.status === 'calling' &&
            callState.receiverId === currentUser.uid
          ) {
            hasActiveCalling = true;
            setActiveCallData({
              chatId: docSnap.id,
              callerId: callState.callerId,
              callerName: callState.callerName || 'Người dùng Findora',
              callerAvatar: callState.callerAvatar || '',
            });
            setIsIncomingVisible(true);
          }
        });

        if (!hasActiveCalling && isIncomingVisible) {
          setIsIncomingVisible(false);
          setActiveCallData(null);
          stopAllRingtones();
        }
      },
      (error) => {
        console.log('Notice: Global call listener error:', error?.message);
      }
    );

    return () => {
      unsubscribe();
      stopAllRingtones();
    };
  }, []);

  const handleAccept = async () => {
    if (!activeCallData) return;
    const { chatId, callerId } = activeCallData;

    try {
      await updateDoc(doc(db, 'chats', chatId), {
        'callState.status': 'connected',
        'callState.connectedAt': new Date().toISOString(),
      });
      await updateDoc(doc(db, 'calls', chatId), { status: 'connected' }).catch(() => {});
    } catch (e) {
      console.log('Error accepting global call:', e);
    } finally {
      setIsIncomingVisible(false);
      stopAllRingtones();
      router.push(`/chat/${callerId}?chatId=${chatId}` as any);
    }
  };

  const handleReject = async () => {
    if (!activeCallData) return;
    const { chatId } = activeCallData;

    try {
      await updateDoc(doc(db, 'chats', chatId), {
        'callState.status': 'rejected',
      });
      await updateDoc(doc(db, 'calls', chatId), { status: 'rejected' }).catch(() => {});
    } catch (e) {
      console.log('Error rejecting global call:', e);
    } finally {
      setIsIncomingVisible(false);
      setActiveCallData(null);
      stopAllRingtones();
    }
  };

  if (!isIncomingVisible || !activeCallData) return null;

  return (
    <IncomingCallModal
      visible={isIncomingVisible}
      caller={{
        name: activeCallData.callerName,
        avatarUrl: activeCallData.callerAvatar,
      }}
      onAccept={handleAccept}
      onReject={handleReject}
    />
  );
}
