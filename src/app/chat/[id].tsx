import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { getPosterDetails } from '../../services/firebaseService';
import { subscribeUserPresence } from '../../services/presenceService';
import { ChatMessage } from '../../models/types';

export default function ChatRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: otherUserId, postId, postTitle } = useLocalSearchParams<{
    id: string;
    postId?: string;
    postTitle?: string;
  }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [otherUser, setOtherUser] = useState<{ name: string; avatarUrl: string }>({
    name: 'Người dùng',
    avatarUrl: ''
  });
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!otherUserId) return;

    // Load other user info
    getPosterDetails(otherUserId).then((details) => {
      if (details) {
        setOtherUser({
          name: details.name || 'Người dùng Findora',
          avatarUrl: details.avatarUrl || ''
        });
      }
    });

    // Presence listener
    const unsubPresence = subscribeUserPresence(otherUserId, (online) => {
      setIsOnline(online);
    });

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Determine unique chatId for direct messages
    const chatId = [currentUser.uid, otherUserId].sort().join('_');

    // Listen to real-time chat messages in chats subcollection
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubMessages = onSnapshot(
      q,
      (snapshot) => {
        const list: ChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            senderId: data.senderId,
            receiverId: data.receiverId,
            message: data.message || data.text || '',
            timestamp: data.timestamp
          });
        });
        setMessages(list);

        // Mark messages as read
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.receiverId === currentUser.uid && data.read === false) {
            updateDoc(doc(db, 'chats', chatId, 'messages', docSnap.id), { read: true }).catch(() => {});
          }
        });
      },
      () => {
        // Fallback to legacy messages collection query if subcollection is empty
        const legacyRef = collection(db, 'messages');
        const legacyQ = query(legacyRef, orderBy('timestamp', 'asc'));
        onSnapshot(legacyQ, (legacySnap) => {
          const list: ChatMessage[] = [];
          legacySnap.forEach((docSnap) => {
            const data = docSnap.data();
            const isParticipant =
              (data.senderId === currentUser.uid && data.receiverId === otherUserId) ||
              (data.senderId === otherUserId && data.receiverId === currentUser.uid);

            if (isParticipant) {
              list.push({
                id: docSnap.id,
                senderId: data.senderId,
                receiverId: data.receiverId,
                message: data.message || data.text || '',
                timestamp: data.timestamp
              });
            }
          });
          setMessages(list);
        });
      }
    );

    return () => {
      unsubPresence();
      unsubMessages();
    };
  }, [otherUserId]);

  const handleSend = async () => {
    if (!inputText.trim() || !otherUserId) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const textToSend = inputText.trim();
    setInputText('');

    const chatId = [currentUser.uid, otherUserId].sort().join('_');

    try {
      // 1. Ensure parent chat document exists in 'chats'
      const chatDocRef = doc(db, 'chats', chatId);
      await setDoc(
        chatDocRef,
        {
          participants: [currentUser.uid, otherUserId],
          lastMessage: textToSend,
          lastTimestamp: serverTimestamp(),
          updatedAt: serverTimestamp(),
          postId: postId || null,
          postTitle: postTitle || null
        },
        { merge: true }
      );

      // 2. Add message to subcollection
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        receiverId: otherUserId,
        postId: postId || null,
        message: textToSend,
        read: false,
        timestamp: serverTimestamp()
      });

      // Also mirror to root messages collection for backward compatibility
      await addDoc(collection(db, 'messages'), {
        senderId: currentUser.uid,
        receiverId: otherUserId,
        postId: postId || null,
        message: textToSend,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error('Error sending message:', e);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Messenger Header Bar */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        {/* Avatar with Online Dot */}
        <View style={styles.avatarWrapper}>
          {otherUser.avatarUrl ? (
            <Image source={{ uri: otherUser.avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Ionicons name="person" size={20} color="#64748B" />
            </View>
          )}
          <View style={[styles.onlineIndicator, { backgroundColor: isOnline ? '#16A34A' : '#CBD5E1' }]} />
        </View>

        {/* Name & Presence Info */}
        <View style={styles.headerTextCol}>
          <Text style={styles.headerNameText} numberOfLines={1}>
            {otherUser.name}
          </Text>
          <Text style={[styles.headerStatusText, { color: isOnline ? '#16A34A' : '#94A3B8' }]}>
            {isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
          </Text>
        </View>

        {/* Header Action Buttons */}
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconActionBtn} activeOpacity={0.7}>
            <Ionicons name="call" size={20} color="#0084FF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconActionBtn} activeOpacity={0.7}>
            <Ionicons name="ellipsis-vertical" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Post Context Bar if present */}
      {postTitle ? (
        <View style={styles.postContextBanner}>
          <Ionicons name="link-outline" size={16} color="#0084FF" />
          <Text style={styles.postContextBannerText} numberOfLines={1}>
            Về bài đăng: "{postTitle}"
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id || Math.random().toString()}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMe = item.senderId === auth.currentUser?.uid;
            return (
              <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
                {!isMe && (
                  <View style={styles.msgAvatarContainer}>
                    {otherUser.avatarUrl ? (
                      <Image source={{ uri: otherUser.avatarUrl }} style={styles.msgAvatar} />
                    ) : (
                      <View style={styles.msgAvatarPlaceholder}>
                        <Ionicons name="person" size={14} color="#64748B" />
                      </View>
                    )}
                  </View>
                )}

                <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                  <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
                    {item.message}
                  </Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.messagesListContent}
        />

        {/* Messenger Style Input Bar */}
        <View style={[styles.inputBarContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.inputPillContainer}>
            <TouchableOpacity style={styles.inputActionIcon} activeOpacity={0.7}>
              <Ionicons name="add-circle" size={26} color="#0084FF" />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />

            <TouchableOpacity style={styles.inputActionIcon} activeOpacity={0.7}>
              <Ionicons name="image-outline" size={22} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sendIconBtn,
                { backgroundColor: inputText.trim() ? '#0084FF' : '#E2E8F0' }
              ]}
              onPress={handleSend}
              disabled={!inputText.trim()}
              activeOpacity={0.8}
            >
              <Ionicons
                name="send"
                size={16}
                color={inputText.trim() ? '#FFFFFF' : '#94A3B8'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  avatarWrapper: {
    position: 'relative',
    width: 40,
    height: 40,
    marginRight: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  headerNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerStatusText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  postContextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  postContextBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
    marginLeft: 6,
    flex: 1,
  },
  messagesListContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexGrow: 1,
  },
  msgRow: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  msgRowOther: {
    justifyContent: 'flex-start',
  },
  msgAvatarContainer: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  msgAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgBubble: {
    maxWidth: '75%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  msgBubbleMe: {
    backgroundColor: '#0084FF', // Messenger Brand Signature Blue
    borderBottomRightRadius: 4,
  },
  msgBubbleOther: {
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 4,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 21,
  },
  msgTextMe: {
    color: '#FFFFFF',
  },
  msgTextOther: {
    color: '#0F172A',
  },
  inputBarContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  inputPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inputActionIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#0F172A',
    maxHeight: 100,
  },
  sendIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
