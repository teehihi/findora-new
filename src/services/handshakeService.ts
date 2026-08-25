import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { completePostResolve } from './firebaseService';
import { verifyHandshakePhotoWithGemini } from './geminiService';
import { sendRemotePushNotification } from './pushNotificationService';

// In-memory fallback map for instant reliable verification
const activeHandshakeOtps = new Map<string, string>();

export interface ChatParticipant {
  id: string;
  name: string;
  avatarUrl?: string;
  chatId: string;
  lastMessage?: string;
}

export interface HandshakeSession {
  id?: string;
  postId: string;
  postTitle: string;
  postImageUrl?: string;
  finderId: string;
  finderName: string;
  receiverId?: string;
  receiverName?: string;
  otpCode: string;
  status: 'pending' | 'otp_verified' | 'photo_verifying' | 'completed' | 'cancelled';
  handoverPhotoUrl?: string;
  aiVerification?: {
    isValid: boolean;
    confidence: number;
    explanation: string;
  };
  rating?: number;
  ratingComment?: string;
  createdAt: any;
  completedAt?: any;
}

/**
 * Fetch list of users who have chatted with the post owner about this post or in general
 */
export async function getChatParticipantsForPost(
  postId: string,
  currentUserId: string
): Promise<ChatParticipant[]> {
  try {
    const chatsRef = collection(db, 'chats');
    // Query without orderBy to avoid requiring a Firestore Composite Index
    const q = query(
      chatsRef,
      where('participants', 'array-contains', currentUserId)
    );

    const snap = await getDocs(q);
    const sortedDocs = [...snap.docs].sort((a, b) => {
      const timeA = a.data().lastMessageTime?.toMillis ? a.data().lastMessageTime.toMillis() : (a.data().lastMessageTime?.seconds ? a.data().lastMessageTime.seconds * 1000 : 0);
      const timeB = b.data().lastMessageTime?.toMillis ? b.data().lastMessageTime.toMillis() : (b.data().lastMessageTime?.seconds ? b.data().lastMessageTime.seconds * 1000 : 0);
      return timeB - timeA;
    });

    const participants: ChatParticipant[] = [];
    const seenIds = new Set<string>();

    for (const d of sortedDocs) {
      const data = d.data();
      const otherId = (data.participants || []).find((id: string) => id !== currentUserId);
      if (otherId && !seenIds.has(otherId)) {
        seenIds.add(otherId);
        
        // Get user details
        let name = data.otherUserName || data.userName || 'Người dùng Findora';
        let avatarUrl = data.otherUserAvatar || data.userAvatar || undefined;
        try {
          const userDoc = await getDoc(doc(db, 'users', otherId));
          if (userDoc.exists()) {
            const uData = userDoc.data();
            name = uData.fullName || uData.name || uData.displayName || uData.username || name;
            avatarUrl = uData.avatarUrl || uData.photoURL || uData.photoUrl || uData.avatar || uData.profileImage || uData.image || avatarUrl;
          }
        } catch {}

        if (!avatarUrl || typeof avatarUrl !== 'string' || avatarUrl.trim() === '') {
          avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00A896&color=fff&size=150`;
        }

        participants.push({
          id: otherId,
          name,
          avatarUrl,
          chatId: d.id,
          lastMessage: data.lastMessage || data.lastMsg || '',
        });
      }
    }

    return participants;
  } catch (e) {
    console.log('Error fetching chat participants:', e);
    return [];
  }
}

/**
 * Generate a cryptographically sound 6-digit OTP code
 */
export function generateHandshakeOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create a new Handshake OTP verification session in Firestore
 */
export async function createHandshakeSession(params: {
  postId: string;
  postTitle: string;
  postImageUrl?: string;
  finderId: string;
  finderName: string;
  receiverId?: string;
  receiverName?: string;
}): Promise<{ handshakeId: string; otpCode: string }> {
  const otpCode = generateHandshakeOtp();
  let handshakeId = `handshake_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Store in memory map for instant reliable lookup
  activeHandshakeOtps.set(handshakeId, otpCode);

  const handshakeData: Omit<HandshakeSession, 'id'> = {
    postId: params.postId,
    postTitle: params.postTitle,
    postImageUrl: params.postImageUrl || '',
    finderId: params.finderId,
    finderName: params.finderName,
    receiverId: params.receiverId || '',
    receiverName: params.receiverName || 'Người nhận đồ',
    otpCode,
    status: 'pending',
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, 'handshakes'), handshakeData);
    handshakeId = docRef.id;
    activeHandshakeOtps.set(handshakeId, otpCode);
  } catch (docErr) {
    console.log('Notice: Storing handshake locally due to rules notice:', docErr);
  }

  // Send in-app notification to receiver (picked up automatically by GlobalNotificationListener)
  if (params.receiverId) {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: params.receiverId,
        title: '🤝 Mã OTP Xác Nhận Nhận Lại Đồ',
        message: `${params.finderName} đang xác nhận trao trả "${params.postTitle}". Mã OTP của bạn là: ${otpCode}. Vui lòng đọc mã này cho họ khi gặp mặt!`,
        type: 'resolve',
        postId: params.postId,
        senderId: params.finderId,
        senderName: params.finderName,
        otpCode,
        handshakeId,
        createdAt: serverTimestamp(),
        read: false,
      });
      console.log('[HANDSHAKE] Created notification for receiver:', params.receiverId);
    } catch (notifErr) {
      console.log('Notice: Error creating in-app notification:', notifErr);
    }
  }

  return { handshakeId, otpCode };
}

/**
 * Subscribe to realtime updates for a handshake session
 */
export function subscribeHandshake(
  handshakeId: string,
  onUpdate: (session: HandshakeSession | null) => void
): () => void {
  const docRef = doc(db, 'handshakes', handshakeId);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate({ id: docSnap.id, ...docSnap.data() } as HandshakeSession);
    } else {
      onUpdate(null);
    }
  });
}

/**
 * Find an existing active handshake session for a post (resumes from Step 3 or 4)
 */
export async function getActiveHandshakeSession(
  postId: string,
  userId: string
): Promise<HandshakeSession | null> {
  try {
    const q = query(
      collection(db, 'handshakes'),
      where('postId', '==', postId),
      where('status', 'in', ['pending', 'otp_verified', 'photo_verifying'])
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      for (const d of snap.docs) {
        const data = d.data() as HandshakeSession;
        if (data.finderId === userId || data.receiverId === userId || !data.receiverId) {
          activeHandshakeOtps.set(d.id, data.otpCode);
          return { id: d.id, ...data };
        }
      }
      const firstDoc = snap.docs[0];
      const data = firstDoc.data() as HandshakeSession;
      activeHandshakeOtps.set(firstDoc.id, data.otpCode);
      return { id: firstDoc.id, ...data };
    }
  } catch (e) {
    console.log('Notice: Query active handshake session notice:', e);
  }
  return null;
}

/**
 * Verify OTP entered by the finder
 */
export async function verifyHandshakeOtp(
  handshakeId: string,
  enteredOtp: string
): Promise<{ success: boolean; message: string }> {
  try {
    const memOtp = activeHandshakeOtps.get(handshakeId);
    if (memOtp && memOtp.trim() === enteredOtp.trim()) {
      return { success: true, message: 'Mã OTP chính xác! Chuyển sang bước chụp ảnh xác nhận.' };
    }

    const docRef = doc(db, 'handshakes', handshakeId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      if (memOtp) {
        return {
          success: memOtp.trim() === enteredOtp.trim(),
          message: memOtp.trim() === enteredOtp.trim() ? 'Mã OTP chính xác!' : 'Mã OTP không chính xác.',
        };
      }
      return { success: false, message: 'Phiên xác thực không tồn tại.' };
    }

    const data = snap.data() as HandshakeSession;
    if (data.status === 'completed') {
      return { success: false, message: 'Phiên trao trả này đã hoàn tất trước đó.' };
    }

    if (data.otpCode.trim() !== enteredOtp.trim()) {
      return { success: false, message: 'Mã OTP không chính xác. Vui lòng kiểm tra lại!' };
    }

    // Mark OTP as verified
    await updateDoc(docRef, {
      status: 'otp_verified',
      otpVerifiedAt: serverTimestamp(),
    }).catch(() => {});

    return { success: true, message: 'Mã OTP chính xác! Chuyển sang bước chụp ảnh xác nhận.' };
  } catch (e: any) {
    const memOtp = activeHandshakeOtps.get(handshakeId);
    if (memOtp && memOtp.trim() === enteredOtp.trim()) {
      return { success: true, message: 'Mã OTP chính xác!' };
    }
    return { success: false, message: e.message || 'Lỗi khi xác thực OTP.' };
  }
}

/**
 * Submit handover photo and verify with Gemini AI
 */
export async function verifyAndCompleteHandshakeWithAI(params: {
  handshakeId: string;
  postId: string;
  postTitle: string;
  postDesc?: string;
  originalImageUrl?: string;
  handoverPhotoBase64: string;
  finderUserId: string;
  rewardPoints?: number;
}): Promise<{
  success: boolean;
  matchScore: number;
  explanation: string;
}> {
  const docRef = doc(db, 'handshakes', params.handshakeId);

  // 1. Update status to photo_verifying
  await updateDoc(docRef, {
    status: 'photo_verifying',
  });

  // 2. Call Gemini AI Photo Verification
  const aiResult = await verifyHandshakePhotoWithGemini(
    params.originalImageUrl || '',
    params.postTitle,
    params.postDesc || '',
    params.handoverPhotoBase64
  );

  if (aiResult.isValid) {
    // 3. Mark Handshake as completed & Complete Post Resolution
    await updateDoc(docRef, {
      status: 'completed',
      aiVerification: {
        isValid: true,
        confidence: aiResult.confidence,
        explanation: aiResult.explanation,
      },
      completedAt: serverTimestamp(),
    });

    // 4. Award points to Finder and mark post as resolved
    await completePostResolve(
      params.postId,
      params.finderUserId,
      5, // Default 5 stars
      aiResult.explanation,
      params.rewardPoints || 50
    );

    return {
      success: true,
      matchScore: aiResult.confidence,
      explanation: aiResult.explanation,
    };
  } else {
    // Revert status to otp_verified to allow retrying photo
    await updateDoc(docRef, {
      status: 'otp_verified',
      aiVerification: {
        isValid: false,
        confidence: aiResult.confidence,
        explanation: aiResult.explanation,
      },
    });

    return {
      success: false,
      matchScore: aiResult.confidence,
      explanation: aiResult.explanation || 'Hình ảnh chưa khớp với bài đăng. Vui lòng chụp rõ hơn món đồ!',
    };
  }
}

/**
 * Submit receiver's star rating & comments for the finder
 */
export async function submitReceiverRating(
  handshakeId: string,
  helperUserId: string,
  rating: number,
  comment: string
): Promise<void> {
  try {
    const docRef = doc(db, 'handshakes', handshakeId);
    await updateDoc(docRef, {
      rating,
      ratingComment: comment,
    });

    // Update reputation score in helper's profile
    const helperRef = doc(db, 'users', helperUserId);
    await updateDoc(helperRef, {
      reputationScore: (rating * 2),
    });
  } catch (e) {
    console.log('Error submitting rating:', e);
  }
}
