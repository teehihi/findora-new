import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { LocationPayload } from '../models/types';

interface ExternalMapsPickerModalProps {
  visible: boolean;
  destination: LocationPayload | null;
  userLocation: { latitude: number; longitude: number } | null;
  onClose: () => void;
}

export const ExternalMapsPickerModal: React.FC<ExternalMapsPickerModalProps> = ({
  visible,
  destination,
  userLocation,
  onClose,
}) => {
  if (!destination) return null;

  const destLat = destination.latitude;
  const destLng = destination.longitude;
  const destLabel = encodeURIComponent(destination.name || destination.address || 'Điểm hẹn');

  const openGoogleMaps = () => {
    onClose();
    const originParam = userLocation ? `&origin=${userLocation.latitude},${userLocation.longitude}` : '';
    const googleWebUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}${originParam}&travelmode=driving`;
    const googleAppUrl = `comgooglemaps://?daddr=${destLat},${destLng}&directionsmode=driving`;

    Linking.canOpenURL(googleAppUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(googleAppUrl);
        } else {
          Linking.openURL(googleWebUrl);
        }
      })
      .catch(() => Linking.openURL(googleWebUrl));
  };

  const openAppleMaps = () => {
    onClose();
    const originParam = userLocation ? `saddr=${userLocation.latitude},${userLocation.longitude}&` : '';
    const appleMapsUrl = `maps:?${originParam}daddr=${destLat},${destLng}&q=${destLabel}`;
    Linking.openURL(appleMapsUrl).catch(() => openGoogleMaps());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.dragHandle} />
              
              <Text style={styles.sheetTitle}>Mở bằng bản đồ ngoài</Text>
              <Text style={styles.sheetSubtitle}>
                Chuyển lộ trình sang ứng dụng bản đồ trên thiết bị
              </Text>

              {/* Google Maps Option */}
              <TouchableOpacity
                style={styles.optionBtn}
                onPress={openGoogleMaps}
                activeOpacity={0.75}
              >
                <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="navigate-circle" size={24} color="#1A73E8" />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionName}>Google Maps</Text>
                  <Text style={styles.optionDesc}>Chỉ đường vệ tinh & giao thông trực tiếp</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              {/* Apple Maps Option (on iOS or if supported) */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.optionBtn}
                  onPress={openAppleMaps}
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="map" size={22} color="#0F172A" />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={styles.optionName}>Apple Maps</Text>
                    <Text style={styles.optionDesc}>Bản đồ mặc định trên thiết bị Apple</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}

              {/* Cancel Button */}
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
});
