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
  const [activeTab, setActiveTab] = useState<'active' | 'resolved'>('active');

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

  const activePosts = posts.filter((p) => p.status === 'active' || !p.status);
  const resolvedPosts = posts.filter((p) => p.status === 'resolved' || (p as any).status === 'completed');
  const displayedPosts = activeTab === 'active' ? activePosts : resolvedPosts;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderBar title="Bài Đăng Của Tôi" showBack />

      {/* Standard Underline Top Tab Bar */}
      <View style={styles.tabBarContainer}>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab('active')}
          activeOpacity={0.7}
        >
          <View style={styles.tabLabelRow}>
            <Text style={[styles.tabButtonText, activeTab === 'active' && styles.tabButtonTextActive]}>
              Đang hoạt động
            </Text>
            <View style={[styles.tabBadge, activeTab === 'active' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'active' && styles.tabBadgeTextActive]}>
                {activePosts.length}
              </Text>
            </View>
          </View>
          {activeTab === 'active' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab('resolved')}
          activeOpacity={0.7}
        >
          <View style={styles.tabLabelRow}>
            <Text style={[styles.tabButtonText, activeTab === 'resolved' && styles.tabButtonTextActive]}>
              Đã giải quyết
            </Text>
            <View style={[styles.tabBadge, activeTab === 'resolved' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'resolved' && styles.tabBadgeTextActive]}>
                {resolvedPosts.length}
              </Text>
            </View>
          </View>
          {activeTab === 'resolved' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
      </View>

      <View style={styles.listWrapper}>
        {loading ? (
          <PostListSkeleton count={3} />
        ) : (
          <FlatList
            data={displayedPosts}
            keyExtractor={(item) => item.id || Math.random().toString()}
            renderItem={({ item }) => (
              <View style={styles.cardWrapper}>
                <PostCard
                  post={item}
                  onPress={() => router.push(`/post/${item.id}`)}
                  onHandshakePress={item.status === 'active' && item.type === 'found' ? () => setSelectedPostForHandshake(item) : undefined}
                />
              </View>
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons
                    name={activeTab === 'active' ? 'document-text-outline' : 'checkmark-done-circle-outline'}
                    size={40}
                    color="#94A3B8"
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {activeTab === 'active'
                    ? 'Không có bài đăng nào đang hoạt động'
                    : 'Chưa có bài đăng nào đã giải quyết'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {activeTab === 'active'
                    ? 'Các bài đăng tìm đồ hoặc chờ trao trả của bạn sẽ hiển thị tại đây.'
                    : 'Khi các giao dịch trao trả đồ hoàn tất thành công, bài viết sẽ được lưu trữ tại đây.'}
                </Text>
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
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    height: 46,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    fontWeight: '800',
    color: '#00A896',
  },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(0, 168, 150, 0.12)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBadgeTextActive: {
    color: '#00A896',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 24,
    right: 24,
    height: 3,
    backgroundColor: '#00A896',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
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
    paddingHorizontal: SPACING.lg,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
