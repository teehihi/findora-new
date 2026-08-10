import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  NativeModules
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  createUserWithEmailAndPassword, 
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
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
  GoogleSigninModule = null;
}

// Official Credentials
const GOOGLE_WEB_CLIENT_ID = '32712775834-at73e6qgmgo8shir419fks3v8daj8pjn.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '32712775834-jvbe5dqn6vjvlj1cv9ot8qrmijjp8r3t.apps.googleusercontent.com';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ Họ và tên, Email và Mật khẩu.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name.trim() });

      // Save complete user metadata to Firestore users collection
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        avatarUrl: '',
        points: 100, // 100 Welcome Points
        reputationScore: 100,
        resolvedCount: 0,
        authProvider: 'email',
        createdAt: serverTimestamp()
      });

      setLoading(false);
      Alert.alert('Tạo tài khoản thành công 🎉', 'Chào mừng bạn đến với Findora! Đã thưởng 100 điểm khởi tạo.', [
        { text: 'Bắt đầu ngay', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Đăng ký thất bại', error.message || 'Không thể tạo tài khoản.');
    }
  };

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
      
      const idToken = response.data?.idToken || (response as any).idToken || (response as any).user?.idToken;

      if (idToken) {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        const user = userCredential.user;

        // Check/Save user profile in Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          await setDoc(userDocRef, {
            uid: user.uid,
            name: user.displayName || name.trim() || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            phone: phone.trim(),
            avatarUrl: user.photoURL || '',
            points: 100,
            reputationScore: 100,
            resolvedCount: 0,
            authProvider: 'google',
            createdAt: serverTimestamp()
          });
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Futuristic iOS Modern Loader Component */}
        <ModernLoader
          visible={googleLoading || loading}
          title={googleLoading ? 'Đang kết nối với Google' : 'Đang khởi tạo tài khoản'}
          subtitle="Vui lòng chờ trong giây lát"
          accentColor="#00C853"
        />

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header Back Button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color="#111111" />
          </TouchableOpacity>

          {/* Title Section */}
          <View style={styles.headerSection}>
            <Text style={styles.title}>Tạo tài khoản</Text>
            <Text style={styles.subtitle}>Vui lòng nhập đầy đủ thông tin</Text>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            {/* Field 1: Họ và tên */}
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Họ và tên</Text>
              <View style={styles.inputGroup}>
                <Ionicons name="person-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nguyễn Văn A"
                  placeholderTextColor="#A0A0A5"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            {/* Field 2: Số điện thoại */}
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Số điện thoại</Text>
              <View style={styles.inputGroup}>
                <Ionicons name="call-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="0931652105"
                  placeholderTextColor="#A0A0A5"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
            </View>

            {/* Field 3: Địa chỉ Email */}
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Địa chỉ Email</Text>
              <View style={styles.inputGroup}>
                <Ionicons name="mail-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="example@findora.com"
                  placeholderTextColor="#A0A0A5"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            {/* Field 4: Mật khẩu */}
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Mật khẩu</Text>
              <View style={styles.inputGroup}>
                <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="........."
                  placeholderTextColor="#A0A0A5"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons 
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                    size={20} 
                    color="#8E8E93" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Vibrant Green Submit Button */}
            <TouchableOpacity 
              style={styles.registerBtn} 
              onPress={handleRegister}
              disabled={loading || googleLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.registerBtnText}>Đăng ký</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>HOẶC TIẾP TỤC VỚI</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Google Sign-In Button */}
            <TouchableOpacity 
              style={styles.googleBtn} 
              onPress={handleGoogleBtnPress}
              disabled={googleLoading || loading}
              activeOpacity={0.85}
            >
              <View style={styles.googleBtnContent}>
                <View style={styles.googleLogoBox}>
                  <GoogleLogo size={22} />
                </View>
                <Text style={styles.googleBtnText}>Tiếp tục với Google</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: SPACING.md
  },
  headerSection: {
    marginBottom: SPACING.lg
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 6
  },
  subtitle: {
    fontSize: 14,
    color: '#666666'
  },
  formContainer: {
    width: '100%'
  },
  fieldBlock: {
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52
  },
  inputIcon: {
    marginRight: 12
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111111'
  },
  registerBtn: {
    backgroundColor: '#00C853',
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },
  registerBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5EA'
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    marginHorizontal: 12,
    letterSpacing: 0.5
  },
  googleBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E5E5EA',
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
  }
});
