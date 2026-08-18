import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
  Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentAddressFromGPS } from '../../services/firebaseService';
import { COLORS, SPACING } from '../../constants/theme';

interface LocationItem {
  code: number | string;
  name: string;
}

// Fallback Vietnam Provinces matching Findora AddressPickerActivity
const POPULAR_PROVINCES: LocationItem[] = [
  { code: '79', name: 'Thành phố Hồ Chí Minh' },
  { code: '01', name: 'Thành phố Hà Nội' },
  { code: '48', name: 'Thành phố Đà Nẵng' },
  { code: '74', name: 'Tỉnh Bình Dương' },
  { code: '75', name: 'Tỉnh Đồng Nai' },
  { code: '92', name: 'Thành phố Cần Thơ' },
  { code: '31', name: 'Thành phố Hải Phòng' },
  { code: '77', name: 'Tỉnh Bà Rịa - Vũng Tàu' },
  { code: '68', name: 'Tỉnh Lâm Đồng' },
  { code: '56', name: 'Tỉnh Khánh Hòa' },
];

export default function SelectLocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Address Selection States (New Administrative Boundaries: Province + Commune/Ward)
  const [provinces, setProvinces] = useState<LocationItem[]>(POPULAR_PROVINCES);
  const [selectedProvince, setSelectedProvince] = useState<LocationItem | null>(null);

  const [wards, setWards] = useState<LocationItem[]>([]);
  const [selectedWard, setSelectedWard] = useState<LocationItem | null>(null);

  const [streetAddress, setStreetAddress] = useState('');
  const [loadingWards, setLoadingWards] = useState(false);

  // Picker Modal States
  const [modalType, setModalType] = useState<'province' | 'ward' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch full provinces list matching Findora AddressPickerActivity (addresskit.cas.so)
  useEffect(() => {
    fetch('https://addresskit.cas.so/api/latest/provinces')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.provinces) && data.provinces.length > 0) {
          const formatted: LocationItem[] = data.provinces.map((item: any) => ({
            code: item.code,
            name: item.name,
          }));
          setProvinces(formatted);
        }
      })
      .catch((err) => console.log('Provinces fetch err:', err));
  }, []);

  // Fetch communes/wards directly for selected province (addresskit.cas.so)
  useEffect(() => {
    if (!selectedProvince) {
      setWards([]);
      setSelectedWard(null);
      return;
    }
    setLoadingWards(true);
    fetch(`https://addresskit.cas.so/api/latest/provinces/${selectedProvince.code}/communes`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.communes)) {
          const list: LocationItem[] = data.communes.map((item: any) => ({
            code: item.code,
            name: item.name,
          }));
          setWards(list);
        }
      })
      .catch((err) => console.log('Communes fetch err:', err))
      .finally(() => setLoadingWards(false));
  }, [selectedProvince]);

  // Normalize GPS abbreviated names to full names matching API data
  const normalizeGpsName = (name: string): string => {
    const abbreviations: [RegExp, string][] = [
      [/^X\.\s*/i, 'Xã '],
      [/^P\.\s*/i, 'Phường '],
      [/^TT\.\s*/i, 'Thị trấn '],
      [/^TP\.\s*/i, 'Thành phố '],
      [/^Q\.\s*/i, 'Quận '],
      [/^H\.\s*/i, 'Huyện '],
      [/^TX\.\s*/i, 'Thị xã '],
    ];
    for (const [pattern, full] of abbreviations) {
      if (pattern.test(name)) {
        return name.replace(pattern, full).trim();
      }
    }
    return name.trim();
  };

  // Handle GPS location click & auto-fill fields below for user review
  const handleGetGpsLocation = async () => {
    try {
      setLoadingGps(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập vị trí.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (loc?.coords) {
        setGpsCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }

      const fullAddr = await getCurrentAddressFromGPS();
      if (fullAddr) {
        const parts = fullAddr.split(',').map((s) => s.trim());

        // Helper: try to find a matching province from the list
        const findProvince = (name: string) =>
          provinces.find(
            (p) =>
              p.name.toLowerCase().includes(name.toLowerCase()) ||
              name.toLowerCase().includes(p.name.toLowerCase())
          );

        if (parts.length >= 3) {
          // e.g. "Hẻm 29 Đường số 16, Phường Thủ Đức, Thành phố Hồ Chí Minh"
          const provName = normalizeGpsName(parts[parts.length - 1]);
          const wardName = normalizeGpsName(parts.slice(1, parts.length - 1).join(', '));
          const street = parts[0];

          const found = findProvince(provName);
          setSelectedProvince(found || { code: 'gps_p', name: provName });
          setSelectedWard({ code: 'gps_w', name: wardName });
          setStreetAddress(street);
        } else if (parts.length === 2) {
          // e.g. "X. An Hiệp, Vĩnh Long"
          const provName = normalizeGpsName(parts[1]);
          const wardName = normalizeGpsName(parts[0]);

          const found = findProvince(provName);
          setSelectedProvince(found || { code: 'gps_p', name: provName });
          setSelectedWard({ code: 'gps_w', name: wardName });
          setStreetAddress('');
        } else {
          // Single part — try as province first
          const found = findProvince(parts[0]);
          if (found) {
            setSelectedProvince(found);
          } else {
            setSelectedProvince({ code: 'gps_p', name: parts[0] });
          }
          setStreetAddress('');
        }

        Alert.alert(
          'Định vị GPS thành công',
          'Đã tự động điền vị trí GPS vào các trường bên dưới. Vui lòng kiểm tra và nhấn "Xem trên bản đồ" để xác nhận.'
        );
      } else {
        Alert.alert('Thông báo', 'Không thể lấy vị trí GPS hiện tại. Vui lòng chọn vị trí thủ công.');
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể truy cập dịch vụ định vị.');
    } finally {
      setLoadingGps(false);
    }
  };

  // Confirm manual selection & navigate to map confirmation screen
  const handleConfirmLocation = () => {
    if (!selectedProvince) {
      Alert.alert('Thông báo', 'Vui lòng chọn Tỉnh/Thành phố.');
      return;
    }

    const parts: string[] = [];
    if (streetAddress.trim()) parts.push(streetAddress.trim());
    if (selectedWard) parts.push(selectedWard.name);
    parts.push(selectedProvince.name);

    const fullAddress = parts.join(', ');

    const params: any = { address: fullAddress };
    if (gpsCoords) {
      params.lat = gpsCoords.lat.toString();
      params.lng = gpsCoords.lng.toString();
    }

    router.replace({
      pathname: '/post/confirm-map',
      params,
    });
  };

  // Filtered picker list for search modal
  const listToDisplay =
    modalType === 'province'
      ? provinces.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : wards.filter((w) => w.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chọn địa chỉ</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Top GPS Location Button */}
        <TouchableOpacity
          style={styles.gpsButton}
          onPress={handleGetGpsLocation}
          disabled={loadingGps}
          activeOpacity={0.85}
        >
          {loadingGps ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="location" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.gpsButtonText}>
            {loadingGps ? 'Đang lấy vị trí GPS...' : 'Lấy vị trí hiện tại'}
          </Text>
        </TouchableOpacity>

        {/* Or Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>hoặc chọn thủ công</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Dropdown 1: Tỉnh / Thành phố */}
        <Text style={styles.label}>Tỉnh/Thành phố</Text>
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => {
            setSearchQuery('');
            setModalType('province');
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.dropdownText, !selectedProvince && styles.placeholderText]} numberOfLines={1}>
            {selectedProvince ? selectedProvince.name : 'Gõ để tìm hoặc chọn'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#64748B" />
        </TouchableOpacity>

        {/* Dropdown 2: Phường / Xã */}
        <Text style={styles.label}>Phường/Xã</Text>
        <TouchableOpacity
          style={[styles.dropdownBtn, !selectedProvince && styles.disabledDropdown]}
          onPress={() => {
            if (!selectedProvince) {
              Alert.alert('Thông báo', 'Vui lòng chọn Tỉnh/Thành phố trước.');
              return;
            }
            setSearchQuery('');
            setModalType('ward');
          }}
          disabled={!selectedProvince}
          activeOpacity={0.8}
        >
          {loadingWards ? (
            <ActivityIndicator size="small" color="#10B981" style={{ marginRight: 8 }} />
          ) : (
            <Text style={[styles.dropdownText, !selectedWard && styles.placeholderText]} numberOfLines={1}>
              {selectedWard ? selectedWard.name : 'Gõ để tìm hoặc chọn'}
            </Text>
          )}
          <Ionicons name="chevron-down" size={20} color="#64748B" />
        </TouchableOpacity>

        {/* Input 3: Số nhà, tên đường (không bắt buộc) */}
        <Text style={styles.label}>Số nhà, tên đường (không bắt buộc)</Text>
        <TextInput
          style={styles.input}
          placeholder="VD: 123 Nguyễn Huệ"
          placeholderTextColor="#94A3B8"
          value={streetAddress}
          onChangeText={setStreetAddress}
        />

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={22} color="#059669" style={{ marginRight: 10 }} />
          <Text style={styles.infoBannerText}>
            Sau khi chọn xong, bạn sẽ xem vị trí trên bản đồ để xác nhận
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Button */}
      <View style={styles.bottomDock}>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmLocation} activeOpacity={0.85}>
          <Text style={styles.confirmBtnText}>Xem trên bản đồ</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Selection Modal with Safe Area Top Inset */}
      <Modal visible={modalType !== null} animationType="slide" transparent={false}>
        <View style={[styles.modalContainer, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12), paddingBottom: insets.bottom }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalType(null)} style={styles.modalBackBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {modalType === 'province' ? 'Chọn Tỉnh / Thành phố' : 'Chọn Phường / Xã'}
            </Text>
          </View>

          {/* Search Input inside Modal */}
          <View style={styles.modalSearchBox}>
            <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Tìm kiếm..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          <FlatList
            data={listToDisplay}
            keyExtractor={(item) => item.code.toString()}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listItem}
                onPress={() => {
                  if (modalType === 'province') {
                    setSelectedProvince(item);
                    setSelectedWard(null);
                  } else {
                    setSelectedWard(item);
                  }
                  setModalType(null);
                }}
              >
                <Text style={styles.listItemText}>{item.name}</Text>
                {((modalType === 'province' && selectedProvince?.code === item.code) ||
                  (modalType === 'ward' && selectedWard?.code === item.code)) && (
                  <Ionicons name="checkmark" size={20} color="#10B981" />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 20,
  },
  gpsButton: {
    height: 50,
    backgroundColor: '#10B981',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  gpsButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#94A3B8',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    marginTop: 4,
  },
  dropdownBtn: {
    height: 50,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  disabledDropdown: {
    backgroundColor: '#F1F5F9',
    opacity: 0.6,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  placeholderText: {
    color: '#94A3B8',
    fontWeight: '400',
  },
  input: {
    height: 50,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 20,
  },
  infoBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#047857',
    lineHeight: 18,
    fontWeight: '500',
  },
  bottomDock: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  confirmBtn: {
    height: 50,
    backgroundColor: '#10B981',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalBackBtn: {
    padding: 6,
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 14,
    height: 44,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  listItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    flex: 1,
  },
});
