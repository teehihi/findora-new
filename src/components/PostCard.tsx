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
    ? post.createdAt.toDate().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Mới đăng';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* Top Banner Row */}
      <View style={styles.headerRow}>
        <View style={[styles.typeBadge, isLost ? styles.lostBadge : styles.foundBadge]}>
          <Text style={styles.typeBadgeText}>
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

      {/* Main Content Area */}
      <View style={styles.bodyRow}>
        {post.imageUrl ? (
          <Image source={{ uri: post.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={32} color={COLORS.textMuted} />
          </View>
        )}

        <View style={styles.infoCol}>
          <Text style={styles.title} numberOfLines={1}>{post.title}</Text>
          <Text style={styles.description} numberOfLines={2}>{post.description}</Text>

          {/* AI Detection Label Pill */}
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
              <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
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
          <Ionicons name="heart-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.statText}>{post.likes?.length || 0} lượt thích</Text>
        </View>

        {post.rewardPoints && post.rewardPoints > 0 ? (
          <View style={styles.rewardBadge}>
            <Ionicons name="trophy" size={14} color={COLORS.gold} />
            <Text style={styles.rewardText}>Thưởng {post.rewardPoints}P</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small
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
    borderRadius: 12
  },
  lostBadge: {
    backgroundColor: '#FEE2E2'
  },
  foundBadge: {
    backgroundColor: '#D1FAE5'
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.text
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
    fontSize: 11,
    color: COLORS.textMuted
  },
  bodyRow: {
    flexDirection: 'row',
    marginTop: SPACING.xs
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#E2E8F0'
  },
  placeholderImage: {
    width: 88,
    height: 88,
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
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2
  },
  description: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 4
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.primaryDark,
    marginLeft: 4
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  locationText: {
    fontSize: 11,
    color: COLORS.textMuted,
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
    borderTopColor: '#F1F5F9'
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statText: {
    fontSize: 12,
    color: COLORS.textMuted,
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
