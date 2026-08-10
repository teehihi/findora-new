import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { HeaderBar } from '../../components/HeaderBar';
import { subscribeUserPresence } from '../../services/presenceService';
import { ChatMessage } from '../../models/types';
import { COLORS, SPACING } from '../../constants/theme';

export default function ChatRoomScreen() {
  const { id: otherUserId, postId, postTitle } = useLocalSearchParams<{
    id: string;
    postId?: string;
    postTitle?: string;
  }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!otherUserId) return;

    // Presence listener
    const unsubPresence = subscribeUserPresence(otherUserId, (online) => {
      setIsOnline(online);
    });

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Listen to real-time chat messages
    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      orderBy('timestamp', 'asc')
    );

    const unsubMessages = onSnapshot(
      q, 
      (snapshot) => {
        const list: ChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const isParticipant =
            (data.senderId === currentUser.uid && data.receiverId === otherUserId) ||
            (data.senderId === otherUserId && data.receiverId === currentUser.uid);

          if (isParticipant) {
            list.push({
              id: docSnap.id,
              senderId: data.senderId,
              receiverId: data.receiverId,
              message: data.message || '',
              timestamp: data.timestamp
            });
          }
        });
        setMessages(list);
      },
      (error) => {
        console.log('Chat messages listener notice:', error);
        setMessages([]);
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

    try {
      const messagesRef = collection(db, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        receiverId: otherUserId,
        postId: postId || null,
        message: textToSend,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar 
        title="Trò Chuyện" 
        showBack 
        subtitle={isOnline ? '🟢 Đang truy cập (Online)' : '🔴 Ngoại tuyến (Offline)'}
      />

      {postTitle ? (
        <View style={styles.postContextBox}>
          <Ionicons name="link-outline" size={16} color={COLORS.primary} />
          <Text style={styles.postContextText} numberOfLines={1}>
            Về bài đăng: "{postTitle}"
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id || Math.random().toString()}
          renderItem={({ item }) => {
            const isMe = item.senderId === auth.currentUser?.uid;
            return (
              <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
                <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                  <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
                    {item.message}
                  </Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
        />

        {/* Input Row */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nhập tin nhắn..."
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  postContextBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs
  },
  postContextText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primaryDark,
    marginLeft: 6
  },
  listContent: {
    padding: SPACING.md,
    flexGrow: 1,
    justifyContent: 'flex-end'
  },
  msgRow: {
    marginBottom: SPACING.xs,
    flexDirection: 'row'
  },
  msgRowMe: {
    justifyContent: 'flex-end'
  },
  msgRowOther: {
    justifyContent: 'flex-start'
  },
  msgBubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10
  },
  msgBubbleMe: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4
  },
  msgBubbleOther: {
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20
  },
  msgTextMe: {
    color: '#FFFFFF'
  },
  msgTextOther: {
    color: COLORS.text
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    height: 44,
    fontSize: 14,
    color: COLORS.text,
    marginRight: SPACING.sm
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
