import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar } from '../../components/HeaderBar';
import { auth } from '../../config/firebase';
import { COLORS, SHADOWS, SPACING } from '../../constants/theme';
import { getUserProfile } from '../../services/firebaseService';

export default function SettingsScreen() {
  const router = useRouter();
  const [hasSetupPassword, setHasSetupPassword] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [authProvider, setAuthProvider] = useState('email');

  // System Preference Mockups
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gpsPrecision, setGpsPrecision] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState<'vi' | 'en'>('vi');
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'auto'>('light');

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserEmail(user.email || '');
      
      // Check directly from Firebase Auth providerData
      const hasPasswordProvider = user.providerData?.some((p) => p.providerId === 'password');
      if (hasPasswordProvider) {
        setHasSetupPassword(true);
      }

      getUserProfile(user.uid).then((data: any) => {
        if (data) {
          const hasPass = !!data.hasSetupPassword || data.authProvider === 'email' || hasPasswordProvider;
          setHasSetupPassword(hasPass);
          if (data.authProvider) setAuthProvider(data.authProvider);
        }
      });
    }
  }, []);

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth).catch(() => {});
          router.replace('/(auth)/login');
        }
      }
    ]);
  };

  const showUnderDevelopmentAlert = (featureName: string) => {
    Alert.alert(
      'Tính năng đang phát triển 🚧',
      `Cài đặt "${featureName}" đang được hoàn thiện và sẽ sớm ra mắt trong bản cập nhật tiếp theo của Findora!`,
      [{ text: 'Đã hiểu', style: 'default' }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar title="Cài đặt hệ thống" showBack={true} backgroundColor="#FFFFFF" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: BẢO MẬT VÀ TÀI KHOẢN */}
        <Text style={styles.sectionHeader}>BẢO MẬT VÀ TÀI KHOẢN</Text>
        <View style={styles.menuCard}>
          {/* Đổi / Thiết lập mật khẩu */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/settings/change-password' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#CCFBF1' }]}>
              <Ionicons name="key-outline" size={20} color="#00A896" />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>
                {hasSetupPassword ? 'Đổi mật khẩu' : 'Thiết lập mật khẩu'}
              </Text>
              <Text style={styles.itemSubtitle}>
                {hasSetupPassword 
                  ? 'Bảo vệ tài khoản bằng mã xác thực OTP Email' 
                  : 'Tạo mật khẩu để đăng nhập bằng Email/Password'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.separator} />

          {/* Email tài khoản */}
          <View style={styles.menuItem}>
            <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="mail-outline" size={20} color="#3B82F6" />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Email đăng ký</Text>
              <Text style={styles.itemSubtitle}>{userEmail || 'Chưa liên kết'}</Text>
            </View>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{authProvider === 'google' ? 'Google OAuth' : 'Email'}</Text>
            </View>
          </View>
        </View>

        {/* SECTION 2: HỆ THỐNG */}
        <Text style={styles.sectionHeader}>HỆ THỐNG</Text>
        <View style={styles.menuCard}>
          {/* Ngôn ngữ */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => showUnderDevelopmentAlert('Ngôn ngữ')} 
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="language-outline" size={20} color="#D97706" />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Ngôn ngữ</Text>
              <Text style={styles.itemSubtitle}>
                {currentLanguage === 'vi' ? 'Tiếng Việt (VN)' : 'English (US)'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.separator} />

          {/* Chế độ giao diện */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => showUnderDevelopmentAlert('Chế độ giao diện')} 
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="color-palette-outline" size={20} color="#9333EA" />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Chế độ giao diện</Text>
              <Text style={styles.itemSubtitle}>
                {themeMode === 'light' ? 'Giao diện sáng' : themeMode === 'dark' ? 'Giao diện tối' : 'Tự động'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.separator} />

          {/* Vị trí GPS */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => showUnderDevelopmentAlert('Định vị GPS độ chính xác cao')} 
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="location-outline" size={20} color="#EF4444" />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Định vị GPS độ chính xác cao</Text>
              <Text style={styles.itemSubtitle}>Tìm kiếm đồ vật thất lạc xung quanh chính xác</Text>
            </View>
            <Switch
              value={gpsPrecision}
              onValueChange={() => showUnderDevelopmentAlert('Định vị GPS độ chính xác cao')}
              trackColor={{ false: '#E2E8F0', true: '#00A896' }}
              thumbColor="#FFFFFF"
            />
          </TouchableOpacity>

          <View style={styles.separator} />

          {/* Thông báo đẩy */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => showUnderDevelopmentAlert('Thông báo ghép đôi AI')} 
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="notifications-outline" size={20} color="#6366F1" />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Thông báo ghép đôi AI</Text>
              <Text style={styles.itemSubtitle}>Nhận thông báo khi AI tìm thấy đồ vật tương đồng</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={() => showUnderDevelopmentAlert('Thông báo ghép đôi AI')}
              trackColor={{ false: '#E2E8F0', true: '#00A896' }}
              thumbColor="#FFFFFF"
            />
          </TouchableOpacity>

          <View style={styles.separator} />

          {/* Âm thanh */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => showUnderDevelopmentAlert('Âm thanh & Rung')} 
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="volume-medium-outline" size={20} color="#10B981" />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Âm thanh &amp; Rung</Text>
              <Text style={styles.itemSubtitle}>Âm báo khi có cuộc hẹn bàn giao hoặc tin nhắn</Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={() => showUnderDevelopmentAlert('Âm thanh & Rung')}
              trackColor={{ false: '#E2E8F0', true: '#00A896' }}
              thumbColor="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {/* SECTION 3: THÔNG TIN & HỖ TRỢ */}
        <Text style={styles.sectionHeader}>THÔNG TIN &amp; HỖ TRỢ</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Findora v1.2.0', 'Phiên bản thi AI Riser Việt Nam (Build 2026.08)\n\nPhát triển bởi Đội ngũ Findora.')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
              <Ionicons name="information-circle-outline" size={20} color="#64748B" />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Phiên bản ứng dụng</Text>
              <Text style={styles.itemSubtitle}>v1.2.0 (Official Release)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Hỗ trợ kỹ thuật', 'Email: hotrofindora@gmail.com\nHotline: 1900-FINDORA')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="help-buoy-outline" size={20} color="#00A896" />
            </View>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>Trung tâm hỗ trợ Findora</Text>
              <Text style={styles.itemSubtitle}>hotrofindora@gmail.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* LOGOUT BUTTON */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Đăng Xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 54,
  },
  badgePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 12,
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#EF4444',
  },
});
