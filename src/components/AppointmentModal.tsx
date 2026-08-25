import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { extractAppointmentFromMessageWithGemini } from '../services/geminiService';
import { createAndSaveAppointment, AppointmentPayload } from '../services/appointmentService';

interface AppointmentModalProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  creatorId: string;
  creatorName: string;
  partnerId: string;
  partnerName: string;
  initialMessageText?: string;
  onSuccess: (appointment: AppointmentPayload) => void;
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  visible,
  onClose,
  chatId,
  creatorId,
  creatorName,
  partnerId,
  partnerName,
  initialMessageText = '',
  onSuccess,
}) => {
  const [loadingAi, setLoadingAi] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('Hẹn gặp trao trả đồ');
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [locationText, setLocationText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [isoStart, setIsoStart] = useState('');
  const [isoEnd, setIsoEnd] = useState('');

  // When modal opens, run AI extraction if initialMessageText exists
  useEffect(() => {
    if (visible) {
      if (initialMessageText && initialMessageText.trim()) {
        setLoadingAi(true);
        extractAppointmentFromMessageWithGemini(initialMessageText)
          .then((res) => {
            setTitle(res.title);
            setDateText(res.dateText);
            setTimeText(res.timeText);
            setLocationText(res.locationText);
            setNoteText(res.noteText);
            setIsoStart(res.isoStart);
            setIsoEnd(res.isoEnd);
            setLoadingAi(false);
          })
          .catch(() => {
            setLoadingAi(false);
            setDefaultDateTime();
          });
      } else {
        setDefaultDateTime();
      }
    }
  }, [visible, initialMessageText]);

  const setDefaultDateTime = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    setDateText(today);
    setTimeText('15:00');
    setLocationText('');
    setNoteText('Nhớ mang theo giấy tờ tùy thân để đối chiếu.');
    const startStr = `${today.replace(/-/g, '')}T150000`;
    const endStr = `${today.replace(/-/g, '')}T160000`;
    setIsoStart(startStr);
    setIsoEnd(endStr);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Thiếu tiêu đề', 'Vui lòng nhập tiêu đề cuộc hẹn.');
      return;
    }
    if (!locationText.trim()) {
      Alert.alert('Thiếu địa điểm', 'Vui lòng nhập địa điểm hẹn gặp.');
      return;
    }

    try {
      setSaving(true);
      const cleanDate = dateText.trim().replace(/-/g, '');
      const cleanTime = timeText.trim().replace(/:/g, '');
      const finalIsoStart = isoStart || `${cleanDate}T${cleanTime}00`;
      const finalIsoEnd = isoEnd || `${cleanDate}T${String(Number(cleanTime.slice(0, 2)) + 1).padStart(2, '0')}${cleanTime.slice(2, 4)}00`;

      const appointment = await createAndSaveAppointment({
        chatId,
        creatorId,
        creatorName,
        partnerId,
        partnerName,
        title: title.trim(),
        dateText: dateText.trim(),
        timeText: timeText.trim(),
        locationText: locationText.trim(),
        noteText: noteText.trim(),
        isoStart: finalIsoStart,
        isoEnd: finalIsoEnd,
      });

      setSaving(false);
      onSuccess(appointment);
      onClose();
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Lỗi', e.message || 'Không thể tạo cuộc hẹn.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="calendar" size={22} color="#00A896" style={{ marginRight: 8 }} />
              <Text style={styles.headerTitle}>Tạo Nhắc Hẹn Gặp Mặt</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {loadingAi ? (
              <View style={styles.aiLoadingBox}>
                <ActivityIndicator size="small" color="#00A896" />
                <Text style={styles.aiLoadingText}>
                  Gemini AI đang tự động trích xuất ngày, giờ, địa điểm từ tin nhắn...
                </Text>
              </View>
            ) : initialMessageText ? (
              <View style={styles.aiDetectedTipBox}>
                <Ionicons name="sparkles" size={16} color="#00A896" style={{ marginRight: 6 }} />
                <Text style={styles.aiDetectedTipText}>
                  Đã tự động điền thông tin từ tin nhắn bằng Gemini AI. Bạn có thể chỉnh sửa nếu cần!
                </Text>
              </View>
            ) : null}

            {/* Title Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Tiêu đề cuộc hẹn:</Text>
              <TextInput
                style={styles.input}
                placeholder="Ví dụ: Hẹn nhận lại thẻ sinh viên"
                placeholderTextColor="#94A3B8"
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Date & Time Row */}
            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Ngày hẹn (YYYY-MM-DD):</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2026-08-26"
                  placeholderTextColor="#94A3B8"
                  value={dateText}
                  onChangeText={setDateText}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Giờ hẹn (HH:mm):</Text>
                <TextInput
                  style={styles.input}
                  placeholder="15:00"
                  placeholderTextColor="#94A3B8"
                  value={timeText}
                  onChangeText={setTimeText}
                />
              </View>
            </View>

            {/* Location Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Địa điểm gặp mặt:</Text>
              <TextInput
                style={styles.input}
                placeholder="Ví dụ: Cổng số 1 Đại học Sư Phạm Kỹ Thuật"
                placeholderTextColor="#94A3B8"
                value={locationText}
                onChangeText={setLocationText}
              />
            </View>

            {/* Note Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Ghi chú thêm:</Text>
              <TextInput
                style={[styles.input, { minHeight: 64, textAlignVertical: 'top' }]}
                placeholder="Ghi chú nhắc nhở đối chiếu giấy tờ, màu áo..."
                placeholderTextColor="#94A3B8"
                value={noteText}
                onChangeText={setNoteText}
                multiline
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="calendar-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.saveBtnText}>Tạo Nhắc Hẹn & Gửi Vào Chat</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
  },
  aiLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  aiLoadingText: {
    flex: 1,
    fontSize: 12.5,
    color: '#166534',
    marginLeft: 8,
    lineHeight: 18,
  },
  aiDetectedTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  aiDetectedTipText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  formGroup: {
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00A896',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    shadowColor: '#00A896',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
