import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  Image,
  NativeModules
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithCredential,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../config/firebase';
import { GoogleLogo } from '../../components/GoogleLogo';
import { ModernLoader } from '../../components/ModernLoader';
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
      await GoogleSigninModule.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSigninModule.signIn();
      
      const googleUser = response.data?.user || (response as any).user;
      const idToken = response.data?.idToken || (response as any).idToken || googleUser?.idToken;

      if (idToken) {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        const user = userCredential.user;

        const realName = googleUser?.name || user.displayName || user.email?.split('@')[0] || 'User';
        const realAvatar = googleUser?.photo || user.photoURL || '';

        // Update Firebase Auth profile if displayName is missing
        if (!user.displayName && realName) {
          await updateProfile(user, { displayName: realName, photoURL: realAvatar }).catch(() => {});
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
            createdAt: serverTimestamp()
          });
        } else {
          // Always update Firestore with exact name and avatarUrl from Google
          await updateDoc(userDocRef, {
            name: realName,
            avatarUrl: realAvatar
          }).catch(() => {});
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
      Alert.alert('Đăng nhập thất bại', error.message || 'Email hoặc mật khẩu không chính xác.');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Futuristic Modern Loader Component */}
      <ModernLoader
        visible={googleLoading || loading}
        title={googleLoading ? 'Đang kết nối với Google' : 'Đang xác thực tài khoản'}
        subtitle="Vui lòng chờ trong giây lát"
        accentColor="#00A896"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Genuine Brand Logo */}
        <View style={styles.brandContainer}>
          <Image
            source={require('../../../assets/images/Logo_noBG.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Nền tảng tìm đồ thất lạc AI thông minh</Text>
        </View>

        {/* Login Form */}
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

          {/* Social Sign-In Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>HOẶC ĐĂNG NHẬP VỚI</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Official Multi-Color Google Sign-In Button */}
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

          {/* Register Link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerLabel}>Chưa có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.registerLink}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  }
});
