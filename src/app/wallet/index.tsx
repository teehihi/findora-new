import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar } from '../../components/HeaderBar';
import { auth, db } from '../../config/firebase';
import { COLORS, SHADOWS, SPACING } from '../../constants/theme';
import { Transaction, User } from '../../models/types';
import { fetchUserTransactions, getLevelFromPoints, VOUCHER_IMAGES } from '../../services/firebaseService';

const LEVEL_ASSETS: Record<string, any> = {
  'Huyền thoại': require('../../../assets/images/ic_legendary.png'),
  'Thiên thần': require('../../../assets/images/ic_angel.png'),
  'Người tốt': require('../../../assets/images/ic_good.png'),
  'Tập sự': require('../../../assets/images/ic_newbie.png'),
};

function getVoucherImage(tx: Transaction): any {
  const brandUpper = (tx.brand || tx.title || tx.description || '').toUpperCase();
  if (brandUpper.includes('XANH')) return VOUCHER_IMAGES['1'];
  if (brandUpper.includes('HIGHLANDS')) return VOUCHER_IMAGES['2'];
  if (brandUpper.includes('COFFEE') || brandUpper.includes('THE COFFEE HOUSE')) return VOUCHER_IMAGES['3'];
  if (brandUpper.includes('JOLLIBEE')) return VOUCHER_IMAGES['4'];
  return VOUCHER_IMAGES['1'];
}

function formatTransactionDate(timestamp: any): string {
  if (!timestamp) return 'Vừa thực hiện';
  try {
    let date: Date;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'number' || typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return 'Vừa thực hiện';
    }

    if (isNaN(date.getTime())) return 'Vừa thực hiện';

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    if (isToday) {
      return `Hôm nay, ${hours}:${minutes}`;
    }
    return `${day}/${month}/${year} • ${hours}:${minutes}`;
  } catch {
    return 'Vừa thực hiện';
  }
}

function TransactionSkeletonCard() {
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
    <View style={styles.txRow}>
      <Animated.View style={[styles.skeletonCircle, { opacity: pulseAnim }]} />
      <View style={styles.txInfo}>
        <Animated.View style={[styles.skeletonPill, { width: '75%', height: 16, marginBottom: 6, opacity: pulseAnim }]} />
        <Animated.View style={[styles.skeletonPill, { width: '40%', height: 12, opacity: pulseAnim }]} />
      </View>
      <Animated.View style={[styles.skeletonPill, { width: 52, height: 18, opacity: pulseAnim }]} />
    </View>
  );
}

export default function WalletScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Voucher Detail Modal States
  const [selectedVoucherTx, setSelectedVoucherTx] = useState<Transaction | null>(null);
  const [isVoucherModalVisible, setIsVoucherModalVisible] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const loadTransactions = async (userId: string) => {
    const list = await fetchUserTransactions(userId);
    setTransactions(list);
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    // 1. Realtime listener for User Points & Level
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as User);
      }
    });

    // 2. Fetch real transactions
    loadTransactions(user.uid).finally(() => setLoading(false));

    return () => unsub();
  }, []);

  const handleRefresh = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setRefreshing(true);
    await loadTransactions(user.uid);
    setRefreshing(false);
  };

  const userPoints = profile?.points || 0;
  const userLevel = profile?.level || getLevelFromPoints(userPoints);
  const levelBadgeImage = LEVEL_ASSETS[userLevel] || LEVEL_ASSETS['Tập sự'];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderBar title="Ví Điểm Thưởng" showBack />

      {/* 1. Header Balance Banner with bg_point.webp */}
      <ImageBackground
        source={require('../../../assets/images/bg_point.webp')}
        style={styles.cardBanner}
        imageStyle={styles.cardBannerBg}
        resizeMode="cover"
      >
        <View style={styles.bannerTopRow}>
          <View style={styles.bannerLeft}>
            <Text style={styles.cardLabel}>Số Dư Điểm Findo</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceNum}>{userPoints}</Text>
              <Image
                source={require('../../../assets/images/FindoPoint.webp')}
                style={{ width: 24, height: 24, marginLeft: 6 }}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.actionBtnVoucher}
            onPress={() => router.push('/wallet/vouchers')}
            activeOpacity={0.85}
          >
            <Ionicons name="gift" size={16} color="#0D9488" />
            <Text style={styles.btnTextVoucher}>Đổi Voucher</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnLeaderboard}
            onPress={() => router.push('/wallet/leaderboard')}
            activeOpacity={0.85}
          >
            <Ionicons name="trophy" size={16} color="#FFFFFF" />
            <Text style={styles.btnTextLeaderboard}>BXH Helper</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>

      {/* 2. Transaction History Section */}
      <View style={styles.historyHeaderRow}>
        <Text style={styles.historyTitle}>Lịch Sử Biến Động Điểm</Text>
        {transactions.length > 0 && (
          <Text style={styles.historyCountText}>{transactions.length} giao dịch</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.listContent}>
          <TransactionSkeletonCard />
          <TransactionSkeletonCard />
          <TransactionSkeletonCard />
          <TransactionSkeletonCard />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id || Math.random().toString()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item }) => {
            const isPositive = (item.amount || 0) > 0;
            const isVoucher = item.type === 'voucher' || (item.amount || 0) < 0;

            return (
              <TouchableOpacity
                style={styles.txRow}
                onPress={() => {
                  if (isVoucher) {
                    setCopiedCode(false);
                    setSelectedVoucherTx(item);
                    setIsVoucherModalVisible(true);
                  }
                }}
                activeOpacity={isVoucher ? 0.7 : 1}
              >
                <View style={[styles.txIconBox, isPositive ? styles.txIconBoxPositive : styles.txIconBoxNegative]}>
                  <Ionicons
                    name={isPositive ? 'arrow-down' : item.type === 'voucher' ? 'gift' : 'arrow-up'}
                    size={18}
                    color={isPositive ? '#16A34A' : '#E11D48'}
                  />
                </View>

                <View style={styles.txInfo}>
                  <Text style={styles.txTitle} numberOfLines={1}>
                    {item.title || (isPositive ? 'Thưởng trả đồ thành công' : 'Đổi voucher')}
                  </Text>
                  {item.description ? (
                    <Text style={styles.txDesc} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}
                  <Text style={styles.txDate}>{formatTransactionDate(item.timestamp)}</Text>
                </View>

                <View style={styles.txRightCol}>
                  <Text style={[styles.txAmount, isPositive ? styles.txAmountPositive : styles.txAmountNegative]}>
                    {isPositive ? `+${item.amount}` : `${item.amount}`} FP
                  </Text>
                  {isVoucher && (
                    <Ionicons name="chevron-forward" size={14} color="#94A3B8" style={{ marginTop: 2 }} />
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={40} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có lịch sử giao dịch</Text>
              <Text style={styles.emptySubtitle}>
                Điểm thưởng từ việc giúp đỡ tìm đồ và các lượt đổi voucher ưu đãi sẽ hiển thị tại đây!
              </Text>
              <TouchableOpacity
                style={styles.emptyExploreBtn}
                onPress={() => router.push('/wallet/vouchers')}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles" size={16} color="#0D9488" style={{ marginRight: 6 }} />
                <Text style={styles.emptyExploreBtnText}>Khám phá Chợ Voucher</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* 3. Voucher Detail Modal */}
      <Modal
        visible={isVoucherModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsVoucherModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Chi tiết Voucher đã đổi</Text>
              <TouchableOpacity
                onPress={() => setIsVoucherModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedVoucherTx && (
              <View style={styles.modalVoucherBody}>
                {/* Artwork */}
                <View style={styles.modalArtworkBox}>
                  {getVoucherImage(selectedVoucherTx) ? (
                    <Image
                      source={getVoucherImage(selectedVoucherTx)}
                      style={styles.modalVoucherImg}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons name="gift" size={36} color="#00A896" />
                  )}
                </View>

                {/* Title & Brand */}
                <View style={styles.modalBrandBadge}>
                  <Text style={styles.modalBrandText}>
                    {selectedVoucherTx.brand || selectedVoucherTx.title || 'VOUCHER ƯU ĐÃI'}
                  </Text>
                </View>

                <Text style={styles.modalTitleText}>
                  {selectedVoucherTx.description || selectedVoucherTx.title}
                </Text>

                {/* Voucher Code Box */}
                <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>MÃ VOUCHER CỦA BẠN</Text>
                  <Text style={styles.codeValue}>
                    {selectedVoucherTx.code || `FINDORA_${(selectedVoucherTx.id || '').substring(0, 6).toUpperCase()}`}
                  </Text>

                  {/* Barcode Mock Visual */}
                  <View style={styles.barcodeVisual}>
                    <View style={styles.barcodeLinesRow}>
                      {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 4, 1, 2, 3, 1, 4, 2].map((w, i) => (
                        <View key={i} style={[styles.barcodeBar, { width: w * 2, marginRight: 2 }]} />
                      ))}
                    </View>
                    <Text style={styles.barcodeNumberText}>
                      {selectedVoucherTx.code || `FINDORA_${(selectedVoucherTx.id || '').substring(0, 6).toUpperCase()}`}
                    </Text>
                  </View>
                </View>

                {/* Meta details */}
                <View style={styles.modalMetaCard}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Điểm đã dùng:</Text>
                    <Text style={styles.metaValPoints}>{Math.abs(selectedVoucherTx.amount)} FP</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Ngày đổi:</Text>
                    <Text style={styles.metaVal}>{formatTransactionDate(selectedVoucherTx.timestamp)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Hạn sử dụng:</Text>
                    <Text style={styles.metaVal}>{selectedVoucherTx.expiryDate || '31/12/2026'}</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => {
                    setCopiedCode(true);
                    Alert.alert(
                      'Đã sao chép! 📋',
                      `Mã voucher "${selectedVoucherTx.code || 'FINDORA_VIP'}" đã được sao chép vào bộ nhớ tạm.`
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={copiedCode ? 'checkmark-circle' : 'copy-outline'}
                    size={18}
                    color="#00A896"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.copyBtnText}>
                    {copiedCode ? 'Đã sao chép mã' : 'Sao chép mã voucher'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setIsVoucherModalVisible(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.closeBtnText}>Đóng</Text>
                </TouchableOpacity>
              </View>
            )}
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

  // 1. Balance Banner
  cardBanner: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 14,
    height: 156,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'space-between',
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardBannerBg: {
    borderRadius: 20,
    resizeMode: 'cover',
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 12,
    color: '#E6FFFA',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  balanceNum: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  balanceUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: '#CCFBF1',
    marginLeft: 6,
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
    width: 22,
    height: 22,
  },
  userRankText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00796B',
  },

  // Banner Action Buttons
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionBtnVoucher: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  btnTextVoucher: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D9488',
    marginLeft: 6,
  },
  actionBtnLeaderboard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  btnTextLeaderboard: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 6,
  },

  // 2. Transaction History Section
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  historyCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txIconBoxPositive: {
    backgroundColor: '#DCFCE7',
  },
  txIconBoxNegative: {
    backgroundColor: '#FFE4E6',
  },
  txInfo: {
    flex: 1,
    marginRight: 10,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
  },
  txDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  txDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  txRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 6,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  txAmountPositive: {
    color: '#16A34A',
  },
  txAmountNegative: {
    color: '#E11D48',
  },

  // Skeletons
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    marginRight: 12,
  },
  skeletonPill: {
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
  },

  // Empty State
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
  emptyExploreBtn: {
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
  emptyExploreBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
  },

  // 3. Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
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
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalVoucherBody: {
    alignItems: 'center',
  },
  modalArtworkBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  modalVoucherImg: {
    width: 70,
    height: 70,
  },
  modalBrandBadge: {
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  modalBrandText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 0.5,
  },
  modalTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 14,
  },
  codeContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#00A896',
    borderStyle: 'dashed',
    marginBottom: 14,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#00A896',
    letterSpacing: 2,
    marginBottom: 10,
  },
  barcodeVisual: {
    alignItems: 'center',
    width: '100%',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  barcodeLinesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    marginBottom: 4,
  },
  barcodeBar: {
    height: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 1,
  },
  barcodeNumberText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1.5,
  },
  modalMetaCard: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  metaValPoints: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E11D48',
  },
  copyBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6FFFA',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#99F6E4',
    marginBottom: 10,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D9488',
  },
  closeBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00A896',
    paddingVertical: 12,
    borderRadius: 14,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
