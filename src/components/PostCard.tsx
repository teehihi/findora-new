import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Post } from '../models/types';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';

interface PostCardProps {
  post: Post;
  onPress: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onPress }) => {
  const isLost = post.type === 'lost';
  const isResolved = post.status === 'resolved';

  const formattedDate = post.createdAt?.toDate
    ? post.createdAt.toDate().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      }) + ' ' + post.createdAt.toDate().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit'
      })
    : 'Mới đăng';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={[styles.typeBadge, isLost ? styles.lostBadge : styles.foundBadge]}>
          <Text style={[styles.typeBadgeText, isLost ? styles.lostText : styles.foundText]}>
            {isLost ? 'MẤT ĐỒ 🚨' : 'NHẶT ĐƯỢC 📦'}
          </Text>
        </View>

        {isResolved ? (
          <View style={styles.resolvedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
            <Text style={styles.resolvedText}>ĐÃ GIẢI QUYẾT</Text>
          </View>
        ) : (
          <Text style={styles.dateText}>{formattedDate}</Text>
        )}
      </View>

      {/* Main Body Row */}
      <View style={styles.bodyRow}>
        {post.imageUrl ? (
          <Image source={{ uri: post.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={32} color="#CBD5E1" />
          </View>
        )}

        <View style={styles.infoCol}>
          <Text style={styles.title} numberOfLines={1}>{post.title}</Text>
          <Text style={styles.description} numberOfLines={2}>{post.description}</Text>

          {/* AI Tag if present */}
          {post.imageLabel ? (
            <View style={styles.aiTag}>
              <Ionicons name="sparkles" size={12} color={COLORS.primary} />
              <Text style={styles.aiTagText}>
                AI: {post.imageLabel} ({Math.round((post.confidence || 0.8) * 100)}%)
              </Text>
            </View>
          ) : null}

          {/* Address */}
          {post.address ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#64748B" />
              <Text style={styles.locationText} numberOfLines={1}>
                {post.address}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Card Footer */}
      <View style={styles.footerRow}>
        <View style={styles.statItem}>
          <Ionicons name="heart-outline" size={16} color="#64748B" />
          <Text style={styles.statText}>{post.likes?.length || 0} lượt thích</Text>
        </View>

        {post.rewardPoints && post.rewardPoints > 0 ? (
          <View style={styles.rewardBadge}>
            <Ionicons name="trophy" size={12} color="#B45309" />
            <Text style={styles.rewardText}>Thưởng {post.rewardPoints}P</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  lostBadge: {
    backgroundColor: '#FEE2E2'
  },
  foundBadge: {
    backgroundColor: '#DCFCE7'
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800'
  },
  lostText: {
    color: '#DC2626'
  },
  foundText: {
    color: '#15803D'
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  resolvedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 4
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500'
  },
  bodyRow: {
    flexDirection: 'row',
    marginTop: 2
  },
  image: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F1F5F9'
  },
  placeholderImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  infoCol: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center'
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 20
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 6
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F6F4',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#00A896',
    marginLeft: 4
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4,
    flex: 1
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC'
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  rewardText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    marginLeft: 4
  }
});
