import React from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HeaderBar } from '../../components/HeaderBar';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

interface Voucher {
  id: string;
  title: string;
  brand: string;
  pointsCost: number;
  discount: string;
  icon: string;
}

const VOUCHERS: Voucher[] = [
  { id: '1', title: 'Voucher Highlands Coffee 30k', brand: 'Highlands Coffee', pointsCost: 150, discount: 'Giảm 30.000đ', icon: 'cafe' },
  { id: '2', title: 'Voucher GrabBike 20k', brand: 'Grab', pointsCost: 100, discount: 'Giảm 20.000đ chuyến xe', icon: 'bicycle' },
  { id: '3', title: 'Voucher Shopee 50k', brand: 'Shopee', pointsCost: 250, discount: 'Giảm 50.000đ đơn bất kỳ', icon: 'cart' },
  { id: '4', title: 'Voucher Circle K 15k', brand: 'Circle K', pointsCost: 80, discount: 'Giảm 15.000đ thanh toán', icon: 'storefront' }
];

export default function VoucherMarketScreen() {
  const handleRedeem = (voucher: Voucher) => {
    Alert.alert(
      'Xác nhận đổi quà',
      `Bạn có muốn dùng ${voucher.pointsCost} điểm Findora để đổi "${voucher.title}" không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đổi ngay',
          onPress: () => Alert.alert('Đổi quà thành công 🎉', `Mã Voucher: FINDORA_${Math.floor(100000 + Math.random() * 900000)}`)
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar title="Chợ Voucher Đổi Quà" showBack />

      <FlatList
        data={VOUCHERS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Ionicons name={item.icon as any} size={28} color={COLORS.primary} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
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
