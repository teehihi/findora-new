import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../config/firebase';
import { COLORS, SPACING } from '../../constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập Email khôi phục.');
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      setLoading(false);
      Alert.alert('Thành công ✉️', 'Email hướng dẫn khôi phục mật khẩu đã được gửi đến email của bạn.', [
        { text: 'Quay lại Đăng nhập', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Lỗi', e.message || 'Không thể gửi email khôi phục.');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>

      <Text style={styles.title}>Quên Mật Khẩu 🔒</Text>
      <Text style={styles.subtitle}>Nhập Email đã đăng ký để nhận đường dẫn đặt lại mật khẩu.</Text>

      <View style={styles.inputGroup}>
        <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Email của bạn"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={handleReset} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>Gửi Email Khôi Phục</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    paddingTop: SPACING.xl
  },
  backBtn: {
    marginBottom: SPACING.md
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.xl
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg
  },
  inputIcon: {
    marginRight: SPACING.sm
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
