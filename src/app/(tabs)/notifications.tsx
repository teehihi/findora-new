import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { Notification } from '../../models/types';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const notifRef = collection(db, 'notifications');
      const q = query(notifRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const list: Notification[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: data.userId,
          title: data.title || 'Thông báo',
          message: data.message || '',
          type: data.type || 'system',
          postId: data.postId,
          createdAt: data.createdAt,
          read: data.read || false
        });
      });

      setNotifications(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'match': return 'sparkles';
      case 'chat': return 'chatbubbles';
      case 'points': return 'trophy';
      case 'resolve': return 'checkmark-circle';
      default: return 'notifications';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="notifications" size={24} color={COLORS.primary} />
        <Text style={styles.headerTitle}>Thông Báo 🔔</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id || Math.random().toString()}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.itemCard, !item.read && styles.unreadCard]}
            onPress={() => {
              if (item.postId) router.push(`/post/${item.postId}`);
            }}
          >
            <View style={styles.iconCircle}>
              <Ionicons name={getNotifIcon(item.type)} size={22} color={COLORS.primary} />
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={56} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Chưa có thông báo nào</Text>
            <Text style={styles.emptySubtitle}>Các cập nhật về ghép đôi AI, tin nhắn và điểm thưởng sẽ xuất hiện tại đây.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginLeft: SPACING.xs
  },
  listContent: {
    padding: SPACING.md
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small
  },
  unreadCard: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md
  },
  infoCol: {
    flex: 1
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2
  },
  message: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18
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
