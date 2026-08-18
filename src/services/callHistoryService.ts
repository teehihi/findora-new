import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export type CallHistoryRecord = {
  callId: string;
  chatId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  callType: 'voice';
  status: 'ended' | 'rejected' | 'cancelled' | 'failed' | 'missed';
  duration?: number;
};

class CallHistoryService {
  async saveCallRecord(record: CallHistoryRecord): Promise<void> {
    console.log('[CallHistoryService] SAVE_RECORD', { callId: record.callId, status: record.status });
    try {
      const callDocRef = doc(db, 'calls', record.callId);
      await setDoc(
        callDocRef,
        {
          ...record,
          duration: record.duration || 0,
          updatedAt: serverTimestamp(),
          endedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Save system message to chat messages subcollection for chat UI history
      if (record.chatId) {
        const messagesCollRef = collection(db, 'chats', record.chatId, 'messages');
        const textMessage =
          record.status === 'rejected' || record.status === 'cancelled' || record.status === 'missed'
            ? '📞 Cuộc gọi nhỡ'
            : `📞 Cuộc gọi thoại (${record.duration || 0}s)`;

        await addDoc(messagesCollRef, {
          text: textMessage,
          senderId: record.callerId,
          receiverId: record.receiverId,
          type: 'call_log',
          callId: record.callId,
          callStatus: record.status,
          duration: record.duration || 0,
          createdAt: serverTimestamp(),
        }).catch((err) => console.log('[CallHistoryService] Error saving chat message:', err));
      }
    } catch (e) {
      console.log('[CallHistoryService] Error saving record:', e);
    }
  }
}

export const callHistoryService = new CallHistoryService();
