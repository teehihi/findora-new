import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchLeaderboard } from '../../services/firebaseService';
import { User } from '../../models/types';
import { HeaderBar } from '../../components/HeaderBar';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

export default function LeaderboardScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard().then((data) => {
      setUsers(data);
      setLoading(false);
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar title="Bảng Xếp Hạng Helper 🏆" showBack />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.uid}
          renderItem={({ item, index }) => {
            const rank = index + 1;
            const rankColor = rank === 1 ? '#F59E0B' : rank === 2 ? '#94A3B8' : rank === 3 ? '#B45309' : COLORS.textMuted;
            return (
              <View style={styles.card}>
                <View style={[styles.rankCircle, { backgroundColor: rank <= 3 ? rankColor : '#F1F5F9' }]}>
                  <Text style={[styles.rankText, { color: rank <= 3 ? '#FFFFFF' : COLORS.text }]}>
                    {rank}
                  </Text>
                </View>

                <View style={styles.info}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.badge}>{item.levelBadge}</Text>
                </View>

                <Text style={styles.points}>{item.points} P</Text>
              </View>
            );
          }}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
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
  rankCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md
  },
  rankText: {
    fontSize: 16,
    fontWeight: '800'
  },
  info: {
    flex: 1
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text
  },
  badge: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2
  },
  points: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary
  }
});
