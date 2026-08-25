import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { 
  initializeDeviceNotifications, 
  triggerDeviceNotification 
} from '../services/deviceNotificationService';
import { registerPushToken } from '../services/pushNotificationService';
import { HandshakeSession } from '../services/handshakeService';

let NotificationsModule: any = null;
try {
  NotificationsModule = require('expo-notifications');
} catch (e) {
  console.log('Notice: expo-notifications not loaded in GlobalNotificationListener:', e);
}

export function GlobalNotificationListener() {
  const router = useRouter();
  const seenNotifIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  // Active handshake session for receiver
  const [activeReceiverHandshake, setActiveReceiverHandshake] = useState<HandshakeSession | null>(null);
  const [receiverPhotoUri, setReceiverPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // 1. Initialize notification channels & request permissions
    initializeDeviceNotifications();

    // 2. Listen to notification click events from system tray safely
    let responseSubscription: any = null;
    try {
      if (NotificationsModule && typeof NotificationsModule.addNotificationResponseReceivedListener === 'function') {
        responseSubscription = NotificationsModule.addNotificationResponseReceivedListener((response: any) => {
          const data = response?.notification?.request?.content?.data;
          if (!data) return;

          if (data.type === 'chat' && data.senderId) {
            router.push(`/chat/${data.senderId}`);
          } else if (data.postId) {
            router.push(`/post/${data.postId}`);
          } else if (data.senderId) {
            router.push(`/chat/${data.senderId}`);
          } else {
            router.push('/(tabs)/notifications');
          }
        });
      }
    } catch (e) {
      console.log('Notice: Notifications response listener notice:', e);
    }

    return () => {
      try {
        if (responseSubscription && typeof responseSubscription.remove === 'function') {
          responseSubscription.remove();
        }
      } catch (err) {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Register Expo push token for background/killed state delivery
    registerPushToken(user.uid);

    // 3. Realtime listener on Firestore notifications collection
    let unsubscribeNotifs: (() => void) | null = null;
    let unsubscribeHandshakes: (() => void) | null = null;

    try {
      const notifRef = collection(db, 'notifications');
      const q = query(
        notifRef,
        where('userId', '==', user.uid),
        where('read', '==', false)
      );

      unsubscribeNotifs = onSnapshot(
        q,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const docId = change.doc.id;
            const data = change.doc.data();

            if (change.type === 'added') {
              if (isFirstLoad.current) {
                seenNotifIds.current.add(docId);
              } else if (!seenNotifIds.current.has(docId)) {
                seenNotifIds.current.add(docId);

                const type = data.type || 'system';
                const title = data.title || 'Findora';
                const body = data.message || data.body || '';

                triggerDeviceNotification({
                  title,
                  body,
                  data: {
                    ...data,
                    id: docId,
                  },
                  type,
                });
              }
            }
          });

          if (isFirstLoad.current) {
            isFirstLoad.current = false;
          }
        },
        (error) => {
          console.log('Notice: Notification realtime listener notice:', error);
        }
      );
    } catch (err) {
      console.log('Notice: Setting up notifications listener notice:', err);
    }

    // 4. Realtime listener on active Handshakes for Lost Item Owner (Receiver side)
    try {
      const handshakeQ = query(
        collection(db, 'handshakes'),
        where('receiverId', '==', user.uid),
        where('status', 'in', ['otp_verified', 'photo_verifying'])
      );

      unsubscribeHandshakes = onSnapshot(
        handshakeQ,
        (snapshot) => {
          if (!snapshot.empty) {
            const firstDoc = snapshot.docs[0];
            const data = { id: firstDoc.id, ...firstDoc.data() } as HandshakeSession;
            setActiveReceiverHandshake(data);
            if (data.handoverPhotoUrl) {
              setReceiverPhotoUri(data.handoverPhotoUrl);
            }
          } else {
            setActiveReceiverHandshake(null);
          }
        },
        (err) => {
          console.log('Notice: Handshake receiver listener notice:', err);
        }
      );
    } catch (err) {
      console.log('Notice: Setting up handshake receiver listener notice:', err);
    }

    return () => {
      if (unsubscribeNotifs) unsubscribeNotifs();
      if (unsubscribeHandshakes) unsubscribeHandshakes();
    };
  }, [auth.currentUser?.uid]);

  const handleReceiverTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setReceiverPhotoUri(result.assets[0].uri);
    }
  };

  return (
    <>
      {/* Realtime Step 4 Photo Modal for Lost Item Owner */}
      {activeReceiverHandshake && (
        <Modal
          visible={!!activeReceiverHandshake}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveReceiverHandshake(null)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => setActiveReceiverHandshake(null)}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>

            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="camera" size={24} color="#00A896" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Bước 4: Chụp Ảnh Xác Nhận</Text>
                    <Text style={styles.modalSubtitle}>Xác thực trao nhận đồ tại chỗ</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setActiveReceiverHandshake(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Verified OTP Success Badge */}
              <View style={styles.verifiedSuccessBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.verifiedSuccessBadgeText}>Mã OTP đã khớp thành công!</Text>
              </View>

              <Text style={styles.instructionText}>
                Hai bên cùng tiến hành chụp ảnh trao nhận đồ trực tiếp tại điểm hẹn:
              </Text>

              {/* Photo Preview or Live Camera Card */}
              {receiverPhotoUri ? (
                <View style={styles.photoPreviewBox}>
                  <Image source={{ uri: receiverPhotoUri }} style={styles.photoPreviewImg} />
                  <TouchableOpacity
                    style={styles.retakeBtn}
                    onPress={handleReceiverTakePhoto}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera-reverse" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.retakeBtnText}>Chụp lại</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.liveCameraCard}
                  onPress={handleReceiverTakePhoto}
                  activeOpacity={0.85}
                >
                  <View style={styles.liveCameraIconCircle}>
                    <Ionicons name="camera" size={34} color="#00A896" />
                  </View>
                  <Text style={styles.liveCameraTitle}>Mở Camera Chụp Ảnh Trực Tiếp</Text>
                  <Text style={styles.liveCameraSub}>
                    Chụp ảnh món đồ hoặc khoảnh khắc trao nhận để lưu làm minh chứng
                  </Text>
                </TouchableOpacity>
              )}

              {/* Done & Close Button */}
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setActiveReceiverHandshake(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.doneBtnText}>Đã Hiểu & Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 380,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 168, 150, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedSuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  verifiedSuccessBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  instructionText: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 16,
  },
  liveCameraCard: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#00A896',
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  liveCameraIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(0, 168, 150, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  liveCameraTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#00A896',
    marginBottom: 4,
    textAlign: 'center',
  },
  liveCameraSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 260,
  },
  photoPreviewBox: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 18,
  },
  photoPreviewImg: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  retakeBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  retakeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  doneBtn: {
    backgroundColor: '#00A896',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#00A896',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  doneBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

