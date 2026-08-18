import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchPosts } from '../../services/firebaseService';
import { findMatches } from '../../services/aiMatching';
import { Post, MatchResult } from '../../models/types';
import { MatchCard } from '../../components/MatchCard';
import { auth } from '../../config/firebase';
import { COLORS, SPACING } from '../../constants/theme';

export default function MatchesScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMatches = async () => {
    try {
      const allPosts = await fetchPosts('all');
      const currentUser = auth.currentUser;

      if (!currentUser) {
        // If not logged in, compare first post with others as demo
        if (allPosts.length > 0) {
          const results = findMatches(allPosts[0], allPosts);
          setMatches(results);
        }
      } else {
        // Find current user's posts
        const userPosts = allPosts.filter(p => p.userId === currentUser.uid);
        let aggregatedMatches: MatchResult[] = [];

        if (userPosts.length > 0) {
          // Find matches for user's latest post
          const latestPost = userPosts[0];
          aggregatedMatches = findMatches(latestPost, allPosts);
        } else {
          // Fallback: compare all lost posts against found posts
          const lostPosts = allPosts.filter(p => p.type === 'lost');
          if (lostPosts.length > 0) {
            aggregatedMatches = findMatches(lostPosts[0], allPosts);
          }
        }

        setMatches(aggregatedMatches);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadMatches();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={24} color={COLORS.primary} />
        <Text style={styles.headerTitle}>Gợi Ý Ghép Đôi AI 🤖</Text>
      </View>

      <Text style={styles.bannerSubtitle}>
        Thuật toán AI Findora tự động kết hợp Hình ảnh + Nội dung + Khoảng cách địa lý để tìm đúng vật phẩm bị thất lạc.
      </Text>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>AI đang phân tích các cặp bài đăng...</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.post.id || Math.random().toString()}
          renderItem={({ item }) => (
            <MatchCard 
              match={item} 
              onPress={() => router.push(`/post/${item.post.id}`)} 
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="sparkles-outline" size={56} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Chưa có gợi ý ghép đôi nào</Text>
              <Text style={styles.emptySubtitle}>
                Tạo bài đăng Mất đồ/Nhặt được để AI Findora tự động ghép đôi và gửi thông báo cho bạn!
              </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginLeft: SPACING.xs
  },
  bannerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    lineHeight: 18
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 100
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: SPACING.sm
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
