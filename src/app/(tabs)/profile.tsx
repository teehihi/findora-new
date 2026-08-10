import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Share,
  RefreshControl,
  Platform,
  Animated,
  Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { auth, db } from '../../config/firebase';
import { getUserProfile, getLevelFromPoints } from '../../services/firebaseService';
import { User } from '../../models/types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [postsCount, setPostsCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [upgrading, setUpgrading] = useState<boolean>(false);
  const [displayPercent, setDisplayPercent] = useState<number>(0);

  const currentUser = auth.currentUser;

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const auraPulseAnim = useRef(new Animated.Value(0.95)).current;
  const auraOpacityAnim = useRef(new Animated.Value(0.2)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const loadData = async () => {
    if (currentUser) {
      try {
        const userProf = await getUserProfile(currentUser.uid);
        setProfile(userProf);

        // Fetch user active posts count exactly like native ProfileActivity.java
        const postsRef = collection(db, 'posts');
        const qPosts = query(postsRef, where('userId', '==', currentUser.uid));
        const postsSnap = await getDocs(qPosts);
        setPostsCount(postsSnap.size);
      } catch (e) {
        console.error('Error loading profile stats:', e);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi Findora?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          router.replace('/(auth)/login');
        }
      }
    ]);
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Kết nối với ${profile?.name || currentUser?.displayName || 'tôi'} trên ứng dụng Findora! Cùng nhau hỗ trợ tìm đồ thất lạc AI thông minh.`
      });
    } catch (e) {
      console.log('Share profile error:', e);
    }
  };

  // Read Level directly from Firestore profile data
  const points = profile?.points || 0;
  const currentLevelName = profile?.level || getLevelFromPoints(points);

  const getLevelDetails = (levelName: string, pts: number) => {
    let iconAsset = require('../../../assets/images/ic_newbie.png');
    let nextTierPts = 100;
    let currentTierPts = 0;
    let nextLevelName: string | null = 'Người tốt';

    if (levelName === 'Huyền thoại') {
      iconAsset = require('../../../assets/images/ic_legendary.png');
      currentTierPts = 1000;
      nextTierPts = 1000;
      nextLevelName = null;
    } else if (levelName === 'Thiên thần') {
      iconAsset = require('../../../assets/images/ic_angel.png');
      currentTierPts = 500;
      nextTierPts = 1000;
      nextLevelName = 'Huyền thoại';
    } else if (levelName === 'Người tốt') {
      iconAsset = require('../../../assets/images/ic_good.png');
      currentTierPts = 100;
      nextTierPts = 500;
      nextLevelName = 'Thiên thần';
    } else {
      iconAsset = require('../../../assets/images/ic_newbie.png');
      currentTierPts = 0;
      nextTierPts = 100;
      nextLevelName = 'Người tốt';
    }

    let percent = 0;
    if (nextLevelName === null) {
      percent = 100;
    } else {
      const pointsInTier = pts - currentTierPts;
      const tierRange = nextTierPts - currentTierPts;
      if (tierRange > 0) {
        percent = Math.min(100, Math.max(0, Math.floor((pointsInTier * 100) / tierRange)));
      }
    }

    return {
      levelName,
      iconAsset,
      nextTierPts,
      nextLevelName,
      percent
    };
  };

  const levelInfo = getLevelDetails(currentLevelName, points);
  const canUpgrade = points >= levelInfo.nextTierPts && levelInfo.nextLevelName !== null;

  // Trigger eye-catching animations whenever levelInfo changes
  useEffect(() => {
    // 1. Continuous Breathing Pulse Animation for Button
    const buttonPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: canUpgrade ? 1.04 : 1.02,
          duration: 900,
          easing: Easing.ease,
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.ease,
          useNativeDriver: true
        })
      ])
    );

    // 2. Glowing Aura Ring Pulse Animation
    const auraPulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(auraPulseAnim, {
            toValue: 1.12,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(auraOpacityAnim, {
            toValue: 0.45,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true
          })
        ]),
        Animated.parallel([
          Animated.timing(auraPulseAnim, {
            toValue: 0.95,
            duration: 1200,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(auraOpacityAnim, {
            toValue: 0.15,
            duration: 1200,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true
          })
        ])
      ])
    );

    buttonPulse.start();
    auraPulse.start();

    // 3. Smooth Circle Progress Fill Animation
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: levelInfo.percent,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start();

    // Listener to update display percentage text continuously
    const listenerId = progressAnim.addListener(({ value }) => {
      setDisplayPercent(Math.round(value));
    });

    return () => {
      buttonPulse.stop();
      auraPulse.stop();
      progressAnim.removeListener(listenerId);
    };
  }, [levelInfo.percent, canUpgrade]);

  const handleUpgrade = async () => {
    if (!currentUser) return;
    if (!canUpgrade && levelInfo.nextLevelName) {
      Alert.alert(
        'Chưa đủ điểm nâng cấp 💡',
        `Bạn cần tích lũy thêm ${levelInfo.nextTierPts - points} FP nữa để nâng cấp lên danh hiệu ${levelInfo.nextLevelName}!`
      );
      return;
    }

    if (!levelInfo.nextLevelName) {
      Alert.alert('Đã đạt cấp tối đa 🏆', 'Bạn đang ở danh hiệu cao nhất "Huyền thoại"!');
      return;
    }

    try {
      setUpgrading(true);
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        level: levelInfo.nextLevelName
      });
      setUpgrading(false);
      Alert.alert('Chúc mừng! 🎉', `Bạn đã nâng cấp thành công lên danh hiệu ${levelInfo.nextLevelName}!`);
      loadData();
    } catch (e: any) {
      setUpgrading(false);
      Alert.alert('Lỗi', e.message || 'Không thể nâng cấp lúc này.');
    }
  };

  // SVG Circular Progress Constants
  const circleSize = 140;
  const strokeWidth = 10;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedStrokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0]
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00C853']} />}
      >
        {/* HERO PROFILE SECTION */}
        <View style={styles.heroSection}>
          {/* Avatar Container */}
          <View style={styles.avatarBorderFrame}>
            {profile?.avatarUrl || currentUser?.photoURL ? (
              <Image 
                source={{ uri: profile?.avatarUrl || currentUser?.photoURL || '' }} 
                style={styles.avatarImage} 
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {(profile?.name || currentUser?.displayName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* User Name */}
          <Text style={styles.userName}>{profile?.name || currentUser?.displayName || 'Người dùng Findora'}</Text>

          {/* Native Level Badge Pill directly fetched from Firestore */}
          <View style={styles.badgePill}>
            <Image 
              source={levelInfo.iconAsset} 
              style={styles.badgeImage} 
              resizeMode="contain" 
            />
            <Text style={styles.badgeText}>{levelInfo.levelName}</Text>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={styles.editBtn} 
              onPress={() => router.push('/profile/edit')}
              activeOpacity={0.85}
            >
              <Text style={styles.editBtnText}>Chỉnh sửa</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.shareBtn} 
              onPress={handleShareProfile}
              activeOpacity={0.85}
            >
              <Text style={styles.shareBtnText}>Chia sẻ</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3-STATS CARD */}
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{postsCount}</Text>
            <Text style={styles.statLabel}>Bài đăng</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profile?.resolvedCount || 0}</Text>
            <Text style={styles.statLabel}>Đã trả lại</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#00C853' }]}>{points}</Text>
            <Text style={styles.statLabel}>FindoPoint</Text>
          </View>
        </View>

        {/* GRAY SEPARATOR BAND */}
        <View style={styles.separatorBand} />

        {/* UTILITIES SECTION (Tiện ích của tôi) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Tiện ích của tôi</Text>
          
          <View style={styles.utilityGrid}>
            <TouchableOpacity style={styles.utilityItem} onPress={() => router.push('/map')}>
              <Image 
                source={require('../../../assets/images/ic_findora_map.png')} 
                style={styles.utilityIconImage} 
                resizeMode="contain" 
              />
              <Text style={styles.utilityLabel} numberOfLines={1}>Bản đồ Findora</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.utilityItem} onPress={() => router.push('/wallet/vouchers')}>
              <Image 
                source={require('../../../assets/images/ic_voucher_market.png')} 
                style={styles.utilityIconImage} 
                resizeMode="contain" 
              />
              <Text style={styles.utilityLabel} numberOfLines={1}>Chợ Voucher</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.utilityItem} onPress={() => router.push('/wallet/leaderboard')}>
              <Image 
                source={require('../../../assets/images/ic_leaderboard.png')} 
                style={styles.utilityIconImage} 
                resizeMode="contain" 
              />
              <Text style={styles.utilityLabel} numberOfLines={1}>Bảng xếp hạng</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.utilityItem} onPress={() => router.push('/wallet')}>
              <Image 
                source={require('../../../assets/images/ic_wallet.png')} 
                style={styles.utilityIconImage} 
                resizeMode="contain" 
              />
              <Text style={styles.utilityLabel} numberOfLines={1}>Ví & Điểm</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* GRAY SEPARATOR BAND */}
        <View style={styles.separatorBand} />

        {/* EYE-CATCHING ANIMATED LEVEL UP WIDGET (Nâng cấp tài khoản) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Nâng cấp tài khoản</Text>
          
          <View style={styles.levelCard}>
            {/* Animated Glowing Aura & SVG Circular Progress Bar */}
            <View style={styles.circleProgressContainer}>
              {/* Pulsing Aura Circle */}
              <Animated.View 
                style={[
                  styles.pulsingAuraCircle,
                  {
                    transform: [{ scale: auraPulseAnim }],
                    opacity: auraOpacityAnim
                  }
                ]} 
              />

              <Svg width={circleSize} height={circleSize}>
                {/* Background Circle Track */}
                <Circle
                  cx={circleSize / 2}
                  cy={circleSize / 2}
                  r={radius}
                  stroke="#E5E7EB"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                {/* Animated Active Progress Circle */}
                <AnimatedCircle
                  cx={circleSize / 2}
                  cy={circleSize / 2}
                  r={radius}
                  stroke="#00C853"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={animatedStrokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  transform={`rotate(-90 ${circleSize / 2} ${circleSize / 2})`}
                />
              </Svg>
              <View style={styles.circlePercentOverlay}>
                <Text style={styles.circlePercentText}>{displayPercent}%</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.levelDesc}>
              {levelInfo.nextLevelName 
                ? `Đạt ${levelInfo.nextTierPts} FP (FindoPoint) để lên cấp ${levelInfo.nextLevelName}`
                : 'Bạn đã đạt cấp độ cao nhất! 🏆'}
            </Text>

            {/* Animated Pulsing Upgrade Button */}
            <Animated.View style={{ width: '100%', transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity 
                style={[
                  styles.upgradeBtn, 
                  canUpgrade ? styles.upgradeBtnActive : styles.upgradeBtnDisabled
                ]}
                onPress={handleUpgrade}
                disabled={upgrading}
                activeOpacity={0.85}
              >
                <Ionicons 
                  name="hardware-chip-outline" 
                  size={18} 
                  color={canUpgrade ? '#FFFFFF' : '#9CA3AF'} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={[styles.upgradeBtnText, { color: canUpgrade ? '#FFFFFF' : '#9CA3AF' }]}>
                  {levelInfo.nextLevelName ? 'Nâng cấp' : 'Đã đạt cấp tối đa'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* ACCOUNT OVERVIEW SECTION (TỔNG QUAN TÀI KHOẢN) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.overviewSectionHeader}>TỔNG QUAN TÀI KHOẢN</Text>
          
          <View style={styles.overviewCard}>
            <TouchableOpacity style={styles.overviewItem} onPress={() => router.push('/post/my-posts')}>
              <Ionicons name="journal-outline" size={22} color="#1F2937" style={styles.overviewIcon} />
              <Text style={styles.overviewText}>Bài đăng của tôi</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            <TouchableOpacity style={styles.overviewItem} onPress={() => Alert.alert('Thông báo', 'Tính năng Mục đã lưu sẽ ra mắt trong bản cập nhật tới!')}>
              <Ionicons name="bookmark-outline" size={22} color="#1F2937" style={styles.overviewIcon} />
              <Text style={styles.overviewText}>Mục đã lưu</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            <TouchableOpacity style={styles.overviewItem} onPress={() => Alert.alert('Thông báo', 'Trang Cài đặt hệ thống đang được hoàn thiện!')}>
              <Ionicons name="settings-outline" size={22} color="#1F2937" style={styles.overviewIcon} />
              <Text style={styles.overviewText}>Cài đặt</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Soft Red Logout Button */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" style={{ marginRight: 8 }} />
            <Text style={styles.logoutBtnText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  scrollContent: {
    paddingBottom: 110
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 12 : 20,
    paddingBottom: 24,
    paddingHorizontal: 24
  },
  avatarBorderFrame: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: '#00C853',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#F8FAFC'
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#00C853',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarInitial: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 8,
    textAlign: 'center'
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingStart: 10,
    paddingEnd: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 20
  },
  badgeImage: {
    width: 22,
    height: 22,
    marginRight: 6
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D'
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  editBtn: {
    backgroundColor: '#00C853',
    height: 42,
    paddingHorizontal: 26,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  shareBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#00C853',
    height: 42,
    paddingHorizontal: 26,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center'
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00C853'
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 20,
    paddingVertical: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2
  },
  statBox: {
    flex: 1,
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 2
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#71717A'
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB'
  },
  separatorBand: {
    height: 8,
    backgroundColor: '#F3F4F6',
    width: '100%'
  },
  sectionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 16
  },
  utilityGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  utilityItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4
  },
  utilityIconImage: {
    width: 36,
    height: 36,
    marginBottom: 8
  },
  utilityLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center'
  },
  levelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3
  },
  circleProgressContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  pulsingAuraCircle: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#00C853'
  },
  circlePercentOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center'
  },
  circlePercentText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#00C853'
  },
  levelDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16
  },
  upgradeBtn: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  upgradeBtnActive: {
    backgroundColor: '#00C853',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  upgradeBtnDisabled: {
    backgroundColor: '#F3F4F6'
  },
  upgradeBtnText: {
    fontSize: 15,
    fontWeight: '700'
  },
  overviewSectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#71717A',
    letterSpacing: 0.8,
    marginBottom: 12
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden'
  },
  overviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  overviewIcon: {
    marginRight: 16
  },
  overviewText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111111'
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 58
  },
  logoutBtn: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626'
  }
});
