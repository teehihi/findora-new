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
  Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithCredential 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../config/firebase';
import { GoogleLogo } from '../../components/GoogleLogo';
import { COLORS, SPACING } from '../../constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Configure Google Auth Session with clean redirectUri
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '32712775834-at73e6qgmgo8shir419fks3v8daj8pjn.apps.googleusercontent.com',
    webClientId: '32712775834-at73e6qgmgo8shir419fks3v8daj8pjn.apps.googleusercontent.com',
    androidClientId: '32712775834-2cf02a6qtip9ter0jlft4c6rs5741elf.apps.googleusercontent.com',
    iosClientId: '32712775834-at73e6qgmgo8shir419fks3v8daj8pjn.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    redirectUri: makeRedirectUri()
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.authentication?.idToken || response.params?.id_token;
      if (idToken) {
        handleGoogleSignInWithToken(idToken);
      }
    }
  }, [response]);

  const handleGoogleSignInWithToken = async (idToken: string) => {
    try {
      setGoogleLoading(true);
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      // Check if user already exists in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        // Save new Google user to Firestore
        await setDoc(userDocRef, {
          uid: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          avatarUrl: user.photoURL || '',
          phone: '',
          points: 100, // Initial bonus points
          reputationScore: 100,
          resolvedCount: 0,
          authProvider: 'google',
          createdAt: serverTimestamp()
        });
      }

      setGoogleLoading(false);
      router.replace('/(tabs)');
    } catch (error: any) {
      setGoogleLoading(false);
      Alert.alert('Đăng nhập Google thất bại', error.message || 'Không thể xác thực với Google.');
    }
  };

  const handleGoogleBtnPress = () => {
    // preferEphemeralSession: true prevents Safari from remembering cached account session
    promptAsync({
      preferEphemeralSession: true
    });
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
            disabled={loading}
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
            disabled={googleLoading || !request}
            activeOpacity={0.8}
          >
            {googleLoading ? (
              <ActivityIndicator color="#1F1F1F" />
            ) : (
              <View style={styles.googleBtnContent}>
                <View style={styles.googleLogoBox}>
                  <GoogleLogo size={22} />
                </View>
                <Text style={styles.googleBtnText}>Tiếp tục với Google</Text>
              </View>
            )}
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
