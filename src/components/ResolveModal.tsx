import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { completePostResolve } from '../services/firebaseService';

interface ResolveModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
  postTitle: string;
  onSuccess: () => void;
}

export const ResolveModal: React.FC<ResolveModalProps> = ({
  visible,
  onClose,
  postId,
  postTitle,
  onSuccess
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [inputOtp, setInputOtp] = useState<string>('');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [helperEmailOrPhone, setHelperEmailOrPhone] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Step 1: Generate OTP for verification
  const handleStartHandover = () => {
    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(randomOtp);
    setStep(2);
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = () => {
    if (inputOtp.trim() !== generatedOtp) {
      Alert.alert('Lỗi xác thực', 'Mã OTP không chính xác. Vui lòng thử lại!');
      return;
    }
    setStep(3);
  };

  // Step 3: Complete resolve and award points
  const handleFinalSubmit = async () => {
    try {
      setLoading(true);
      // Execute post status update & points award
      await completePostResolve(
        postId,
        helperEmailOrPhone || 'helper_user',
        rating,
        comment,
        50
      );
      setLoading(false);
      Alert.alert('Thành công 🎉', 'Đã xác nhận trao trả đồ thành công!');
      onSuccess();
      onClose();
      // Reset state
      setStep(1);
      setInputOtp('');
      setComment('');
    } catch (e) {
      setLoading(false);
      Alert.alert('Lỗi', 'Không thể hoàn tất xác nhận.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>

          {step === 1 && (
            <View>
              <Text style={styles.title}>Xác Nhận Trao Trả Đồ 🤝</Text>
              <Text style={styles.subtitle}>
                Quy trình 3 bước xác thực an toàn bằng OTP khi gặp mặt trao trả đồ "{postTitle}"
              </Text>
              
              <TextInput
                style={styles.input}
                placeholder="Nhập Email hoặc SĐT người trao trả/nhận đồ"
                value={helperEmailOrPhone}
                onChangeText={setHelperEmailOrPhone}
              />

              <TouchableOpacity style={styles.primaryBtn} onPress={handleStartHandover}>
                <Text style={styles.btnText}>Tạo mã OTP xác nhận</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.title}>Bước 2: Nhập Mã OTP 🔑</Text>
              <Text style={styles.subtitle}>
                Vui lòng bảo người đối diện đọc mã OTP 6 số hiển thị dưới đây để xác nhận trực tiếp:
              </Text>

              <View style={styles.otpBox}>
                <Text style={styles.otpText}>{generatedOtp}</Text>
              </View>

              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="--- ---"
                keyboardType="number-pad"
                maxLength={6}
                value={inputOtp}
                onChangeText={setInputOtp}
              />

              <TouchableOpacity style={styles.primaryBtn} onPress={handleVerifyOtp}>
                <Text style={styles.btnText}>Xác nhận OTP</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.title}>Bước 3: Đánh Giá & Thưởng 🌟</Text>
              <Text style={styles.subtitle}>
                Hãy để lại lời cảm ơn và đánh giá để hỗ trợ cộng đồng Findora!
              </Text>

              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setRating(star)}>
                    <Ionicons
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={32}
                      color={COLORS.gold}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.input, { height: 80 }]}
                placeholder="Viết lời cảm ơn..."
                multiline
                value={comment}
                onChangeText={setComment}
              />

              <TouchableOpacity 
                style={styles.primaryBtn} 
                onPress={handleFinalSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnText}>Hoàn tất & Thưởng 50 điểm</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  content: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: SPACING.xs
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.xs
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: SPACING.md
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: SPACING.md
  },
  otpBox: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: SPACING.md
  },
  otpText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
    color: COLORS.primaryDark
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 8
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: SPACING.md
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.xs
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
