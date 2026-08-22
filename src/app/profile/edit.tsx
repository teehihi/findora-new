import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { updateProfile } from 'firebase/auth';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar } from '../../components/HeaderBar';
import { auth } from '../../config/firebase';
import { COLORS, SHADOWS, SPACING } from '../../constants/theme';
import {
  getLevelFromPoints,
  getUserProfile,
  updateUserProfile,
  uploadAvatarImage,
} from '../../services/firebaseService';

const LEVEL_ASSETS: Record<string, any> = {
  'Huyền thoại': require('../../../assets/images/ic_legendary.png'),
  'Thiên thần': require('../../../assets/images/ic_angel.png'),
  'Người tốt': require('../../../assets/images/ic_good.png'),
  'Tập sự': require('../../../assets/images/ic_newbie.png'),
};

export default function EditProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUri, setAvatarUri] = useState('');
  const [newAvatarUri, setNewAvatarUri] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState('Tập sự');
  const [saving, setSaving] = useState(false);
  const [pickerModalVisible, setPickerModalVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(350)).current;

  useEffect(() => {
    if (pickerModalVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 15,
      }).start();
    } else {
      slideAnim.setValue(350);
    }
  }, [pickerModalVisible]);

  const closeModal = (callback?: () => void) => {
    Animated.timing(slideAnim, {
      toValue: 350,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setPickerModalVisible(false);
      if (callback) callback();
    });
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setEmail(user.email || '');
      if (user.displayName) setName(user.displayName);
      if (user.photoURL) setAvatarUri(user.photoURL);

      getUserProfile(user.uid).then((data) => {
        if (data) {
          if (data.name) setName(data.name);
          if (data.email) setEmail(data.email);
          if (data.phone) setPhone(data.phone);
          if (data.avatarUrl) setAvatarUri(data.avatarUrl);
          const lvl = data.level || getLevelFromPoints(data.points || 0);
          setUserLevel(lvl);
        }
      });
    }
  }, []);

  const openImagePickerOptions = () => {
    setPickerModalVisible(true);
  };

  const handlePickCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Ứng dụng cần quyền camera để chụp ảnh đại diện.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setNewAvatarUri(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể mở máy ảnh.');
    }
  };

  const handlePickLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Ứng dụng cần quyền thư viện ảnh để chọn ảnh đại diện.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setNewAvatarUri(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể mở thư viện ảnh.');
    }
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!name.trim()) {
      Alert.alert('Thông báo', 'Họ và tên không được để trống.');
      return;
    }

    try {
      setSaving(true);
      let finalAvatarUrl = avatarUri;

      // 1. Upload new avatar if selected
      if (newAvatarUri) {
        finalAvatarUrl = await uploadAvatarImage(newAvatarUri, user.uid);
      }

      // 2. Update Firebase Auth Profile
      await updateProfile(user, {
        displayName: name.trim(),
        photoURL: finalAvatarUrl,
      });

      // 3. Update Firestore User Document
      await updateUserProfile(user.uid, {
        name: name.trim(),
        fullName: name.trim(),
        phone: phone.trim(),
        avatarUrl: finalAvatarUrl,
        photoUrl: finalAvatarUrl,
      });

      setSaving(false);
      Alert.alert('Thành công 🎉', 'Đã cập nhật thông tin cá nhân thành công!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Lỗi', e.message || 'Không thể lưu thay đổi lúc này.');
    }
  };

  const activeAvatar = newAvatarUri || avatarUri;
  const levelImage = LEVEL_ASSETS[userLevel] || LEVEL_ASSETS['Tập sự'];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderBar title="Chỉnh Sửa Cá Nhân" showBack backgroundColor="#F8FAFC" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Avatar Section with Edit Badge */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarGlowBorder}>
                {activeAvatar ? (
                  <Image source={{ uri: activeAvatar }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>{(name || 'U').charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.cameraBadgeBtn}
                onPress={openImagePickerOptions}
                activeOpacity={0.85}
              >
                <Ionicons name="camera" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={openImagePickerOptions} activeOpacity={0.7}>
              <Text style={styles.changeAvatarText}>Đổi ảnh đại diện</Text>
            </TouchableOpacity>

            {/* Level Badge Pill */}
            <View style={styles.levelPill}>
              <Image source={levelImage} style={styles.levelPillIcon} resizeMode="contain" />
              <Text style={styles.levelPillText}>{userLevel}</Text>
            </View>
          </View>

          {/* 2. Form Fields Card */}
          <View style={styles.formCard}>
            {/* Field: Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Họ và tên</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#00A896" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Nhập họ và tên của bạn"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Field: Email (Readonly) */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Email đăng ký</Text>
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={11} color="#64748B" style={{ marginRight: 3 }} />
                  <Text style={styles.lockedBadgeText}>Không thể sửa</Text>
                </View>
              </View>
              <View style={[styles.inputContainer, styles.inputContainerDisabled]}>
                <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, styles.textInputDisabled]}
                  value={email}
                  editable={false}
                  placeholder="Chưa có email"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Field: Phone */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Số điện thoại liên hệ</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color="#00A896" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Nhập số điện thoại để người nhận liên hệ"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
          </View>

          {/* 3. Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>Đang lưu thay đổi...</Text>
              </View>
            ) : (
              <View style={styles.savingRow}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>Lưu Thay Đổi</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 4. Image Picker Bottom Modal */}
      <Modal
        visible={pickerModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => closeModal()}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => closeModal()}
        >
          <Animated.View
            style={[
              styles.pickerModalCard,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <Text style={styles.pickerModalTitle}>Chọn ảnh đại diện</Text>

              <TouchableOpacity
                style={styles.pickerOptionBtn}
                onPress={() => closeModal(handlePickCamera)}
                activeOpacity={0.8}
              >
                <View style={[styles.pickerIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="camera" size={22} color="#0284C7" />
                </View>
                <Text style={styles.pickerOptionText}>Chụp ảnh mới</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pickerOptionBtn}
                onPress={() => closeModal(handlePickLibrary)}
                activeOpacity={0.8}
              >
                <View style={[styles.pickerIconCircle, { backgroundColor: '#E6FFFA' }]}>
                  <Ionicons name="images" size={22} color="#0D9488" />
                </View>
                <Text style={styles.pickerOptionText}>Chọn từ thư viện ảnh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pickerCancelBtn}
                onPress={() => closeModal()}
                activeOpacity={0.8}
              >
                <Text style={styles.pickerCancelText}>Hủy</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
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
    paddingBottom: 40,
    paddingTop: 10,
  },

  // 1. Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginVertical: 18,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarGlowBorder: {
    width: 108,
    height: 108,
    borderRadius: 54,
    padding: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#00A896',
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '900',
    color: '#00A896',
  },
  cameraBadgeBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#00A896',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  changeAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00A896',
    marginTop: 2,
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  levelPillIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  levelPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },

  // 2. Form Card
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 50,
  },
  inputContainerDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    height: '100%',
  },
  textInputDisabled: {
    color: '#64748B',
  },

  // 3. Save Button
  saveButton: {
    backgroundColor: '#00A896',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // 4. Image Picker Modal (Android)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  pickerModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  pickerModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 18,
  },
  pickerOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  pickerOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  pickerCancelBtn: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  pickerCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
});
