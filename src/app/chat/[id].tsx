import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhoneMissIcon, PhoneReceiveIcon, PhoneSendIcon, VideoReceiveIcon } from '../../components/CallIcons';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { InAppCallModal } from '../../components/InAppCallModal';
import { IncomingCallModal } from '../../components/IncomingCallModal';
import { auth, db } from '../../config/firebase';
import { ChatMessage } from '../../models/types';
import { fetchPostById, getLevelFromPoints, getPosterDetails } from '../../services/firebaseService';
import { subscribeUserPresence } from '../../services/presenceService';
import { playSoundEffect } from '../../services/soundService';
import { CallStatus } from '../../models/callTypes';
import { callManager } from '../../services/callManager';

type MessagePosition = 'SINGLE' | 'TOP' | 'MIDDLE' | 'BOTTOM';
const MESSAGES_PAGE_SIZE = 25;

const getMessagePosition = (index: number, list: ChatMessage[]): MessagePosition => {
  if (!list || list.length === 0 || index < 0) return 'SINGLE';
  const current = list[index];
  const hasPrev = index > 0;
  const hasNext = index < list.length - 1;

  const getMillis = (ts: any) => {
    if (!ts) return Date.now();
    if (ts.seconds) return ts.seconds * 1000;
    if (typeof ts === 'number') return ts;
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? Date.now() : parsed;
  };

  const isWithinTimeGroup = (t1: any, t2: any) => {
    return Math.abs(getMillis(t1) - getMillis(t2)) < 10 * 60 * 1000; // 10 mins
  };

  let samePrev = false;
  let sameNext = false;

  if (hasPrev) {
    const prev = list[index - 1];
    samePrev = prev.senderId === current.senderId && isWithinTimeGroup(prev.timestamp, current.timestamp);
  }
  if (hasNext) {
    const next = list[index + 1];
    sameNext = next.senderId === current.senderId && isWithinTimeGroup(current.timestamp, next.timestamp);
  }

  if (!samePrev && !sameNext) return 'SINGLE';
  if (!samePrev) return 'TOP';
  if (!sameNext) return 'BOTTOM';
  return 'MIDDLE';
};

const getBubbleBorderRadius = (isMe: boolean, position: MessagePosition) => {
  const radius = 18;
  const smallRadius = 4;

  if (isMe) {
    switch (position) {
      case 'TOP':
        return {
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          borderBottomLeftRadius: radius,
          borderBottomRightRadius: smallRadius,
        };
      case 'MIDDLE':
        return {
          borderTopLeftRadius: radius,
          borderTopRightRadius: smallRadius,
          borderBottomLeftRadius: radius,
          borderBottomRightRadius: smallRadius,
        };
      case 'BOTTOM':
        return {
          borderTopLeftRadius: radius,
          borderTopRightRadius: smallRadius,
          borderBottomLeftRadius: radius,
          borderBottomRightRadius: radius,
        };
      case 'SINGLE':
      default:
        return {
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          borderBottomLeftRadius: radius,
          borderBottomRightRadius: smallRadius,
        };
    }
  } else {
    switch (position) {
      case 'TOP':
        return {
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          borderBottomLeftRadius: smallRadius,
          borderBottomRightRadius: radius,
        };
      case 'MIDDLE':
        return {
          borderTopLeftRadius: smallRadius,
          borderTopRightRadius: radius,
          borderBottomLeftRadius: smallRadius,
          borderBottomRightRadius: radius,
        };
      case 'BOTTOM':
        return {
          borderTopLeftRadius: smallRadius,
          borderTopRightRadius: radius,
          borderBottomLeftRadius: radius,
          borderBottomRightRadius: radius,
        };
      case 'SINGLE':
      default:
        return {
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          borderBottomLeftRadius: smallRadius,
          borderBottomRightRadius: radius,
        };
    }
  }
};

const formatSeparatorTimestamp = (rawTs: any): string => {
  if (!rawTs) return '';
  let date: Date;
  if (rawTs.seconds) {
    date = new Date(rawTs.seconds * 1000);
  } else if (typeof rawTs === 'number') {
    date = new Date(rawTs);
  } else {
    date = new Date(rawTs);
  }
  if (isNaN(date.getTime())) return '';

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return `${hours}:${minutes} ${day} Tháng ${month}, ${year}`;
};

const formatMessageTime = (rawTs: any): string => {
  if (!rawTs) return '';
  let date: Date;
  if (rawTs.seconds) {
    date = new Date(rawTs.seconds * 1000);
  } else if (typeof rawTs === 'number') {
    date = new Date(rawTs);
  } else {
    date = new Date(rawTs);
  }
  if (isNaN(date.getTime())) return '';

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const formatRelativeTime = (rawTs: any): string => {
  if (!rawTs) return 'Đã gửi';
  let date: Date;
  if (rawTs.seconds) {
    date = new Date(rawTs.seconds * 1000);
  } else if (typeof rawTs === 'number') {
    date = new Date(rawTs);
  } else {
    date = new Date(rawTs);
  }
  if (isNaN(date.getTime())) return 'Đã gửi';

  const now = Date.now();
  const diff = now - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (minutes < 1) {
    return 'Đã gửi';
  } else if (minutes < 60) {
    return `Đã gửi ${minutes} phút trước`;
  } else if (hours < 24) {
    return `Đã gửi ${hours} giờ trước`;
  } else if (days < 7) {
    return `Đã gửi ${days} ngày trước`;
  } else {
    return `Đã gửi ${weeks} tuần trước`;
  }
};

const formatLastActive = (lastChanged?: number, fallbackTs?: any): string => {
  let millis = lastChanged;
  if (!millis && fallbackTs) {
    if (fallbackTs.seconds) {
      millis = fallbackTs.seconds * 1000;
    } else if (typeof fallbackTs === 'number') {
      millis = fallbackTs;
    } else {
      const parsed = new Date(fallbackTs).getTime();
      if (!isNaN(parsed)) millis = parsed;
    }
  }

  if (!millis) return 'Hoạt động gần đây';

  const now = Date.now();
  const diff = Math.max(0, now - millis);

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (minutes < 1) {
    return 'Vừa mới hoạt động';
  } else if (minutes < 60) {
    return `Hoạt động ${minutes} phút trước`;
  } else if (hours < 24) {
    return `Hoạt động ${hours} giờ trước`;
  } else if (days < 7) {
    return `Hoạt động ${days} ngày trước`;
  } else {
    return `Hoạt động ${weeks} tuần trước`;
  }
};

const getUserBadgeDetails = (levelName?: string, points: number = 0) => {
  const lvl = levelName || getLevelFromPoints(points);

  if (lvl === 'Huyền thoại' || points >= 1000) {
    return {
      iconAsset: require('../../../assets/images/ic_legendary.png'),
      name: 'Huyền thoại',
      bgColor: '#FEF3C7',
      textColor: '#B45309'
    };
  } else if (lvl === 'Thiên thần' || points >= 500) {
    return {
      iconAsset: require('../../../assets/images/ic_angel.png'),
      name: 'Thiên thần',
      bgColor: '#DCFCE7',
      textColor: '#15803D'
    };
  } else if (lvl === 'Người tốt' || points >= 100) {
    return {
      iconAsset: require('../../../assets/images/ic_good.png'),
      name: 'Người tốt',
      bgColor: '#DBEAFE',
      textColor: '#1D4ED8'
    };
  } else {
    return {
      iconAsset: require('../../../assets/images/ic_newbie.png'),
      name: 'Tân thủ',
      bgColor: '#F1F5F9',
      textColor: '#475569'
    };
  }
};

const shouldShowDateHeader = (index: number, list: ChatMessage[]) => {
  if (index <= 0) return true;
  const current = list[index];
  const previous = list[index - 1];
  if (!current?.timestamp || !previous?.timestamp) return false;

  const getMillis = (ts: any) => {
    if (!ts) return 0;
    if (ts.seconds) return ts.seconds * 1000;
    if (typeof ts === 'number') return ts;
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  const diff = Math.abs(getMillis(current.timestamp) - getMillis(previous.timestamp));
  return diff > 15 * 60 * 1000; // 15 minutes
};

// Component dynamically calculating aspect ratio for portrait vs landscape photos
function AutoAspectImage({
  uri,
  borderRadiusStyle
}: {
  uri: string;
  borderRadiusStyle: any;
}) {
  const [aspectRatio, setAspectRatio] = useState<number>(4 / 3);

  useEffect(() => {
    if (!uri) return;
    Image.getSize(
      uri,
      (width, height) => {
        if (width > 0 && height > 0) {
          const ratio = width / height;
          const clampedRatio = Math.max(0.55, Math.min(ratio, 1.8));
          setAspectRatio(clampedRatio);
        }
      },
      (error) => console.log('Error getting image size:', error)
    );
  }, [uri]);

  return (
    <Image
      source={{ uri }}
      style={[
        {
          width: 220,
          aspectRatio: aspectRatio,
          maxHeight: 320,
        },
        borderRadiusStyle
      ]}
      resizeMode="cover"
    />
  );
}

// Swipeable wrapper for swipe-to-reply action
function SwipeableMessageRow({
  item,
  isMe,
  onReply,
  children
}: {
  item: ChatMessage;
  isMe: boolean;
  onReply: (msg: ChatMessage) => void;
  children: React.ReactNode;
}) {
  const panX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dy) < 15;
      },
      onPanResponderMove: (_, gestureState) => {
        if (isMe) {
          if (gestureState.dx < 0) {
            panX.setValue(Math.max(gestureState.dx, -70));
          }
        } else {
          if (gestureState.dx > 0) {
            panX.setValue(Math.min(gestureState.dx, 70));
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = 40;
        if ((isMe && gestureState.dx < -threshold) || (!isMe && gestureState.dx > threshold)) {
          onReply(item);
        }
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 6,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{ transform: [{ translateX: panX }] }}
    >
      {children}
    </Animated.View>
  );
}

export default function ChatRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    id: otherUserId,
    chatId: paramChatId,
    postId,
    postTitle,
    postImage,
    postType,
    acceptCall,
    activeCallId: paramActiveCallId
  } = useLocalSearchParams<{
    id: string;
    chatId?: string;
    postId?: string;
    postTitle?: string;
    postImage?: string;
    postType?: string;
    acceptCall?: string;
    activeCallId?: string;
  }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [lastChanged, setLastChanged] = useState<number | undefined>(undefined);
  const [firestoreLastActive, setFirestoreLastActive] = useState<any>(null);
  const [userBadgeInfo, setUserBadgeInfo] = useState(getUserBadgeDetails('Tân thủ', 0));
  const [activeChatId, setActiveChatId] = useState<string>(paramChatId || '');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);
  const [selectedViewerImage, setSelectedViewerImage] = useState<string | null>(null);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState<number>(0);
  const [pendingPostAttachment, setPendingPostAttachment] = useState<{
    id: string;
    title: string;
    image?: string;
    type?: string;
  } | null>(() => {
    if (postId && postTitle) {
      return {
        id: postId,
        title: postTitle,
        image: postImage || '',
        type: postType || 'lost'
      };
    }
    return null;
  });

  const [selectedMsgForAction, setSelectedMsgForAction] = useState<ChatMessage | null>(null);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState<boolean>(false);

  // Automatically fetch full post metadata & real image from Firestore
  useEffect(() => {
    if (!postId) return;
    fetchPostById(postId)
      .then((pData) => {
        if (pData) {
          setPendingPostAttachment({
            id: pData.id || postId || '',
            title: pData.title || postTitle || 'Bài viết',
            image: pData.imageUrl || postImage || '',
            type: pData.type || postType || 'lost'
          });
        }
      })
      .catch((err) => {
        console.log('Notice: Could not load post attachment details:', err);
      });
  }, [postId]);

  const handleDeleteMessage = async (msg: ChatMessage | null) => {
    if (!msg || !msg.id || msg.id.startsWith('temp_')) return;
    const currentUser = auth.currentUser;
    if (!currentUser || !otherUserId) return;

    const targetChatDocId = msg.chatDocId || activeChatId || [currentUser.uid, otherUserId].sort().join('_');

    // Optimistic UI update: instantly remove from local state
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    playSoundEffect('chatSend');

    try {
      const msgRef = doc(db, 'chats', targetChatDocId, 'messages', msg.id);
      const msgSnap = await getDoc(msgRef);

      if (msgSnap.exists()) {
        const msgData = msgSnap.data();
        const existingDeletedBy: string[] = msgData.deletedBy || [];

        // Check if the other user has already deleted it
        const willBeDeletedByBoth =
          existingDeletedBy.includes(otherUserId) ||
          (existingDeletedBy.length > 0 && !existingDeletedBy.includes(currentUser.uid));

        if (willBeDeletedByBoth) {
          // Both users deleted this message -> HARD DELETE from server permanently!
          await deleteDoc(msgRef);
        } else {
          // Only current user deleted -> SOFT DELETE by adding currentUser.uid to deletedBy
          await updateDoc(msgRef, {
            deletedBy: arrayUnion(currentUser.uid)
          });
        }
      }
    } catch (e) {
      console.error('Error deleting message:', e);
    }
  };

  // Call feature states
  const [isCallOptionVisible, setIsCallOptionVisible] = useState<boolean>(false);
  const [isInAppCallVisible, setIsInAppCallVisible] = useState<boolean>(false);
  const [isIncomingCallVisible, setIsIncomingCallVisible] = useState<boolean>(false);
  const [callStatus, setCallStatus] = useState<CallStatus>('IDLE');
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callerDetails, setCallerDetails] = useState<{ name: string; avatarUrl: string }>({
    name: 'Người dùng Findora',
    avatarUrl: ''
  });

  // Pagination & Inverted Scrolling performance optimization states
  const [messageLimit, setMessageLimit] = useState<number>(MESSAGES_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(true);

  const [otherUser, setOtherUser] = useState<{ name: string; avatarUrl: string; phone?: string }>({
    name: 'Người dùng',
    avatarUrl: '',
    phone: ''
  });
  const flatListRef = useRef<FlatList>(null);
  const autoAcceptHandledRef = useRef(false);

  // Invert messages array so latest message is at index 0 (bottom of screen)
  const reversedMessages = useMemo(() => {
    return [...messages].reverse();
  }, [messages]);

  // Load more older messages when scrolling UP towards top
  const loadMoreOlderMessages = useCallback(() => {
    if (isLoadingMore || !hasMoreMessages) return;
    setIsLoadingMore(true);
    setMessageLimit((prev) => prev + MESSAGES_PAGE_SIZE);
  }, [isLoadingMore, hasMoreMessages]);

  const sendCallRecordMessage = async (
    callType: 'voice' | 'video',
    durationSecs: number,
    status: 'ended' | 'missed' | 'rejected'
  ) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !otherUserId) return;
    const chatId = activeChatId || paramChatId || [currentUser.uid, otherUserId].sort().join('_');

    let callText = 'Cuộc gọi thoại đã kết thúc';
    if (status === 'missed') callText = 'Cuộc gọi nhỡ';
    if (status === 'rejected') callText = 'Cuộc gọi bị từ chối';

    try {
      await setDoc(
        doc(db, 'chats', chatId),
        {
          participants: [currentUser.uid, otherUserId],
          lastMessage: callText,
          lastTimestamp: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: currentUser.uid,
        receiverId: otherUserId,
        type: 'call',
        callType,
        callDuration: durationSecs,
        callStatus: status,
        text: callText,
        message: callText,
        read: false,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.log('Error saving call record:', e);
    }
  };

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser || !otherUserId) return;

    let unsubChatDoc = () => { };
    const unsubMessagesList: (() => void)[] = [];
    const messageMap = new Map<string, ChatMessage>();

    const updateMessagesState = () => {
      setMessages((prev) => {
        const realMsgs = Array.from(messageMap.values());
        const pendingTemps = prev.filter(
          (m) =>
            Boolean(m.id && m.id.startsWith('temp_')) &&
            !realMsgs.some((rm) => rm.message === m.message && rm.senderId === m.senderId)
        );

        const combined = [...realMsgs, ...pendingTemps];
        combined.sort((a, b) => {
          const getMillis = (ts: any) => {
            if (!ts) return Date.now();
            if (ts.seconds) return ts.seconds * 1000;
            if (typeof ts === 'number') return ts;
            const parsed = new Date(ts).getTime();
            return isNaN(parsed) ? Date.now() : parsed;
          };
          return getMillis(a.timestamp) - getMillis(b.timestamp);
        });
        return combined;
      });
    };

    // Load other user details & profile level from Firestore doc
    getPosterDetails(otherUserId).then((details: any) => {
      if (details) {
        setOtherUser((prev) => ({
          ...prev,
          name: details.name || prev.name,
          avatarUrl: details.avatarUrl || prev.avatarUrl,
          phone: details.phone || prev.phone
        }));
      }
    });

    getDoc(doc(db, 'users', otherUserId)).then((userSnap) => {
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const pts = typeof uData.points === 'number' ? uData.points : 0;
        const fallback = uData.lastActive || uData.updatedAt || uData.createdAt;
        const phone = uData.phone || uData.phoneNumber || uData.mobile || '';

        if (fallback) {
          setFirestoreLastActive(fallback);
        }
        const lvl = uData.level || getLevelFromPoints(pts);
        setUserBadgeInfo(getUserBadgeDetails(lvl, pts));
        setOtherUser((prev) => ({
          ...prev,
          name: uData.fullName || uData.name || prev.name,
          avatarUrl: uData.photoUrl || uData.avatarUrl || prev.avatarUrl,
          phone: phone || prev.phone
        }));
      } else {
        setUserBadgeInfo(getUserBadgeDetails('Tân thủ', 0));
      }
    }).catch(() => { });

    // Presence listener with lastChanged timestamp
    const unsubPresence = subscribeUserPresence(otherUserId, (online, changed) => {
      setIsOnline(online);
      if (changed) {
        setLastChanged(changed);
      }
    });

    // Determine target chatId strictly as single canonical conversation between 2 users
    const canonicalChatId = [currentUser.uid, otherUserId].sort().join('_');
    setActiveChatId(canonicalChatId);

    const activeChatSubIds = new Set<string>();
    const unsubDocsMap = new Map<string, () => void>();
    const unsubMsgsMap = new Map<string, () => void>();

    const attachChatSubListeners = (cId: string) => {
      if (activeChatSubIds.has(cId)) return;
      activeChatSubIds.add(cId);

      // 1. Doc listener for presence, lastSeen watermark and calls
      const unsubDoc = onSnapshot(doc(db, 'chats', cId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();

          // Live Seen Timestamp synchronization across all thread documents
          const rawLastSeen = data['lastSeen_' + otherUserId] || data.lastSeen;
          if (rawLastSeen) {
            const millis = rawLastSeen.seconds
              ? rawLastSeen.seconds * 1000
              : typeof rawLastSeen === 'number'
              ? rawLastSeen
              : new Date(rawLastSeen).getTime();
            if (millis > 0) {
              setOtherUserLastSeen((prev) => Math.max(prev, millis));
            }
          }

          const callData = data.callState;
          if (callData) {
            if (callData.callId && callData.callId !== currentCallId) {
              if (callManager.ActiveCallId !== callData.callId) {
                return;
              }
              setCurrentCallId(callData.callId);
            }

            if (callData.status === 'calling' || callData.status === 'ringing') {
              setIsIncomingCallVisible(false);
              if (callData.callerId === currentUser.uid && callManager.ActiveCallId === callData.callId) {
                setIsInAppCallVisible(true);
                setCallStatus('RINGING');
              }
            } else if (callData.status === 'accepted') {
              setIsIncomingCallVisible(false);
              setIsInAppCallVisible(true);
              setCallStatus('CONNECTING');
            } else if (callData.status === 'connecting') {
              setIsIncomingCallVisible(false);
              setIsInAppCallVisible(true);
              setCallStatus('CONNECTING');
            } else if (callData.status === 'connected') {
              // Both sides connected
              setIsIncomingCallVisible(false);
              setIsInAppCallVisible(true);
              setCallStatus('CONNECTED');
            } else if (callData.status === 'failed') {
              setIsIncomingCallVisible(false);
              setIsInAppCallVisible(true);
              setCallStatus('FAILED');
            } else if (callData.status === 'ended' || callData.status === 'rejected') {
              // Call closed
              setIsIncomingCallVisible(false);
              setIsInAppCallVisible(false);
              setCallStatus('IDLE');
            }
          }
        }
      });
      unsubDocsMap.set(cId, unsubDoc);

      // 2. Mark existing unread messages as read
      const markAllUnreadAsRead = async (chatId: string) => {
        try {
          updateDoc(doc(db, 'chats', chatId), {
            ['lastSeen_' + currentUser.uid]: serverTimestamp(),
            ['unreadCount_' + currentUser.uid]: 0,
          }).catch(() => {});

          const unreadSnap = await getDocs(
            query(collection(db, 'chats', chatId, 'messages'), where('read', '==', false))
          );
          unreadSnap.forEach((dSnap) => {
            if (dSnap.data().senderId !== currentUser.uid) {
              updateDoc(doc(db, 'chats', chatId, 'messages', dSnap.id), { read: true }).catch(() => {});
            }
          });

          const notifSnap = await getDocs(
            query(collection(db, 'notifications'), where('userId', '==', currentUser.uid), where('read', '==', false))
          );
          notifSnap.forEach((nSnap) => {
            const nData = nSnap.data();
            if (nData.senderId === otherUserId || nData.chatId === chatId) {
              updateDoc(doc(db, 'notifications', nSnap.id), { read: true }).catch(() => {});
            }
          });
        } catch (e) {
          console.log('Error marking unread as read:', e);
        }
      };

      markAllUnreadAsRead(cId);

      // 3. Subcollection messages listener
      const subMsgsQuery = query(
        collection(db, 'chats', cId, 'messages'),
        orderBy('timestamp', 'asc'),
        limitToLast(messageLimit)
      );

      const unsubMsg = onSnapshot(subMsgsQuery, (snapshot) => {
        let hasUnread = false;

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'removed') {
            messageMap.delete(change.doc.id);
          }
        });

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const deletedBy: string[] = data.deletedBy || [];

          if (deletedBy.includes(currentUser.uid)) {
            messageMap.delete(docSnap.id);
            return;
          }

          const isRead = Boolean(data.read);
          messageMap.set(docSnap.id, {
            id: docSnap.id,
            senderId: data.senderId,
            receiverId: data.receiverId || otherUserId,
            message: data.text || data.message || '',
            type: data.type || 'text',
            postId: data.postId || undefined,
            postTitle: data.postTitle || undefined,
            postImage: data.postImage || undefined,
            postType: data.postType || undefined,
            callType: data.callType || 'voice',
            callDuration: data.callDuration || 0,
            callStatus: data.callStatus || 'ended',
            imageUrl: data.imageUrl || '',
            replyToId: data.replyToId || null,
            replyToText: data.replyToText || null,
            replyToSender: data.replyToSender || null,
            read: isRead,
            deletedBy,
            chatDocId: cId,
            timestamp: data.timestamp
          });

          if (data.senderId === otherUserId && !isRead) {
            hasUnread = true;
            updateDoc(doc(db, 'chats', cId, 'messages', docSnap.id), { read: true }).catch(() => {});
          }
        });

        if (hasUnread) {
          updateDoc(doc(db, 'chats', cId), {
            ['lastSeen_' + currentUser.uid]: serverTimestamp(),
            ['unreadCount_' + currentUser.uid]: 0,
          }).catch(() => {});
        }

        updateMessagesState();
        setIsLoadingMore(false);
      });

      unsubMsgsMap.set(cId, unsubMsg);
    };

    // Always attach to canonicalChatId first
    attachChatSubListeners(canonicalChatId);
    if (paramChatId && paramChatId !== canonicalChatId) {
      attachChatSubListeners(paramChatId);
    }

    // Dynamically listen to all chat documents where currentUser is participant
    const chatsRef = collection(db, 'chats');
    const qChats = query(chatsRef, where('participants', 'array-contains', currentUser.uid));
    const unsubChatsQuery = onSnapshot(qChats, (chatsSnap) => {
      chatsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const participants: string[] = data.participants || [];
        if (participants.includes(otherUserId)) {
          attachChatSubListeners(docSnap.id);
        }
      });
    });

    return () => {
      unsubPresence();
      unsubChatsQuery();
      unsubDocsMap.forEach((c) => c());
      unsubMsgsMap.forEach((c) => c());
    };
  }, [otherUserId, paramChatId, postId, messageLimit]);



  const handleCellularCall = () => {
    setIsCallOptionVisible(false);
    if (otherUser.phone && otherUser.phone.trim() !== '') {
      Linking.openURL(`tel:${otherUser.phone.trim()}`);
    } else {
      Alert.alert(
        'Chưa có số điện thoại',
        `${otherUser.name} chưa cập nhật số điện thoại di động trên hệ thống.`,
        [{ text: 'Đóng', style: 'cancel' }]
      );
    }
  };

  const handleInAppCall = async () => {
    setIsCallOptionVisible(false);
    const currentUser = auth.currentUser;
    if (!currentUser || !otherUserId) return;

    const chatId = activeChatId || paramChatId || [currentUser.uid, otherUserId].sort().join('_');
    const callId = `${chatId}_${Date.now()}`;
    setCurrentCallId(callId);

    try {
      setIsInAppCallVisible(true);
      setCallStatus('OUTGOING_CALL');

      await callManager.startCall({
        callId,
        chatId,
        callerId: currentUser.uid,
        callerName: currentUser.displayName || 'Bạn',
        callerAvatar: currentUser.photoURL || '',
        receiverId: otherUserId,
        isCaller: true,
        onStatusChange: setCallStatus,
        onError: (error) => Alert.alert('Lỗi cuộc gọi', error instanceof Error ? error.message : String(error)),
      });
    } catch (e) {
      console.error('Error starting call:', e);
    }
  };

  const handleAcceptIncomingCall = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !otherUserId) return;

    const chatId = activeChatId || paramChatId || [currentUser.uid, otherUserId].sort().join('_');
    const callId = paramActiveCallId || currentCallId;
    if (!callId) {
      console.error('[CALL:ACCEPT_ERROR] Missing incoming callId!');
      return;
    }
    setCurrentCallId(callId);

    try {
      setIsIncomingCallVisible(false);
      setIsInAppCallVisible(true);
      setCallStatus('ACCEPTING');

      callManager.claimIncomingCall({
        callId,
        chatId,
        callerId: otherUserId,
        callerName: otherUser.name,
        callerAvatar: otherUser.avatarUrl,
        receiverId: currentUser.uid,
        isCaller: false,
        onStatusChange: setCallStatus,
        onError: (error) => Alert.alert('Lỗi cuộc gọi', error instanceof Error ? error.message : String(error)),
      }, 'ACCEPTING');

      await callManager.acceptCall({
        callId,
        chatId,
        callerId: otherUserId,
        callerName: otherUser.name,
        callerAvatar: otherUser.avatarUrl,
        receiverId: currentUser.uid,
        isCaller: false,
        onStatusChange: setCallStatus,
        onError: (error) => Alert.alert('Lỗi cuộc gọi', error instanceof Error ? error.message : String(error)),
      });
    } catch (e) {
      console.error('Error accepting call:', e);
    }
  };

  useEffect(() => {
    if (acceptCall !== '1' || autoAcceptHandledRef.current || !activeChatId) return;
    autoAcceptHandledRef.current = true;
    handleAcceptIncomingCall();
  }, [acceptCall, activeChatId]);

  const handleRejectIncomingCall = async () => {
    try {
      await callManager.rejectCall();
      await sendCallRecordMessage('voice', 0, 'rejected');
    } catch (e) {
      console.error('Error rejecting call:', e);
    } finally {
      setIsIncomingCallVisible(false);
      setCallStatus('IDLE');
      setCurrentCallId(null);
    }
  };

  const handleEndCall = async (callDurationSecs?: number) => {
    const finalDuration = typeof callDurationSecs === 'number' ? callDurationSecs : 0;
    try {
      if (callStatus === 'RINGING' || callStatus === 'OUTGOING_CALL') {
        await callManager.cancelCall();
      } else {
        await callManager.endCall('ended', finalDuration);
        await sendCallRecordMessage('voice', finalDuration, 'ended');
      }
    } catch (e) {
      console.error('Error ending call:', e);
    } finally {
      setIsInAppCallVisible(false);
      setIsIncomingCallVisible(false);
      setCallStatus('IDLE');
      setCurrentCallId(null);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !otherUserId) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const textToSend = inputText.trim();
    setInputText('');

    const chatId = activeChatId || paramChatId || [currentUser.uid, otherUserId].sort().join('_');

    const replyData = replyingTo
      ? {
        replyToId: replyingTo.id,
        replyToText: replyingTo.imageUrl ? '[Hình ảnh]' : replyingTo.message,
        replyToSender: replyingTo.senderId === currentUser.uid ? 'Bạn' : otherUser.name
      }
      : {};

    setReplyingTo(null);

    // 1. Optimistic UI update: Display message immediately on sender's UI
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      senderId: currentUser.uid,
      receiverId: otherUserId,
      message: textToSend,
      type: 'text',
      read: false,
      timestamp: Date.now(),
      ...replyData
    };

    setMessages((prev) => {
      // Avoid duplicate tempId
      if (prev.some((m) => m.id === tempId)) return prev;
      return [...prev, optimisticMsg];
    });

    // Play send sound effect
    playSoundEffect('chatSend');

    // 2. Perform Firestore background writes in parallel for lightning-fast delivery
    (async () => {
      try {
        const chatDocRef = doc(db, 'chats', chatId);
        const subMsgsRef = collection(db, 'chats', chatId, 'messages');
        const notifRef = collection(db, 'notifications');

        const [_, docRef] = await Promise.all([
          setDoc(
            chatDocRef,
            {
              participants: [currentUser.uid, otherUserId],
              lastMessage: textToSend,
              lastTimestamp: serverTimestamp(),
              updatedAt: serverTimestamp(),
              postId: postId || null,
              postTitle: postTitle || null
            },
            { merge: true }
          ),
          addDoc(subMsgsRef, {
            senderId: currentUser.uid,
            receiverId: otherUserId,
            text: textToSend,
            message: textToSend,
            type: 'text',
            postId: postId || null,
            read: false,
            timestamp: serverTimestamp(),
            ...replyData
          }),
        ]);

        // Instantly promote optimistic message from temp_... to docRef.id
        if (docRef?.id) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    id: docRef.id,
                    timestamp: Date.now(),
                  }
                : m
            )
          );
        }

        // Send realtime notification in background
        addDoc(notifRef, {
          userId: otherUserId,
          title: currentUser.displayName || 'Tin nhắn mới',
          message: textToSend,
          type: 'chat',
          senderId: currentUser.uid,
          senderName: currentUser.displayName || 'Người dùng',
          senderAvatar: currentUser.photoURL || '',
          chatId,
          createdAt: serverTimestamp(),
          read: false
        }).catch(() => {});
      } catch (e) {
        console.error('Error sending message in background:', e);
      }
    })();
  };

  const handleSendPostCard = async () => {
    if (!pendingPostAttachment || !otherUserId) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const attachment = { ...pendingPostAttachment };
    setPendingPostAttachment(null);

    const chatId = activeChatId || paramChatId || [currentUser.uid, otherUserId].sort().join('_');
    const tempId = `temp_${Date.now()}`;
    const cardMsg: ChatMessage = {
      id: tempId,
      senderId: currentUser.uid,
      receiverId: otherUserId,
      message: `[Bài viết] ${attachment.title}`,
      type: 'post_card',
      postId: attachment.id,
      postTitle: attachment.title,
      postImage: attachment.image || '',
      postType: attachment.type || 'lost',
      read: false,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, cardMsg]);
    playSoundEffect('chatSend');

    (async () => {
      try {
        const chatDocRef = doc(db, 'chats', chatId);
        const subMsgsRef = collection(db, 'chats', chatId, 'messages');
        const notifRef = collection(db, 'notifications');

        const [_, docRef] = await Promise.all([
          setDoc(
            chatDocRef,
            {
              participants: [currentUser.uid, otherUserId],
              lastMessage: `[Bài viết] ${attachment.title}`,
              lastTimestamp: serverTimestamp(),
              updatedAt: serverTimestamp(),
              postId: attachment.id,
              postTitle: attachment.title
            },
            { merge: true }
          ),
          addDoc(subMsgsRef, {
            senderId: currentUser.uid,
            receiverId: otherUserId,
            text: `[Bài viết] ${attachment.title}`,
            message: `[Bài viết] ${attachment.title}`,
            type: 'post_card',
            postId: attachment.id,
            postTitle: attachment.title,
            postImage: attachment.image || '',
            postType: attachment.type || 'lost',
            read: false,
            timestamp: serverTimestamp()
          })
        ]);

        if (docRef?.id) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    id: docRef.id,
                    timestamp: Date.now()
                  }
                : m
            )
          );
        }

        addDoc(notifRef, {
          userId: otherUserId,
          title: currentUser.displayName || 'Tin nhắn mới',
          message: `[Bài viết] ${attachment.title}`,
          type: 'chat',
          senderId: currentUser.uid,
          senderName: currentUser.displayName || 'Người dùng',
          senderAvatar: currentUser.photoURL || '',
          chatId,
          postId: attachment.id,
          createdAt: serverTimestamp(),
          read: false
        }).catch(() => {});
      } catch (e) {
        console.error('Error sending post card:', e);
      }
    })();
  };

  const isMessageSeen = useCallback(
    (msg: ChatMessage): boolean => {
      if (!msg) return false;
      if (msg.read === true) return true;
      if (msg.senderId === auth.currentUser?.uid && otherUserLastSeen > 0) {
        let msgMillis = 0;
        if (typeof msg.timestamp === 'number') {
          msgMillis = msg.timestamp;
        } else if (msg.timestamp?.seconds) {
          msgMillis = msg.timestamp.seconds * 1000;
        } else if (msg.timestamp) {
          msgMillis = new Date(msg.timestamp).getTime();
        }
        if (msgMillis > 0 && otherUserLastSeen >= msgMillis) {
          return true;
        }
      }
      return false;
    },
    [otherUserLastSeen]
  );

  const isLastSent = (index: number) => {
    const current = messages[index];
    if (!current || current.senderId !== auth.currentUser?.uid) return false;
    for (let i = index + 1; i < messages.length; i++) {
      if (messages[i].senderId === auth.currentUser?.uid) return false;
    }
    return true;
  };

  const isLastReadSent = (index: number) => {
    const current = messages[index];
    if (!current || current.senderId !== auth.currentUser?.uid) return false;
    if (!isMessageSeen(current)) return false;
    for (let i = index + 1; i < messages.length; i++) {
      const m = messages[i];
      if (m.senderId === auth.currentUser?.uid && isMessageSeen(m)) return false;
    }
    return true;
  };

  const otherUserLastMsg = [...messages].reverse().find(m => m.senderId === otherUserId);
  const fallbackPresenceTs = firestoreLastActive || otherUserLastMsg?.timestamp;

  // In Inverted FlatList, ListFooterComponent renders at top of screen above oldest message!
  const renderInvertedTopHeader = () => (
    <View>
      {/* Loading Spinner for Older Messages at top */}
      {isLoadingMore ? (
        <View style={styles.loadingOlderContainer}>
          <ActivityIndicator size="small" color="#0084FF" />
          <Text style={styles.loadingOlderText}>Đang tải tin nhắn cũ hơn...</Text>
        </View>
      ) : null}

      {/* Profile Card rendered at top of history */}
      <View style={styles.chatProfileHeader}>
        <TouchableOpacity
          style={styles.headerProfileAvatarContainer}
          onPress={() => router.push(`/profile/${otherUserId}` as any)}
          activeOpacity={0.8}
        >
          {otherUser.avatarUrl ? (
            <Image source={{ uri: otherUser.avatarUrl }} style={styles.headerProfileAvatar} />
          ) : (
            <View style={styles.headerProfileAvatarPlaceholder}>
              <Ionicons name="person" size={40} color="#64748B" />
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.headerProfileName}>{otherUser.name}</Text>

        {/* Dynamic Personal Badge Pill using Custom PNG Assets */}
        <View style={[styles.badgePillContainer, { backgroundColor: userBadgeInfo.bgColor }]}>
          <Image source={userBadgeInfo.iconAsset} style={styles.badgePillImage} resizeMode="contain" />
          <Text style={[styles.badgePillText, { color: userBadgeInfo.textColor }]}>
            {userBadgeInfo.name}
          </Text>
        </View>

        <Text style={styles.headerProfileSubtext}>
          Thành viên cộng đồng Findora
        </Text>

        <TouchableOpacity
          style={styles.viewProfileBtn}
          onPress={() => router.push(`/profile/${otherUserId}` as any)}
          activeOpacity={0.75}
        >
          <Ionicons name="person-circle-outline" size={18} color="#0F172A" />
          <Text style={styles.viewProfileBtnText}>Trang cá nhân</Text>
        </TouchableOpacity>

        <View style={styles.headerNoticeContainer}>
          <Ionicons name="lock-closed" size={12} color="#94A3B8" style={{ marginRight: 4 }} />
          <Text style={styles.headerNoticeText}>
            Giờ đây hai bạn có thể nhắn tin cho nhau, xem thông tin như trạng thái hoạt động và thời điểm đọc tin nhắn.
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Messenger Header Bar */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        {/* Avatar with Online Dot */}
        <View style={styles.avatarWrapper}>
          {otherUser.avatarUrl ? (
            <Image source={{ uri: otherUser.avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Ionicons name="person" size={20} color="#64748B" />
            </View>
          )}
          <View style={[styles.onlineIndicator, { backgroundColor: isOnline ? '#16A34A' : '#CBD5E1' }]} />
        </View>

        {/* Name & Dynamic Presence / Relative Offline Time */}
        <View style={styles.headerTextCol}>
          <Text style={styles.headerNameText} numberOfLines={1}>
            {otherUser.name}
          </Text>
          <Text style={[styles.headerStatusText, { color: isOnline ? '#16A34A' : '#94A3B8' }]}>
            {isOnline ? 'Đang hoạt động' : formatLastActive(lastChanged, fallbackPresenceTs)}
          </Text>
        </View>

        {/* Header Action Buttons */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={() => setIsCallOptionVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="call" size={20} color="#0084FF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconActionBtn} activeOpacity={0.7}>
            <Ionicons name="ellipsis-vertical" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Post Context Banner - Clickable to open Post Detail */}
      {postTitle ? (
        <TouchableOpacity
          style={styles.postContextBanner}
          onPress={() => {
            if (postId) {
              router.push(`/post/${postId}`);
            }
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="link-outline" size={16} color="#0084FF" />
          <Text style={styles.postContextBannerText} numberOfLines={1}>
            Về bài đăng: "{postTitle}"
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#0084FF" />
        </TouchableOpacity>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          keyExtractor={(item) => item.id || Math.random().toString()}
          inverted={true}
          ListFooterComponent={renderInvertedTopHeader}
          onEndReached={loadMoreOlderMessages}
          onEndReachedThreshold={0.5}
          initialNumToRender={25}
          maxToRenderPerBatch={15}
          windowSize={10}
          renderItem={({ item }) => {
            const origIndex = messages.findIndex((m) => m.id === item.id);
            const isMe = item.senderId === auth.currentUser?.uid;
            const isCallMsg = item.type === 'call';
            const isPostCardMsg = item.type === 'post_card';
            const isMissedOrRejected = isCallMsg && (!item.callDuration || item.callDuration === 0);
            const hasImage = item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.trim() !== '';
            const position = getMessagePosition(origIndex, messages);
            const borderRadiusStyle = getBubbleBorderRadius(isMe, position);
            const isExpanded = expandedMsgId === item.id;
            const showDateHeader = shouldShowDateHeader(origIndex, messages);
            const isLastInGroup = position === 'BOTTOM' || position === 'SINGLE';

            const lastReadSent = isLastReadSent(origIndex);
            const lastSent = isLastSent(origIndex);
            const showMetaRow = isExpanded || (isMe && (lastSent || lastReadSent));

            return (
              <View style={styles.msgItemContainer}>
                {/* Full Date Header Header centered ABOVE clicked or separator message */}
                {showDateHeader && (
                  <View style={styles.dateHeaderContainer}>
                    <Text style={styles.dateHeaderText}>
                      {formatSeparatorTimestamp(item.timestamp)}
                    </Text>
                  </View>
                )}

                <SwipeableMessageRow item={item} isMe={isMe} onReply={setReplyingTo}>
                  <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
                    {!isMe && (
                      <View style={styles.msgAvatarContainer}>
                        {isLastInGroup ? (
                          otherUser.avatarUrl ? (
                            <Image source={{ uri: otherUser.avatarUrl }} style={styles.msgAvatar} />
                          ) : (
                            <View style={styles.msgAvatarPlaceholder}>
                              <Ionicons name="person" size={14} color="#64748B" />
                            </View>
                          )
                        ) : null}
                      </View>
                    )}

                    <View style={isMe ? styles.bubbleColMe : styles.bubbleColOther}>
                      {/* 1. Call Card Message Rendering */}
                      {isCallMsg ? (() => {
                        const isMissed = isMissedOrRejected;
                        const isIncomingMissed = isMissed && !isMe; // they called me, I didn't answer → RED
                        const isOutgoingMissed = isMissed && isMe;  // I called them, they didn't answer → normal
                        const isIncoming = !isMe && !isMissed;      // incoming answered → arrow in
                        const isOutgoing = isMe && !isMissed;       // outgoing answered → arrow out
                        const isVideo = item.callType === 'video';

                        // Determine card title
                        let cardTitle = isVideo ? 'Cuộc gọi video' : 'Cuộc gọi thoại';
                        if (isIncomingMissed) cardTitle = `Đã nhỡ cuộc gọi ${isVideo ? 'video' : 'thoại'}`;

                        // Render the appropriate SVG icon
                        const renderCallIcon = () => {
                          const iconSize = 22;
                          if (isMissed) {
                            return <PhoneMissIcon size={iconSize} color={isIncomingMissed ? '#FFFFFF' : '#0F172A'} />;
                          }
                          if (isVideo) {
                            return <VideoReceiveIcon size={iconSize} color="#0F172A" />;
                          }
                          if (isIncoming) {
                            return <PhoneReceiveIcon size={iconSize} color="#0F172A" />;
                          }
                          return <PhoneSendIcon size={iconSize} color="#0F172A" />;
                        };

                        return (
                          <TouchableOpacity
                            activeOpacity={0.95}
                            onLongPress={() => setSelectedMsgForAction(item)}
                            style={[
                              styles.callCardContainer,
                              isIncomingMissed && styles.callCardContainerMissed
                            ]}
                          >
                            <View style={styles.callCardHeaderRow}>
                              <View style={[
                                styles.callCardIconCircle,
                                isIncomingMissed && styles.callCardIconCircleMissed
                              ]}>
                                {renderCallIcon()}
                              </View>
                              <View style={styles.callCardTextCol}>
                                <Text style={[
                                  styles.callCardTitle,
                                  isIncomingMissed && styles.callCardTitleMissed
                                ]}>
                                  {cardTitle}
                                </Text>
                                <Text style={[
                                  styles.callCardSubtitle,
                                  isIncomingMissed && { color: '#94A3B8' }
                                ]}>
                                  {isMissed
                                    ? formatMessageTime(item.timestamp)
                                    : item.callDuration && item.callDuration > 0
                                      ? item.callDuration < 60
                                        ? `${item.callDuration} giây`
                                        : `${Math.floor(item.callDuration / 60)} phút ${item.callDuration % 60} giây`
                                      : formatMessageTime(item.timestamp)}
                                </Text>
                              </View>
                            </View>

                            <TouchableOpacity
                              style={[
                                styles.callBackBtn,
                                isIncomingMissed && styles.callBackBtnMissed
                              ]}
                              onPress={handleInAppCall}
                              activeOpacity={0.8}
                            >
                              <Text style={[
                                styles.callBackBtnText,
                                isIncomingMissed && styles.callBackBtnTextMissed
                              ]}>Gọi lại</Text>
                            </TouchableOpacity>
                          </TouchableOpacity>
                        );
                      })() : isPostCardMsg ? (
                        /* 2. TikTok Shop Style Post Item Card Rendering */
                        <TouchableOpacity
                          activeOpacity={0.95}
                          onLongPress={() => setSelectedMsgForAction(item)}
                          onPress={() => setExpandedMsgId(isExpanded ? null : item.id)}
                          style={[
                            styles.postCardBubble,
                            isMe ? styles.postCardBubbleMe : styles.postCardBubbleOther,
                            borderRadiusStyle
                          ]}
                        >
                          <View style={styles.postCardHeaderRow}>
                            <Ionicons name="pricetag" size={13} color={isMe ? '#FFFFFF' : '#059669'} />
                            <Text style={[styles.postCardHeaderLabel, isMe && { color: '#FFFFFF' }]}>
                              Bài viết quan tâm
                            </Text>
                            <View style={[styles.postCardTypeBadge, item.postType === 'found' ? styles.badgeFound : styles.badgeLost]}>
                              <Text style={[styles.postCardTypeBadgeText, item.postType === 'found' ? styles.badgeFoundText : styles.badgeLostText]}>
                                {item.postType === 'found' ? 'Nhặt được' : 'Thất lạc'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.postCardBodyRow}>
                            {item.postImage ? (
                              <Image source={{ uri: item.postImage }} style={styles.postCardImage} />
                            ) : (
                              <View style={styles.postCardImagePlaceholder}>
                                <Ionicons name="newspaper-outline" size={24} color="#64748B" />
                              </View>
                            )}
                            <View style={styles.postCardInfoCol}>
                              <Text style={[styles.postCardTitle, isMe && { color: '#FFFFFF' }]} numberOfLines={2}>
                                {item.postTitle || item.message.replace('[Bài viết] ', '')}
                              </Text>
                              {item.postId ? (
                                <Text style={[styles.postCardIdText, isMe && { color: 'rgba(255,255,255,0.8)' }]}>
                                  Mã: #{item.postId.slice(-6).toUpperCase()}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.postCardActionButton,
                              isMe ? styles.postCardActionButtonMe : styles.postCardActionButtonOther
                            ]}
                            onPress={() => {
                              if (item.postId) {
                                router.push(`/post/${item.postId}`);
                              }
                            }}
                            activeOpacity={0.85}
                          >
                            <Text style={[
                              styles.postCardActionButtonText,
                              isMe ? styles.postCardActionButtonTextMe : styles.postCardActionButtonTextOther
                            ]}>
                              Xem chi tiết bài viết
                            </Text>
                            <Ionicons name="chevron-forward" size={14} color={isMe ? '#0084FF' : '#059669'} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ) : (
                        /* 3. Normal Text / Image Bubble Rendering */
                        <>
                          {/* Messenger Style Reply Header + Quoted Bubble */}
                          {item.replyToText ? (
                            <View style={[styles.replyContainer, isMe ? styles.replyContainerMe : styles.replyContainerOther]}>
                              <View style={[styles.replyLabelRow, isMe ? styles.replyLabelRowMe : styles.replyLabelRowOther]}>
                                <Ionicons name="return-up-back" size={13} color="#64748B" style={{ marginRight: 4 }} />
                                <Text style={styles.replyLabelText}>
                                  {isMe
                                    ? `Bạn đã trả lời ${item.replyToSender || ''}`
                                    : `${otherUser.name} đã trả lời ${item.replyToSender || ''}`}
                                </Text>
                              </View>

                              <View style={[styles.replyQuoteBubble, isMe ? styles.replyQuoteBubbleMe : styles.replyQuoteBubbleOther]}>
                                <Text style={styles.replyQuoteMessageText} numberOfLines={2} ellipsizeMode="tail">
                                  {item.replyToText}
                                </Text>
                              </View>
                            </View>
                          ) : null}

                          {/* Main Message Bubble */}
                          {hasImage ? (
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => setSelectedViewerImage(item.imageUrl!)}
                              onLongPress={() => setSelectedMsgForAction(item)}
                              style={[
                                styles.imageMsgContainer,
                                borderRadiusStyle,
                                item.replyToText ? styles.msgBubbleOverlapping : null
                              ]}
                            >
                              <AutoAspectImage
                                uri={item.imageUrl!}
                                borderRadiusStyle={borderRadiusStyle}
                              />
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => setExpandedMsgId(isExpanded ? null : item.id)}
                              onLongPress={() => setSelectedMsgForAction(item)}
                              style={[
                                styles.msgBubble,
                                isMe ? styles.msgBubbleMe : styles.msgBubbleOther,
                                borderRadiusStyle,
                                item.replyToText ? styles.msgBubbleOverlapping : null
                              ]}
                            >
                              <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
                                {item.message}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}

                      {/* Time + Ticks / Status / Seen Avatar Row below bubble */}
                      {showMetaRow && (
                        <View style={[styles.metaRow, isMe ? styles.metaRowMe : styles.metaRowOther]}>
                          {isExpanded && (
                            <View style={styles.timeTickContainer}>
                              <Text style={styles.timeTickText}>
                                {item.id.startsWith('temp_')
                                  ? 'Đang gửi...'
                                  : (isMessageSeen(item) ? 'Đã xem ' : 'Đã gửi ') + formatMessageTime(item.timestamp)}
                              </Text>
                              {isMe && (
                                <Ionicons
                                  name={
                                    item.id.startsWith('temp_')
                                      ? 'time-outline'
                                      : isMessageSeen(item)
                                      ? 'checkmark-done'
                                      : 'checkmark'
                                  }
                                  size={14}
                                  color={isMessageSeen(item) ? '#0084FF' : '#94A3B8'}
                                  style={styles.tickIcon}
                                />
                              )}
                            </View>
                          )}

                          {!isExpanded && isMe && (
                            <>
                              {lastReadSent ? (
                                <View style={styles.seenRowContainer}>
                                  <Text style={styles.seenLabelText}>Đã xem</Text>
                                  <View style={styles.seenAvatarContainer}>
                                    {otherUser.avatarUrl ? (
                                      <Image source={{ uri: otherUser.avatarUrl }} style={styles.seenAvatar} />
                                    ) : (
                                      <View style={styles.seenAvatarPlaceholder}>
                                        <Ionicons name="person" size={8} color="#64748B" />
                                      </View>
                                    )}
                                  </View>
                                </View>
                              ) : (lastSent || item.id.startsWith('temp_')) && !isMessageSeen(item) ? (
                                <View style={styles.timeTickContainer}>
                                  <Text style={styles.timeTickText}>
                                    {item.id.startsWith('temp_') ? 'Đang gửi...' : 'Đã gửi'}
                                  </Text>
                                  <Ionicons
                                    name={item.id.startsWith('temp_') ? 'time-outline' : 'checkmark'}
                                    size={14}
                                    color="#94A3B8"
                                    style={styles.tickIcon}
                                  />
                                </View>
                              ) : null}
                            </>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                </SwipeableMessageRow>
              </View>
            );
          }}
          contentContainerStyle={styles.messagesListContent}
        />

        {/* Reply Preview Bar above Input Bar */}
        {replyingTo ? (
          <View style={styles.replyPreviewBar}>
            <View style={styles.replyPreviewBarContent}>
              <Text style={styles.replyPreviewTitle}>
                Đang trả lời {replyingTo.senderId === auth.currentUser?.uid ? 'chính mình' : otherUser.name}
              </Text>
              <Text style={styles.replyPreviewText} numberOfLines={1}>
                {replyingTo.imageUrl ? '[Hình ảnh]' : replyingTo.message}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.closeReplyBtn}>
              <Ionicons name="close-circle" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Floating TikTok Shop Style Post Attachment Bar */}
        {pendingPostAttachment && (
          <View style={styles.pendingAttachmentBar}>
            <View style={styles.pendingAttachmentContent}>
              {pendingPostAttachment.image ? (
                <Image source={{ uri: pendingPostAttachment.image }} style={styles.pendingAttachmentThumb} />
              ) : (
                <View style={styles.pendingAttachmentThumbPlaceholder}>
                  <Ionicons name="newspaper-outline" size={18} color="#059669" />
                </View>
              )}
              <View style={styles.pendingAttachmentTextCol}>
                <View style={styles.pendingAttachmentHeaderRow}>
                  <Text style={styles.pendingAttachmentLabel}>Bài viết bạn vừa mở</Text>
                  <View style={[styles.postCardTypeBadgeMini, pendingPostAttachment.type === 'found' ? styles.badgeFound : styles.badgeLost]}>
                    <Text style={[styles.postCardTypeBadgeTextMini, pendingPostAttachment.type === 'found' ? styles.badgeFoundText : styles.badgeLostText]}>
                      {pendingPostAttachment.type === 'found' ? 'Nhặt được' : 'Thất lạc'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.pendingAttachmentTitle} numberOfLines={1}>
                  {pendingPostAttachment.title}
                </Text>
              </View>
            </View>

            <View style={styles.pendingAttachmentActions}>
              <TouchableOpacity
                style={styles.sendAttachmentBtn}
                onPress={handleSendPostCard}
                activeOpacity={0.8}
              >
                <Ionicons name="send" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.sendAttachmentBtnText}>Gửi thẻ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeAttachmentBtn}
                onPress={() => setPendingPostAttachment(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Messenger Style Input Bar */}
        <View style={[styles.inputBarContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.inputPillContainer}>
            <TouchableOpacity style={styles.inputActionIcon} activeOpacity={0.7}>
              <Ionicons name="add-circle" size={26} color="#0084FF" />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />

            <TouchableOpacity style={styles.inputActionIcon} activeOpacity={0.7}>
              <Ionicons name="image-outline" size={22} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sendIconBtn,
                { backgroundColor: inputText.trim() ? '#0084FF' : '#E2E8F0' }
              ]}
              onPress={handleSend}
              disabled={!inputText.trim()}
              activeOpacity={0.8}
            >
              <Ionicons
                name="send"
                size={16}
                color={inputText.trim() ? '#FFFFFF' : '#94A3B8'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Fullscreen Image Viewer Modal with Close X + Options Menu ... */}
      <ImageViewerModal
        visible={selectedViewerImage !== null}
        imageUrl={selectedViewerImage || ''}
        hideBottomOverlay={true}
        onClose={() => setSelectedViewerImage(null)}
      />

      {/* Call Option Modal (Bottom Action Sheet) */}
      <Modal
        visible={isCallOptionVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsCallOptionVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsCallOptionVisible(false)}
        >
          <View style={styles.actionSheetContainer}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>Tùy chọn cuộc gọi</Text>
              <Text style={styles.actionSheetSubtitle}>Liên hệ với {otherUser.name}</Text>
            </View>

            <TouchableOpacity style={styles.actionSheetOption} onPress={handleCellularCall} activeOpacity={0.75}>
              <View style={[styles.actionSheetIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="call" size={22} color="#0084FF" />
              </View>
              <View style={styles.actionSheetTextCol}>
                <Text style={styles.actionSheetOptionTitle}>Gọi di động</Text>
                <Text style={styles.actionSheetOptionSubtitle}>
                  {otherUser.phone ? otherUser.phone : 'Sử dụng số điện thoại cá nhân'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionSheetOption} onPress={handleInAppCall} activeOpacity={0.75}>
              <View style={[styles.actionSheetIconWrapper, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="wifi" size={22} color="#16A34A" />
              </View>
              <View style={styles.actionSheetTextCol}>
                <Text style={styles.actionSheetOptionTitle}>Gọi qua App (Findora Voice)</Text>
                <Text style={styles.actionSheetOptionSubtitle}>Cuộc gọi thoại miễn phí qua internet</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetCancelBtn}
              onPress={() => setIsCallOptionVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionSheetCancelText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Outgoing / Active Voice Call Overlay Modal */}
      <InAppCallModal
        visible={isInAppCallVisible}
        otherUser={otherUser}
        status={callStatus}
        onClose={handleEndCall}
      />

      {/* Message Actions Modal (Long Press on Message) */}
      <Modal
        visible={selectedMsgForAction !== null && !isDeleteConfirmVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedMsgForAction(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedMsgForAction(null)}
        >
          <View style={styles.actionSheetContainer}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>Tùy chọn tin nhắn</Text>
              <Text style={styles.actionSheetSubtitle} numberOfLines={1}>
                {selectedMsgForAction?.message || 'Tin nhắn'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.actionSheetOption}
              onPress={() => {
                const msg = selectedMsgForAction;
                setSelectedMsgForAction(null);
                if (msg) setReplyingTo(msg);
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.actionSheetIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="return-up-back" size={22} color="#0084FF" />
              </View>
              <View style={styles.actionSheetTextCol}>
                <Text style={styles.actionSheetOptionTitle}>Trả lời tin nhắn</Text>
                <Text style={styles.actionSheetOptionSubtitle}>Trích dẫn tin nhắn này trong cuộc trò chuyện</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetOption}
              onPress={() => {
                setIsDeleteConfirmVisible(true);
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.actionSheetIconWrapper, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="trash-outline" size={22} color="#DC2626" />
              </View>
              <View style={styles.actionSheetTextCol}>
                <Text style={[styles.actionSheetOptionTitle, { color: '#DC2626' }]}>Xóa tin nhắn</Text>
                <Text style={styles.actionSheetOptionSubtitle}>Xóa ở phía bạn (Xóa vĩnh viễn khi cả 2 cùng xóa)</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetCancelBtn}
              onPress={() => setSelectedMsgForAction(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionSheetCancelText}>Hủy bỏ</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={isDeleteConfirmVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDeleteConfirmVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDeleteConfirmVisible(false)}
        >
          <View style={styles.confirmDeleteCard}>
            <View style={styles.confirmDeleteIconCircle}>
              <Ionicons name="trash" size={28} color="#DC2626" />
            </View>
            <Text style={styles.confirmDeleteTitle}>Xóa tin nhắn?</Text>
            <Text style={styles.confirmDeleteDesc}>
              Tin nhắn này sẽ bị xóa khỏi cuộc trò chuyện của bạn. Khi cả 2 người cùng xóa, tin nhắn sẽ bị xóa vĩnh viễn khỏi máy chủ.
            </Text>

            <View style={styles.confirmDeleteBtnRow}>
              <TouchableOpacity
                style={styles.confirmDeleteCancelBtn}
                onPress={() => {
                  setIsDeleteConfirmVisible(false);
                  setSelectedMsgForAction(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmDeleteCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={() => {
                  const targetMsg = selectedMsgForAction;
                  setIsDeleteConfirmVisible(false);
                  setSelectedMsgForAction(null);
                  if (targetMsg) {
                    handleDeleteMessage(targetMsg);
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmDeleteBtnText}>Xóa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Real-time Incoming Voice Call Modal */}
      <IncomingCallModal
        visible={isIncomingCallVisible}
        caller={callerDetails}
        onAccept={handleAcceptIncomingCall}
        onReject={handleRejectIncomingCall}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  avatarWrapper: {
    position: 'relative',
    width: 40,
    height: 40,
    marginRight: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  headerNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerStatusText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  postContextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  postContextBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
    marginLeft: 6,
    flex: 1,
  },
  messagesListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  chatProfileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerProfileAvatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#22C55E',
    padding: 2,
    marginBottom: 12,
  },
  headerProfileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
  },
  headerProfileAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfileName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  badgePillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgePillImage: {
    width: 18,
    height: 18,
    marginRight: 6,
  },
  badgePillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  headerProfileSubtext: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  viewProfileBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginLeft: 6,
  },
  headerNoticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  headerNoticeText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
  loadingOlderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  loadingOlderText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
    fontWeight: '500',
  },
  msgItemContainer: {
    marginBottom: 2,
  },
  dateHeaderContainer: {
    alignItems: 'center',
    marginVertical: 14,
  },
  dateHeaderText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  msgRowOther: {
    justifyContent: 'flex-start',
  },
  msgAvatarContainer: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  msgAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleColMe: {
    alignItems: 'flex-end',
    maxWidth: '82%',
  },
  bubbleColOther: {
    alignItems: 'flex-start',
    maxWidth: '82%',
  },
  callCardContainer: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 14,
    width: 240,
    marginVertical: 4,
  },
  callCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callCardIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  callCardTextCol: {
    flex: 1,
  },
  callCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  callCardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  callBackBtn: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 12,
  },
  callBackBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  // Missed / Rejected Call Card overrides
  callCardContainerMissed: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  callCardIconCircleMissed: {
    backgroundColor: '#EF4444',
  },
  callDirectionBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callCardTitleMissed: {
    color: '#DC2626',
  },
  callBackBtnMissed: {
    backgroundColor: '#CBD5E1',
  },
  callBackBtnTextMissed: {
    color: '#0F172A',
  },
  replyContainer: {
    marginBottom: -12,
    zIndex: 1,
  },
  replyContainerMe: {
    alignItems: 'flex-end',
  },
  replyContainerOther: {
    alignItems: 'flex-start',
  },
  replyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  replyLabelRowMe: {
    justifyContent: 'flex-end',
  },
  replyLabelRowOther: {
    justifyContent: 'flex-start',
  },
  replyLabelText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  replyQuoteBubble: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 26,
    borderRadius: 16,
    maxWidth: '100%',
  },
  replyQuoteBubbleMe: {
    backgroundColor: '#E2E8F0',
  },
  replyQuoteBubbleOther: {
    backgroundColor: '#E2E8F0',
  },
  replyQuoteMessageText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 19,
  },
  msgBubbleOverlapping: {
    marginTop: -10,
    zIndex: 2,
  },
  imageMsgContainer: {
    backgroundColor: 'transparent',
    padding: 0,
    overflow: 'hidden',
  },
  msgBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  msgBubbleMe: {
    backgroundColor: '#0084FF',
  },
  msgBubbleOther: {
    backgroundColor: '#F1F5F9',
  },
  msgText: {
    fontSize: 15,
    lineHeight: 21,
  },
  msgTextMe: {
    color: '#FFFFFF',
  },
  msgTextOther: {
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  metaRowMe: {
    justifyContent: 'flex-end',
  },
  metaRowOther: {
    justifyContent: 'flex-start',
  },
  timeTickContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeTickText: {
    fontSize: 11,
    color: '#64748B',
  },
  tickIcon: {
    marginLeft: 3,
  },
  seenRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  seenLabelText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginRight: 4,
  },
  seenAvatarContainer: {
    width: 14,
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
  },
  seenAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  seenAvatarPlaceholder: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  replyPreviewBarContent: {
    flex: 1,
  },
  replyPreviewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0084FF',
  },
  replyPreviewText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 1,
  },
  closeReplyBtn: {
    padding: 4,
  },
  inputBarContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  inputPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inputActionIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#0F172A',
    maxHeight: 100,
  },
  sendIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  actionSheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  actionSheetSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  actionSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
  },
  actionSheetIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionSheetTextCol: {
    flex: 1,
  },
  actionSheetOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionSheetOptionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  actionSheetCancelBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 6,
  },
  actionSheetCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },

  // TikTok Shop Style Post Item Card in Message Stream
  postCardBubble: {
    width: 250,
    padding: 12,
    borderRadius: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  postCardBubbleMe: {
    backgroundColor: '#0084FF',
  },
  postCardBubbleOther: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  postCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postCardHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    marginLeft: 4,
    flex: 1,
  },
  postCardTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  postCardTypeBadgeMini: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginLeft: 6,
  },
  badgeLost: {
    backgroundColor: '#FEE2E2',
  },
  badgeLostText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  badgeFound: {
    backgroundColor: '#DCFCE7',
  },
  badgeFoundText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  postCardTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  postCardTypeBadgeTextMini: {
    fontSize: 9,
    fontWeight: '700',
  },
  postCardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  postCardImage: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    marginRight: 10,
  },
  postCardImagePlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  postCardInfoCol: {
    flex: 1,
  },
  postCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
  },
  postCardIdText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  postCardActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  postCardActionButtonMe: {
    backgroundColor: '#FFFFFF',
  },
  postCardActionButtonOther: {
    backgroundColor: '#F1F5F9',
  },
  postCardActionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    marginRight: 4,
  },
  postCardActionButtonTextMe: {
    color: '#0084FF',
  },
  postCardActionButtonTextOther: {
    color: '#0F172A',
  },

  // Floating TikTok Shop Attachment Preview Bar above Input Box
  pendingAttachmentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  pendingAttachmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  pendingAttachmentThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    marginRight: 10,
  },
  pendingAttachmentThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pendingAttachmentTextCol: {
    flex: 1,
  },
  pendingAttachmentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  pendingAttachmentLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  pendingAttachmentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  pendingAttachmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendAttachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
  },
  sendAttachmentBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  closeAttachmentBtn: {
    padding: 4,
  },
  confirmDeleteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '85%',
    maxWidth: 340,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  confirmDeleteIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmDeleteTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmDeleteDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  confirmDeleteBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  confirmDeleteCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
