import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Linking,
  Share,
  Alert,
  Platform,
  Modal,
  Pressable,
  Animated
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { fetchPostById, subscribeComments, addComment, fetchPosts, getPosterDetails, toggleLikePost, deletePost } from '../../services/firebaseService';
import { findMatches } from '../../services/aiMatching';
import { Post, Comment, MatchResult } from '../../models/types';
import { ResolveModal } from '../../components/ResolveModal';
import { MatchCard } from '../../components/MatchCard';
import { ImageViewerModal } from '../../components/ImageViewerModal';
import { PostDetailSkeleton } from '../../components/PostDetailSkeleton';
import { getDisplayCategory } from '../../utils/categoryUtils';
import { auth } from '../../config/firebase';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

interface CustomTimeModalProps {
  visible: boolean;
  detailedDate: string;
  postedAgoText: string;
  onClose: () => void;
}

const CustomTimeModal: React.FC<CustomTimeModalProps> = ({
  visible,
  detailedDate,
  postedAgoText,
  onClose,
}) => {
  const [showModal, setShowModal] = useState(visible);

  const backdropAnim = React.useRef(new Animated.Value(0)).current;
  const cardScale = React.useRef(new Animated.Value(0.88)).current;
  const iconAnim = React.useRef(new Animated.Value(0)).current;
  const titleAnim = React.useRef(new Animated.Value(0)).current;
  const bodyAnim = React.useRef(new Animated.Value(0)).current;
  const btnAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      backdropAnim.setValue(0);
      cardScale.setValue(0.88);
      iconAnim.setValue(0);
      titleAnim.setValue(0);
      bodyAnim.setValue(0);
      btnAnim.setValue(0);

      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.stagger(55, [
          Animated.spring(iconAnim, {
            toValue: 1,
            friction: 5,
            tension: 85,
            useNativeDriver: true,
          }),
          Animated.timing(titleAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(bodyAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(btnAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else if (showModal) {
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(() => setShowModal(false));
    }
  }, [visible]);

  if (!showModal) return null;

  return (
    <Modal visible={showModal} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.timeModalOverlay, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.timeModalCard,
            {
              transform: [{ scale: cardScale }],
              opacity: backdropAnim,
            },
          ]}
        >
          {/* 1. Header with Staggered Icon and Title */}
          <View style={styles.timeModalHeader}>
            <Animated.View
              style={[
                styles.timeModalIconBox,
                {
                  opacity: iconAnim,
                  transform: [
                    { scale: iconAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                    { translateY: iconAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                  ],
                },
              ]}
            >
              <Ionicons name="time" size={24} color="#10B981" />
            </Animated.View>
            <Animated.View
              style={{
                flex: 1,
                opacity: titleAnim,
                transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
              }}
            >
              <Text style={styles.timeModalTitle}>Thời gian đăng bài</Text>
            </Animated.View>
          </View>

          {/* 2. Staggered Body Content */}
          <Animated.View
            style={[
              styles.timeModalBody,
              {
                opacity: bodyAnim,
                transform: [{ translateY: bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
              },
            ]}
          >
            <Text style={styles.timeModalLabel}>Thời gian chính xác:</Text>
            <Text style={styles.timeModalValue}>{detailedDate}</Text>

            <View style={styles.timeModalAgoBadge}>
              <Ionicons name="hourglass-outline" size={16} color="#059669" style={{ marginRight: 6 }} />
              <Text style={styles.timeModalAgoText}>{postedAgoText}</Text>
            </View>
          </Animated.View>

          {/* 3. Staggered Action Button */}
          <Animated.View
            style={{
              opacity: btnAnim,
              transform: [{ translateY: btnAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <TouchableOpacity
              style={styles.timeModalPrimaryBtn}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.timeModalPrimaryText}>Đã hiểu</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

interface CustomDeleteModalProps {
  visible: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const CustomDeleteModal: React.FC<CustomDeleteModalProps> = ({
  visible,
  isDeleting,
  onConfirm,
  onClose,
}) => {
  const [showModal, setShowModal] = useState(visible);

  const backdropAnim = React.useRef(new Animated.Value(0)).current;
  const cardScale = React.useRef(new Animated.Value(0.88)).current;
  const iconAnim = React.useRef(new Animated.Value(0)).current;
  const titleAnim = React.useRef(new Animated.Value(0)).current;
  const descAnim = React.useRef(new Animated.Value(0)).current;
  const btn1Anim = React.useRef(new Animated.Value(0)).current;
  const btn2Anim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      backdropAnim.setValue(0);
      cardScale.setValue(0.88);
      iconAnim.setValue(0);
      titleAnim.setValue(0);
      descAnim.setValue(0);
      btn1Anim.setValue(0);
      btn2Anim.setValue(0);

      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.stagger(55, [
          Animated.spring(iconAnim, {
            toValue: 1,
            friction: 5,
            tension: 85,
            useNativeDriver: true,
          }),
          Animated.timing(titleAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(descAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(btn1Anim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(btn2Anim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else if (showModal) {
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(() => setShowModal(false));
    }
  }, [visible]);

  if (!showModal) return null;

  return (
    <Modal visible={showModal} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.timeModalOverlay, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={!isDeleting ? onClose : undefined} />
        <Animated.View
          style={[
            styles.deleteModalCard,
            {
              transform: [{ scale: cardScale }],
              opacity: backdropAnim,
            },
          ]}
        >
          {/* 1. Staggered Warning Badge */}
          <Animated.View
            style={[
              styles.deleteModalIconBox,
              {
                opacity: iconAnim,
                transform: [
                  { scale: iconAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                  { translateY: iconAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
                ],
              },
            ]}
          >
            <Feather name="alert-triangle" size={26} color="#EF4444" />
          </Animated.View>

          {/* 2. Staggered Title */}
          <Animated.View
            style={{
              opacity: titleAnim,
              transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            }}
          >
            <Text style={styles.deleteModalTitle}>Xác nhận xóa bài</Text>
          </Animated.View>

          {/* 3. Staggered Description */}
          <Animated.View
            style={{
              opacity: descAnim,
              transform: [{ translateY: descAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            }}
          >
            <Text style={styles.deleteModalDesc}>
              Bạn có chắc chắn muốn xóa bài đăng này không? Thao tác này sẽ xóa vĩnh viễn dữ liệu và không thể hoàn tác.
            </Text>
          </Animated.View>

          {/* 4. Staggered Action Button 1 */}
          <Animated.View
            style={{
              width: '100%',
              opacity: btn1Anim,
              transform: [{ translateY: btn1Anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <TouchableOpacity
              style={styles.deleteModalConfirmBtn}
              onPress={onConfirm}
              disabled={isDeleting}
              activeOpacity={0.85}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteModalConfirmText}>Xóa ngay</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* 5. Staggered Action Button 2 */}
          <Animated.View
            style={{
              width: '100%',
              opacity: btn2Anim,
              transform: [{ translateY: btn2Anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <TouchableOpacity
              style={styles.deleteModalCancelBtn}
              onPress={onClose}
              disabled={isDeleting}
              activeOpacity={0.85}
            >
              <Text style={styles.deleteModalCancelText}>Hủy bỏ</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUser = auth.currentUser;

  const [post, setPost] = useState<Post | null>(null);
  const [poster, setPoster] = useState<{ name: string; avatarUrl: string; phone?: string }>({ name: 'Người dùng Findora', avatarUrl: '', phone: '' });
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [relatedMatches, setRelatedMatches] = useState<MatchResult[]>([]);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [fullImageVisible, setFullImageVisible] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(0);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      fetchPostById(id).then(async (data) => {
        setPost(data);
        setLoading(false);
        if (data) {
          if (currentUser) {
            setIsLiked((data.likes || []).includes(currentUser.uid));
          }
          setLikeCount(data.likes?.length || 0);

          if (data.userId) {
            getPosterDetails(data.userId).then(setPoster);
          }

          // Fallback reverse geocode if address is missing
          if (!data.address && data.lat && data.lng) {
            try {
              const geo = await Location.reverseGeocodeAsync({ latitude: data.lat, longitude: data.lng });
              if (geo && geo.length > 0) {
                const item = geo[0];
                const parts: string[] = [];
                if (item.streetNumber || item.street) {
                  parts.push(`${item.streetNumber ? item.streetNumber + ' ' : ''}${item.street || ''}`.trim());
                }
                if (item.subregion || item.district) parts.push(item.subregion || item.district || '');
                if (item.city || item.region) parts.push(item.city || item.region || '');
                const fullAddr = parts.filter(Boolean).join(', ');
                if (fullAddr) {
                  setPost((prev) => prev ? { ...prev, address: fullAddr } : null);
                }
              }
            } catch (e) {
              console.log('Reverse geocode fallback error:', e);
            }
          }

          fetchPosts('all').then((all) => {
            const matches = findMatches(data, all);
            setRelatedMatches(matches.slice(0, 3));
          });
        }
      });
    }, [id, currentUser])
  );

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeComments(id, setComments);
    return () => unsubscribe();
  }, [id]);

  const handleToggleLike = async () => {
    if (!currentUser || !post?.id) return;
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikeCount((prev) => (newIsLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      await toggleLikePost(post.id, currentUser.uid, isLiked);
    } catch (e) {
      console.error('Like toggle error:', e);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !id) return;
    const user = auth.currentUser;
    if (!user) return;

    try {
      setSubmittingComment(true);
      await addComment({
        postId: id,
        userId: user.uid,
        userName: user.displayName || 'Người dùng Findora',
        userAvatar: user.photoURL || '',
        content: newComment.trim()
      });
      setNewComment('');
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCallPhone = () => {
    const phoneNumber = post?.contactPhone || poster.phone;
    if (phoneNumber) {
      const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
      Linking.openURL(`tel:${cleanPhone}`);
    } else {
      Alert.alert('Thông báo', 'Người đăng bài chưa cập nhật số điện thoại liên hệ.');
    }
  };

  const handleOpenChat = () => {
    if (!post) return;
    router.push({
      pathname: '/chat/[id]',
      params: { id: post.userId, postId: post.id, postTitle: post.title }
    });
  };

  const handleShare = async () => {
    if (!post) return;
    try {
      await Share.share({
        title: post.title,
        message: `[Findora] ${post.title}\n${post.description || ''}\nXem chi tiết tại ứng dụng Findora!`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleDeletePost = () => {
    if (!post?.id) return;
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!post?.id) return;
    try {
      setIsDeleting(true);
      await deletePost(post.id);
      setIsDeleting(false);
      setDeleteModalVisible(false);
      router.back();
    } catch (e) {
      setIsDeleting(false);
      Alert.alert('Lỗi', 'Không thể xóa bài đăng. Vui lòng thử lại sau.');
    }
  };

  const handleEditPost = () => {
    if (!post?.id) return;
    router.push({
      pathname: '/post/edit',
      params: { id: post.id }
    });
  };

  const formatPostDates = (createdAt: any) => {
    let dateObj = new Date();
    if (createdAt) {
      if (createdAt.toDate) {
        dateObj = createdAt.toDate();
      } else if (createdAt.seconds) {
        dateObj = new Date(createdAt.seconds * 1000);
      } else if (typeof createdAt === 'number' || typeof createdAt === 'string') {
        dateObj = new Date(createdAt);
      }
    }
    if (isNaN(dateObj.getTime())) dateObj = new Date();

    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    const seconds = dateObj.getSeconds().toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();

    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const weekday = weekdays[dateObj.getDay()];

    const now = new Date();
    const diffSeconds = Math.max(0, Math.floor((now.getTime() - dateObj.getTime()) / 1000));
    let timeAgo = '';
    if (diffSeconds < 60) {
      timeAgo = 'vừa xong';
    } else if (diffSeconds < 3600) {
      const mins = Math.floor(diffSeconds / 60);
      timeAgo = `${mins} phút trước`;
    } else if (diffSeconds < 86400) {
      const h = Math.floor(diffSeconds / 3600);
      timeAgo = `${h} giờ trước`;
    } else if (diffSeconds < 86400 * 7) {
      const d = Math.floor(diffSeconds / 86400);
      timeAgo = `${d} ngày trước`;
    } else if (diffSeconds < 86400 * 30) {
      const w = Math.floor(diffSeconds / (86400 * 7));
      timeAgo = `${w} tuần trước`;
    } else if (diffSeconds < 86400 * 365) {
      const m = Math.floor(diffSeconds / (86400 * 30));
      timeAgo = `${m} tháng trước`;
    } else {
      const y = Math.floor(diffSeconds / (86400 * 365));
      timeAgo = `${y} năm trước`;
    }

    const postedAgoText = diffSeconds < 60 ? 'Đã đăng vừa xong' : `Đã đăng ${timeAgo}`;

    return {
      timeOnly: `${hours}:${minutes}`,
      fullDate: `${hours}:${minutes}, ${day}/${month}/${year}`,
      detailedDate: `${hours}:${minutes}:${seconds} - ${weekday}, ${day}/${month}/${year}`,
      postedAgoText,
      day,
      month,
      year
    };
  };

  if (loading) {
    return <PostDetailSkeleton />;
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Không tìm thấy bài đăng.</Text>
      </SafeAreaView>
    );
  }

  const isOwner = auth.currentUser?.uid === post.userId;
  const isLost = post.type === 'lost';
  const { timeOnly, fullDate, detailedDate, postedAgoText, day, month, year } = formatPostDates(post.createdAt);

  const defaultLat = post.lat || 10.762622;
  const defaultLng = post.lng || 106.660172;
  const targetPhone = post?.contactPhone || poster.phone;
  const bottomNavPadding = Math.max(insets.bottom, 16) + 80;

  return (
    <View style={styles.container}>
      <ScrollView 
        bounces={false} 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: bottomNavPadding + 30 }}
      >
        {/* Top Hero Image Banner */}
        <View style={styles.heroBannerContainer}>
          {post.imageUrl ? (
            <TouchableOpacity onPress={() => setFullImageVisible(true)} activeOpacity={0.9}>
              <Image source={{ uri: post.imageUrl }} style={styles.heroImage} resizeMode="cover" />
            </TouchableOpacity>
          ) : (
            <View style={styles.fallbackHero}>
              <Ionicons name="image-outline" size={60} color="#94A3B8" />
            </View>
          )}

          {/* Floating Top Action Bar */}
          <View style={[styles.floatingBar, { top: insets.top + 8 }]}>
            <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={24} color="#0F172A" />
            </TouchableOpacity>

            <View style={styles.rightFloatingCluster}>
              <TouchableOpacity style={styles.circleBtn} onPress={handleShare} activeOpacity={0.8}>
                <Ionicons name="share-outline" size={20} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.circleBtn} activeOpacity={0.8}>
                <Ionicons name="ellipsis-vertical" size={20} color="#10B981" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Main Content Sheet Card */}
        <View style={styles.sheetCard}>
          {/* Status / Type Badge Row */}
          <View style={styles.badgeRow}>
            <View style={[styles.typeBadgePill, isLost ? styles.lostBadgePill : styles.foundBadgePill]}>
              <Text style={styles.typeBadgeText}>{isLost ? 'THẤT LẠC' : 'NHẶT ĐƯỢC'}</Text>
            </View>

            {post.status === 'resolved' && (
              <View style={styles.resolvedBadgePill}>
                <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                <Text style={styles.resolvedText}>ĐÃ GIẢI QUYẾT</Text>
              </View>
            )}
          </View>

          {/* Post Title */}
          <Text style={styles.postTitle}>{post.title}</Text>

          {/* Posted Time */}
          <Text style={styles.postTimeText}>{postedAgoText}</Text>

          {/* Description Section */}
          <Text style={styles.sectionHeader}>Mô tả chi tiết</Text>
          <Text style={styles.descriptionText}>{post.description}</Text>



          {/* 2 Side-by-Side Info Cards (THỜI GIAN & DANH MỤC) */}
          <View style={styles.infoCardsRow}>
            <TouchableOpacity 
              style={styles.infoCard}
              onPress={() => setTimeModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.infoIconBox}>
                <Ionicons name="time" size={20} color="#10B981" />
              </View>
              <View style={styles.infoTextCol}>
                <Text style={styles.infoLabel}>THỜI GIAN</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{fullDate}</Text>
              </View>
            </TouchableOpacity>

            {(() => {
              const catInfo = getDisplayCategory(post);
              return (
                <View style={styles.infoCard}>
                  <View style={styles.infoIconBox}>
                    <Ionicons name={catInfo.icon} size={20} color="#10B981" />
                  </View>
                  <View style={styles.infoTextCol}>
                    <Text style={styles.infoLabel}>DANH MỤC</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>{catInfo.name}</Text>
                  </View>
                </View>
              );
            })()}
          </View>

          {/* Location & Map Section */}
          <Text style={styles.sectionHeader}>Khu vực</Text>
          <Text style={styles.coordinatesText}>
            {post.address || (post.lat && post.lng ? `${post.lat.toFixed(6)}, ${post.lng.toFixed(6)}` : 'Thành phố Hồ Chí Minh')}
          </Text>

          <View style={styles.mapContainer}>
            <MapView
              style={styles.mapView}
              initialRegion={{
                latitude: defaultLat,
                longitude: defaultLng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker
                coordinate={{ latitude: defaultLat, longitude: defaultLng }}
                title={post.title}
                description={post.address}
              />
            </MapView>
          </View>

          {/* Poster User Info Card */}
          <TouchableOpacity style={styles.posterCard} onPress={handleOpenChat} activeOpacity={0.85}>
            <Image
              source={{ uri: poster.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' }}
              style={styles.posterAvatar}
            />
            <View style={styles.posterInfoCol}>
              <Text style={styles.posterName}>{poster.name || 'Người dùng Findora'}</Text>
              <Text style={styles.posterSubText}>Vừa truy cập • Đã xác thực</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {/* OTP Resolve Button for Owner */}
          {isOwner && post.status === 'active' && (
            <TouchableOpacity style={styles.otpBtn} onPress={() => setResolveModalVisible(true)} activeOpacity={0.85}>
              <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.otpBtnText}>Xác Nhận Trả Đồ OTP</Text>
            </TouchableOpacity>
          )}

          {/* Reward Points Badge if present */}
          {post.rewardPoints ? (
            <View style={styles.rewardBox}>
              <Ionicons name="trophy" size={20} color="#D97706" />
              <Text style={styles.rewardText}>Thưởng {post.rewardPoints} điểm Findora cho người hỗ trợ!</Text>
            </View>
          ) : null}

          {/* Interaction Bar (Like & Comment Icons) - 100% Identical to Home Screen (PostCard.tsx) */}
          <View style={styles.interactionBar}>
            <TouchableOpacity style={styles.interactionBtn} onPress={handleToggleLike} activeOpacity={0.7}>
              <Feather
                name="thumbs-up"
                size={20}
                color={isLiked ? '#1877F2' : '#65676B'}
              />
              {likeCount > 0 && (
                <Text style={[styles.interactionCount, isLiked && { color: '#1877F2', fontWeight: '700' }]}>
                  {likeCount}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.interactionBtn} activeOpacity={0.7}>
              <Feather name="message-circle" size={20} color="#65676B" />
              {comments.length > 0 && (
                <Text style={styles.interactionCount}>{comments.length}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Comment Input Box */}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Viết bình luận..."
              placeholderTextColor="#94A3B8"
              value={newComment}
              onChangeText={setNewComment}
            />
            <TouchableOpacity
              style={styles.sendCommentCircleBtn}
              onPress={handleAddComment}
              disabled={submittingComment}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {comments.length > 0 && (
            <View style={styles.commentsListContainer}>
              <Text style={styles.commentsTitle}>Bình luận ({comments.length})</Text>
              {comments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>{c.userName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentUser}>{c.userName}</Text>
                    <Text style={styles.commentText}>{c.content}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* AI Smart Matching Section */}
          {relatedMatches.length > 0 && (
            <View style={styles.aiMatchingSection}>
              <Text style={styles.aiMatchingTitle}>Gợi ý bài đăng trùng khớp</Text>
              <Text style={styles.aiMatchingSubtitle}>Tìm thấy đồ dùng có đặc điểm tương đồng với bài đăng này</Text>
              {relatedMatches.map((item) => (
                <MatchCard
                  key={item.post.id}
                  match={item}
                  onPress={() => router.push(`/post/${item.post.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Bottom Action Navigation Bar */}
      {post.status === 'active' && (
        <View style={[styles.dockedBottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]} pointerEvents="box-none">
          {isOwner ? (
            /* Owner Mode: Circular Trash Button (Left) + Green Rounded Pill Edit Button (Right) */
            <>
              <TouchableOpacity 
                style={styles.ownerDeleteCircleBtn} 
                onPress={handleDeletePost} 
                activeOpacity={0.75}
              >
                <Feather name="trash-2" size={22} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.ownerEditPillBtn} 
                onPress={handleEditPost} 
                activeOpacity={0.85}
              >
                <Ionicons name="create-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.ownerEditText}>Chỉnh sửa</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Viewer Mode: Call Button + Message Button */
            <>
              <TouchableOpacity 
                style={[styles.dockOutlineBtn, !targetPhone && { opacity: 0.5 }]} 
                onPress={handleCallPhone}
                activeOpacity={0.8}
              >
                <Ionicons name="call-outline" size={20} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={styles.dockOutlineText}>Gọi điện</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.dockSolidBtn} onPress={handleOpenChat} activeOpacity={0.8}>
                <Ionicons name="chatbubbles-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.dockSolidText}>Nhắn tin</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Resolve Modal */}
      <ResolveModal
        visible={resolveModalVisible}
        onClose={() => setResolveModalVisible(false)}
        postId={post.id!}
        postTitle={post.title}
        onSuccess={() => {
          fetchPostById(post.id!).then(setPost);
        }}
      />

      {/* Full Image Viewer */}
      {post.imageUrl && (
        <ImageViewerModal
          visible={fullImageVisible}
          imageUrl={post.imageUrl}
          post={post}
          posterName={poster.name}
          posterAvatar={poster.avatarUrl}
          formattedDate={fullDate}
          likeCount={likeCount}
          isLiked={isLiked}
          commentCount={comments.length}
          onToggleLike={handleToggleLike}
          onClose={() => setFullImageVisible(false)}
        />
      )}

      {/* Custom Sleek Staggered Time Detail Modal */}
      <CustomTimeModal
        visible={timeModalVisible}
        detailedDate={detailedDate}
        postedAgoText={postedAgoText}
        onClose={() => setTimeModalVisible(false)}
      />

      {/* Custom Sleek Staggered Delete Confirmation Modal */}
      <CustomDeleteModal
        visible={deleteModalVisible}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 16,
    color: '#64748B',
  },
  heroBannerContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  fallbackHero: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightFloatingCluster: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetCard: {
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  typeBadgePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  lostBadgePill: {
    backgroundColor: '#FF1E27',
  },
  foundBadgePill: {
    backgroundColor: '#10B981',
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  resolvedBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  resolvedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  postTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 30,
    marginBottom: 6,
  },
  postTimeText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    marginTop: 8,
  },
  descriptionText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
    marginBottom: 20,
  },
  aiTagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  aiTagText: {
    fontSize: 13,
    color: '#047857',
    marginLeft: 6,
  },
  infoCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  infoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoTextCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  coordinatesText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 10,
  },
  mapContainer: {
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapView: {
    width: '100%',
    height: '100%',
  },
  posterCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  posterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  posterInfoCol: {
    flex: 1,
  },
  posterName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  posterSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  otpBtn: {
    backgroundColor: '#A855F7',
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  otpBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rewardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  rewardText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginLeft: 8,
  },
  interactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 16,
  },
  interactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    paddingVertical: 4,
  },
  interactionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#65676B',
    marginLeft: 6,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 20,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 8,
  },
  sendCommentCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  commentsListContainer: {
    marginBottom: 24,
  },
  commentsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  commentAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#047857',
  },
  commentBubble: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  aiMatchingSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  aiMatchingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 2,
  },
  aiMatchingSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
  },
  dockedBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    zIndex: 100,
  },
  ownerDeleteCircleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  ownerEditPillBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  ownerEditText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dockOutlineBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#10B981',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  dockOutlineText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  dockDeleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
  dockSolidBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  dockSolidText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  timeModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  timeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeModalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timeModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  timeModalBody: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  timeModalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  timeModalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
  },
  timeModalAgoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4EA',
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  timeModalAgoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  timeModalPrimaryBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeModalPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  deleteModalIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  deleteModalDesc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteModalConfirmBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  deleteModalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteModalCancelBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
});
