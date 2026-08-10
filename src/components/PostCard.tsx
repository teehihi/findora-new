import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Post } from '../models/types';
import { auth, firebaseConfig } from '../config/firebase';
import { toggleLikePost, getPosterDetails, getPostCommentCount } from '../services/firebaseService';

interface PostCardProps {
  post: Post;
  onPress: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onPress }) => {
  const currentUser = auth.currentUser;
  const isLost = post.type === 'lost';

  const [poster, setPoster] = useState<{ name: string; avatarUrl: string }>({
    name: 'Người dùng',
    avatarUrl: ''
  });
  const [commentCount, setCommentCount] = useState<number>(0);

  const [isLiked, setIsLiked] = useState<boolean>(
    currentUser ? (post.likes || []).includes(currentUser.uid) : false
  );
  const [likeCount, setLikeCount] = useState<number>(post.likes?.length || 0);

  // Fetch poster details from Firestore users/{userId} matching native PostAdapter.java
  useEffect(() => {
    let isMounted = true;
    if (post.userId) {
      getPosterDetails(post.userId).then((res) => {
        if (isMounted) setPoster(res);
      });
    }
    if (post.id) {
      getPostCommentCount(post.id).then((count) => {
        if (isMounted) setCommentCount(count);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [post.userId, post.id]);

  // Clean URL without arbitrary string replacements
  const getSanitizedImageUrl = (url?: string): string => {
    if (!url || typeof url !== 'string') return '';
    let cleaned = url.trim();
    if (cleaned.startsWith('http://')) {
      cleaned = cleaned.replace('http://', 'https://');
    }
    return cleaned;
  };

  const rawImageUrl = post.imageUrl || '';
  const imageUrlString = getSanitizedImageUrl(rawImageUrl);
  const hasImage = Boolean(imageUrlString.length > 0);

  // Log runtime diagnostics for image loading
  if (hasImage) {
    console.log(`[PostCard Diagnostics - ${post.id}]`, {
      originalUrl: rawImageUrl,
      finalUrlPassedToImage: imageUrlString,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      userUid: currentUser?.uid || null,
      isAuthenticated: Boolean(currentUser)
    });
  }

  // Relative Time formatting exactly matching native PostAdapter.java getRelativeTime
  const getRelativeTimeString = (dateObj: Date): string => {
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

    if (diffSeconds < 60) return 'Vừa xong';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} phút trước`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} giờ trước`;
    
    return `${dateObj.getDate()} tháng ${dateObj.getMonth() + 1}`;
  };

  const formattedDate = post.createdAt?.toDate
    ? getRelativeTimeString(post.createdAt.toDate())
    : '28 tháng 4';

  const handleToggleLike = async () => {
    if (!currentUser) return;
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikeCount((prev) => (newIsLiked ? prev + 1 : Math.max(0, prev - 1)));

    if (post.id) {
      try {
        await toggleLikePost(post.id, currentUser.uid, isLiked);
      } catch (e) {
        console.error('Like toggle error:', e);
      }
    }
  };

  return (
    <View style={styles.cardContainer}>
      {/* 1. Header: Avatar + Poster Name + Verified Badge + Date + 3-dots */}
      <View style={styles.headerRow}>
        <View style={styles.avatarFrame}>
          {poster.avatarUrl ? (
            <Image 
              source={{ uri: getSanitizedImageUrl(poster.avatarUrl) }} 
              style={styles.avatarImage} 
              resizeMode="cover"
              onLoad={(event) => {
                console.log(`[Avatar Image Load SUCCESS - User ${post.userId}]`, event.nativeEvent);
              }}
              onError={(error) => {
                console.error(`[Avatar Image Load ERROR - User ${post.userId}]`, {
                  error: error.nativeEvent?.error || error,
                  originalUrl: poster.avatarUrl,
                  projectId: firebaseConfig.projectId,
                  storageBucket: firebaseConfig.storageBucket,
                  userUid: currentUser?.uid || null,
                  isAuthenticated: Boolean(currentUser)
                });
              }}
          />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{poster.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerInfoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.posterName}>{poster.name}</Text>
            {/* Verified Blue Checkmark */}
            <Ionicons name="checkmark-circle" size={16} color="#2563EB" style={styles.verifyIcon} />
          </View>
          <Text style={styles.createdDate}>{formattedDate}</Text>
        </View>

        <TouchableOpacity 
          style={styles.moreBtn} 
          onPress={() => Alert.alert('Tùy chọn', 'Tùy chọn bài đăng')}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#71717A" />
        </TouchableOpacity>
      </View>

      {/* 2. Title & Description */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
        <Text style={styles.postDescription} numberOfLines={3}>{post.description}</Text>

        {/* 3. Image Container with Top-Left Type Badge & Bottom Location Overlay */}
        {hasImage ? (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: imageUrlString }} 
              style={styles.postImage} 
              resizeMode="cover"
              onLoad={(event) => {
                console.log(`[Post Image Load SUCCESS - Post ${post.id}]`, event.nativeEvent);
              }}
              onError={(error) => {
                console.error(`[Post Image Load ERROR - Post ${post.id}]`, {
                  error: error.nativeEvent?.error || error,
                  originalUrl: rawImageUrl,
                  finalUrl: imageUrlString,
                  projectId: firebaseConfig.projectId,
                  storageBucket: firebaseConfig.storageBucket,
                  userUid: currentUser?.uid || null,
                  isAuthenticated: Boolean(currentUser)
                });
              }}
            />

            {/* Type Badge (THẤT LẠC / TÌM THẤY) */}
            <View style={[styles.typeBadge, isLost ? styles.lostBadge : styles.foundBadge]}>
              <Text style={styles.typeBadgeText}>
                {isLost ? 'THẤT LẠC' : 'TÌM THẤY'}
              </Text>
            </View>

            {/* Location Overlay Bar */}
            {post.address ? (
              <View style={styles.locationOverlay}>
                <Ionicons name="location" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.locationOverlayText} numberOfLines={1}>
                  {post.address}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>

      {/* 4. Bottom Action Bar: Genuine Facebook-style Like & Circle Comment Icons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={styles.actionBtn} 
          onPress={handleToggleLike}
          activeOpacity={0.7}
        >
          <Feather 
            name="thumbs-up" 
            size={20} 
            color={isLiked ? '#1877F2' : '#65676B'} 
          />
          {likeCount > 0 && (
            <Text style={[styles.actionCount, isLiked && { color: '#1877F2', fontWeight: '700' }]}>
              {likeCount}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
          <Feather name="message-circle" size={20} color="#65676B" />
          {commentCount > 0 && (
            <Text style={styles.actionCount}>{commentCount}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Card Divider */}
      <View style={styles.bottomDivider} />
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 14,
    marginBottom: 8
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  avatarFrame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#00C853',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#F8FAFC'
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00C853',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  headerInfoCol: {
    flex: 1,
    justifyContent: 'center'
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  posterName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111'
  },
  verifyIcon: {
    marginLeft: 4
  },
  createdDate: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2
  },
  moreBtn: {
    padding: 4
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 4,
    lineHeight: 22
  },
  postDescription: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
    lineHeight: 20
  },
  imageContainer: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#E5E7EB',
    position: 'relative'
  },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: 16
  },
  typeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    zIndex: 10
  },
  lostBadge: {
    backgroundColor: '#EF4444'
  },
  foundBadge: {
    backgroundColor: '#00C853'
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  locationOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10
  },
  locationOverlayText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    paddingVertical: 4
  },
  actionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#65676B',
    marginLeft: 6
  },
  bottomDivider: {
    height: 8,
    backgroundColor: '#F3F4F6',
    marginHorizontal: -16,
    marginTop: 8
  }
});
