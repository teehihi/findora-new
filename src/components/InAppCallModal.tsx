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
import {
  playOutgoingRing,
  playConnectedTone,
  playEndCallTone,
  stopAllRingtones,
  toggleSpeakerphone
} from '../services/voiceCallService';

interface InAppCallModalProps {
  visible: boolean;
  otherUser: {
    name: string;
    avatarUrl: string;
    phone?: string;
  };
  status?: 'RINGING' | 'CONNECTED';
  onClose: (durationSecs?: number) => void;
}

export function InAppCallModal({ visible, otherUser, status = 'RINGING', onClose }: InAppCallModalProps) {
  const [callState, setCallState] = useState<'RINGING' | 'CONNECTED'>(status);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeaker, setIsSpeaker] = useState<boolean>(false);
  const [isVideoOn, setIsVideoOn] = useState<boolean>(false);

  // Pulse animation for avatar rings
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setCallState(status);
    if (status === 'CONNECTED') {
      playConnectedTone();
    }
  }, [status]);

  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation | null = null;
    if (visible) {
      setDuration(0);
      setIsMuted(false);
      setIsSpeaker(false);
      setIsVideoOn(false);

      if (status === 'RINGING') {
        playOutgoingRing();
      }

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
        stopAllRingtones();
      };
    } else {
      stopAllRingtones();
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

  const handleEndCallAction = async () => {
    await playEndCallTone();
    onClose(duration);
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    const mStr = mins.toString().padStart(2, '0');
    const sStr = remainingSecs.toString().padStart(2, '0');
    return `${mStr}:${sStr}`;
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
                styles.pulseRingOuter,
                { transform: [{ scale: pulseAnim }], opacity: 0.3 }
              ]}
            />
            <Animated.View
              style={[
                styles.pulseRingInner,
                { transform: [{ scale: pulseAnim }], opacity: 0.45 }
              ]}
            />

            {otherUser.avatarUrl ? (
              <Image source={{ uri: otherUser.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={60} color="#94A3B8" />
              </View>
            )}
          </View>

          <Text style={styles.callerName}>{otherUser.name}</Text>

          <Text style={[styles.statusText, callState === 'CONNECTED' ? styles.statusConnected : null]}>
            {callState === 'CONNECTED' ? formatDuration(duration) : 'Đang đổ chuông...'}
          </Text>
        </View>

        {/* Call Control Buttons Bar */}
        <View style={styles.controlsContainer}>
          <View style={styles.controlsRow}>
            {/* Mic Toggle */}
            <TouchableOpacity
              style={[styles.controlBtn, isMuted ? styles.controlBtnActive : null]}
              onPress={() => setIsMuted(!isMuted)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={26}
                color={isMuted ? '#0F172A' : '#FFFFFF'}
              />
              <Text style={[styles.controlText, isMuted ? styles.controlTextActive : null]}>
                {isMuted ? 'Đã tắt mic' : 'Mic'}
              </Text>
            </TouchableOpacity>

            {/* Speaker Toggle */}
            <TouchableOpacity
              style={[styles.controlBtn, isSpeaker ? styles.controlBtnActive : null]}
              onPress={handleToggleSpeaker}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isSpeaker ? 'volume-high' : 'volume-medium'}
                size={26}
                color={isSpeaker ? '#0F172A' : '#FFFFFF'}
              />
              <Text style={[styles.controlText, isSpeaker ? styles.controlTextActive : null]}>
                {isSpeaker ? 'Loa ngoài' : 'Loa'}
              </Text>
            </TouchableOpacity>

            {/* Video Toggle */}
            <TouchableOpacity
              style={[styles.controlBtn, isVideoOn ? styles.controlBtnActive : null]}
              onPress={() => setIsVideoOn(!isVideoOn)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isVideoOn ? 'videocam' : 'videocam-off'}
                size={26}
                color={isVideoOn ? '#0F172A' : '#FFFFFF'}
              />
              <Text style={[styles.controlText, isVideoOn ? styles.controlTextActive : null]}>
                Video
              </Text>
            </TouchableOpacity>
          </View>

          {/* Red End Call Button */}
          <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCallAction} activeOpacity={0.85}>
            <Ionicons name="call" size={32} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  headerText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  avatarWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 180,
    height: 180,
    marginBottom: 24,
  },
  pulseRingOuter: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#0084FF',
  },
  pulseRingInner: {
    position: 'absolute',
    width: 155,
    height: 155,
    borderRadius: 77.5,
    backgroundColor: '#38BDF8',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  callerName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
  },
  statusConnected: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '700',
  },
  controlsContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 40,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  controlBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  controlText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    fontWeight: '600',
  },
  controlTextActive: {
    color: '#0F172A',
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
});
