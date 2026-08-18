import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Modal,
  Pressable,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { auth } from '../../config/firebase';
import { 
  fetchNotificationsList, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  getPosterDetails
} from '../../services/firebaseService';
import { Notification } from '../../models/types';
import { NotificationSkeletonList } from '../../components/NotificationSkeleton';
import { COLORS, SPACING } from '../../constants/theme';

// ==================== BOTTOM SHEET OPTIONS MODAL (DRAGGABLE) ====================
interface OptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onMarkAllAsRead: () => void;
}

const NotificationOptionsModal: React.FC<OptionsModalProps> = ({
  visible,
  onClose,
  onMarkAllAsRead,
}) => {
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(visible);
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  // PanResponder for smooth drag-down-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 60 || gestureState.vy > 0.5) {
          Animated.parallel([
            Animated.timing(backdropAnim, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
              toValue: 300,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start(() => onClose());
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            friction: 8,
            tension: 80,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setShow(true);
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (show) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => setShow(false));
    }
  }, [visible]);

  if (!show) return null;

  return (
    <Modal visible={show} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalOverlay, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.bottomSheetCard,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Top Handle Bar */}
          <View style={styles.bottomSheetHandle} />

          {/* Action Row: Mark all as read */}
          <TouchableOpacity
            style={styles.bottomSheetActionItem}
            onPress={() => {
              onMarkAllAsRead();
              onClose();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.bottomSheetIconCircle}>
              <MaterialCommunityIcons name="email-check-outline" size={22} color="#0F172A" />
            </View>
            <Text style={styles.bottomSheetActionText}>Đánh dấu tất cả là đã đọc</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// ==================== MAIN NOTIFICATIONS SCREEN ====================
export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUser = auth.currentUser;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);

  // Pagination state: Total visible items start at 10
  const [displayLimit, setDisplayLimit] = useState(10);
  const [hasActivatedInfiniteScroll, setHasActivatedInfiniteScroll] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const loadNotifications = async () => {
    try {
      if (!currentUser) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const list = await fetchNotificationsList(currentUser.uid);

      // Auto enrich with sender profiles if senderId exists
      const enrichedList = await Promise.all(
        list.map(async (item) => {
          if (!item.senderAvatar && item.senderId) {
            const poster = await getPosterDetails(item.senderId);
            return {
              ...item,
              senderAvatar: poster.avatarUrl || item.senderAvatar,
              senderName: item.senderName || poster.name,
            };
          }
          return item;
        })
      );

      setNotifications(enrichedList);
    } catch (e) {
      console.error('Error fetching notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [currentUser])
  );

  const handleNotificationPress = async (item: Notification) => {
    if (!item.read && item.id) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
      markNotificationAsRead(item.id);
    }

    if (item.postId) {
      router.push(`/post/${item.postId}`);
    } else if (item.senderId) {
      router.push(`/chat/${item.senderId}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsAsRead(currentUser.uid);
  };

  // Tapping "Xem thông báo trước đó" reveals 10 more items smoothly
  const handleLoadEarlier = () => {
    setLoadingEarlier(true);
    setHasActivatedInfiniteScroll(true);
    setTimeout(() => {
      setDisplayLimit((prev) => prev + 10);
      setLoadingEarlier(false);
    }, 600);
  };

  // Automatic Infinite Scroll on ScrollView near bottom
  const handleScroll = (event: any) => {
    if (!hasActivatedInfiniteScroll || loadingEarlier || displayLimit >= filteredList.length) return;
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
    if (isCloseToBottom) {
      setLoadingEarlier(true);
      setTimeout(() => {
        setDisplayLimit((prev) => prev + 10);
        setLoadingEarlier(false);
      }, 500);
    }
  };

  // Robust Timestamp parsing for Firestore Timestamp, Seconds, and String dates
  const getMillisFromTimestamp = (createdAt: any): number => {
    if (!createdAt) return 0;
    if (typeof createdAt === 'number') {
      return createdAt > 1e11 ? createdAt : createdAt * 1000;
    }
    if (createdAt.toMillis && typeof createdAt.toMillis === 'function') {
      return createdAt.toMillis();
    }
    if (createdAt.toDate && typeof createdAt.toDate === 'function') {
      return createdAt.toDate().getTime();
    }
    if (createdAt.seconds != null) {
      return createdAt.seconds * 1000 + (createdAt.nanoseconds || 0) / 1e6;
    }
    if (createdAt._seconds != null) {
      return createdAt._seconds * 1000 + (createdAt._nanoseconds || 0) / 1e6;
    }
    const parsed = new Date(createdAt).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  // Helper for relative time formatting matching Facebook (e.g. 1 giờ, 3 giờ, Hôm qua, 4 tháng)
  const formatTimeAgo = (createdAt: any, index: number = 0): string => {
    const millis = getMillisFromTimestamp(createdAt);
    
    // If no timestamp exists in legacy document, fallback to realistic older date
    if (!millis || isNaN(millis)) {
      return '4 tháng';
    }

    const diffSec = Math.floor((Date.now() - millis) / 1000);
    if (diffSec < 60) return 'Vừa xong';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} giờ`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks} tuần`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} tháng`;
    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} năm`;
  };

  // Helper to detect if notification is from Findora AI matching
  const isMatchNotification = (item: Notification) => {
    const t = (item.type || '').toLowerCase();
    const title = (item.title || '').toLowerCase();
    const msg = (item.message || '').toLowerCase();
    return t === 'match' || title.includes('gợi ý') || title.includes('phù hợp') || title.includes('trùng khớp') || msg.includes('gợi ý') || msg.includes('phù hợp') || msg.includes('trùng khớp');
  };

  // Parse Actor name and text for clean Facebook bold styling
  const renderNotificationMessage = (item: Notification) => {
    const isMatch = isMatchNotification(item);
    const isChat = !isMatch && (item.type === 'chat' || (!item.postId && Boolean(item.senderId)));
    let actorName = item.senderName || '';
    let actionText = item.message || item.title;

    if (isMatch) {
      actorName = 'Findora AI';
      actionText = item.message && item.message !== item.title
        ? `đã tìm thấy bài đăng có thể trùng khớp: "${item.message}"`
        : 'đã tìm thấy gợi ý bài đăng phù hợp với đồ của bạn!';
    } else if (isChat) {
      actorName = item.senderName || (item.title && !item.title.includes(' ') ? item.title : 'Người dùng');
      actionText = 'đã gửi tin nhắn cho bạn!';
    } else if (item.type === 'comment') {
      actorName = item.senderName || (item.title.includes('đã') ? item.title.split('đã')[0].trim() : 'Người dùng');
      const cleanContent = item.message && item.message !== item.title ? item.message : '';
      actionText = cleanContent
        ? `đã bình luận về bài viết của bạn: "${cleanContent}"`
        : 'đã bình luận về bài viết của bạn.';
    } else if (item.type === 'like') {
      actorName = item.senderName || (item.title.includes('đã') ? item.title.split('đã')[0].trim() : 'Người dùng');
      actionText = 'đã thích bài viết của bạn.';
    } else if (item.type === 'points') {
      actorName = 'Findora';
      actionText = item.message || 'đã tặng điểm thưởng cho bạn!';
    } else {
      // Fallback: cleanup if title starts with username
      if (item.title.includes('đã')) {
        const parts = item.title.split('đã');
        actorName = parts[0].trim();
        actionText = `đã ${parts.slice(1).join('đã').trim()}`;
      } else if (item.message && item.message !== item.title) {
        actorName = item.title;
        actionText = item.message;
      } else {
        actorName = 'Findora';
        actionText = item.title || item.message;
      }
    }

    return (
      <Text style={[styles.messageText, !item.read && styles.unreadMessageText]} numberOfLines={3}>
        <Text style={styles.actorName}>{actorName} </Text>
        {actionText}
      </Text>
    );
  };

  // Badge icon & color based on notification type
  const getBadgeDetails = (type: string, isChat?: boolean, isMatch?: boolean) => {
    if (isMatch || type === 'match') {
      return {
        icon: <Ionicons name="sparkles" size={11} color="#FFFFFF" />,
        bgColor: '#10B981',
      };
    }
    if (type === 'chat' || isChat) {
      return {
        icon: <Ionicons name="chatbubbles" size={11} color="#FFFFFF" />,
        bgColor: '#1877F2',
      };
    }
    switch (type) {
      case 'comment':
        return {
          icon: <Ionicons name="chatbubble" size={11} color="#FFFFFF" />,
          bgColor: '#1877F2',
        };
      case 'like':
        return {
          icon: <Ionicons name="heart" size={11} color="#FFFFFF" />,
          bgColor: '#EF4444',
        };
      case 'points':
        return {
          icon: <Ionicons name="trophy" size={11} color="#FFFFFF" />,
          bgColor: '#F59E0B',
        };
      case 'resolve':
        return {
          icon: <Ionicons name="checkmark" size={11} color="#FFFFFF" />,
          bgColor: '#10B981',
        };
      default:
        return {
          icon: <Ionicons name="notifications" size={11} color="#FFFFFF" />,
          bgColor: '#6366F1',
        };
    }
  };

  // Filter notifications
  const filteredList = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Helper to check if a notification was strictly created on the same calendar day (Hôm nay)
  const isCreatedToday = (createdAt: any): boolean => {
    const millis = getMillisFromTimestamp(createdAt);
    if (!millis) return false;
    const notifDate = new Date(millis);
    const today = new Date();
    return (
      notifDate.getDate() === today.getDate() &&
      notifDate.getMonth() === today.getMonth() &&
      notifDate.getFullYear() === today.getFullYear()
    );
  };

  // Split strictly: "Mới" (created today) vs "Trước đó" (previous days / older)
  const allRecentNotifications: Notification[] = [];
  const allEarlierNotifications: Notification[] = [];

  filteredList.forEach((n) => {
    if (isCreatedToday(n.createdAt)) {
      allRecentNotifications.push(n);
    } else {
      allEarlierNotifications.push(n);
    }
  });

  // Cap total visible notifications across both sections to displayLimit (starts at 10)
  const visibleRecent = allRecentNotifications.slice(0, displayLimit);
  const remainingSlots = Math.max(0, displayLimit - visibleRecent.length);
  const visibleEarlier = allEarlierNotifications.slice(0, remainingSlots);

  const totalNotificationsCount = allRecentNotifications.length + allEarlierNotifications.length;
  const currentVisibleCount = visibleRecent.length + visibleEarlier.length;
  const hasMoreToLoad = totalNotificationsCount > currentVisibleCount;

  // Render a single notification item
  const renderItem = (item: Notification, index: number) => {
    const isMatch = isMatchNotification(item);
    const isChat = !isMatch && (item.type === 'chat' || (!item.postId && Boolean(item.senderId)));
    const badge = getBadgeDetails(item.type, isChat, isMatch);
    const timeAgo = formatTimeAgo(item.createdAt, index);

    return (
      <TouchableOpacity
        key={item.id || Math.random().toString()}
        style={[styles.itemCard, !item.read && styles.unreadItemCard]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {/* Left: Avatar with Overlaid Type Badge */}
        <View style={styles.avatarContainer}>
          {isMatch || item.type === 'system' || item.type === 'points' || item.type === 'resolve' || (!item.senderAvatar && !item.senderId) ? (
            // App / System / AI Match: Always Use Findora Official App Logo
            <Image 
              source={require('../../../assets/images/Logo_BG_noText.png')} 
              style={styles.avatarImg} 
              resizeMode="cover"
            />
          ) : item.senderAvatar ? (
            <Image 
              source={{ uri: item.senderAvatar }} 
              style={styles.avatarImg} 
              resizeMode="cover"
            />
          ) : item.imageUrl ? (
            <Image 
              source={{ uri: item.imageUrl }} 
              style={styles.avatarImg} 
              resizeMode="cover"
            />
          ) : (
            <Image 
              source={require('../../../assets/images/Logo_BG_noText.png')} 
              style={styles.avatarImg} 
              resizeMode="cover"
            />
          )}

          {/* Action Badge */}
          <View style={[styles.badgeOverlay, { backgroundColor: badge.bgColor }]}>
            {badge.icon}
          </View>
        </View>

        {/* Center: Notification Message & Time */}
        <View style={styles.infoCol}>
          {renderNotificationMessage(item)}
          <Text style={[styles.timeText, !item.read && styles.unreadTimeText]}>{timeAgo}</Text>
        </View>

        {/* Right: Unread Blue Dot Indicator */}
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 1. Header Bar: Back Button + Title + More Options */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Thông báo</Text>

        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => setOptionsModalVisible(true)}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      {/* 2. Filter Pills: Tất cả / Chưa đọc (Styled in Primary Emerald Theme) */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
          onPress={() => {
            setActiveFilter('all');
            setDisplayLimit(10);
            setHasActivatedInfiniteScroll(false);
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterPillText, activeFilter === 'all' && styles.filterPillTextActive]}>
            Tất cả
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'unread' && styles.filterPillActive]}
          onPress={() => {
            setActiveFilter('unread');
            setDisplayLimit(10);
            setHasActivatedInfiniteScroll(false);
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterPillText, activeFilter === 'unread' && styles.filterPillTextActive]}>
            Chưa đọc {unreadCount > 0 ? `(${unreadCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Main Scrollable Notification List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <NotificationSkeletonList count={6} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setDisplayLimit(10);
                setHasActivatedInfiniteScroll(false);
                loadNotifications();
              }}
              colors={['#10B981']}
              tintColor="#10B981"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {filteredList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={48} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có thông báo nào</Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === 'unread'
                  ? 'Bạn đã xem hết tất cả thông báo.'
                  : 'Các cập nhật về đồ thất lạc, ghép đôi AI và tin nhắn sẽ xuất hiện tại đây.'}
              </Text>
            </View>
          ) : (
            <>
              {/* Section: Mới (Recent / Today) */}
              {visibleRecent.length > 0 && (
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Mới</Text>
                  </View>
                  {visibleRecent.map((item, idx) => renderItem(item, idx))}
                </View>
              )}

              {/* Section: Trước đó (Earlier) */}
              {visibleEarlier.length > 0 && (
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Trước đó</Text>
                  </View>
                  {visibleEarlier.map((item, idx) => renderItem(item, visibleRecent.length + idx))}
                </View>
              )}

              {/* Skeleton Shimmer when Loading Earlier / Infinite Scrolling */}
              {loadingEarlier && (
                <View style={{ marginTop: 8 }}>
                  <NotificationSkeletonList count={3} />
                </View>
              )}

              {/* "Xem thông báo trước đó" Button (Facebook Style) - Only shown BEFORE infinite scroll is activated */}
              {!hasActivatedInfiniteScroll && hasMoreToLoad && !loadingEarlier && (
                <TouchableOpacity
                  style={styles.loadEarlierBtn}
                  onPress={handleLoadEarlier}
                  activeOpacity={0.8}
                >
                  <Text style={styles.loadEarlierText}>Xem thông báo trước đó</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* 4. Bottom Sheet Options Modal (Facebook style with Drag) */}
      <NotificationOptionsModal
        visible={optionsModalVisible}
        onClose={() => setOptionsModalVisible(false)}
        onMarkAllAsRead={handleMarkAllAsRead}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterPillActive: {
    backgroundColor: '#10B981', // Emerald Primary theme
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingTop: 8,
  },
  sectionContainer: {
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  unreadItemCard: {
    backgroundColor: '#F0FDF4', // Soft emerald tint for unread items
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatarImg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F1F5F9',
  },
  avatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
  },
  badgeOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  messageText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 3,
  },
  unreadMessageText: {
    color: '#0F172A',
    fontWeight: '500',
  },
  actorName: {
    fontWeight: '700',
    color: '#0F172A',
  },
  timeText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748B',
  },
  unreadTimeText: {
    color: '#10B981',
    fontWeight: '600',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginLeft: 10,
  },
  loadEarlierBtn: {
    marginHorizontal: 16,
    marginVertical: 16,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadEarlierText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#334155',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  bottomSheetHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  bottomSheetIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  bottomSheetActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
});
