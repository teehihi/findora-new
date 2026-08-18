import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebase';
import { getPosterDetails } from '../../services/firebaseService';

export interface Conversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string;
  lastMessage: string;
  postId?: string;
  postTitle?: string;
  timestamp: string;
  rawTimestamp?: any;
  unreadCount: number;
}

export default function ChatListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChatForAction, setSelectedChatForAction] = useState<Conversation | null>(null);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState<boolean>(false);

  const handleDeleteConversation = async (item: Conversation | null) => {
    const user = auth.currentUser;
    if (!user || !item) return;

    // Optimistic removal from list
    setConversations((prev) => prev.filter((c) => c.otherUserId !== item.otherUserId));

    try {
      const entry = userChatMapRef.current.get(item.otherUserId);
      const docIds = new Set<string>(entry ? entry.docIds : [item.id]);
      docIds.add(item.id);
      docIds.add([user.uid, item.otherUserId].sort().join('_'));

      for (const docId of docIds) {
        try {
          const subMsgs = await getDocs(collection(db, 'chats', docId, 'messages'));
          await Promise.all(subMsgs.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
          await deleteDoc(doc(db, 'chats', docId)).catch(() => {});
        } catch (docErr) {
          console.log('Notice: Single doc deletion skipped:', docErr);
        }
      }

      // Also clean up notifications
      try {
        const notifRef = collection(db, 'notifications');
        const notifSnap = await getDocs(query(notifRef, where('userId', '==', user.uid)));
        for (const nDoc of notifSnap.docs) {
          const nData = nDoc.data();
          if (nData.senderId === item.otherUserId || docIds.has(nData.chatId)) {
            await deleteDoc(nDoc.ref).catch(() => {});
          }
        }
      } catch (nErr) {
        console.log('Notice: Notification cleanup error:', nErr);
      }
    } catch (e) {
      console.error('Error deleting conversation:', e);
    }
  };

  const getTimestampMillis = (rawTs: any): number => {
    if (!rawTs) return 0;
    if (rawTs.seconds) return rawTs.seconds * 1000;
    if (typeof rawTs === 'number') return rawTs;
    const parsed = new Date(rawTs).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatTimestamp = (rawTs: any): string => {
    if (!rawTs) return '';
    try {
      let dateObj: Date;
      if (rawTs.seconds) {
        dateObj = new Date(rawTs.seconds * 1000);
      } else if (rawTs instanceof Date) {
        dateObj = rawTs;
      } else {
        dateObj = new Date(rawTs);
      }

      if (isNaN(dateObj.getTime())) return '';

      const now = new Date();
      const isToday = dateObj.toDateString() === now.toDateString();

      if (isToday) {
        const hours = dateObj.getHours().toString().padStart(2, '0');
        const minutes = dateObj.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      } else {
        const day = dateObj.getDate().toString().padStart(2, '0');
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month}`;
      }
    } catch {
      return '';
    }
  };

  const userDetailsCache = useRef<Record<string, { name: string; avatarUrl: string }>>({});
  const userChatMapRef = useRef<Map<string, { latestDoc: any; docIds: string[] }>>(new Map());

  const loadConversations = async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const chatsRef = collection(db, 'chats');
      const qChats = query(chatsRef, where('participants', 'array-contains', user.uid));
      const snapshot = await getDocs(qChats);

      if (!snapshot.empty) {
        // Group conversations by otherUserId so each person appears exactly once
        const userChatMap = new Map<string, { latestDoc: any; docIds: string[] }>();
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const participants: string[] = data.participants || [];
          const otherId = participants.find((id) => id !== user.uid) || user.uid;

          if (!userChatMap.has(otherId)) {
            userChatMap.set(otherId, { latestDoc: docSnap, docIds: [docSnap.id] });
          } else {
            const entry = userChatMap.get(otherId)!;
            entry.docIds.push(docSnap.id);
            const currentTs = getTimestampMillis(data.lastTimestamp || data.timestamp || data.updatedAt);
            const existingTs = getTimestampMillis(
              entry.latestDoc.data().lastTimestamp ||
              entry.latestDoc.data().timestamp ||
              entry.latestDoc.data().updatedAt
            );
            if (currentTs > existingTs) {
              entry.latestDoc = docSnap;
            }
          }
        });

        userChatMapRef.current = userChatMap;

        const list: Conversation[] = [];
        for (const [otherId, { latestDoc, docIds }] of userChatMap.entries()) {
          const data = latestDoc.data();

          if (!userDetailsCache.current[otherId]) {
            try {
              const details = await getPosterDetails(otherId);
              userDetailsCache.current[otherId] = {
                name: details.name || data.otherUserName || 'Người dùng Findora',
                avatarUrl: details.avatarUrl || data.otherUserAvatar || '',
              };
            } catch (e) {
              userDetailsCache.current[otherId] = {
                name: data.otherUserName || 'Người dùng Findora',
                avatarUrl: data.otherUserAvatar || '',
              };
            }
          }

          const userDetails = userDetailsCache.current[otherId];

          let totalUnread = 0;
          for (const cId of docIds) {
            try {
              const chatDocSnap = snapshot.docs.find((sd) => sd.id === cId);
              const chatData = chatDocSnap?.data();
              const clearedAt = getTimestampMillis(chatData?.['clearedAt_' + user.uid] || chatData?.clearedAt);

              const msgsRef = collection(db, 'chats', cId, 'messages');
              const unreadQuery = query(msgsRef, where('read', '==', false));
              const unreadSnap = await getDocs(unreadQuery);
              unreadSnap.forEach((d) => {
                const msgData = d.data();
                const msgTs = getTimestampMillis(msgData.timestamp);
                if (clearedAt > 0 && msgTs > 0 && msgTs <= clearedAt) {
                  return;
                }
                if (msgData.senderId !== user.uid) {
                  totalUnread++;
                }
              });
            } catch (e) { }
          }

          const rawTs = data.lastTimestamp || data.timestamp || data.updatedAt;

          list.push({
            id: latestDoc.id,
            otherUserId: otherId,
            otherUserName: userDetails.name,
            otherUserAvatar: userDetails.avatarUrl,
            lastMessage: data.lastMessage || data.message || 'Bắt đầu trò chuyện',
            postId: data.postId || '',
            postTitle: data.postTitle || '',
            timestamp: formatTimestamp(rawTs),
            rawTimestamp: rawTs,
            unreadCount: totalUnread,
          });
        }

        list.sort((a, b) => getTimestampMillis(b.rawTimestamp) - getTimestampMillis(a.rawTimestamp));
        setConversations(list);
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.log('Error loading chat list:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const chatsRef = collection(db, 'chats');
    const qChats = query(chatsRef, where('participants', 'array-contains', user.uid));
    const msgUnsubs = new Map<string, () => void>();
    const unreadCountsMap = new Map<string, number>();

    const unsub = onSnapshot(
      qChats,
      async (snapshot) => {
        if (snapshot.empty) {
          setConversations([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        // Group conversations by otherUserId
        const userChatMap = new Map<string, { latestDoc: any; docIds: string[] }>();
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const participants: string[] = data.participants || [];
          const otherId = participants.find((id) => id !== user.uid) || user.uid;

          // Check if user has cleared this chat and no new message was sent
          const deletedBy: string[] = data.deletedBy || [];
          const clearedAt = getTimestampMillis(data['clearedAt_' + user.uid] || data.clearedAt);
          const currentTs = getTimestampMillis(data.lastTimestamp || data.timestamp || data.updatedAt);

          if (deletedBy.includes(user.uid) && clearedAt > 0 && currentTs <= clearedAt) {
            return;
          }

          if (!userChatMap.has(otherId)) {
            userChatMap.set(otherId, { latestDoc: docSnap, docIds: [docSnap.id] });
          } else {
            const entry = userChatMap.get(otherId)!;
            entry.docIds.push(docSnap.id);
            const existingTs = getTimestampMillis(
              entry.latestDoc.data().lastTimestamp ||
              entry.latestDoc.data().timestamp ||
              entry.latestDoc.data().updatedAt
            );
            if (currentTs > existingTs) {
              entry.latestDoc = docSnap;
            }
          }
        });
        userChatMapRef.current = userChatMap;

        // Clean up listeners for deleted chats
        const currentChatIds = new Set(snapshot.docs.map((d) => d.id));
        for (const [cId, cleanFn] of msgUnsubs.entries()) {
          if (!currentChatIds.has(cId)) {
            cleanFn();
            msgUnsubs.delete(cId);
            unreadCountsMap.delete(cId);
          }
        }

        // Attach realtime unread listener to each conversation document
        snapshot.docs.forEach((docSnap) => {
          const chatId = docSnap.id;
          if (!msgUnsubs.has(chatId)) {
            const msgsRef = collection(db, 'chats', chatId, 'messages');
            const unreadQuery = query(msgsRef, where('read', '==', false));
            const unsubMsg = onSnapshot(
              unreadQuery,
              (uSnap) => {
                let count = 0;
                uSnap.forEach((d) => {
                  if (d.data().senderId !== user.uid) {
                    count++;
                  }
                });
                unreadCountsMap.set(chatId, count);

                // Realtime UI update: recalculate unread per user
                setConversations((prev) =>
                  prev.map((c) => {
                    const entry = userChatMap.get(c.otherUserId);
                    if (!entry) return c;
                    const sumUnread = entry.docIds.reduce(
                      (acc, id) => acc + (unreadCountsMap.get(id) || 0),
                      0
                    );
                    return { ...c, unreadCount: sumUnread };
                  })
                );
              },
              (err) => {
                console.log('Realtime unread listener notice for chat', chatId, err);
              }
            );
            msgUnsubs.set(chatId, unsubMsg);
          }
        });

        const list: Conversation[] = await Promise.all(
          Array.from(userChatMap.entries()).map(async ([otherId, { latestDoc, docIds }]) => {
            const data = latestDoc.data();

            if (!userDetailsCache.current[otherId]) {
              try {
                const details = await getPosterDetails(otherId);
                userDetailsCache.current[otherId] = {
                  name: details.name || data.otherUserName || 'Người dùng Findora',
                  avatarUrl: details.avatarUrl || data.otherUserAvatar || '',
                };
              } catch (e) {
                userDetailsCache.current[otherId] = {
                  name: data.otherUserName || 'Người dùng Findora',
                  avatarUrl: data.otherUserAvatar || '',
                };
              }
            }

            const userDetails = userDetailsCache.current[otherId];
            const sumUnread = docIds.reduce(
              (acc, id) => acc + (unreadCountsMap.get(id) || 0),
              0
            );
            const rawTs = data.lastTimestamp || data.timestamp || data.updatedAt;

            return {
              id: latestDoc.id,
              otherUserId: otherId,
              otherUserName: userDetails.name,
              otherUserAvatar: userDetails.avatarUrl,
              lastMessage: data.lastMessage || data.message || 'Bắt đầu trò chuyện',
              postId: data.postId || '',
              postTitle: data.postTitle || '',
              timestamp: formatTimestamp(rawTs),
              rawTimestamp: rawTs,
              unreadCount: sumUnread,
            };
          })
        );

        list.sort((a, b) => getTimestampMillis(b.rawTimestamp) - getTimestampMillis(a.rawTimestamp));
        setConversations(list);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.log('Realtime chat listener error:', error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => {
      unsub();
      msgUnsubs.forEach((clean) => clean());
      msgUnsubs.clear();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const handleOpenChat = async (item: Conversation) => {
    const user = auth.currentUser;
    // 1. Optimistic UI update: instantly reset unread counter to 0 for this user
    setConversations((prev) =>
      prev.map((c) => (c.otherUserId === item.otherUserId ? { ...c, unreadCount: 0 } : c))
    );

    // 2. Mark unread messages and notifications as read in background across all docIds for this user
    if (user) {
      (async () => {
        try {
          const entry = userChatMapRef.current.get(item.otherUserId);
          const docIds = entry ? entry.docIds : [item.id];
          for (const cId of docIds) {
            updateDoc(doc(db, 'chats', cId), {
              ['lastSeen_' + user.uid]: serverTimestamp(),
              ['unreadCount_' + user.uid]: 0,
            }).catch(() => {});

            const msgsRef = collection(db, 'chats', cId, 'messages');
            const unreadSnap = await getDocs(query(msgsRef, where('read', '==', false)));
            unreadSnap.forEach((dSnap) => {
              if (dSnap.data().senderId !== user.uid) {
                updateDoc(doc(db, 'chats', cId, 'messages', dSnap.id), { read: true }).catch(() => {});
              }
            });
          }

          // Clear chat notifications from this sender
          const notifRef = collection(db, 'notifications');
          const notifSnap = await getDocs(query(notifRef, where('userId', '==', user.uid), where('read', '==', false)));
          notifSnap.forEach((nSnap) => {
            const nData = nSnap.data();
            if (nData.senderId === item.otherUserId || docIds.includes(nData.chatId)) {
              updateDoc(doc(db, 'notifications', nSnap.id), { read: true }).catch(() => {});
            }
          });
        } catch (err) {
          console.log('Error marking chat messages as read:', err);
        }
      })();
    }

    // 3. Navigate to chat room
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: item.otherUserId,
        chatId: item.id,
        postId: item.postId || '',
        postTitle: item.postTitle || ''
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* Messenger Large Bold Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Tin nhắn</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0084FF" />
          <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0084FF" />
          }
          renderItem={({ item }) => {
            const hasUnread = item.unreadCount > 0;
            return (
              <TouchableOpacity
                style={styles.chatItemRow}
                onPress={() => handleOpenChat(item)}
                onLongPress={() => setSelectedChatForAction(item)}
                activeOpacity={0.7}
              >
                {/* Avatar Container with Messenger Blue Unread Dot */}
                <View style={styles.avatarContainer}>
                  {item.otherUserAvatar ? (
                    <Image source={{ uri: item.otherUserAvatar }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={24} color="#64748B" />
                    </View>
                  )}

                  {/* Messenger Style Blue Unread Dot */}
                  {hasUnread && <View style={styles.unreadDotIndicator} />}
                </View>

                {/* Content Column */}
                <View style={styles.contentCol}>
                  {/* Name and Timestamp Row */}
                  <View style={styles.topMetaRow}>
                    <Text style={styles.userNameText} numberOfLines={1}>
                      {item.otherUserName}
                    </Text>
                    {item.timestamp ? (
                      <Text style={styles.timeText}>{item.timestamp}</Text>
                    ) : null}
                  </View>

                  {/* Last Message and Unread Count Badge Row */}
                  <View style={styles.middleMessageRow}>
                    <Text
                      style={[
                        styles.lastMessageText,
                        hasUnread ? styles.unreadLastMessageText : styles.readLastMessageText
                      ]}
                      numberOfLines={1}
                    >
                      {item.lastMessage}
                    </Text>

                    {/* Messenger Style Blue Badge */}
                    {hasUnread ? (
                      <View style={styles.unreadBadgePill}>
                        <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Post Title Context (e.g. Về: Thẻ sinh viên...) */}
                  {item.postTitle ? (
                    <Text style={styles.postTitleText} numberOfLines={1}>
                      Về: {item.postTitle}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContentContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="chatbubbles-outline" size={42} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có tin nhắn nào</Text>
              <Text style={styles.emptySubtitle}>
                Bắt đầu nhắn tin từ chi tiết bài đăng để trao đổi về đồ thất lạc.
              </Text>
            </View>
          }
        />
      )}

      {/* Conversation Action Sheet Modal (Long Press on item) */}
      <Modal
        visible={selectedChatForAction !== null && !isDeleteConfirmVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedChatForAction(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedChatForAction(null)}
        >
          <View style={styles.actionSheetContainer}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>Tùy chọn cuộc trò chuyện</Text>
              <Text style={styles.actionSheetSubtitle} numberOfLines={1}>
                {selectedChatForAction?.otherUserName || 'Người dùng'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.actionSheetOption}
              onPress={() => {
                const target = selectedChatForAction;
                setSelectedChatForAction(null);
                if (target) handleOpenChat(target);
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.actionSheetIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="chatbubble-ellipses" size={22} color="#0084FF" />
              </View>
              <View style={styles.actionSheetTextCol}>
                <Text style={styles.actionSheetOptionTitle}>Mở cuộc trò chuyện</Text>
                <Text style={styles.actionSheetOptionSubtitle}>Xem tin nhắn và gửi phản hồi</Text>
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
                <Text style={[styles.actionSheetOptionTitle, { color: '#DC2626' }]}>Xóa toàn bộ cuộc trò chuyện</Text>
                <Text style={styles.actionSheetOptionSubtitle}>Xóa ở phía bạn (Tự động xóa vĩnh viễn trên Server khi cả 2 cùng xóa)</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetCancelBtn}
              onPress={() => setSelectedChatForAction(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionSheetCancelText}>Hủy bỏ</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirmation Dialog */}
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
            <Text style={styles.confirmDeleteTitle}>Xóa toàn bộ cuộc trò chuyện?</Text>
            <Text style={styles.confirmDeleteDesc}>
              Toàn bộ tin nhắn với {selectedChatForAction?.otherUserName} sẽ bị xóa khỏi danh sách của bạn. Khi cả 2 người cùng xóa, toàn bộ dữ liệu sẽ được xóa vĩnh viễn khỏi hệ thống.
            </Text>

            <View style={styles.confirmDeleteBtnRow}>
              <TouchableOpacity
                style={styles.confirmDeleteCancelBtn}
                onPress={() => {
                  setIsDeleteConfirmVisible(false);
                  setSelectedChatForAction(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmDeleteCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={() => {
                  const target = selectedChatForAction;
                  setIsDeleteConfirmVisible(false);
                  setSelectedChatForAction(null);
                  if (target) {
                    handleDeleteConversation(target);
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
  },
  listContentContainer: {
    paddingBottom: 100,
  },
  chatItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    position: 'relative',
    width: 52,
    height: 52,
    marginRight: 14,
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unreadDotIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#0084FF',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  contentCol: {
    flex: 1,
    justifyContent: 'center',
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  middleMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessageText: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  unreadLastMessageText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  readLastMessageText: {
    fontWeight: '400',
    color: '#64748B',
  },
  unreadBadgePill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0084FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  postTitleText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  actionSheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  actionSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  actionSheetSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  actionSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
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
    marginBottom: 2,
  },
  actionSheetOptionSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  actionSheetCancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmDeleteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '85%',
    maxWidth: 340,
    marginBottom: 'auto',
    marginTop: 'auto',
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
