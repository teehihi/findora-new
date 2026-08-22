import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar } from '../../components/HeaderBar';
import { auth, db } from '../../config/firebase';
import { VoucherCategory, VoucherItem } from '../../models/types';
import { fetchVouchers, getLevelFromPoints, redeemVoucher } from '../../services/firebaseService';
import { playSoundEffect } from '../../services/soundService';

type CategoryFilter = VoucherCategory;

const CATEGORY_CHIPS: { id: CategoryFilter; label: string; icon: string }[] = [
  { id: 'ALL', label: 'Tất cả', icon: 'grid-outline' },
  { id: 'FOOD_BEVERAGE', label: 'Ăn uống', icon: 'restaurant-outline' },
  { id: 'TRANSPORT', label: 'Đi lại', icon: 'car-outline' },
  { id: 'SHOPPING', label: 'Mua sắm', icon: 'bag-handle-outline' },
  { id: 'ENTERTAINMENT', label: 'Giải trí', icon: 'film-outline' },
  { id: 'SERVICES', label: 'Tiện ích & Học tập', icon: 'sparkles-outline' },
];

function VoucherSkeletonCard() {
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
    <View style={styles.ticketCard}>
      <View style={styles.notchTop} />
      <View style={styles.notchBottom} />

      <Animated.View style={[styles.artworkContainer, styles.skeletonBox, { opacity: pulseAnim }]} />
      <View style={styles.dashedSeparator} />

      <View style={styles.ticketBody}>
        <View style={styles.infoCol}>
          <Animated.View style={[styles.skeletonPill, { width: 56, height: 14, marginBottom: 8, opacity: pulseAnim }]} />
          <Animated.View style={[styles.skeletonPill, { width: '85%', height: 16, marginBottom: 8, opacity: pulseAnim }]} />
          <Animated.View style={[styles.skeletonPill, { width: '55%', height: 12, opacity: pulseAnim }]} />
        </View>

        <View style={styles.actionCol}>
          <Animated.View style={[styles.skeletonPill, { width: 42, height: 16, marginBottom: 8, opacity: pulseAnim }]} />
          <Animated.View style={[styles.skeletonButton, { opacity: pulseAnim }]} />
        </View>
      </View>
    </View>
  );
}

const LEVEL_ASSETS: Record<string, any> = {
  'Huyền thoại': require('../../../assets/images/ic_legendary.png'),
  'Thiên thần': require('../../../assets/images/ic_angel.png'),
  'Người tốt': require('../../../assets/images/ic_good.png'),
  'Tập sự': require('../../../assets/images/ic_newbie.png'),
};

export default function VoucherMarketScreen() {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [userLevel, setUserLevel] = useState<string>('Tập sự');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('ALL');

  // Modal States
  const [selectedVoucherForRedeem, setSelectedVoucherForRedeem] = useState<VoucherItem | null>(null);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState<boolean>(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState<boolean>(false);
  const [redeemedCode, setRedeemedCode] = useState<string>('');
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // 1. Fetch vouchers catalog
  useEffect(() => {
    fetchVouchers().then((data) => {
      setVouchers(data);
      setLoading(false);
    });
  }, []);

  // 2. Realtime listener on user's current points & actual stored level
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const points = data.points || 0;
        const level = data.level || getLevelFromPoints(points);
        setUserPoints(points);
        setUserLevel(level);
      }
    });

    return () => unsub();
  }, []);

  // Filter vouchers based on search & industry category
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((item) => {
      // Industry Category match
      let matchesCat = true;
      if (selectedCategory !== 'ALL') {
        const itemCat = item.category;
        const brandKey = (item.brand || '').toUpperCase();
        if (selectedCategory === 'FOOD_BEVERAGE') {
          matchesCat = itemCat === 'FOOD_BEVERAGE' || brandKey.includes('HIGHLANDS') || brandKey.includes('JOLLIBEE') || brandKey.includes('COFFEE');
        } else if (selectedCategory === 'TRANSPORT') {
          const isFoodBrand = brandKey.includes('JOLLIBEE') || brandKey.includes('HIGHLANDS') || brandKey.includes('COFFEE');
          matchesCat = !isFoodBrand && (itemCat === 'TRANSPORT' || brandKey.includes('XANH') || brandKey.includes('GRAB') || brandKey === 'BE' || brandKey.startsWith('BE '));
        } else if (selectedCategory === 'SHOPPING') {
          matchesCat = itemCat === 'SHOPPING';
        } else if (selectedCategory === 'ENTERTAINMENT') {
          matchesCat = itemCat === 'ENTERTAINMENT';
        } else if (selectedCategory === 'SERVICES') {
          matchesCat = itemCat === 'SERVICES';
        }
      }

      // Search query match
      let matchesSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        matchesSearch =
          item.title.toLowerCase().includes(q) ||
          item.brand.toLowerCase().includes(q) ||
          item.discount.toLowerCase().includes(q);
      }

      return matchesCat && matchesSearch;
    });
  }, [vouchers, selectedCategory, searchQuery]);

  const levelBadgeImage = LEVEL_ASSETS[userLevel] || LEVEL_ASSETS['Tập sự'];

  const openRedeemConfirm = (voucher: VoucherItem) => {
    if (userPoints < voucher.pointsCost) {
      Alert.alert(
        'Chưa đủ điểm Findo',
        `Bạn hiện có ${userPoints} điểm Findo. Cần thêm ${voucher.pointsCost - userPoints} điểm nữa để đổi voucher này. Hãy đóng góp thêm vào cộng đồng để nhận điểm thưởng nhé!`,
        [{ text: 'Đã hiểu', style: 'cancel' }]
      );
      return;
    }
    setSelectedVoucherForRedeem(voucher);
    setIsConfirmModalVisible(true);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedVoucherForRedeem) return;
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Chưa đăng nhập', 'Vui lòng đăng nhập để đổi voucher.');
      return;
    }

    setIsRedeeming(true);
    try {
      const result = await redeemVoucher(user.uid, selectedVoucherForRedeem);
      setIsRedeeming(false);
      setIsConfirmModalVisible(false);

      if (result.success && result.code) {
        playSoundEffect('chatSend');
        setRedeemedCode(result.code);
        setCopiedCode(false);
        setIsSuccessModalVisible(true);
      } else {
        Alert.alert('Không thể đổi voucher', result.message || 'Vui lòng thử lại sau.');
      }
    } catch (e: any) {
      setIsRedeeming(false);
      Alert.alert('Lỗi', e.message || 'Đã có lỗi xảy ra.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderBar title="Chợ Voucher Đổi Quà" showBack />

      {/* 1. User Points Header Banner */}
      <ImageBackground
        source={require('../../../assets/images/bg_point.webp')}
        style={styles.pointsBanner}
        imageStyle={styles.pointsBannerBgImage}
        resizeMode="cover"
      >
        <View style={styles.pointsBannerLeft}>
          <Text style={styles.pointsBannerSubtitle}>Findo Points khả dụng</Text>
          <View style={styles.pointsCounterRow}>
            <Text style={styles.pointsCounterNumber}>{userPoints}</Text>
            <Image
              source={require('../../../assets/images/FindoPoint.webp')}
              style={{ width: 22, height: 22, marginLeft: 6 }}
              resizeMode="contain"
            />
          </View>
        </View>
      </ImageBackground>

      {/* 2. Search Box */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm ưu đãi, thương hiệu..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3. Category Filter Chips */}
      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollContent}
        >
          {CATEGORY_CHIPS.map((chip) => {
            const isActive = selectedCategory === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(chip.id)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={chip.icon as any}
                  size={15}
                  color={isActive ? '#FFFFFF' : '#64748B'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Voucher List & Skeleton Loading */}
      {loading ? (
        <View style={styles.listContent}>
          <VoucherSkeletonCard />
          <VoucherSkeletonCard />
          <VoucherSkeletonCard />
          <VoucherSkeletonCard />
        </View>
      ) : filteredVouchers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="pricetags-outline" size={38} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>Chưa có voucher trong mục này</Text>
          <Text style={styles.emptySubtitle}>
            Các ưu đãi mới cho ngành hàng này sẽ sớm được Findora cập nhật nhé!
          </Text>
          <TouchableOpacity
            style={styles.emptyActionBtn}
            onPress={() => {
              setSelectedCategory('ALL');
              setSearchQuery('');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={16} color="#00A896" style={{ marginRight: 6 }} />
            <Text style={styles.emptyActionBtnText}>Xem tất cả ưu đãi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredVouchers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isAffordable = userPoints >= item.pointsCost;

            return (
              <View style={styles.ticketCard}>
                {/* Left Ticket Cutout Notch Top (Clean borderless bite) */}
                <View style={styles.notchTop} />
                {/* Left Ticket Cutout Notch Bottom (Clean borderless bite) */}
                <View style={styles.notchBottom} />

                {/* Left Side: Artwork Container */}
                <View style={styles.artworkContainer}>
                  {item.image ? (
                    <Image source={item.image} style={styles.voucherImage} resizeMode="contain" />
                  ) : (
                    <View style={styles.placeholderArtwork}>
                      <Ionicons name="gift" size={32} color="#00A896" />
                    </View>
                  )}
                </View>

                {/* Dashed Perforated Separator Line */}
                <View style={styles.dashedSeparator} />

                {/* Middle & Right Content */}
                <View style={styles.ticketBody}>
                  {/* Middle Info Column */}
                  <View style={styles.infoCol}>
                    <View style={styles.brandBadge}>
                      <Text style={styles.brandBadgeText} numberOfLines={1}>
                        {item.brand}
                      </Text>
                    </View>

                    <Text style={styles.voucherTitle} numberOfLines={2}>
                      {item.title}
                    </Text>

                    <View style={styles.metaRow}>
                      <Ionicons name="time-outline" size={12} color="#64748B" style={{ marginRight: 3 }} />
                      <Text style={styles.metaText}>
                        Còn {item.remainingCount || 10} • Hạn {item.expiryDate || '31/12'}
                      </Text>
                    </View>
                  </View>

                  {/* Right Side: Points & Redeem Action Button */}
                  <View style={styles.actionCol}>
                    <Text style={[styles.pointsCostText, !isAffordable && styles.pointsCostDisabled]}>
                      {item.pointsCost} FP
                    </Text>

                    <TouchableOpacity
                      style={[styles.redeemButton, !isAffordable && styles.redeemButtonDisabled]}
                      onPress={() => openRedeemConfirm(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.redeemButtonText, !isAffordable && styles.redeemButtonTextDisabled]}>
                        {isAffordable ? 'Thu thập' : 'Chưa đủ'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* 5. Redeem Confirmation Modal */}
      <Modal
        visible={isConfirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Xác nhận đổi quà</Text>
              <TouchableOpacity onPress={() => setIsConfirmModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedVoucherForRedeem && (
              <View style={styles.modalVoucherPreview}>
                <View style={styles.modalArtworkBox}>
                  {selectedVoucherForRedeem.image ? (
                    <Image source={selectedVoucherForRedeem.image} style={styles.modalVoucherImage} resizeMode="contain" />
                  ) : (
                    <Ionicons name="gift" size={36} color="#00A896" />
                  )}
                </View>

                <Text style={styles.modalBrandText}>{selectedVoucherForRedeem.brand}</Text>
                <Text style={styles.modalTitleText}>{selectedVoucherForRedeem.title}</Text>

                <View style={styles.pointsDeductionCard}>
                  <View style={styles.deductionRow}>
                    <Text style={styles.deductionLabel}>Điểm hiện có:</Text>
                    <Text style={styles.deductionVal}>{userPoints} FP</Text>
                  </View>
                  <View style={styles.deductionRow}>
                    <Text style={styles.deductionLabel}>Chi phí đổi quà:</Text>
                    <Text style={[styles.deductionVal, { color: '#DC2626' }]}>-{selectedVoucherForRedeem.pointsCost} FP</Text>
                  </View>
                  <View style={[styles.deductionRow, styles.deductionTotalRow]}>
                    <Text style={styles.deductionTotalLabel}>Điểm còn lại:</Text>
                    <Text style={styles.deductionTotalVal}>{userPoints - selectedVoucherForRedeem.pointsCost} FP</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsConfirmModalVisible(false)}
                disabled={isRedeeming}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText}>Hủy bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmRedeem}
                disabled={isRedeeming}
                activeOpacity={0.85}
              >
                {isRedeeming ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Đổi ngay</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. Redeem Success Modal with Barcode & Code */}
      <Modal
        visible={isSuccessModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={48} color="#00A896" />
            </View>

            <Text style={styles.successTitle}>Đổi Voucher Thành Công! 🎉</Text>
            <Text style={styles.successSubtitle}>
              Mã voucher đã được lưu vào ví quà của bạn. Đưa mã này cho nhân viên khi thanh toán:
            </Text>

            {/* Voucher Code Box */}
            <View style={styles.voucherCodeContainer}>
              <Text style={styles.voucherCodeLabel}>MÃ VOUCHER</Text>
              <Text style={styles.voucherCodeValue}>{redeemedCode}</Text>

              {/* Barcode Mock Visual */}
              <View style={styles.barcodeVisual}>
                <View style={styles.barcodeLinesRow}>
                  {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 4, 1, 2, 3, 1, 4, 2].map((w, i) => (
                    <View key={i} style={[styles.barcodeBar, { width: w * 2, marginRight: 2 }]} />
                  ))}
                </View>
                <Text style={styles.barcodeNumberText}>{redeemedCode}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.copyCodeBtn}
              onPress={() => {
                setCopiedCode(true);
                Alert.alert('Đã sao chép! 📋', `Mã voucher "${redeemedCode}" đã được sao chép vào bộ nhớ tạm.`);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name={copiedCode ? "checkbox" : "copy-outline"} size={18} color="#00A896" style={{ marginRight: 6 }} />
              <Text style={styles.copyCodeBtnText}>
                {copiedCode ? 'Đã sao chép mã' : 'Sao chép mã voucher'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.successCloseBtn}
              onPress={() => setIsSuccessModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.successCloseBtnText}>Hoàn tất</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  // 1. Points Banner
  pointsBanner: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    height: 104,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    overflow: 'hidden',
  },
  pointsBannerBgImage: {
    borderRadius: 16,
    resizeMode: 'cover',
  },
  pointsBannerLeft: {
    flex: 1,
  },
  pointsBannerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E6FFFA',
    letterSpacing: 0.3,
  },
  pointsCounterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  pointsCounterNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pointsCounterUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: '#CCFBF1',
    marginLeft: 6,
  },
  pointsBannerRight: {
    alignItems: 'flex-end',
  },
  userRankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 24,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rankBadgeImage: {
    width: 24,
    height: 24,
  },
  userRankText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00796B',
  },

  // 2. Search Section
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#0F172A',
  },

  // 3. Category Chips
  chipsWrapper: {
    marginBottom: 10,
  },
  chipsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: '#00A896',
    borderColor: '#00A896',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // 4. Voucher Ticket List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 50,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
  },

  // Skeleton Styles
  skeletonBox: {
    backgroundColor: '#E2E8F0',
  },
  skeletonPill: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
  },
  skeletonButton: {
    width: 74,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },

  // Ticket Card Design
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginVertical: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  notchTop: {
    position: 'absolute',
    left: 98,
    top: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    borderWidth: 0,
    zIndex: 10,
  },
  notchBottom: {
    position: 'absolute',
    left: 98,
    bottom: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    borderWidth: 0,
    zIndex: 10,
  },
  artworkContainer: {
    width: 82,
    height: 82,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  voucherImage: {
    width: '100%',
    height: '100%',
  },
  placeholderArtwork: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6FFFA',
  },
  dashedSeparator: {
    width: 1,
    height: '75%',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginHorizontal: 12,
  },
  ticketBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
    paddingRight: 8,
  },
  brandBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00A896',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  voucherTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
  },
  actionCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pointsCostText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#00A896',
    marginBottom: 6,
  },
  pointsCostDisabled: {
    color: '#94A3B8',
  },
  redeemButton: {
    backgroundColor: '#00A896',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    minWidth: 74,
    alignItems: 'center',
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  redeemButtonDisabled: {
    backgroundColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  redeemButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  redeemButtonTextDisabled: {
    color: '#94A3B8',
  },

  // 5. Modal Overlay & Confirmation Box
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalVoucherPreview: {
    alignItems: 'center',
    marginVertical: 8,
  },
  modalArtworkBox: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalVoucherImage: {
    width: '100%',
    height: '100%',
  },
  modalBrandText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00A896',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  modalTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 16,
  },
  pointsDeductionCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  deductionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deductionLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  deductionVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  deductionTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    marginTop: 2,
  },
  deductionTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  deductionTotalVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#00A896',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#00A896',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // 6. Success Modal
  successCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  successIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E6FFFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  voucherCodeContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  voucherCodeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 6,
  },
  voucherCodeValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#00A896',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  barcodeVisual: {
    alignItems: 'center',
    paddingVertical: 6,
    width: '100%',
  },
  barcodeLinesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    overflow: 'hidden',
  },
  barcodeBar: {
    height: 38,
    backgroundColor: '#0F172A',
  },
  barcodeNumberText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 4,
    letterSpacing: 2,
  },
  copyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#E6FFFA',
    marginBottom: 14,
    width: '100%',
  },
  copyCodeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00A896',
  },
  successCloseBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#00A896',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

