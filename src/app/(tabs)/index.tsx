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
  SafeAreaView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchPosts, getCurrentAddressFromGPS, subscribeUnreadNotificationCount } from '../../services/firebaseService';
import { auth } from '../../config/firebase';
import { Post } from '../../models/types';
import { PostCard } from '../../components/PostCard';

export default function HomeScreen() {
  const router = useRouter();
  const currentUser = auth.currentUser;

  const [posts, setPosts] = useState<Post[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<string>('Thành phố Hồ Chí Minh');
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const loadLocation = async () => {
    try {
      const address = await getCurrentAddressFromGPS();
      if (address) {
        setUserLocation(address);
      }
    } catch (e) {
      console.error('Error fetching GPS location:', e);
    }
  };

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
    loadLocation();
    loadPosts();
  }, [typeFilter, searchQuery]);

  // Realtime unread notification listener matching native MainActivity.java line 745
  useEffect(() => {
    let unsubscribe = () => {};
    if (currentUser?.uid) {
      unsubscribe = subscribeUnreadNotificationCount(currentUser.uid, (count) => {
        setUnreadCount(count);
      });
    } else {
      setUnreadCount(0);
    }
    return () => {
      unsubscribe();
    };
  }, [currentUser?.uid]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLocation();
    loadPosts();
  };

  const renderHeader = () => (
    <View>
      {/* 1. Header: Real GPS Location Pin + Notification Bell Button */}
      <View style={styles.topHeaderRow}>
        <View style={styles.locationContainer}>
          <Ionicons name="location" size={18} color="#00C853" style={{ marginRight: 6 }} />
          <Text style={styles.locationText} numberOfLines={1}>
            {userLocation}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.bellBtnContainer} 
          onPress={() => router.push('/(tabs)/notifications')}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={24} color="#1F2937" />
          {/* Notification Badge Count from Firestore */}
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 2. Hero Headline Title */}
      <View style={styles.heroTitleContainer}>
        <Text style={styles.heroTitle}>
          Hôm nay bạn <Text style={styles.heroTitleHighlight}>tìm</Text> gì?
        </Text>
      </View>

      {/* 3. Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color="#9CA3AF" style={{ marginRight: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm ví, chìa khóa, thú cưng bị mất..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 4. Filter Chips Row */}
      <View style={styles.chipsRow}>
        <TouchableOpacity
          style={[styles.chipBtn, typeFilter === 'all' ? styles.chipActive : styles.chipInactive]}
          onPress={() => setTypeFilter('all')}
          activeOpacity={0.85}
        >
          <Text style={[styles.chipText, typeFilter === 'all' ? styles.chipTextActive : styles.chipTextInactive]}>
            Tất cả
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chipBtn, typeFilter === 'lost' ? styles.chipActive : styles.chipInactive]}
          onPress={() => setTypeFilter('lost')}
          activeOpacity={0.85}
        >
          <Text style={[styles.chipText, typeFilter === 'lost' ? styles.chipTextActive : styles.chipTextInactive]}>
            Thất lạc
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chipBtn, typeFilter === 'found' ? styles.chipActive : styles.chipInactive]}
          onPress={() => setTypeFilter('found')}
          activeOpacity={0.85}
        >
          <Text style={[styles.chipText, typeFilter === 'found' ? styles.chipTextActive : styles.chipTextInactive]}>
            Tìm thấy
          </Text>
        </TouchableOpacity>
      </View>

      {/* 5. AI Assistant Teaser Card */}
      <TouchableOpacity 
        style={styles.aiCard} 
        onPress={() => router.push('/(tabs)/matches')}
        activeOpacity={0.9}
      >
        <View style={styles.aiHeaderRow}>
          <Text style={styles.aiTagText}>TRỢ LÝ AI THÔNG MINH</Text>
        </View>
        <Text style={styles.aiCardTitle}>Tìm thấy 2 gợi ý phù hợp</Text>
        <Text style={styles.aiCardDesc}>
          Mất: Thẻ sinh viên Nguyễn Thị Thuỳ Trang ĐH KHTN - Độ phù hợp 80%
        </Text>
      </TouchableOpacity>

      {/* 6. Section Header: Recent Reports */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Bài đăng gần đây</Text>
          <Text style={styles.sectionSubtitle}>Cập nhật vừa xong</Text>
        </View>

        <TouchableOpacity onPress={() => setTypeFilter('all')}>
          <Text style={styles.seeAllText}>Xem tất cả</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id || Math.random().toString()}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <PostCard 
            post={item} 
            onPress={() => router.push(`/post/${item.id}`)} 
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00C853']} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#00C853" />
              <Text style={styles.loadingText}>Đang tải bài đăng Findora...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={56} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Chưa có bài đăng nào</Text>
              <Text style={styles.emptySubtitle}>Hãy tạo bài đăng mới để hỗ trợ tìm đồ thất lạc!</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  listContent: {
    paddingBottom: 30
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    paddingBottom: 12
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12
  },
  locationText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
    flex: 1
  },
  bellBtnContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    paddingHorizontal: 5,
    height: 18,
    minWidth: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center'
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  heroTitleContainer: {
    paddingHorizontal: 20,
    marginBottom: 16
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
    lineHeight: 36
  },
  heroTitleHighlight: {
    color: '#00C853',
    fontStyle: 'italic',
    fontWeight: '800'
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111111'
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16
  },
  chipBtn: {
    height: 38,
    paddingHorizontal: 20,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  chipActive: {
    backgroundColor: '#00C853'
  },
  chipInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#00C853'
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700'
  },
  chipTextActive: {
    color: '#FFFFFF'
  },
  chipTextInactive: {
    color: '#00C853'
  },
  aiCard: {
    backgroundColor: '#EFF6FF',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE'
  },
  aiHeaderRow: {
    marginBottom: 6
  },
  aiTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00C853',
    letterSpacing: 0.6
  },
  aiCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 4
  },
  aiCardDesc: {
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111'
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00C853'
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6B7280'
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4
  }
});
