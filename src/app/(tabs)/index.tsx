import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchPosts } from '../../services/firebaseService';
import { Post } from '../../models/types';
import { PostCard } from '../../components/PostCard';
import { COLORS, SPACING } from '../../constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = async () => {
    try {
      const data = await fetchPosts(typeFilter, searchQuery);
      setPosts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [typeFilter, searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPosts();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* App Header Bar */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Ionicons name="search-circle" size={32} color={COLORS.primary} />
          <Text style={styles.brandTitle}>Findora</Text>
        </View>
        <TouchableOpacity 
          style={styles.aiButton} 
          onPress={() => router.push('/(tabs)/matches')}
          activeOpacity={0.8}
        >
          <Ionicons name="sparkles" size={16} color="#FFFFFF" />
          <Text style={styles.aiButtonText}>AI Matches</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input Box */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo từ khóa (mèo, chìa khóa, ví, điện thoại...)"
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Chip Filters */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.chip, typeFilter === 'all' && styles.chipActive]}
          onPress={() => setTypeFilter('all')}
        >
          <Text style={[styles.chipText, typeFilter === 'all' && styles.chipTextActive]}>
            Tất cả
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, typeFilter === 'lost' && styles.chipActiveLost]}
          onPress={() => setTypeFilter('lost')}
        >
          <Text style={[styles.chipText, typeFilter === 'lost' && styles.chipTextActiveLost]}>
            🔴 Mất đồ
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, typeFilter === 'found' && styles.chipActiveFound]}
          onPress={() => setTypeFilter('found')}
        >
          <Text style={[styles.chipText, typeFilter === 'found' && styles.chipTextActiveFound]}>
            🟢 Nhặt được
          </Text>
        </TouchableOpacity>
      </View>

      {/* Feed List */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải bài đăng Findora...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id || Math.random().toString()}
          renderItem={({ item }) => (
            <PostCard 
              post={item} 
              onPress={() => router.push(`/post/${item.id}`)} 
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={56} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Chưa có bài đăng nào</Text>
              <Text style={styles.emptySubtitle}>Hãy là người đầu tiên tạo bài đăng tìm đồ hoặc báo nhặt được!</Text>
            </View>
          }
        />
      )}

      {/* Floating Create Post Button */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push('/post/create')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
        <Text style={styles.fabText}>Đăng Bài</Text>
      </TouchableOpacity>
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
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginLeft: 6
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  aiButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 4
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.md,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  searchIcon: {
    marginRight: SPACING.xs
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: 8
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E2E8F0'
  },
  chipActive: {
    backgroundColor: COLORS.text
  },
  chipActiveLost: {
    backgroundColor: '#EF4444'
  },
  chipActiveFound: {
    backgroundColor: '#10B981'
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted
  },
  chipTextActive: {
    color: '#FFFFFF'
  },
  chipTextActiveLost: {
    color: '#FFFFFF'
  },
  chipTextActiveFound: {
    color: '#FFFFFF'
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 80
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
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6
  },
  fabText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 4
  }
});
