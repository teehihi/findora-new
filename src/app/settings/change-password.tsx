import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { 
  updatePassword, 
  linkWithCredential, 
  EmailAuthProvider, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar } from '../../components/HeaderBar';
import { auth } from '../../config/firebase';
import { generateOtpEmailTemplate, sendEmail } from '../../services/emailService';
import { getUserProfile, updateUserProfile } from '../../services/firebaseService';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [hasSetupPassword, setHasSetupPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');

  // Step 1: Input Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: OTP Verification
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setEmail(user.email || '');
      setUserName(user.displayName || user.email?.split('@')[0] || '');
      getUserProfile(user.uid).then((data: any) => {
        if (data) {
          setHasSetupPassword(!!data.hasSetupPassword);
          if (data.name) setUserName(data.name);
        }
      });
    }
  }, []);

  const handleSendOtp = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    if (!email) {
      Alert.alert('Lỗi', 'Không tìm thấy địa chỉ email của bạn.');
      return;
    }

    try {
      setSendingOtp(true);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);

      const html = generateOtpEmailTemplate({
        userName: userName || email.split('@')[0],
        otpCode: otp,
      });

      await sendEmail({
        to: email,
        subject: '[Findora] Mã xác thực OTP thay đổi mật khẩu',
        html,
      });

      setSendingOtp(false);
      setStep('otp');
      setEnteredOtp('');
      Alert.alert(
        'Đã gửi mã OTP ✉️',
        `Mã xác thực gồm 6 số đã được gửi đến:\n${email}\n\nVui lòng kiểm tra hộp thư đến (hoặc thư rác/spam).`
      );
    } catch (e: any) {
      setSendingOtp(false);
      Alert.alert('Lỗi', 'Không thể gửi email OTP lúc này. Vui lòng thử lại sau.');
    }
  };

  const handleVerifyAndSave = async () => {
    if (enteredOtp.trim() !== generatedOtp) {
      Alert.alert('Mã OTP không chính xác', 'Vui lòng kiểm tra lại 6 chữ số trong email của bạn.');
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) return;

    try {
      setSubmitting(true);
      const emailCred = EmailAuthProvider.credential(user.email, newPassword);

      try {
        // First try to link email & password credential (for Google users creating password for the first time)
        await linkWithCredential(user, emailCred);
      } catch (linkError: any) {
        // If already linked, directly update password
        if (linkError.code === 'auth/provider-already-linked' || linkError.code === 'auth/credential-already-in-use') {
          await updatePassword(user, newPassword);
        } else if (linkError.code === 'auth/requires-recent-login') {
          await updatePassword(user, newPassword);
        } else {
          throw linkError;
        }
      }

      await updateUserProfile(user.uid, { hasSetupPassword: true } as any);
      setSubmitting(false);

      Alert.alert('Thành công! 🎉', 'Mật khẩu của bạn đã được cập nhật thành công.', [
        { text: 'Xong', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      setSubmitting(false);
      if (error.code === 'auth/requires-recent-login') {
        Alert.alert(
          'Xác thực bảo mật từ Google/Firebase',
          'Vì lý do an toàn, phiên làm việc hiện tại yêu cầu bạn đăng nhập lại trước khi cập nhật mật khẩu, hoặc bạn có thể nhận liên kết đặt mật khẩu nhanh qua Email.',
          [
            { text: 'Hủy', style: 'cancel' },
            {
              text: 'Gửi link qua Email',
              onPress: async () => {
                try {
                  await sendPasswordResetEmail(auth, user.email!);
                  Alert.alert('Đã gửi email! ✉️', `Liên kết đổi mật khẩu đã được gửi tới ${user.email}. Vui lòng mở Gmail để đặt lại mật khẩu!`);
                } catch (e: any) {
                  Alert.alert('Lỗi', e.message);
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Lỗi', error.message || 'Không thể cập nhật mật khẩu.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar 
        title={hasSetupPassword ? 'Đổi mật khẩu' : 'Thiết lập mật khẩu'} 
        showBack={true} 
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.iconCircle}>
              <Ionicons 
                name={step === 'input' ? 'shield-checkmark' : 'mail-unread'} 
                size={28} 
                color="#00A896" 
              />
            </View>
            <Text style={styles.cardTitle}>
              {step === 'input' 
                ? (hasSetupPassword ? 'Đổi Mật Khẩu Tài Khoản' : 'Thiết Lập Mật Khẩu')
                : 'Xác Thực Mã OTP Email'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {step === 'input'
                ? 'Nhập mật khẩu mới. Hệ thống sẽ gửi mã OTP về Email để bảo vệ quyền sở hữu của bạn.'
                : `Nhập mã xác thực 6 số vừa được gửi tới email ${email}`}
            </Text>
          </View>

          {step === 'input' ? (
            /* STEP 1: FORM NHẬP MẬT KHẨU */
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Mật khẩu mới</Text>
              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={20} color="#00A896" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  secureTextEntry={!showPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons 
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                    size={20} 
                    color="#94A3B8" 
                  />
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Xác nhận mật khẩu mới</Text>
              <View style={styles.inputBox}>
                <Ionicons name="checkmark-done-outline" size={20} color="#00A896" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Nhập lại mật khẩu mới"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (!newPassword || newPassword.length < 6) && styles.primaryBtnDisabled
                ]}
                onPress={handleSendOtp}
                disabled={sendingOtp || !newPassword || newPassword.length < 6}
                activeOpacity={0.85}
              >
                {sendingOtp ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="mail" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>Gửi mã OTP qua Email</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* STEP 2: FORM NHẬP OTP */
            <View style={styles.formCard}>
              <Text style={styles.otpLabel}>Nhập mã OTP 6 chữ số</Text>

              {/* Hidden text input */}
              <TextInput
                style={styles.hiddenInput}
                value={enteredOtp}
                onChangeText={(t) => setEnteredOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <View style={styles.otpBoxesRow}>
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const digit = enteredOtp[idx] || '';
                  return (
                    <View key={idx} style={[styles.otpBox, digit !== '' && styles.otpBoxFilled]}>
                      <Text style={styles.otpDigit}>{digit}</Text>
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  enteredOtp.length < 6 && styles.primaryBtnDisabled
                ]}
                onPress={handleVerifyAndSave}
                disabled={submitting || enteredOtp.length < 6}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>Xác nhận &amp; Cập nhật</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendBtn}
                onPress={() => setStep('input')}
                activeOpacity={0.7}
              >
                <Text style={styles.resendText}>Quay lại chỉnh sửa mật khẩu</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#0F172A',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00A896',
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 24,
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 16,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0.01,
    width: 1,
    height: 1,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 14,
  },
  otpBox: {
    width: 44,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: '#00A896',
    backgroundColor: '#F0FDF4',
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '800',
    color: '#00A896',
  },
  resendBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
});
