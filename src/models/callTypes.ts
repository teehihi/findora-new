import { FieldValue } from 'firebase/firestore';

export type CallStatus =
  | 'IDLE'
  | 'CALLING'
  | 'OUTGOING_CALL'
  | 'RINGING'
  | 'INCOMING_CALL'
  | 'ACCEPTING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'ENDING'
  | 'ENDED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED'
  | 'EXPIRED';

export type CallType = 'voice' | 'video';

export type SerializedCandidate = {
  callId?: string;
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

export type SDPSessionDescription = {
  sdp: string;
  type: 'offer' | 'answer';
};

export interface CallDocument {
  callId: string;
  chatId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  receiverName?: string;
  receiverAvatar?: string;
  callType: CallType;
  status:
    | 'calling'
    | 'ringing'
    | 'accepted'
    | 'connecting'
    | 'connected'
    | 'rejected'
    | 'cancelled'
    | 'ended'
    | 'failed';
  sdpOffer?: SDPSessionDescription | null;
  sdpAnswer?: SDPSessionDescription | null;
  callerCandidates?: SerializedCandidate[];
  receiverCandidates?: SerializedCandidate[];
  createdAt: any;
  updatedAt: any;
  connectedAt?: any;
  endedAt?: any;
  duration?: number;
  failureReason?: string;
}
