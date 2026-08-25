import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchPosts } from '../../services/firebaseService';
import { Post } from '../../models/types';
import { PostCard } from '../../components/PostCard';
import { PostListSkeleton } from '../../components/PostCardSkeleton';
import { HeaderBar } from '../../components/HeaderBar';
import { HandshakeModal } from '../../components/HandshakeModal';
import { auth } from '../../config/firebase';
import { COLORS, SPACING } from '../../constants/theme';

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
    <SafeAreaView style={styles.container}>
      <HeaderBar title="Bài Đăng Của Tôi" showBack />

      {loading ? (
        <PostListSkeleton count={3} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id || Math.random().toString()}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <PostCard post={item} onPress={() => router.push(`/post/${item.id}`)} />
              
              {/* Quick Handshake Action on Active Posts */}
              {item.status === 'active' && (
                <TouchableOpacity
                  style={styles.quickHandshakeBtn}
                  onPress={() => setSelectedPostForHandshake(item)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.quickHandshakeBtnText}>Xác Nhận Trả Đồ OTP</Text>
                </TouchableOpacity>
              )}
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
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.md,
  },
  cardWrapper: {
    marginBottom: 16,
  },
  quickHandshakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00A896',
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: -8,
    marginHorizontal: 4,
    marginBottom: 8,
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  quickHandshakeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
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
