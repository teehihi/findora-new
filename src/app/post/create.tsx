import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { analyzeImageWithGemini } from '../../services/geminiService';
import { createPost, uploadImageToStorage } from '../../services/firebaseService';
import { HeaderBar } from '../../components/HeaderBar';
import { auth } from '../../config/firebase';
import { COLORS, SPACING } from '../../constants/theme';

export default function CreatePostScreen() {
  const router = useRouter();
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('56 Hoàng Diệu 2, Phường Linh Chiểu, Thủ Đức, TP.HCM');
  const [lat, setLat] = useState<number>(10.8505);
  const [lng, setLng] = useState<number>(106.7717);
  const [rewardPoints, setRewardPoints] = useState('50');
  const [contactPhone, setContactPhone] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageLabel, setImageLabel] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0.85);

  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
          quality: 0.8,
          base64: true
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          base64: true
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        if (asset.base64) {
          setImageBase64(asset.base64);
          // Run Gemini AI Analysis
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
        const path = `posts/${currentUser.uid}_${Date.now()}.jpg`;
        uploadedUrl = await uploadImageToStorage(imageUri, path);
      }

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
        confidence,
        rewardPoints: parseInt(rewardPoints) || 0,
        contactPhone: contactPhone.trim(),
        status: 'active'
      });

      setSubmitting(false);
      Alert.alert('Thành công 🎉', 'Bài đăng của bạn đã được tạo thành công!');
      router.back();
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert('Lỗi', e.message || 'Không thể tạo bài đăng.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar title="Tạo Bài Đăng Mới" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Lost / Found Selector */}
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBox, type === 'lost' && styles.typeBoxActiveLost]}
            onPress={() => setType('lost')}
          >
            <Text style={[styles.typeText, type === 'lost' && styles.typeTextActive]}>
              🔴 BÁO MẤT ĐỒ
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeBox, type === 'found' && styles.typeBoxActiveFound]}
            onPress={() => setType('found')}
          >
            <Text style={[styles.typeText, type === 'found' && styles.typeTextActive]}>
              🟢 BÁO NHẶT ĐƯỢC
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

          {/* AI Banner Status */}
          {aiAnalyzing ? (
            <View style={styles.aiAnalyzingBox}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.aiAnalyzingText}>Gemini AI đang phân tích hình ảnh...</Text>
            </View>
          ) : imageLabel ? (
            <View style={styles.aiResultBox}>
              <Ionicons name="sparkles" size={16} color={COLORS.primary} />
              <Text style={styles.aiResultText}>
                Đã tự động nhận diện: <Text style={{ fontWeight: '800' }}>{imageLabel}</Text> ({Math.round(confidence * 100)}%)
              </Text>
            </View>
          ) : null}
        </View>

        {/* Form Controls */}
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

          <Text style={styles.label}>Địa chỉ / Vị trí</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
          />

          <View style={styles.rowTwoCols}>
            <View style={{ flex: 1, marginRight: SPACING.sm }}>
              <Text style={styles.label}>Điểm thưởng (P)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
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
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handleSubmit} 
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Đăng Bài Ngay</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    backgroundColor: '#E2E8F0',
    alignItems: 'center'
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
    height: 100,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC'
  },
  pickerText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 4
  },
  imagePreviewWrapper: {
    position: 'relative'
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 14
  },
  removeImgBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  aiAnalyzingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: SPACING.sm
  },
  aiAnalyzingText: {
    fontSize: 12,
    color: COLORS.primaryDark,
    marginLeft: 6,
    fontWeight: '600'
  },
  aiResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: SPACING.sm
  },
  aiResultText: {
    fontSize: 12,
    color: '#B45309',
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
  rowTwoCols: {
    flexDirection: 'row'
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: SPACING.xl
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF'
  }
});
