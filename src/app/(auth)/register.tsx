import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  ScrollView 
} from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../config/firebase';
import { COLORS, SPACING } from '../../constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ Họ tên, Email và Mật khẩu.');
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

      // Save user metadata to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        points: 100, // Initial bonus points
        reputationScore: 100,
        resolvedCount: 0,
        createdAt: serverTimestamp()
      });

      setLoading(false);
      Alert.alert('Thành công 🎉', 'Đăng ký tài khoản thành công! Nhận 100 điểm thưởng chào mừng.', [
        { text: 'Bắt đầu ngay', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Đăng ký thất bại', error.message || 'Không thể tạo tài khoản.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>

      <Text style={styles.title}>Tạo Tài Khoản Mới 🚀</Text>
      <Text style={styles.subtitle}>Tham gia cộng đồng Findora hỗ trợ tìm kiếm đồ bị mất</Text>

      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Ionicons name="person-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Họ và tên"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="call-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Số điện thoại"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Mật khẩu (ít nhất 6 ký tự)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity 
          style={styles.registerBtn} 
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.btnText}>Đăng Ký Tài Khoản</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl
  },
  backBtn: {
    marginBottom: SPACING.md
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.xl
  },
  formContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border
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
  registerBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
