import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  Alert 
} from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../config/firebase';
import { getUserProfile } from '../../services/firebaseService';
import { User } from '../../models/types';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      getUserProfile(user.uid).then(setProfile);
    }
  }, []);

  const handleLogout = async () => {
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

  const currentUser = auth.currentUser;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View style={styles.userCard}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.placeholderAvatar}>
              <Text style={styles.avatarInitials}>
                {(profile?.name || currentUser?.displayName || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <Text style={styles.name}>{profile?.name || currentUser?.displayName || 'Người dùng Findora'}</Text>
          <Text style={styles.email}>{currentUser?.email || 'email@example.com'}</Text>

          {/* Level Badge */}
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>{profile?.levelBadge || 'Bronze Helper 🥉'}</Text>
          </View>

          {/* Stats Bar */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{profile?.points || 0}</Text>
              <Text style={styles.statLabel}>Điểm thưởng</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{profile?.resolvedCount || 0}</Text>
              <Text style={styles.statLabel}>Đã giúp đỡ</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{profile?.reputationScore || 100}</Text>
              <Text style={styles.statLabel}>Uy tín</Text>
            </View>
          </View>
        </View>

        {/* Menu Shortcuts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chức năng chính</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/post/my-posts')}>
            <View style={[styles.menuIconBox, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="document-text" size={20} color="#0284C7" />
            </View>
            <Text style={styles.menuText}>Bài đăng của tôi</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/chat')}>
            <View style={[styles.menuIconBox, { backgroundColor: '#FCE7F3' }]}>
              <Ionicons name="chatbubbles" size={20} color="#DB2777" />
            </View>
            <Text style={styles.menuText}>Trò chuyện trực tiếp</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/wallet')}>
            <View style={[styles.menuIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="wallet" size={20} color="#D97706" />
            </View>
            <Text style={styles.menuText}>Ví điểm thưởng & Lịch sử</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/wallet/vouchers')}>
            <View style={[styles.menuIconBox, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="gift" size={20} color="#16A34A" />
            </View>
            <Text style={styles.menuText}>Chợ Voucher Đổi Quà</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/wallet/leaderboard')}>
            <View style={[styles.menuIconBox, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="trophy" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.menuText}>Bảng Xếp Hạng Helper</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tài khoản</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/edit')}>
            <View style={[styles.menuIconBox, { backgroundColor: '#F1F5F9' }]}>
              <Ionicons name="create-outline" size={20} color={COLORS.text} />
            </View>
            <Text style={styles.menuText}>Chỉnh sửa thông tin cá nhân</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={[styles.menuIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            </View>
            <Text style={[styles.menuText, { color: '#DC2626' }]}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  scrollContent: {
    padding: SPACING.md
  },
  userCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: SPACING.sm
  },
  placeholderAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text
  },
  email: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2
  },
  badgePill: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: SPACING.sm
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  statBox: {
    flex: 1,
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0'
  },
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: SPACING.sm
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text
  }
});
