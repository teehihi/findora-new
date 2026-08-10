import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../config/firebase';
import { getUserProfile, fetchUserTransactions } from '../../services/firebaseService';
import { Transaction, User } from '../../models/types';
import { HeaderBar } from '../../components/HeaderBar';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

export default function WalletScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    getUserProfile(user.uid).then(setProfile);

    fetchUserTransactions(user.uid).then((list) => {
      setTransactions(list);
      setLoading(false);
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar title="Ví Điểm Thưởng" showBack />

      {/* Balance Card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Số Dư Điểm Findora</Text>
        <Text style={styles.balance}>{profile?.points || 0} P</Text>
        
        <View style={styles.btnRow}>
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => router.push('/wallet/vouchers')}
          >
            <Ionicons name="gift" size={18} color="#FFFFFF" />
            <Text style={styles.btnText}>Đổi Voucher</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#7C3AED' }]} 
            onPress={() => router.push('/wallet/leaderboard')}
          >
            <Ionicons name="trophy" size={18} color="#FFFFFF" />
            <Text style={styles.btnText}>BXH Helper</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* History Header */}
      <Text style={styles.historyTitle}>Lịch Sử Giao Dịch</Text>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id || Math.random().toString()}
          renderItem={({ item }) => (
            <View style={styles.txRow}>
              <View style={styles.txIconBox}>
                <Ionicons 
                  name={item.amount > 0 ? 'arrow-down-circle' : 'arrow-up-circle'} 
                  size={24} 
                  color={item.amount > 0 ? '#10B981' : '#EF4444'} 
                />
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txDesc}>{item.description}</Text>
                <Text style={styles.txDate}>Vừa thực hiện</Text>
              </View>
              <Text style={[styles.txAmount, { color: item.amount > 0 ? '#10B981' : '#EF4444' }]}>
                {item.amount > 0 ? `+${item.amount}` : item.amount} P
              </Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Chưa có lịch sử biến động điểm.</Text>
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
  card: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 24,
    padding: SPACING.lg,
    margin: SPACING.md,
    ...SHADOWS.medium
  },
  cardLabel: {
    fontSize: 13,
    color: '#E0F2FE',
    fontWeight: '600'
  },
  balance: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: SPACING.sm
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: SPACING.sm
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 12
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 6
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs
  },
  listContent: {
    paddingHorizontal: SPACING.md
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  txIconBox: {
    marginRight: SPACING.md
  },
  txInfo: {
    flex: 1
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text
  },
  txDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '800'
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted
  }
});
