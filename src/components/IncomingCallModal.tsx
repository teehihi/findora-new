import React, { useEffect, useRef } from 'react';
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
import { playIncomingRing, playConnectedTone, stopAllRingtones } from '../services/voiceCallService';

interface IncomingCallModalProps {
  visible: boolean;
  caller: {
    name: string;
    avatarUrl: string;
    phone?: string;
  };
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({ visible, caller, onAccept, onReject }: IncomingCallModalProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation | null = null;
    if (visible) {
      playIncomingRing();

      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
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

  const handleAcceptAction = async () => {
    await playConnectedTone();
    onAccept();
  };

  const handleRejectAction = async () => {
    await stopAllRingtones();
    onReject();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <Ionicons name="call" size={16} color="#16A34A" style={{ marginRight: 6 }} />
          <Text style={styles.headerText}>Cuộc gọi thoại đến từ Findora</Text>
        </View>

        {/* Center Caller Info & Pulsing Avatar */}
        <View style={styles.centerContent}>
          <View style={styles.avatarWrapper}>
            <Animated.View
              style={[
                styles.pulseRingOuter,
                { transform: [{ scale: pulseAnim }], opacity: 0.35 }
              ]}
            />
            <Animated.View
              style={[
                styles.pulseRingInner,
                { transform: [{ scale: pulseAnim }], opacity: 0.5 }
              ]}
            />

            {caller.avatarUrl ? (
              <Image source={{ uri: caller.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={56} color="#94A3B8" />
              </View>
            )}
          </View>

          <Text style={styles.callerName}>{caller.name}</Text>
          <Text style={styles.subtext}>Đang gọi cho bạn...</Text>
        </View>

        {/* Bottom Actions: Decline (Red) & Accept (Green) */}
        <View style={styles.actionsContainer}>
          {/* Decline Button */}
          <TouchableOpacity style={styles.actionCol} onPress={handleRejectAction} activeOpacity={0.85}>
            <View style={[styles.actionBtn, styles.declineBtn]}>
              <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </View>
            <Text style={styles.declineText}>Từ chối</Text>
          </TouchableOpacity>

          {/* Accept Button */}
          <TouchableOpacity style={styles.actionCol} onPress={handleAcceptAction} activeOpacity={0.85}>
            <View style={[styles.actionBtn, styles.acceptBtn]}>
              <Ionicons name="call" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.acceptText}>Trả lời</Text>
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
    fontSize: 14,
    color: '#38BDF8',
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
    width: 160,
    height: 160,
    marginBottom: 24,
  },
  pulseRingOuter: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#16A34A',
  },
  pulseRingInner: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#4ADE80',
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  callerName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    marginBottom: 30,
  },
  actionCol: {
    alignItems: 'center',
  },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  declineBtn: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  acceptBtn: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
  },
  declineText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  acceptText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4ADE80',
  },
});
