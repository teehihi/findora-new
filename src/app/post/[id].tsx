import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Linking 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchPostById, subscribeComments, addComment, fetchPosts, getPosterDetails, toggleLikePost } from '../../services/firebaseService';
import { findMatches } from '../../services/aiMatching';
import { Post, Comment, MatchResult } from '../../models/types';
import { HeaderBar } from '../../components/HeaderBar';
import { ResolveModal } from '../../components/ResolveModal';
import { MatchCard } from '../../components/MatchCard';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { auth } from '../../config/firebase';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUser = auth.currentUser;

  const [post, setPost] = useState<Post | null>(null);
  const [poster, setPoster] = useState<{ name: string; avatarUrl: string }>({ name: 'Người dùng', avatarUrl: '' });
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [relatedMatches, setRelatedMatches] = useState<MatchResult[]>([]);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [fullImageVisible, setFullImageVisible] = useState(false);

  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(0);

  useEffect(() => {
    if (!id) return;
    fetchPostById(id).then((data) => {
      setPost(data);
      setLoading(false);
      if (data) {
        if (currentUser) {
          setIsLiked((data.likes || []).includes(currentUser.uid));
        }
        setLikeCount(data.likes?.length || 0);

        if (data.userId) {
          getPosterDetails(data.userId).then(setPoster);
        }

        fetchPosts('all').then((all) => {
          const matches = findMatches(data, all);
          setRelatedMatches(matches.slice(0, 3));
        });
      }
    });

    const unsubscribe = subscribeComments(id, setComments);
    return () => unsubscribe();
  }, [id]);

  const handleToggleLike = async () => {
    if (!currentUser || !post?.id) return;
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikeCount((prev) => (newIsLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      await toggleLikePost(post.id, currentUser.uid, isLiked);
    } catch (e) {
      console.error('Like toggle error:', e);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !id) return;
    const user = auth.currentUser;
    if (!user) return;

    try {
      setSubmittingComment(true);
      await addComment({
        postId: id,
        userId: user.uid,
        userName: user.displayName || 'Người dùng Findora',
        userAvatar: user.photoURL || '',
        content: newComment.trim()
      });
      setNewComment('');
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCallPhone = () => {
    if (post?.contactPhone) {
      Linking.openURL(`tel:${post.contactPhone}`);
    }
  };

  const handleOpenChat = () => {
    if (!post) return;
    router.push({
      pathname: '/chat/[id]',
      params: { id: post.userId, postId: post.id, postTitle: post.title }
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Không tìm thấy bài đăng.</Text>
      </SafeAreaView>
    );
  }

  const isOwner = auth.currentUser?.uid === post.userId;
  const isLost = post.type === 'lost';

  const getRelativeTimeString = (dateObj?: any): string => {
    if (!dateObj) return 'Vừa xong';
    const d = dateObj.toDate ? dateObj.toDate() : new Date();
    const diffSeconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
    if (diffSeconds < 60) return 'Vừa xong';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} phút trước`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} giờ trước`;
    return `${d.getDate()} tháng ${d.getMonth() + 1}`;
  };

  const formattedDate = getRelativeTimeString(post.createdAt);

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar title="Chi Tiết Bài Đăng" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Post Image with Click to Zoom Modal */}
        {post.imageUrl ? (
          <TouchableOpacity onPress={() => setFullImageVisible(true)} activeOpacity={0.9}>
            <Image source={{ uri: post.imageUrl }} style={styles.image} resizeMode="cover" />
          </TouchableOpacity>
        ) : null}

        {/* Info Card */}
        <View style={styles.card}>
          <View style={styles.typeBadgeRow}>
            <View style={[styles.typeBadge, isLost ? styles.lostBadge : styles.foundBadge]}>
              <Text style={styles.typeBadgeText}>{isLost ? '🔴 ĐỒ BỊ MẤT' : '🟢 NHẶT ĐƯỢC'}</Text>
            </View>

            {post.status === 'resolved' ? (
              <View style={styles.resolvedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                <Text style={styles.resolvedText}>ĐÃ GIẢI QUYẾT</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.title}>{post.title}</Text>
          <Text style={styles.description}>{post.description}</Text>

          {/* AI Info Pill */}
          {post.imageLabel ? (
            <View style={styles.aiTag}>
              <Ionicons name="sparkles" size={14} color={COLORS.primary} />
              <Text style={styles.aiTagText}>
                Nhận diện AI: <Text style={{ fontWeight: '800' }}>{post.imageLabel}</Text> ({Math.round((post.confidence || 0.85) * 100)}%)
              </Text>
            </View>
          ) : null}

          {/* Address */}
          {post.address ? (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color={COLORS.primary} />
              <Text style={styles.locationText}>{post.address}</Text>
            </View>
          ) : null}

          {/* Contact & Reward */}
          {post.rewardPoints ? (
            <View style={styles.rewardBox}>
              <Ionicons name="trophy" size={20} color={COLORS.gold} />
              <Text style={styles.rewardText}>Thưởng {post.rewardPoints} điểm Findora cho người hỗ trợ!</Text>
            </View>
          ) : null}
        </View>

        {/* Action Buttons Row */}
        {post.status === 'active' && (
          <View style={styles.actionRow}>
            {!isOwner && (
              <TouchableOpacity style={styles.chatBtn} onPress={handleOpenChat}>
                <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Nhắn Tin Ngay</Text>
              </TouchableOpacity>
            )}

            {post.contactPhone ? (
              <TouchableOpacity style={styles.callBtn} onPress={handleCallPhone}>
                <Ionicons name="call" size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Gọi Điện</Text>
              </TouchableOpacity>
            ) : null}

            {isOwner && (
              <TouchableOpacity style={styles.resolveBtn} onPress={() => setResolveModalVisible(true)}>
                <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Xác Nhận Trả Đồ OTP</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Related Matches Section */}
        {relatedMatches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gợi ý ghép đôi AI liên quan 🤖</Text>
            {relatedMatches.map((item) => (
              <MatchCard 
                key={item.post.id} 
                match={item} 
                onPress={() => router.push(`/post/${item.post.id}`)} 
              />
            ))}
          </View>
        )}

        {/* Comments Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bình luận ({comments.length})</Text>

          {/* Add Comment Input */}
          <View style={styles.addCommentRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Viết bình luận hoặc manh mối..."
              value={newComment}
              onChangeText={setNewComment}
            />
            <TouchableOpacity 
              style={styles.sendCommentBtn} 
              onPress={handleAddComment}
              disabled={submittingComment}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentItem}>
              <View style={styles.commentAvatar}>
                <Text style={styles.avatarText}>{comment.userName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.commentContent}>
                <Text style={styles.commentUser}>{comment.userName}</Text>
                <Text style={styles.commentText}>{comment.content}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Resolve OTP Modal */}
      <ResolveModal
        visible={resolveModalVisible}
        onClose={() => setResolveModalVisible(false)}
        postId={post.id!}
        postTitle={post.title}
        onSuccess={() => {
          fetchPostById(post.id!).then(setPost);
        }}
      />

      {/* Full Screen Facebook-Style Photo Viewer Modal with Zoom */}
      {post.imageUrl ? (
        <ImageViewerModal
          visible={fullImageVisible}
          imageUrl={post.imageUrl}
          post={post}
          posterName={poster.name}
          posterAvatar={poster.avatarUrl}
          formattedDate={formattedDate}
          likeCount={likeCount}
          isLiked={isLiked}
          commentCount={comments.length}
          onToggleLike={handleToggleLike}
          onClose={() => setFullImageVisible(false)}
        />
      ) : null}
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
  errorText: {
    fontSize: 16,
    color: COLORS.textMuted
  },
  scrollContent: {
    padding: SPACING.md
  },
  image: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    marginBottom: SPACING.md
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8
  },
  lostBadge: {
    backgroundColor: '#FEE2E2'
  },
  foundBadge: {
    backgroundColor: '#D1FAE5'
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  resolvedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.xs
  },
  description: {
    fontSize: 15,
    color: COLORS.textMuted,
    lineHeight: 22,
    marginBottom: SPACING.md
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: SPACING.sm
  },
  aiTagText: {
    fontSize: 12,
    color: COLORS.primaryDark,
    marginLeft: 6
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm
  },
  locationText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginLeft: 6
  },
  rewardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    marginTop: SPACING.xs
  },
  rewardText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginLeft: SPACING.xs
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SPACING.md
  },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 12
  },
  resolveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    borderRadius: 12
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8
  },
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.md
  },
  addCommentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md
  },
  commentInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 14,
    marginRight: 8
  },
  sendCommentBtn: {
    backgroundColor: COLORS.primary,
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: SPACING.sm
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark
  },
  commentContent: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: 12
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2
  },
  commentText: {
    fontSize: 13,
    color: COLORS.textMuted
  }
});
