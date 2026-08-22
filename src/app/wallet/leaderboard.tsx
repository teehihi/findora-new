import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar } from '../../components/HeaderBar';
import { auth } from '../../config/firebase';
import { COLORS, SHADOWS, SPACING } from '../../constants/theme';
import { User } from '../../models/types';
import { fetchLeaderboard } from '../../services/firebaseService';

type Timeframe = 'WEEK' | 'MONTH' | 'ALL';

const TIMEFRAME_TABS: { key: Timeframe; label: string }[] = [
  { key: 'WEEK', label: 'Tuần' },
  { key: 'MONTH', label: 'Tháng' },
  { key: 'ALL', label: 'Mọi lúc' },
];

const LEVEL_ASSETS: Record<string, any> = {
  'Huyền thoại': require('../../../assets/images/ic_legendary.png'),
  'Thiên thần': require('../../../assets/images/ic_angel.png'),
  'Người tốt': require('../../../assets/images/ic_good.png'),
  'Tập sự': require('../../../assets/images/ic_newbie.png'),
};

function LeaderboardSkeleton() {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.skeletonContainer}>
      {/* Podium Skeleton */}
      <View style={styles.skeletonPodiumRow}>
        <Animated.View style={[styles.skeletonPodiumCol, { height: 160, opacity: pulseAnim }]} />
        <Animated.View style={[styles.skeletonPodiumCol, { height: 195, opacity: pulseAnim }]} />
        <Animated.View style={[styles.skeletonPodiumCol, { height: 145, opacity: pulseAnim }]} />
      </View>

      {/* List Skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <Animated.View style={[styles.skeletonCircle, { opacity: pulseAnim }]} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Animated.View style={[styles.skeletonLine, { width: '60%', height: 16, opacity: pulseAnim }]} />
            <Animated.View style={[styles.skeletonLine, { width: '35%', height: 12, marginTop: 6, opacity: pulseAnim }]} />
          </View>
          <Animated.View style={[styles.skeletonLine, { width: 50, height: 18, opacity: pulseAnim }]} />
        </View>
      ))}
    </View>
  );
}

const PAGE_SIZE = 10;

export default function LeaderboardScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('ALL');

  const currentUserId = auth.currentUser?.uid;

  const loadData = async (timeframe: Timeframe) => {
    try {
      const data = await fetchLeaderboard(timeframe);
      setUsers(data);
    } catch (e) {
      console.error('Error loading leaderboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadData(selectedTimeframe);
  }, [selectedTimeframe]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadData(selectedTimeframe);
    setRefreshing(false);
  };

  const top1 = users[0];
  const top2 = users[1];
  const top3 = users[2];
  const restUsers = users.slice(3);
  const displayedRestUsers = restUsers.slice(0, page * PAGE_SIZE);

  const handleLoadMore = () => {
    if (displayedRestUsers.length < restUsers.length && !loadingMore) {
      setLoadingMore(true);
      setTimeout(() => {
        setPage((prev) => prev + 1);
        setLoadingMore(false);
      }, 350);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderBar title="Bảng Vinh Danh Việc Tốt" showBack backgroundColor="#F8FAFC" />

      {/* 1. Timeframe Tab Segment */}
      <View style={styles.tabContainer}>
        {TIMEFRAME_TABS.map((tab) => {
          const isActive = selectedTimeframe === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setSelectedTimeframe(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <LeaderboardSkeleton />
      ) : (
        <FlatList
          data={displayedRestUsers}
          keyExtractor={(item) => item.uid}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.podiumSection}>
              {/* TOP 3 PODIUM */}
              <View style={styles.podiumRow}>
                {/* TOP 2 (LEFT) */}
                {top2 ? (
                  <View style={[styles.podiumCol, styles.podiumCol2]}>
                    <View style={styles.avatarWrapper}>
                      <View style={[styles.avatarBorder, styles.avatarBorder2]}>
                        {top2.avatarUrl ? (
                          <Image source={{ uri: top2.avatarUrl }} style={styles.podiumAvatar} />
                        ) : (
                          <View style={[styles.podiumAvatar, styles.avatarFallback2]}>
                            <Text style={styles.avatarInitial}>{(top2.name || 'U').charAt(0)}</Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.podiumBadge, styles.podiumBadge2]}>
                        <Text style={styles.podiumBadgeText}>2</Text>
                      </View>
                    </View>

                    <Text style={styles.podiumName} numberOfLines={1}>
                      {top2.name || 'Helper 2'}
                    </Text>

                    <View style={styles.podiumPointsRow}>
                      <Text style={styles.podiumPoints}>{top2.points}</Text>
                      <Image
                        source={require('../../../assets/images/FindoPoint.webp')}
                        style={styles.coinIconSmall}
                        resizeMode="contain"
                      />
                    </View>

                    <View style={[styles.podiumBase, styles.podiumBase2]}>
                      <Text style={styles.podiumBaseNumber}>2</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.podiumCol} />
                )}

                {/* TOP 1 (CENTER) */}
                {top1 ? (
                  <View style={[styles.podiumCol, styles.podiumCol1]}>
                    <View style={styles.avatarWrapper}>
                      <View style={[styles.avatarBorder, styles.avatarBorder1]}>
                        {top1.avatarUrl ? (
                          <Image source={{ uri: top1.avatarUrl }} style={styles.podiumAvatarLarge} />
                        ) : (
                          <View style={[styles.podiumAvatarLarge, styles.avatarFallback1]}>
                            <Text style={styles.avatarInitialLarge}>{(top1.name || 'U').charAt(0)}</Text>
                          </View>
                        )}
                      </View>

                      {/* ic_top1.png artwork at top-right corner overlapping avatar */}
                      <View style={styles.topRightBadge}>
                        <Image
                          source={require('../../../assets/images/ic_top1.png')}
                          style={styles.crownImage}
                          resizeMode="contain"
                        />
                      </View>

                      <View style={[styles.podiumBadge, styles.podiumBadge1]}>
                        <Text style={styles.podiumBadgeText}>1</Text>
                      </View>
                    </View>

                    <Text style={[styles.podiumName, styles.podiumName1]} numberOfLines={1}>
                      {top1.name || 'Helper 1'}
                    </Text>

                    <View style={styles.podiumPointsRow}>
                      <Text style={[styles.podiumPoints, styles.podiumPoints1]}>{top1.points}</Text>
                      <Image
                        source={require('../../../assets/images/FindoPoint.webp')}
                        style={styles.coinIconMedium}
                        resizeMode="contain"
                      />
                    </View>

                    <View style={[styles.podiumBase, styles.podiumBase1]}>
                      <Text style={styles.podiumBaseNumber1}>1</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.podiumCol} />
                )}

                {/* TOP 3 (RIGHT) */}
                {top3 ? (
                  <View style={[styles.podiumCol, styles.podiumCol3]}>
                    <View style={styles.avatarWrapper}>
                      <View style={[styles.avatarBorder, styles.avatarBorder3]}>
                        {top3.avatarUrl ? (
                          <Image source={{ uri: top3.avatarUrl }} style={styles.podiumAvatar} />
                        ) : (
                          <View style={[styles.podiumAvatar, styles.avatarFallback3]}>
                            <Text style={styles.avatarInitial}>{(top3.name || 'U').charAt(0)}</Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.podiumBadge, styles.podiumBadge3]}>
                        <Text style={styles.podiumBadgeText}>3</Text>
                      </View>
                    </View>

                    <Text style={styles.podiumName} numberOfLines={1}>
                      {top3.name || 'Helper 3'}
                    </Text>

                    <View style={styles.podiumPointsRow}>
                      <Text style={styles.podiumPoints}>{top3.points}</Text>
                      <Image
                        source={require('../../../assets/images/FindoPoint.webp')}
                        style={styles.coinIconSmall}
                        resizeMode="contain"
                      />
                    </View>

                    <View style={[styles.podiumBase, styles.podiumBase3]}>
                      <Text style={styles.podiumBaseNumber}>3</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.podiumCol} />
                )}
              </View>
            </View>
          }
          renderItem={({ item, index }) => {
            const rank = index + 4;
            const isMe = item.uid === currentUserId;
            const levelImage = LEVEL_ASSETS[item.level || 'Tập sự'] || LEVEL_ASSETS['Tập sự'];

            return (
              <View style={[styles.rankCard, isMe && styles.rankCardMe]}>
                {/* Rank Number */}
                <View style={[styles.rankNumberBox, isMe && styles.rankNumberBoxMe]}>
                  <Text style={[styles.rankNumberText, isMe && styles.rankNumberTextMe]}>
                    {rank}
                  </Text>
                </View>

                {/* Avatar */}
                <View style={styles.userAvatarBox}>
                  {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={styles.userAvatar} />
                  ) : (
                    <View style={styles.userAvatarFallback}>
                      <Text style={styles.userAvatarInitial}>{(item.name || 'U').charAt(0)}</Text>
                    </View>
                  )}
                </View>

                {/* Name & Level */}
                <View style={styles.userInfoCol}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.userName, isMe && styles.userNameMe]} numberOfLines={1}>
                      {item.name || 'Người dùng'}
                    </Text>
                    {isMe && (
                      <View style={styles.mePill}>
                        <Text style={styles.mePillText}>Bạn</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.levelRow}>
                    <Image source={levelImage} style={styles.levelMiniIcon} resizeMode="contain" />
                    <Text style={styles.levelText}>{item.level || 'Tập sự'}</Text>
                  </View>
                </View>

                {/* Points */}
                <View style={styles.pointsCol}>
                  <Text style={[styles.pointsText, isMe && styles.pointsTextMe]}>
                    {item.points}
                  </Text>
                  <Image
                    source={require('../../../assets/images/FindoPoint.webp')}
                    style={styles.coinIconList}
                    resizeMode="contain"
                  />
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#00A896" />
                <Text style={styles.footerLoaderText}>Đang tải thêm...</Text>
              </View>
            ) : restUsers.length > 0 && displayedRestUsers.length >= restUsers.length ? (
              <View style={styles.footerEnd}>
                <Text style={styles.footerEndText}>Đã hiển thị tất cả {users.length} thành viên</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>Chưa có dữ liệu bảng xếp hạng</Text>
              <Text style={styles.emptySubtitle}>
                Hãy giúp đỡ mọi người tìm lại đồ thất lạc để tích lũy điểm và thăng hạng!
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
    backgroundColor: '#F8FAFC',
  },

  // 1. Timeframe Tab Segment
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#00A896',
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  // 2. Podium Section
  podiumSection: {
    paddingTop: 14,
    paddingBottom: 8,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
  },
  podiumCol1: {
    zIndex: 10,
    marginHorizontal: 6,
  },
  podiumCol2: {
    zIndex: 5,
  },
  podiumCol3: {
    zIndex: 5,
  },

  topRightBadge: {
    position: 'absolute',
    top: 0,
    right: 2,
    zIndex: 25,
  },
  crownImage: {
    width: 28,
    height: 28,
  },

  avatarWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarBorder: {
    borderRadius: 999,
    padding: 3,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarBorder1: {
    borderColor: '#F59E0B',
    borderWidth: 3,
  },
  avatarBorder2: {
    borderColor: '#94A3B8',
    borderWidth: 2.5,
  },
  avatarBorder3: {
    borderColor: '#FDBA74',
    borderWidth: 2.5,
  },

  podiumAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  podiumAvatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarFallback1: {
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallback2: {
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallback3: {
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '900',
    color: '#334155',
  },
  avatarInitialLarge: {
    fontSize: 28,
    fontWeight: '900',
    color: '#B45309',
  },

  podiumBadge: {
    position: 'absolute',
    bottom: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  podiumBadge1: {
    backgroundColor: '#F59E0B',
  },
  podiumBadge2: {
    backgroundColor: '#94A3B8',
  },
  podiumBadge3: {
    backgroundColor: '#EA580C',
  },
  podiumBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  podiumName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    maxWidth: 90,
    marginTop: 4,
  },
  podiumName1: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    maxWidth: 110,
  },

  podiumPointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  podiumPoints: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D9488',
  },
  podiumPoints1: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D9488',
  },

  coinIconSmall: {
    width: 14,
    height: 14,
    marginLeft: 3,
  },
  coinIconMedium: {
    width: 16,
    height: 16,
    marginLeft: 4,
  },
  coinIconList: {
    width: 18,
    height: 18,
    marginLeft: 4,
  },

  // Podium Bases (Steps)
  podiumBase: {
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  podiumBase1: {
    height: 95,
    backgroundColor: '#FEF08A',
    borderColor: '#FDE047',
  },
  podiumBase2: {
    height: 72,
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
  },
  podiumBase3: {
    height: 56,
    backgroundColor: '#FED7AA',
    borderColor: '#FDBA74',
  },
  podiumBaseNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: 'rgba(15, 23, 42, 0.35)',
  },
  podiumBaseNumber1: {
    fontSize: 26,
    fontWeight: '900',
    color: '#B45309',
  },

  // 3. Rank Cards for Rank 4+
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  rankCardMe: {
    borderColor: '#99F6E4',
    backgroundColor: '#F0FDFA',
  },
  rankNumberBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankNumberBoxMe: {
    backgroundColor: '#00A896',
  },
  rankNumberText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
  },
  rankNumberTextMe: {
    color: '#FFFFFF',
  },

  userAvatarBox: {
    marginRight: 12,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  userAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: '#475569',
  },

  userInfoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    maxWidth: 150,
  },
  userNameMe: {
    color: '#0D9488',
    fontWeight: '800',
  },
  mePill: {
    backgroundColor: '#00A896',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  mePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  levelMiniIcon: {
    width: 14,
    height: 14,
    marginRight: 4,
  },
  levelText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },

  pointsCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D9488',
  },
  pointsTextMe: {
    color: '#00A896',
  },

  // 4. Floating My Rank Card (Clean, modern light card with teal accents)
  myRankFloatingCard: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#00A896',
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  myRankIndexBox: {
    backgroundColor: '#00A896',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  myRankIndexText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  myAvatarBox: {
    marginRight: 10,
  },
  myAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  myAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myAvatarInitial: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  myInfoCol: {
    flex: 1,
  },
  myName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  myLevel: {
    fontSize: 11,
    color: '#64748B',
  },
  myPointsCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  myPointsText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D9488',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  // Skeletons
  skeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  skeletonPodiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  skeletonPodiumCol: {
    width: '30%',
    backgroundColor: '#E2E8F0',
    borderRadius: 16,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  skeletonCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E2E8F0',
  },
  skeletonLine: {
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
  },

  // Pagination Footer
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  footerLoaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D9488',
    marginLeft: 8,
  },
  footerEnd: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  footerEndText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
});
