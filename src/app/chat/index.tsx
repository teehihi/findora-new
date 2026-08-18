import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, getDocs, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
        const list: Conversation[] = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const participants: string[] = data.participants || [];
          const otherId = participants.find((id) => id !== user.uid) || user.uid;

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

          let unread = 0;
          try {
            const msgsRef = collection(db, 'chats', docSnap.id, 'messages');
            const unreadQuery = query(msgsRef, where('read', '==', false));
            const unreadSnap = await getDocs(unreadQuery);
            unreadSnap.forEach((d) => {
              if (d.data().senderId !== user.uid) {
                unread++;
              }
            });
          } catch (e) { }

          const rawTs = data.lastTimestamp || data.timestamp || data.updatedAt;

          list.push({
            id: docSnap.id,
            otherUserId: otherId,
            otherUserName: userDetails.name,
            otherUserAvatar: userDetails.avatarUrl,
            lastMessage: data.lastMessage || data.message || 'Bắt đầu trò chuyện',
            postId: data.postId || '',
            postTitle: data.postTitle || '',
            timestamp: formatTimestamp(rawTs),
            rawTimestamp: rawTs,
            unreadCount: unread,
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

    const unsub = onSnapshot(
      qChats,
      async (snapshot) => {
        if (snapshot.empty) {
          setConversations([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        const list: Conversation[] = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const participants: string[] = data.participants || [];
            const otherId = participants.find((id) => id !== user.uid) || user.uid;

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

            let unread = 0;
            try {
              const msgsRef = collection(db, 'chats', docSnap.id, 'messages');
              const unreadQuery = query(msgsRef, where('read', '==', false));
              const unreadSnap = await getDocs(unreadQuery);
              unreadSnap.forEach((d) => {
                if (d.data().senderId !== user.uid) {
                  unread++;
                }
              });
            } catch (e) { }

            const rawTs = data.lastTimestamp || data.timestamp || data.updatedAt;

            return {
              id: docSnap.id,
              otherUserId: otherId,
              otherUserName: userDetails.name,
              otherUserAvatar: userDetails.avatarUrl,
              lastMessage: data.lastMessage || data.message || 'Bắt đầu trò chuyện',
              postId: data.postId || '',
              postTitle: data.postTitle || '',
              timestamp: formatTimestamp(rawTs),
              rawTimestamp: rawTs,
              unreadCount: unread,
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

    return () => unsub();
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
    // 1. Optimistic UI update: instantly reset unread counter to 0
    setConversations((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, unreadCount: 0 } : c))
    );

    // 2. Mark unread messages and notifications as read in background
    if (user) {
      (async () => {
        try {
          // A. Mark messages from other user as read
          const msgsRef = collection(db, 'chats', item.id, 'messages');
          const unreadSnap = await getDocs(query(msgsRef, where('read', '==', false)));
          unreadSnap.forEach((dSnap) => {
            if (dSnap.data().senderId !== user.uid) {
              updateDoc(doc(db, 'chats', item.id, 'messages', dSnap.id), { read: true }).catch(() => {});
            }
          });

          // B. Clear chat notifications from this sender
          const notifRef = collection(db, 'notifications');
          const notifSnap = await getDocs(query(notifRef, where('userId', '==', user.uid), where('read', '==', false)));
          notifSnap.forEach((nSnap) => {
            const nData = nSnap.data();
            if (nData.senderId === item.otherUserId || nData.chatId === item.id) {
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
});
