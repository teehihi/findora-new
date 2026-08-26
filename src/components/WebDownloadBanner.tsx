import React, { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

interface WebDownloadBannerProps {
  apkUrl?: string;
}

export function WebDownloadBanner({
  apkUrl = "https://github.com/teehihi/findora-new/releases"
}: WebDownloadBannerProps) {
  const [closed, setClosed] = useState(false);

  // Only show on Web platform
  if (Platform.OS !== 'web' || closed) {
    return null;
  }

  const handleDownload = () => {
    if (apkUrl) {
      Linking.openURL(apkUrl);
    }
  };

  return (
    <View style={styles.banner}>
      <View style={styles.leftContent}>
        <View style={styles.iconBadge}>
          {/* Official Android Robot Head SVG */}
          <Svg width={22} height={18} viewBox="45 260 270 155">
            <Path
              d="m263.837 306.59 21.9331-37.9944c1.2377-2.12998.48933-4.83565-1.61189-6.07335-2.1012-1.23768-4.83565-.5181-6.04456 1.61189l-22.221 38.4837c-16.9536-7.74281-36.0371-12.0604-56.5599-12.0604-20.5227 0-39.6063 4.31754-56.5599 12.0604l-22.221-38.4837c-1.2377-2.12999-3.94336-2.84957-6.07335-1.61189-2.13 1.2377-2.84959 3.94337-1.61189 6.07335l21.9331 37.9944c-37.8217 20.494-63.4392 58.7762-67.6703 103.592h264.407c-4.2312-44.8161-29.8487-83.0984-67.6991-103.592zm-125.209 66.4614c-6.13092 0-11.0817-4.97957-11.0817-11.0817 0-6.13093 4.97957-11.0817 11.0817-11.0817 6.13092 0 11.0817 4.97956 11.0817 11.0817.0289 6.10212-4.95079 11.0817-11.0817 11.0817zm121.381 0c-6.13091 0-11.0817-4.97957-11.0817-11.0817 0-6.13093 4.97958-11.0817 11.0817-11.0817 6.13093 0 11.0817 4.97956 11.0817 11.0817.0288 6.10212-4.95077 11.0817-11.0817 11.0817z"
              fill="#00A896"
            />
          </Svg>
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Trải nghiệm đầy đủ trên Ứng dụng Findora</Text>
          <Text style={styles.subtitle}>Camera AI, WebRTC Call &amp; Bản đồ Google Maps 3D</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload} activeOpacity={0.85}>
          <Ionicons name="download-outline" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={styles.downloadBtnText}>Tải APK</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeBtn} onPress={() => setClosed(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={16} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#F0FDF4',
    borderBottomWidth: 1,
    borderBottomColor: '#CCFBF1',
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 999,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00A896',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 14,
    marginRight: 6,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
});
