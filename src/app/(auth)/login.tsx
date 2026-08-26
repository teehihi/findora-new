import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  updateProfile,
  updatePassword
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal as RNModal,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleLogo } from '../../components/GoogleLogo';
import { auth, db } from '../../config/firebase';
import { COLORS, SPACING } from '../../constants/theme';

// Safely resolve native GoogleSignin module for Expo Go / Dev Build compatibility
let GoogleSigninModule: any = null;
let statusCodesEnum: any = {};

try {
  const gSignin = require('@react-native-google-signin/google-signin');
  if (NativeModules.RNGoogleSignin || gSignin.GoogleSignin) {
    GoogleSigninModule = gSignin.GoogleSignin;
    statusCodesEnum = gSignin.statusCodes || {};
  }
} catch (e) {
  // Expo Go sandbox environment without native RNGoogleSignin binary
  GoogleSigninModule = null;
}

// Official Credentials
const GOOGLE_WEB_CLIENT_ID = '32712775834-at73e6qgmgo8shir419fks3v8daj8pjn.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '32712775834-jvbe5dqn6vjvlj1cv9ot8qrmijjp8r3t.apps.googleusercontent.com';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Google New User Onboarding / Password Setup States
  const [onboardingModalVisible, setOnboardingModalVisible] = useState(false);
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingPhone, setOnboardingPhone] = useState('');
  const [onboardingPassword, setOnboardingPassword] = useState('');
  const [onboardingConfirmPassword, setOnboardingConfirmPassword] = useState('');
  const [onboardingUser, setOnboardingUser] = useState<any>(null);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [showOnboardingPassword, setShowOnboardingPassword] = useState(false);

  useEffect(() => {
    if (GoogleSigninModule) {
      try {
        GoogleSigninModule.configure({
          webClientId: GOOGLE_WEB_CLIENT_ID,
          iosClientId: GOOGLE_IOS_CLIENT_ID,
          scopes: ['profile', 'email'],
          offlineAccess: false
        });
      } catch (e) {
        console.log('[GoogleSignin] Configuration notice:', e);
      }
    }
  }, []);

  const handleGoogleBtnPress = async () => {
    if (!GoogleSigninModule || !NativeModules.RNGoogleSignin) {
      Alert.alert(
        'Yêu cầu Expo Development Build 🚀',
        'Đăng nhập Google Native yêu cầu bản Expo Development Build (npx expo run:ios --device).\n\nVui lòng sử dụng Đăng Nhập Email/Mật khẩu khi chạy trên ứng dụng Expo Go.'
      );
      return;
    }

    try {
      setGoogleLoading(true);
      GoogleSigninModule.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID,
        scopes: ['profile', 'email'],
        offlineAccess: false
      });
      await GoogleSigninModule.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSigninModule.signOut().catch(() => { });
      const response = await GoogleSigninModule.signIn();

      const googleUser = response.data?.user || (response as any).user;
      let idToken = response.data?.idToken || (response as any).idToken || googleUser?.idToken;

      if (!idToken && typeof GoogleSigninModule.getTokens === 'function') {
        const tokens = await GoogleSigninModule.getTokens().catch(() => null);
        idToken = tokens?.idToken;
      }

      if (idToken) {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        const user = userCredential.user;

        const realName = googleUser?.name || user.displayName || user.email?.split('@')[0] || 'User';
        const realAvatar = googleUser?.photo || user.photoURL || '';

        // Update Firebase Auth profile if displayName is missing
        if (!user.displayName && realName) {
          await updateProfile(user, { displayName: realName, photoURL: realAvatar }).catch(() => { });
        }

        // Save/verify user profile in Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          await setDoc(userDocRef, {
            uid: user.uid,
            name: realName,
            email: user.email || '',
            avatarUrl: realAvatar,
            phone: '',
            points: 100,
            reputationScore: 100,
            resolvedCount: 0,
            authProvider: 'google',
            hasSetupPassword: false,
            createdAt: serverTimestamp()
          });

          // Show Onboarding Modal so user can edit name, phone and setup password
          setGoogleLoading(false);
          setOnboardingUser(user);
          setOnboardingName(realName);
          setOnboardingPhone('');
          setOnboardingPassword('');
          setOnboardingConfirmPassword('');
          setOnboardingModalVisible(true);
          return;
        } else {
          // If the user profile already exists, PRESERVE their customized name and avatar!
          const existingData = userSnap.data();
          const updatePayload: Record<string, any> = {};
          if (!existingData.name) updatePayload.name = realName;
          if (!existingData.avatarUrl && realAvatar) updatePayload.avatarUrl = realAvatar;
          if (!existingData.email && user.email) updatePayload.email = user.email;

          if (Object.keys(updatePayload).length > 0) {
            await updateDoc(userDocRef, updatePayload).catch(() => { });
          }
        }

        setGoogleLoading(false);
        router.replace('/(tabs)');
      } else {
        setGoogleLoading(false);
        Alert.alert('Đăng nhập Google thất bại', 'Không lấy được ID Token từ Google.');
      }
    } catch (error: any) {
      setGoogleLoading(false);
      if (error.code === statusCodesEnum.SIGN_IN_CANCELLED) {
        console.log('[GoogleSignin] User cancelled login flow.');
      } else if (error.code === statusCodesEnum.IN_PROGRESS) {
        console.log('[GoogleSignin] Sign-in already in progress.');
      } else if (error.code === statusCodesEnum.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Lỗi', 'Thiết bị không hỗ trợ Google Play Services.');
      } else {
        Alert.alert('Đăng nhập Google thất bại', error.message || 'Lỗi khi kết nối với Google.');
      }
    }
  };

  const handleSaveOnboarding = async (skipPassword = false) => {
    if (!onboardingUser) return;
    try {
      setOnboardingSaving(true);
      const userDocRef = doc(db, 'users', onboardingUser.uid);
      const updates: Record<string, any> = {
        name: onboardingName.trim() || onboardingUser.displayName || 'User',
        phone: onboardingPhone.trim(),
      };

      if (!skipPassword && onboardingPassword.trim()) {
        if (onboardingPassword.length < 6) {
          setOnboardingSaving(false);
          Alert.alert('Mật khẩu không hợp lệ', 'Mật khẩu phải có ít nhất 6 ký tự.');
          return;
        }
        if (onboardingPassword !== onboardingConfirmPassword) {
          setOnboardingSaving(false);
          Alert.alert('Mật khẩu không khớp', 'Mật khẩu xác nhận không trùng khớp.');
          return;
        }
        await updatePassword(onboardingUser, onboardingPassword.trim());
        updates.hasSetupPassword = true;
      }

      if (onboardingName.trim()) {
        await updateProfile(onboardingUser, { displayName: onboardingName.trim() }).catch(() => {});
      }

      await updateDoc(userDocRef, updates).catch(() => {});
      setOnboardingSaving(false);
      setOnboardingModalVisible(false);
      router.replace('/(tabs)');
    } catch (e: any) {
      setOnboardingSaving(false);
      setOnboardingModalVisible(false);
      router.replace('/(tabs)');
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setLoading(false);
      router.replace('/(tabs)');
    } catch (error: any) {
      setLoading(false);
      const code = error.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        Alert.alert(
          'Đăng nhập không thành công',
          'Email hoặc mật khẩu chưa chính xác.\n\n💡 Lưu ý: Nếu tài khoản này được tạo bằng Google, bạn vui lòng chọn "Tiếp tục với Google" hoặc bấm "Quên mật khẩu" để tạo mật khẩu đăng nhập nhé!',
          [
            { text: 'Đóng', style: 'cancel' },
            { 
              text: 'Quên mật khẩu?', 
              onPress: () => router.push('/(auth)/forgot-password' as any) 
            }
          ]
        );
      } else {
        Alert.alert('Đăng nhập thất bại', error.message || 'Email hoặc mật khẩu không chính xác.');
      }
    }
  };

  const handleGuestDemoLogin = async () => {
    try {
      setLoading(true);
      let user = auth.currentUser;
      if (!user) {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, 'demo_judge@findora.vn', '12345678');
          user = userCredential.user;
        } catch {
          try {
            const newCred = await createUserWithEmailAndPassword(auth, 'demo_judge@findora.vn', '12345678');
            user = newCred.user;
          } catch {
            const anonCred = await signInAnonymously(auth);
            user = anonCred.user;
          }
        }
      }

      if (user) {
        await updateProfile(user, {
          displayName: 'Ban Giám Khảo (Demo)',
          photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        }).catch(() => { });
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          uid: user.uid,
          name: 'Ban Giám Khảo (Demo)',
          email: user.email || 'demo_judge@findora.vn',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          points: 500,
          reputationScore: 100,
          resolvedCount: 5,
          authProvider: 'demo',
          createdAt: serverTimestamp(),
        }, { merge: true }).catch(() => { });
      }

      setLoading(false);
      router.replace('/(tabs)');
    } catch {
      setLoading(false);
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandContainer}>
            <Image
              source={require('../../../assets/images/Logo_noBG.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>Nền tảng tìm đồ thất lạc AI thông minh</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Đăng Nhập</Text>

            <View style={styles.inputGroup}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email của bạn"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Mật khẩu"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.forgotText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={handleEmailLogin}
              disabled={loading || googleLoading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginBtnText}>Đăng Nhập</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>HOẶC</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleBtnPress}
              disabled={googleLoading || loading}
              activeOpacity={0.8}
            >
              <View style={styles.googleBtnContent}>
                <View style={styles.googleLogoBox}>
                  <GoogleLogo size={22} />
                </View>
                <Text style={styles.googleBtnText}>Tiếp tục với Google</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoBtn}
              onPress={handleGuestDemoLogin}
              disabled={loading || googleLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.demoBtnText}>Trải Nghiệm Nhanh</Text>
            </TouchableOpacity>

            <View style={styles.registerRow}>
              <Text style={styles.registerLabel}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                <Text style={styles.registerLink}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Google Sign-in Onboarding / Password Setup Modal */}
      <RNModal
        visible={onboardingModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => handleSaveOnboarding(true)}
      >
        <View style={styles.onboardingOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.onboardingCard}
          >
            <View style={styles.onboardingHeader}>
              <View style={styles.onboardingIconBox}>
                <Ionicons name="sparkles" size={24} color="#00A896" />
              </View>
              <Text style={styles.onboardingTitle}>Hoàn Tất Hồ Sơ</Text>
              <Text style={styles.onboardingSubtitle}>
                Thiết lập thông tin &amp; tạo mật khẩu để có thể đăng nhập bằng cả 2 cách
              </Text>
            </View>

            <View style={styles.onboardingForm}>
              {/* Name */}
              <Text style={styles.onboardingLabel}>Họ và tên</Text>
              <View style={styles.onboardingInputBox}>
                <Ionicons name="person-outline" size={18} color="#00A896" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.onboardingTextInput}
                  value={onboardingName}
                  onChangeText={setOnboardingName}
                  placeholder="Họ và tên hiển thị"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Phone */}
              <Text style={[styles.onboardingLabel, { marginTop: 12 }]}>Số điện thoại liên hệ</Text>
              <View style={styles.onboardingInputBox}>
                <Ionicons name="call-outline" size={18} color="#00A896" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.onboardingTextInput}
                  value={onboardingPhone}
                  onChangeText={setOnboardingPhone}
                  keyboardType="phone-pad"
                  placeholder="Nhập SĐT để người nhận liên hệ"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {/* Password */}
              <Text style={[styles.onboardingLabel, { marginTop: 12 }]}>Tạo mật khẩu đăng nhập (Tùy chọn)</Text>
              <View style={styles.onboardingInputBox}>
                <Ionicons name="lock-closed-outline" size={18} color="#00A896" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.onboardingTextInput}
                  secureTextEntry={!showOnboardingPassword}
                  value={onboardingPassword}
                  onChangeText={setOnboardingPassword}
                  placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity onPress={() => setShowOnboardingPassword(!showOnboardingPassword)}>
                  <Ionicons name={showOnboardingPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Confirm Password */}
              {onboardingPassword.length > 0 && (
                <View style={[styles.onboardingInputBox, { marginTop: 8 }]}>
                  <Ionicons name="checkmark-done-outline" size={18} color="#00A896" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.onboardingTextInput}
                    secureTextEntry={!showOnboardingPassword}
                    value={onboardingConfirmPassword}
                    onChangeText={setOnboardingConfirmPassword}
                    placeholder="Xác nhận mật khẩu"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              )}
            </View>

            <View style={styles.onboardingActionRow}>
              <TouchableOpacity
                style={styles.onboardingSkipBtn}
                onPress={() => handleSaveOnboarding(true)}
                disabled={onboardingSaving}
              >
                <Text style={styles.onboardingSkipText}>Bỏ qua</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.onboardingSubmitBtn}
                onPress={() => handleSaveOnboarding(false)}
                disabled={onboardingSaving}
                activeOpacity={0.85}
              >
                {onboardingSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.onboardingSubmitText}>Hoàn tất &amp; Bắt đầu</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </RNModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg
  },
  logoImage: {
    width: 220,
    height: 70
  },
  tagline: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4
  },
  formContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.lg
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    height: 52,
    marginBottom: SPACING.md
  },
  inputIcon: {
    marginRight: SPACING.sm
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0'
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginHorizontal: 12,
    letterSpacing: 0.5
  },
  googleBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#DADCE0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  googleLogoBox: {
    marginRight: 10
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F1F1F'
  },
  demoBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#CCFBF1',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  demoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00A896',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg
  },
  registerLabel: {
    fontSize: 14,
    color: COLORS.textMuted
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary
  },

  // Onboarding Modal Styles
  onboardingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  onboardingCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  onboardingHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  onboardingIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  onboardingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  onboardingSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  onboardingForm: {
    width: '100%',
    marginVertical: 10,
  },
  onboardingLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  onboardingInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  onboardingTextInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
  },
  onboardingActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    width: '100%',
  },
  onboardingSkipBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    marginRight: 10,
  },
  onboardingSkipText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748B',
  },
  onboardingSubmitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#00A896',
    alignItems: 'center',
  },
  onboardingSubmitText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
