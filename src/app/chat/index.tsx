import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { getPosterDetails } from '../../services/firebaseService';
import { COLORS, SPACING } from '../../constants/theme';

export interface Conversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string;
  lastMessage: string;
  postTitle?: string;
  timestamp: string;
  unreadCount: number;
}

export default function ChatListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
          
          let userDetails = { name: 'Người dùng', avatarUrl: '' };
          try {
            userDetails = await getPosterDetails(otherId);
          } catch (e) {
            console.log('Error fetching user details:', e);
          }

          // Count unread messages for current user
          let unread = 0;
          try {
            const msgsRef = collection(db, 'chats', docSnap.id, 'messages');
            const unreadQuery = query(msgsRef, where('receiverId', '==', user.uid), where('read', '==', false));
            const unreadSnap = await getDocs(unreadQuery);
            unread = unreadSnap.size;
          } catch (e) {
            // Safe fallback if subcollection query is omitted
          }

          let postTitleVal = data.postTitle || '';
          if (!postTitleVal && data.postId) {
            try {
              const postDoc = await getDoc(doc(db, 'posts', data.postId));
              if (postDoc.exists()) {
                postTitleVal = postDoc.data().title || '';
              }
            } catch (e) {}
          }

          list.push({
            id: docSnap.id,
            otherUserId: otherId,
            otherUserName: userDetails.name || data.otherUserName || 'Người dùng Findora',
            otherUserAvatar: userDetails.avatarUrl || data.otherUserAvatar || '',
            lastMessage: data.lastMessage || data.message || 'Bắt đầu trò chuyện',
            postTitle: postTitleVal,
            timestamp: formatTimestamp(data.lastTimestamp || data.timestamp || data.updatedAt),
            unreadCount: unread
          });
        }
        setConversations(list);
      } else {
        // Fallback fallback querying 'messages' directly
        const msgsRef = collection(db, 'messages');
        const snap = await getDocs(msgsRef);
        const map = new Map<string, Conversation>();

        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          if (data.senderId === user.uid || data.receiverId === user.uid) {
            const otherId = data.senderId === user.uid ? data.receiverId : data.senderId;
            if (otherId && !map.has(otherId)) {
              let userDetails = { name: 'Người dùng', avatarUrl: '' };
              try {
                userDetails = await getPosterDetails(otherId);
              } catch (e) {}

              let postTitleVal = data.postTitle || '';
              if (!postTitleVal && data.postId) {
                try {
                  const postDoc = await getDoc(doc(db, 'posts', data.postId));
                  if (postDoc.exists()) {
                    postTitleVal = postDoc.data().title || '';
                  }
                } catch (e) {}
              }

              map.set(otherId, {
                id: docSnap.id,
                otherUserId: otherId,
                otherUserName: userDetails.name || 'Người dùng Findora',
                otherUserAvatar: userDetails.avatarUrl || '',
                lastMessage: data.message || data.text || 'Bắt đầu trò chuyện',
                postTitle: postTitleVal,
                timestamp: formatTimestamp(data.timestamp),
                unreadCount: data.read === false && data.receiverId === user.uid ? 1 : 0
              });
            }
          }
        }
        setConversations(Array.from(map.values()));
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

    // Subscribe to real-time chats updates
    let unsub = () => {};
    try {
      const chatsRef = collection(db, 'chats');
      const qChats = query(chatsRef, where('participants', 'array-contains', user.uid));
      unsub = onSnapshot(
        qChats,
        () => {
          loadConversations();
        },
        () => {
          loadConversations();
        }
      );
    } catch (e) {
      loadConversations();
    }

    return () => unsub();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
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
                onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.otherUserId, postTitle: item.postTitle || '' } })}
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
    backgroundColor: '#0084FF', // Messenger Brand Signature Blue
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
    backgroundColor: '#0084FF', // Messenger Brand Signature Blue
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
