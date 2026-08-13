import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
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
    } catch (e) {
      console.log('[CallHistoryService] Error saving record:', e);
    }
  }
}

export const callHistoryService = new CallHistoryService();
