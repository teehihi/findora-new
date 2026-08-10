import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchVouchers, VoucherItem } from '../../services/firebaseService';
import { HeaderBar } from '../../components/HeaderBar';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

export default function VoucherMarketScreen() {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVouchers().then((data) => {
      setVouchers(data);
      setLoading(false);
    });
  }, []);

  const handleRedeem = (voucher: VoucherItem) => {
    const code = voucher.code || `FINDORA_${Math.floor(100000 + Math.random() * 900000)}`;
    Alert.alert(
      'Xác nhận đổi quà',
      `Bạn có muốn dùng ${voucher.pointsCost} điểm Findora để đổi "${voucher.title}" không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đổi ngay',
          onPress: () => Alert.alert('Đổi quà thành công 🎉', `Mã Voucher: ${code}`)
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar title="Chợ Voucher Đổi Quà" showBack />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải chợ Voucher...</Text>
        </View>
      ) : (
        <FlatList
          data={vouchers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons name={(item.icon || 'gift') as any} size={28} color={COLORS.primary} />
              </View>
              <View style={styles.info}>
                <Text style={styles.brand}>{item.brand}</Text>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.cost}>Cần {item.pointsCost} điểm Findora</Text>
              </View>
              <TouchableOpacity style={styles.redeemBtn} onPress={() => handleRedeem(item)}>
                <Text style={styles.redeemText}>Đổi quà</Text>
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={styles.listContent}
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
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textMuted
  },
  listContent: {
    padding: SPACING.md
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md
  },
  info: {
    flex: 1
  },
  brand: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryDark
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginVertical: 2
  },
  cost: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309'
  },
  redeemBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10
  },
  redeemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
