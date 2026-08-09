import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MatchResult } from '../models/types';
import { COLORS, SPACING, SHADOWS } from '../constants/theme';

interface MatchCardProps {
  match: MatchResult;
  onPress: () => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, onPress }) => {
  const { post, percentage, distanceKm, imageScore, contentScore } = match;

  const scoreColor =
    percentage >= 70 ? '#10B981' : percentage >= 40 ? '#F59E0B' : '#64748B';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* Top Banner Row */}
      <View style={styles.headerRow}>
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>
          <Ionicons name="sparkles" size={14} color="#FFFFFF" />
          <Text style={styles.scoreText}>{percentage}% KHỚP AI</Text>
        </View>

        {distanceKm != null ? (
          <View style={styles.distanceBadge}>
            <Ionicons name="navigate-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.distanceText}>
              {distanceKm < 1 ? 'Gần bạn (<1 km)' : `Cách ${distanceKm.toFixed(1)} km`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Post Content */}
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

          {/* AI Match Breakdown */}
          <View style={styles.breakdownRow}>
            {imageScore > 0 && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>🖼️ Ảnh trùng nhãn</Text>
              </View>
            )}
            {contentScore > 0.3 && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>📝 Từ khóa trùng</Text>
              </View>
            )}
          </View>
        </View>
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
    ...SHADOWS.medium
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  distanceText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginLeft: 4
  },
  bodyRow: {
    flexDirection: 'row',
    marginTop: SPACING.xs
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E2E8F0'
  },
  placeholderImage: {
    width: 80,
    height: 80,
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
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2
  },
  description: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 6
  },
  breakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  pill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  pillText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600'
  }
});
