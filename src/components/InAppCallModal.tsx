import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CallStatus } from '../models/callTypes';
import {
  toggleSpeakerphone
} from '../services/voiceCallService';
import { setMicrophoneMuted } from '../services/webrtcService';

interface InAppCallModalProps {
  visible: boolean;
  otherUser: {
    name: string;
    avatarUrl: string;
    phone?: string;
  };
  status?: CallStatus;
  onClose: (durationSecs?: number) => void;
}

export function InAppCallModal({ visible, otherUser, status = 'RINGING', onClose }: InAppCallModalProps) {
  const [callState, setCallState] = useState<CallStatus>(status);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeaker, setIsSpeaker] = useState<boolean>(false);
  const [isVideoOn, setIsVideoOn] = useState<boolean>(false);

  // Pulse animation for avatar rings
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setCallState(status);
    if (
      status === 'ENDED' ||
      status === 'REJECTED' ||
      status === 'CANCELLED' ||
      status === 'FAILED'
    ) {
      const timer = setTimeout(() => {
        onClose(duration);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation | null = null;
    if (visible) {
      setDuration(0);
      setIsMuted(false);
      setIsSpeaker(false);
      setIsVideoOn(false);

      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 1000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      return () => {
        if (pulseLoop) pulseLoop.stop();
      };
    }
  }, [visible]);

  // Duration timer when connected
  useEffect(() => {
    let interval: any = null;
    if (visible && callState === 'CONNECTED') {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [visible, callState]);

  const handleToggleSpeaker = async () => {
    const nextState = !isSpeaker;
    setIsSpeaker(nextState);
    await toggleSpeakerphone(nextState);
  };

  const handleToggleMic = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    setMicrophoneMuted(nextState);
  };

  const handleEndCallAction = () => {
    onClose(duration);
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    const mStr = mins.toString().padStart(2, '0');
    const sStr = remainingSecs.toString().padStart(2, '0');
    return `${mStr}:${sStr}`;
  };

  const getStatusLabel = () => {
    if (callState === 'CONNECTED') return formatDuration(duration);
    if (callState === 'CONNECTING' || callState === 'ACCEPTING') return 'Đang kết nối âm thanh...';
    if (callState === 'FAILED') return 'Không thể kết nối cuộc gọi';
    if (callState === 'REJECTED') return 'Cuộc gọi bị từ chối';
    if (callState === 'CANCELLED') return 'Đã hủy cuộc gọi';
    if (callState === 'ENDING' || callState === 'ENDED') return 'Cuộc gọi đã kết thúc';
    if (callState === 'OUTGOING_CALL') return 'Đang gọi...';
    return 'Đang đổ chuông...';
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <Ionicons name="lock-closed" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
          <Text style={styles.headerText}>Findora Call • Mã hóa đầu cuối</Text>
        </View>

        {/* Center Caller Info & Pulsing Avatar */}
        <View style={styles.centerContent}>
          <View style={styles.avatarWrapper}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.25],
                    outputRange: [0.3, 0],
                  }),
                },
              ]}
            />
            {otherUser.avatarUrl ? (
              <Image source={{ uri: otherUser.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {otherUser.name ? otherUser.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.callerName}>{otherUser.name || 'Người dùng Findora'}</Text>
          <Text style={styles.statusLabel}>{getStatusLabel()}</Text>
        </View>

        {/* Bottom Call Action Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.actionRow}>
            {/* Speaker Button */}
            <TouchableOpacity
              style={[styles.actionBtn, isSpeaker && styles.actionBtnActive]}
              onPress={handleToggleSpeaker}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isSpeaker ? 'volume-high' : 'volume-high-outline'}
                size={26}
                color={isSpeaker ? '#0F172A' : '#FFFFFF'}
              />
              <Text style={[styles.actionBtnText, isSpeaker && styles.actionBtnTextActive]}>
                {isSpeaker ? 'Loa ngoài' : 'Loa'}
              </Text>
            </TouchableOpacity>

            {/* Video Toggle (Placeholder) */}
            <TouchableOpacity
              style={[styles.actionBtn, isVideoOn && styles.actionBtnActive]}
              onPress={() => setIsVideoOn(!isVideoOn)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isVideoOn ? 'videocam' : 'videocam-outline'}
                size={26}
                color={isVideoOn ? '#0F172A' : '#FFFFFF'}
              />
              <Text style={[styles.actionBtnText, isVideoOn && styles.actionBtnTextActive]}>
                {isVideoOn ? 'Camera Bật' : 'Camera'}
              </Text>
            </TouchableOpacity>

            {/* Mic Mute Button */}
            <TouchableOpacity
              style={[styles.actionBtn, isMuted && styles.actionBtnActive]}
              onPress={handleToggleMic}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic-outline'}
                size={26}
                color={isMuted ? '#0F172A' : '#FFFFFF'}
              />
              <Text style={[styles.actionBtnText, isMuted && styles.actionBtnTextActive]}>
                {isMuted ? 'Đã tắt mic' : 'Micro'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* End Call Button */}
          <View style={styles.endCallContainer}>
            <TouchableOpacity
              style={styles.endCallBtn}
              onPress={handleEndCallAction}
              activeOpacity={0.85}
            >
              <Ionicons name="call" size={32} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Slate 900 dark theme
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  avatarWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#38BDF8',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#38BDF8',
  },
  avatarPlaceholder: {
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  callerName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  statusLabel: {
    fontSize: 16,
    color: '#38BDF8',
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 36,
  },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  actionBtnText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  actionBtnTextActive: {
    color: '#0F172A',
    fontWeight: '600',
  },
  endCallContainer: {
    alignItems: 'center',
  },
  endCallBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
});
