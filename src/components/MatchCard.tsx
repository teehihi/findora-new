import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MatchResult } from '../models/types';
import { COLORS, SPACING } from '../constants/theme';

interface MatchCardProps {
  match: MatchResult;
  onPress: () => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, onPress }) => {
  const { post, distanceKm, imageScore, contentScore, reasons: precomputedReasons } = match;

  // Use precomputed multi-factor AI reasons if available
  const rawReasons = precomputedReasons && precomputedReasons.length > 0
    ? precomputedReasons
    : (imageScore >= 0.4 ? ['Hình ảnh giống nhau'] : []).concat(
        contentScore >= 0.3 ? ['Thông tin phù hợp'] : [],
        distanceKm != null && distanceKm <= 5 ? ['Vị trí gần nhau'] : []
      );

  const finalReasons = rawReasons.length > 0 
    ? rawReasons 
    : ['Thông tin phù hợp', 'Đặc điểm tương đồng'];

  const displayReasons = finalReasons.slice(0, 2);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.matchHintContainer}>
          <Ionicons name="sparkles" size={14} color="#10B981" style={{ marginRight: 6 }} />
          <Text style={styles.matchHintText}>Có thể là đồ của bạn</Text>
        </View>

        {distanceKm != null ? (
          <View style={styles.distanceContainer}>
            <Text style={styles.distanceText}>
              {distanceKm < 1 ? '< 1 km' : `${distanceKm.toFixed(1).replace('.', ',')} km`}
            </Text>
            <Ionicons 
              name="arrow-up-outline" 
              size={13} 
              color="#64748B" 
              style={{ transform: [{ rotate: '45deg' }], marginLeft: 2 }} 
            />
          </View>
        ) : null}
      </View>

      {/* Body Content Row */}
      <View style={styles.bodyRow}>
        {/* Post Image Thumbnail */}
        {post.imageUrl ? (
          <Image source={{ uri: post.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={28} color="#94A3B8" />
          </View>
        )}

        {/* Post Title & Description */}
        <View style={styles.infoCol}>
          <Text style={styles.title} numberOfLines={1}>{post.title}</Text>
          {post.description ? (
            <Text style={styles.description} numberOfLines={2}>{post.description}</Text>
          ) : null}
        </View>
      </View>

      {/* Dynamic Match Signals (1 Row across full width) */}
      {displayReasons.length > 0 && (
        <View style={styles.matchReasonsRow}>
          {displayReasons.map((reason, idx) => (
            <View key={idx} style={styles.reasonItem}>
              <Ionicons name="checkmark" size={15} color="#10B981" style={styles.checkIcon} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  matchHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchHintText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  placeholderImage: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  matchReasonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    marginRight: 5,
  },
  reasonText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#059669',
  },
});
