import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { HeaderBar } from '../../components/HeaderBar';
import { GoogleAILoader } from '../../components/GoogleAILoader';
import { PostFormSkeleton } from '../../components/PostFormSkeleton';
import { fetchPostById, updatePost, uploadImageToStorage } from '../../services/firebaseService';
import { analyzeImageWithGemini } from '../../services/geminiService';
import { getDisplayCategory } from '../../utils/categoryUtils';
import { auth } from '../../config/firebase';
import { COLORS, SPACING } from '../../constants/theme';
import { Post } from '../../models/types';

export default function EditPostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    selectedAddress?: string;
    selectedLat?: string;
    selectedLng?: string;
  }>();
  const postId = params.id;

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [loadingDots, setLoadingDots] = useState('.');

  // Form State
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [rewardPoints, setRewardPoints] = useState('0');
  const [contactPhone, setContactPhone] = useState('');

  // Image State
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageLabel, setImageLabel] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0.9);
  const [isImageChanged, setIsImageChanged] = useState(false);

  const isNavigatingToMapRef = useRef(false);

  // Dynamic animated loading dots
  useEffect(() => {
    if (aiAnalyzing) {
      let count = 0;
      const interval = setInterval(() => {
        count = (count + 1) % 3;
        setLoadingDots('.'.repeat(count + 1));
      }, 400);
      return () => clearInterval(interval);
    }
  }, [aiAnalyzing]);

  // Load existing post data
  useEffect(() => {
    if (!postId) {
      Alert.alert('Lỗi', 'Không tìm thấy mã bài đăng.');
      router.back();
      return;
    }

    fetchPostById(postId).then((data) => {
      if (data) {
        if (auth.currentUser && data.userId && data.userId !== auth.currentUser.uid) {
          Alert.alert('Từ chối truy cập', 'Bạn không có quyền chỉnh sửa bài đăng này.');
          router.back();
          return;
        }

        setType(data.type || 'lost');
        setTitle(data.title || '');
        setDescription(data.description || '');
        setAddress(data.address || '');
        setLat(data.lat ?? undefined);
        setLng(data.lng ?? undefined);
        setRewardPoints(data.rewardPoints ? data.rewardPoints.toString() : '0');
        setContactPhone(data.contactPhone || '');
        setImageUri(data.imageUrl || null);
        setImageLabel(data.imageLabel || '');
        setConfidence(data.confidence || 0.9);
      } else {
        Alert.alert('Lỗi', 'Bài đăng không tồn tại hoặc đã bị xóa.');
        router.back();
      }
      setLoadingInitial(false);
    });
  }, [postId]);

  // Handle map selection returns
  useEffect(() => {
    if (params.selectedAddress) {
      setAddress(params.selectedAddress);
    }
    if (params.selectedLat && params.selectedLng) {
      setLat(parseFloat(params.selectedLat));
      setLng(parseFloat(params.selectedLng));
    }
  }, [params.selectedAddress, params.selectedLat, params.selectedLng]);

  const handlePickImage = async (useCamera: boolean) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Cần cấp quyền', 'Vui lòng cho phép ứng dụng truy cập máy ảnh.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.5,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Cần cấp quyền', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.5,
          base64: true,
        });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setIsImageChanged(true);

        if (asset.base64) {
          Alert.alert(
            'Phân tích ảnh mới bằng AI?',
            'Bạn có muốn Gemini AI quét lại hình ảnh mới để tự động cập nhật lại Tiêu đề & Mô tả không?',
            [
              { text: 'Giữ nguyên văn bản', style: 'cancel' },
              {
                text: 'Quét lại bằng AI',
                onPress: async () => {
                  try {
                    setAiAnalyzing(true);
                    const res = await analyzeImageWithGemini(asset.base64!, type, 'image/jpeg');
                    if (res) {
                      if (res.title) setTitle(res.title);
                      if (res.description) setDescription(res.description);
                      if (res.imageLabel) setImageLabel(res.imageLabel);
                      if (res.confidence) setConfidence(res.confidence);
                    }
                  } catch (e) {
                    console.error('AI Re-analysis error:', e);
                  } finally {
                    setAiAnalyzing(false);
                  }
                },
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh. Vui lòng thử lại.');
    }
  };

  const handleSubmit = async () => {
    if (!postId) return;
    if (!title.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề bài đăng.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả chi tiết.');
      return;
    }

    try {
      setSubmitting(true);
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Lỗi', 'Vui lòng đăng nhập lại.');
        return;
      }

      let finalImageUrl = imageUri || '';

      if (isImageChanged && imageUri) {
        finalImageUrl = await uploadImageToStorage(imageUri, user.uid);
      }

      const catInfo = getDisplayCategory({ imageLabel, title, description });

      const updatedFields: Partial<Post> = {
        type,
        title: title.trim(),
        description: description.trim(),
        imageUrl: finalImageUrl,
        imageLabel: imageLabel || 'item',
        category: catInfo.name,
        confidence: confidence || 0.9,
        address: address.trim() || 'Thành phố Hồ Chí Minh',
        lat: lat || 10.762622,
        lng: lng || 106.660172,
        rewardPoints: type === 'lost' ? parseInt(rewardPoints || '0', 10) || 0 : 0,
        contactPhone: contactPhone.trim(),
      };

      await updatePost(postId, updatedFields);
      Alert.alert('Thành công', 'Bài đăng đã được cập nhật thành công!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error saving post updates:', error);
      Alert.alert('Lỗi', 'Không thể lưu thay đổi. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return <PostFormSkeleton title="Chỉnh Sửa Bài Đăng" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <HeaderBar title="Chỉnh Sửa Bài Đăng" showBack onBackPress={() => router.back()} />

      <ScrollView
        style={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Type Switcher: Lost vs Found (Identical to Create Post) */}
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBox, type === 'lost' && styles.typeBoxActiveLost]}
            onPress={() => setType('lost')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={type === 'lost' ? '#FFFFFF' : '#EF4444'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.typeText, type === 'lost' && styles.typeTextActive]}>
              BÁO MẤT ĐỒ
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeBox, type === 'found' && styles.typeBoxActiveFound]}
            onPress={() => setType('found')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={type === 'found' ? '#FFFFFF' : '#10B981'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.typeText, type === 'found' && styles.typeTextActive]}>
              BÁO NHẶT ĐƯỢC
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. Image Picker Section (Identical to Create Post) */}
        <View style={styles.imageSection}>
          {imageUri ? (
            <View style={styles.imagePreviewWrapper}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImgBtn}
                onPress={() => {
                  setImageUri(null);
                  setImageLabel('');
                  setIsImageChanged(true);
                }}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imagePickerRow}>
              <TouchableOpacity style={styles.pickerBox} onPress={() => handlePickImage(true)}>
                <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
                <Text style={styles.pickerText}>Chụp ảnh</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.pickerBox} onPress={() => handlePickImage(false)}>
                <Ionicons name="images-outline" size={32} color={COLORS.primary} />
                <Text style={styles.pickerText}>Chọn từ thư viện</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 3. Form Controls (Identical to Create Post) */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Tiêu đề bài đăng</Text>
          <TextInput
            style={styles.input}
            placeholder="Ví dụ: Mất ví da màu nâu tại Linh Chiểu"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Mô tả chi tiết</Text>
          <TextInput
            style={[styles.input, { height: 90 }]}
            placeholder="Mô tả đặc điểm, nhãn hiệu, giấy tờ bên trong..."
            multiline
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.label}>Vị trí</Text>
          <TouchableOpacity
            style={[styles.locationSelectBtn, address ? styles.locationSelectedBtn : null]}
            onPress={() => {
              isNavigatingToMapRef.current = true;
              router.push({
                pathname: '/post/select-location',
                params: { returnScreen: 'post/edit' },
              });
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="location" size={24} color="#10B981" style={styles.locationIconDirect} />

            <View style={styles.locationContent}>
              {address ? (
                <>
                  <Text style={styles.locationMainText} numberOfLines={1}>
                    {address.split(',')[0]}
                  </Text>
                  {address.split(',').length > 1 && (
                    <Text style={styles.locationSubText} numberOfLines={1}>
                      {address.split(',').slice(1).join(', ').trim()}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.locationPlaceholderText}>
                  Chọn vị trí trên bản đồ...
                </Text>
              )}
            </View>

            <View style={styles.locationActionWrap}>
              {address ? (
                <Text style={styles.locationChangeText}>Đổi</Text>
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              )}
            </View>
          </TouchableOpacity>

          {type === 'lost' ? (
            <View style={styles.rowTwoCols}>
              <View style={{ flex: 1, marginRight: SPACING.sm }}>
                <Text style={styles.label}>Điểm thưởng (P)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="50"
                  value={rewardPoints}
                  onChangeText={setRewardPoints}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Số điện thoại liên hệ</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="phone-pad"
                  placeholder="0901234567"
                  value={contactPhone}
                  onChangeText={setContactPhone}
                />
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.label}>Số điện thoại liên hệ</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                placeholder="0901234567"
                value={contactPhone}
                onChangeText={setContactPhone}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Docked Fixed Bottom Action Button */}
      <View style={[styles.dockedBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || aiAnalyzing) && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting || aiAnalyzing}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Lưu Thay Đổi</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Floating Fullscreen AI Analyzing Modal */}
      <Modal visible={aiAnalyzing} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.aiModalOverlay}>
          <View style={styles.aiModalCard}>
            <GoogleAILoader size={80} />
            <Text style={styles.aiModalTitle}>Gemini AI đang phân tích ảnh{loadingDots}</Text>
            <Text style={styles.aiModalSubtitle}>
              Hệ thống đang cập nhật thông tin và tạo lại tiêu đề mới cho bài đăng.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: SPACING.md,
  },
  typeBox: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBoxActiveLost: {
    backgroundColor: '#EF4444',
  },
  typeBoxActiveFound: {
    backgroundColor: '#10B981',
  },
  typeText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  typeTextActive: {
    color: '#FFFFFF',
  },
  imageSection: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  imagePickerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerBox: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  pickerText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
  },
  imagePreviewWrapper: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 16,
  },
  removeImgBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  aiResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: SPACING.sm,
    borderRadius: 10,
    marginTop: SPACING.sm,
  },
  aiResultText: {
    fontSize: 12,
    color: '#D97706',
    marginLeft: 6,
  },
  formSection: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
    marginTop: SPACING.xs,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  locationSelectBtn: {
    minHeight: 54,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  locationSelectedBtn: {
    backgroundColor: '#F0FDF4',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  locationIconDirect: {
    marginRight: 10,
  },
  locationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  locationMainText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
  },
  locationSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  locationPlaceholderText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  locationActionWrap: {
    marginLeft: 8,
  },
  locationChangeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  rowTwoCols: {
    flexDirection: 'row',
  },
  dockedBottomBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  aiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  aiModalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  aiModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  aiModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
});
