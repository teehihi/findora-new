import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchPosts } from '../../services/firebaseService';
import { Post } from '../../models/types';
import { PostCard } from '../../components/PostCard';
import { HeaderBar } from '../../components/HeaderBar';
import { auth } from '../../config/firebase';
import { COLORS, SPACING } from '../../constants/theme';

export default function MyPostsScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      fetchPosts('all').then((all) => {
        setPosts(all.filter((p) => p.userId === user.uid));
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar title="Bài Đăng Của Tôi" showBack />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id || Math.random().toString()}
          renderItem={({ item }) => (
            <PostCard post={item} onPress={() => router.push(`/post/${item.id}`)} />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={56} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Bạn chưa tạo bài đăng nào</Text>
              <Text style={styles.emptySubtitle}>Các bài đăng mất đồ hoặc nhặt được của bạn sẽ hiển thị tại đây.</Text>
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
