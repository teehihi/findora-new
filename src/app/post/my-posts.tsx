import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HandshakeModal } from '../../components/HandshakeModal';
import { HeaderBar } from '../../components/HeaderBar';
import { PostCard } from '../../components/PostCard';
import { PostListSkeleton } from '../../components/PostCardSkeleton';
import { auth } from '../../config/firebase';
import { COLORS, SPACING } from '../../constants/theme';
import { Post } from '../../models/types';
import { fetchPosts } from '../../services/firebaseService';

export default function MyPostsScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPostForHandshake, setSelectedPostForHandshake] = useState<Post | null>(null);

  const loadMyPosts = () => {
    const user = auth.currentUser;
    if (user) {
      fetchPosts('all').then((all) => {
        setPosts(all.filter((p) => p.userId === user.uid));
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyPosts();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderBar title="Bài Đăng Của Tôi" showBack />

      <View style={styles.listWrapper}>
        {loading ? (
          <PostListSkeleton count={3} />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id || Math.random().toString()}
            renderItem={({ item }) => (
              <View style={styles.cardWrapper}>
                <PostCard
                  post={item}
                  onPress={() => router.push(`/post/${item.id}`)}
                  onHandshakePress={item.status === 'active' ? () => setSelectedPostForHandshake(item) : undefined}
                />
              </View>
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
      </View>

      {/* Handshake Modal */}
      {selectedPostForHandshake && (
        <HandshakeModal
          visible={!!selectedPostForHandshake}
          onClose={() => setSelectedPostForHandshake(null)}
          postId={selectedPostForHandshake.id!}
          postTitle={selectedPostForHandshake.title}
          postImageUrl={selectedPostForHandshake.imageUrl}
          postDesc={selectedPostForHandshake.description}
          rewardPoints={selectedPostForHandshake.rewardPoints || 50}
          onSuccess={() => {
            loadMyPosts();
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl * 2,
  },
  cardWrapper: {
    marginBottom: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: SPACING.lg,
  },
});
