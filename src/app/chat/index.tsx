import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { HeaderBar } from '../../components/HeaderBar';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

export interface Conversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  timestamp: any;
  postId?: string;
}

export default function ChatListScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const chatsRef = collection(db, 'messages');
    const q = query(
      chatsRef,
      where('senderId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map = new Map<string, Conversation>();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const otherId = data.receiverId;
        if (!map.has(otherId)) {
          map.set(otherId, {
            id: docSnap.id,
            otherUserId: otherId,
            otherUserName: data.receiverName || 'Người dùng Findora',
            lastMessage: data.message || '',
            timestamp: data.timestamp,
            postId: data.postId
          });
        }
      });

      setConversations(Array.from(map.values()));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar title="Trò Chuyện Direct" showBack />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card} 
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.otherUserId } })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.otherUserName.charAt(0).toUpperCase()}</Text>
              </View>

              <View style={styles.infoCol}>
                <Text style={styles.userName}>{item.otherUserName}</Text>
                <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={56} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện nào</Text>
              <Text style={styles.emptySubtitle}>Bắt đầu trò chuyện với người đăng bài để trao đổi về đồ thất lạc.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  listContent: {
    padding: SPACING.md
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primaryDark
  },
  infoCol: {
    flex: 1
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2
  },
  lastMsg: {
    fontSize: 13,
    color: COLORS.textMuted
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: SPACING.lg
  }
});
