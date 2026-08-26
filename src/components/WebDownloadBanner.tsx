import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
          <Ionicons name="logo-android" size={18} color="#00A896" />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Trải nghiệm đầy đủ trên Android Native</Text>
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
