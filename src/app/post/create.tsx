import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AnimatedSuccessCheckmark } from '../../components/AnimatedSuccessCheckmark';
import { GoogleAILoader } from '../../components/GoogleAILoader';
import { HeaderBar } from '../../components/HeaderBar';
import { auth } from '../../config/firebase';
import { COLORS, SPACING } from '../../constants/theme';
import { createPost, uploadImageToStorage } from '../../services/firebaseService';
import { analyzeImageWithGemini } from '../../services/geminiService';
import { clearPostDraft, getPostDraft, updatePostDraft } from '../../services/postDraftService';
import { getDisplayCategory } from '../../utils/categoryUtils';

export default function CreatePostScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ selectedAddress?: string; selectedLat?: string; selectedLng?: string }>();

  const draft = getPostDraft();

  const [type, setType] = useState<'lost' | 'found'>(draft.type);
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [address, setAddress] = useState(draft.address);
  const [lat, setLat] = useState<number>(draft.lat);
  const [lng, setLng] = useState<number>(draft.lng);

  const [rewardPoints, setRewardPoints] = useState(draft.rewardPoints);
  const [contactPhone, setContactPhone] = useState(draft.contactPhone);
  const [imageUri, setImageUri] = useState<string | null>(draft.imageUri);
  const [imageBase64, setImageBase64] = useState<string | null>(draft.imageBase64);
  const [imageLabel, setImageLabel] = useState<string>(draft.imageLabel);
  const [confidence, setConfidence] = useState<number>(draft.confidence);

  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loadingDots, setLoadingDots] = useState('.');

  // Cycle dots: . -> .. -> ... -> .
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

  const isNavigatingToMapRef = useRef(false);

  // Check if form contains any user-entered content
  const hasUnsavedContent = Boolean(
    title.trim() || description.trim() || imageUri || contactPhone.trim() || address.trim()
  );

  // Sync state changes to global in-memory draft
  const handleTypeChange = (newType: 'lost' | 'found') => {
    setType(newType);
    updatePostDraft({ type: newType });
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    updatePostDraft({ title: val });
  };

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    updatePostDraft({ description: val });
  };

  const handleRewardPointsChange = (val: string) => {
    setRewardPoints(val);
    updatePostDraft({ rewardPoints: val });
  };

  const handleContactPhoneChange = (val: string) => {
    setContactPhone(val);
    updatePostDraft({ contactPhone: val });
  };

  // Sync latest address from draft whenever screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      const current = getPostDraft();
      if (current.address) {
        setAddress(current.address);
        setLat(current.lat);
        setLng(current.lng);
      }
      isNavigatingToMapRef.current = false;
    }, [])
  );

  // Sync params from location confirmation screen
  useEffect(() => {
    if (params?.selectedAddress) {
      setAddress(params.selectedAddress);
      updatePostDraft({ address: params.selectedAddress });
    }
    if (params?.selectedLat && params?.selectedLng) {
      const pLat = parseFloat(params.selectedLat);
      const pLng = parseFloat(params.selectedLng);
      setLat(pLat);
      setLng(pLng);
      updatePostDraft({ lat: pLat, lng: pLng });
    }
  }, [params?.selectedAddress, params?.selectedLat, params?.selectedLng]);

  // Disable native iOS modal swipe-down when form has unsaved content
  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !hasUnsavedContent,
    });
  }, [navigation, hasUnsavedContent]);

  // Confirm exit back to home tab cleanly
  const handleExitConfirm = () => {
    if (!hasUnsavedContent) {
      clearPostDraft();
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
      return;
    }

    Alert.alert(
      'Hủy tạo bài đăng?',
      'Nội dung đang soạn sẽ không được lưu. Bạn có chắc chắn muốn quay về Trang chủ không?',
      [
        { text: 'Tiếp tục soạn', style: 'cancel' },
        {
          text: 'Thoát',
          style: 'destructive',
          onPress: () => {
            clearPostDraft();
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }
        }
      ]
    );
  };

  // Android hardware back handler
  useEffect(() => {
    const backAction = () => {
      if (hasUnsavedContent) {
        handleExitConfirm();
        return true;
      }
      clearPostDraft();
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [hasUnsavedContent]);

  // Pick image from gallery or camera
  const handlePickImage = async (useCamera: boolean = false) => {
    try {
      let result;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền sử dụng camera.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5,
          base64: true
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5,
          base64: true
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        updatePostDraft({ imageUri: asset.uri });
        if (asset.base64) {
          setImageBase64(asset.base64);
          updatePostDraft({ imageBase64: asset.base64 });
          runGeminiAnalysis(asset.base64);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const runGeminiAnalysis = async (base64: string) => {
    try {
      setAiAnalyzing(true);
      const res = await analyzeImageWithGemini(base64, type);
      setTitle(res.title);
      setDescription(res.description);
      setImageLabel(res.imageLabel);
      setConfidence(res.confidence);
      updatePostDraft({
        title: res.title,
        description: res.description,
        imageLabel: res.imageLabel,
        confidence: res.confidence,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ Tiêu đề và Mô tả bài đăng.');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Yêu cầu đăng nhập', 'Vui lòng đăng nhập để tạo bài đăng.');
      return;
    }

    try {
      setSubmitting(true);
      let uploadedUrl = '';

      if (imageUri) {
        const path = `post_images/${currentUser.uid}_${Date.now()}.jpg`;
        uploadedUrl = await uploadImageToStorage(imageUri, path);
      }

      const catInfo = getDisplayCategory({ imageLabel, title, description });

      await createPost({
        title: title.trim(),
        description: description.trim(),
        type,
        userId: currentUser.uid,
        imageUrl: uploadedUrl,
        lat,
        lng,
        address,
        imageLabel,
        category: catInfo.name,
        confidence,
        rewardPoints: type === 'lost' ? (parseInt(rewardPoints) || 0) : 0,
        contactPhone: contactPhone.trim(),
        status: 'active'
      });

      setSubmitting(false);
      setShowSuccessModal(true);
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert('Lỗi', e.message || 'Không thể tạo bài đăng.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <HeaderBar title="Tạo Bài Đăng Mới" showBack onBackPress={handleExitConfirm} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Lost / Found Selector */}
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBox, type === 'lost' && styles.typeBoxActiveLost]}
            onPress={() => handleTypeChange('lost')}
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
            onPress={() => handleTypeChange('found')}
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

        {/* Image Picker Section */}
        <View style={styles.imageSection}>
          {imageUri ? (
            <View style={styles.imagePreviewWrapper}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.removeImgBtn} onPress={() => { setImageUri(null); setImageLabel(''); }}>
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

        {/* Form Controls */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Tiêu đề bài đăng</Text>
          <TextInput
            style={styles.input}
            placeholder="Ví dụ: Mất ví da màu nâu tại Linh Chiểu"
            value={title}
            onChangeText={handleTitleChange}
          />

          <Text style={styles.label}>Mô tả chi tiết</Text>
          <TextInput
            style={[styles.input, { height: 90 }]}
            placeholder="Mô tả đặc điểm, nhãn hiệu, giấy tờ bên trong..."
            multiline
            value={description}
            onChangeText={handleDescriptionChange}
          />

          <Text style={styles.label}>Vị trí</Text>
          <TouchableOpacity
            style={[styles.locationSelectBtn, address ? styles.locationSelectedBtn : null]}
            onPress={() => {
              isNavigatingToMapRef.current = true;
              router.push('/post/select-location');
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
                  onChangeText={handleRewardPointsChange}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Số điện thoại liên hệ</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="phone-pad"
                  placeholder="0901234567"
                  value={contactPhone}
                  onChangeText={handleContactPhoneChange}
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
                onChangeText={handleContactPhoneChange}
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
            <Text style={styles.submitBtnText}>Đăng Bài Ngay</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Floating Fullscreen AI Analyzing Modal Overlay */}
      <Modal visible={aiAnalyzing} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.aiModalOverlay}>
          <View style={styles.aiModalCard}>
            {/* Google 4-Color Floating Spheres Loader */}
            <GoogleAILoader size={80} />

            <Text style={styles.aiModalTitle}>Gemini AI đang phân tích ảnh{loadingDots}</Text>
            <Text style={styles.aiModalSubtitle}>
              Hệ thống đang tự động nhận diện đồ vật, trích xuất thông tin và tạo tiêu đề cho bài đăng của bạn.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Floating Fullscreen Success Modal Overlay */}
      <Modal visible={showSuccessModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.aiModalOverlay}>
          <View style={styles.successModalCard}>
            {/* SVG Animated Spinning Arc into Checkmark */}
            <AnimatedSuccessCheckmark size={88} />

            <Text style={styles.successModalTitle}>Đăng Bài Thành Công!</Text>
            <Text style={styles.successModalSubtitle}>
              Bài đăng của bạn đã được đăng tải lên Findora. Hệ thống sẽ thông báo ngay khi có người tìm thấy hoặc kết nối phù hợp.
            </Text>

            {type === 'lost' && parseInt(rewardPoints) > 0 && (
              <View style={styles.successRewardBadge}>
                <Ionicons name="gift-outline" size={16} color="#B45309" style={{ marginRight: 6 }} />
                <Text style={styles.successRewardText}>
                  Thưởng người tìm thấy: <Text style={{ fontWeight: '800' }}>+{rewardPoints} P</Text>
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.successDoneBtn}
              onPress={() => {
                setShowSuccessModal(false);
                clearPostDraft();
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)');
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.successDoneBtnText}>Hoàn Tất</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  scrollContent: {
    padding: SPACING.md
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: SPACING.md
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
    backgroundColor: '#EF4444'
  },
  typeBoxActiveFound: {
    backgroundColor: '#10B981'
  },
  typeText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted
  },
  typeTextActive: {
    color: '#FFFFFF'
  },
  imageSection: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  imagePickerRow: {
    flexDirection: 'row',
    gap: 12
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
    backgroundColor: '#F8FAFC'
  },
  pickerText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8
  },
  imagePreviewWrapper: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden'
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 16
  },
  removeImgBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4
  },
  aiAnalyzingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: SPACING.sm,
    borderRadius: 10,
    marginTop: SPACING.sm
  },
  aiAnalyzingText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
    marginLeft: 8
  },
  aiResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: SPACING.sm,
    borderRadius: 10,
    marginTop: SPACING.sm
  },
  aiResultText: {
    fontSize: 12,
    color: '#D97706',
    marginLeft: 6
  },
  formSection: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
    marginTop: SPACING.xs
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.sm
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
    flexDirection: 'row'
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  aiModalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
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
  },
  successModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  successIconContainer: {
    position: 'relative',
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successHaloRing: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#34D399',
  },
  successIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#A7F3D0',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  successModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  successModalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  successRewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  successRewardText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
  },
  successDoneBtn: {
    width: '100%',
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successDoneBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
