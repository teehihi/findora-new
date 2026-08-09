import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { updateProfile } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { getUserProfile, updateUserProfile } from '../../services/firebaseService';
import { HeaderBar } from '../../components/HeaderBar';
import { COLORS, SPACING } from '../../constants/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setName(user.displayName || '');
      getUserProfile(user.uid).then((data) => {
        if (data?.phone) setPhone(data.phone);
      });
    }
  }, []);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      setSaving(true);
      await updateProfile(user, { displayName: name.trim() });
      await updateUserProfile(user.uid, {
        name: name.trim(),
        phone: phone.trim()
      });
      setSaving(false);
      Alert.alert('Thành công', 'Đã lưu thay đổi thông tin cá nhân!');
      router.back();
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Lỗi', e.message || 'Không thể lưu thay đổi.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar title="Chỉnh Sửa Cá Nhân" showBack />

      <View style={styles.content}>
        <Text style={styles.label}>Họ và tên</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Số điện thoại</Text>
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>Lưu Thay Đổi</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  content: {
    padding: SPACING.md
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
    marginTop: SPACING.sm
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    height: 48,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    height: 50,
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
