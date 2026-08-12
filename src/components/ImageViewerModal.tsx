import React, { useState, useRef, useEffect } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Dimensions, 
  StatusBar,
  Platform,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
  Alert,
  Share
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { BlurView } from 'expo-blur';
import { Post } from '../models/types';

// Safely require @callstack/liquid-glass for iOS Liquid Glass effect
let LiquidGlassView: any = null;
try {
  LiquidGlassView = require('@callstack/liquid-glass').LiquidGlassView;
} catch (e) {
  // Gracefully fallback to Expo BlurView when native module is not in current binary
}

interface ImageViewerModalProps {
  visible: boolean;
  imageUrl: string;
  post?: Post;
  posterName?: string;
  posterAvatar?: string;
  formattedDate?: string;
  likeCount?: number;
  isLiked?: boolean;
  commentCount?: number;
  hideBottomOverlay?: boolean;
  onToggleLike?: () => void;
  onClose: () => void;
  onCommentPress?: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  imageUrl,
  post,
  posterName,
  posterAvatar,
  formattedDate,
  likeCount = 0,
  isLiked = false,
  commentCount = 0,
  hideBottomOverlay = false,
  onToggleLike,
  onClose,
  onCommentPress
}) => {
  const insets = useSafeAreaInsets();
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState<boolean>(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);

  const currentZoomScale = useRef<number>(1);
  const initialPinchDistRef = useRef<number | null>(null);
  const initialZoomScaleRef = useRef<number>(1);
  const scrollViewRef = useRef<ScrollView>(null);

  const panXY = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const zoomAnim = useRef(new Animated.Value(1)).current;
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<any>(null);

  // Reset positions safely on open and close
  useEffect(() => {
    panXY.stopAnimation();
    panXY.setValue({ x: 0, y: 0 });
    zoomAnim.stopAnimation();
    zoomAnim.setValue(1);

    if (visible) {
      setShowControls(true);
      setIsZoomed(false);
      setIsOptionsModalVisible(false);
      setIsDescriptionExpanded(false);
      currentZoomScale.current = 1;
      initialPinchDistRef.current = null;
    }
  }, [visible]);

  // PanResponder with Cross-Platform Pinch-to-Zoom (2 fingers), Double-Tap Zoom, and Drag-to-Dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length === 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          initialPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
          initialZoomScaleRef.current = currentZoomScale.current;
        } else {
          initialPinchDistRef.current = null;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length === 2) {
          // 2-Finger Pinch Zoom
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const currentDist = Math.sqrt(dx * dx + dy * dy);
          if (initialPinchDistRef.current && initialPinchDistRef.current > 0) {
            const scaleFactor = currentDist / initialPinchDistRef.current;
            const newScale = Math.max(1, Math.min(4.5, initialZoomScaleRef.current * scaleFactor));
            currentZoomScale.current = newScale;
            zoomAnim.setValue(newScale);
            if (newScale > 1.1 && !isZoomed) setIsZoomed(true);
            if (newScale <= 1.1 && isZoomed) setIsZoomed(false);
          }
        } else if (isZoomed) {
          // Pan image when zoomed
          panXY.setValue({ x: gestureState.dx, y: gestureState.dy });
        } else {
          // Drag down/up to dismiss when unzoomed
          panXY.setValue({ x: gestureState.dx, y: gestureState.dy });
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        initialPinchDistRef.current = null;

        if (isZoomed && currentZoomScale.current > 1.1) {
          Animated.spring(panXY, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            bounciness: 2
          }).start();
        } else {
          if (currentZoomScale.current <= 1.1) {
            setIsZoomed(false);
            currentZoomScale.current = 1;
            Animated.spring(zoomAnim, { toValue: 1, useNativeDriver: true, bounciness: 2 }).start();
          }

          const dist = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
          const velocity = Math.sqrt(gestureState.vx * gestureState.vx + gestureState.vy * gestureState.vy);

          if (dist > 15 || velocity > 0.08) {
            const targetX = gestureState.dx * 3;
            const targetY = gestureState.dy * 3;

            Animated.timing(panXY, {
              toValue: { x: targetX, y: targetY },
              duration: 120,
              useNativeDriver: true
            }).start(() => {
              onClose();
              panXY.stopAnimation();
              panXY.setValue({ x: 0, y: 0 });
            });
          } else {
            Animated.spring(panXY, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
              bounciness: 2
            }).start();
          }
        }
      }
    })
  ).current;

  // Handle Tap and Double-Tap Zoom
  const handleImageTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 280;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }

      if (isZoomed) {
        setIsZoomed(false);
        currentZoomScale.current = 1;
        Animated.parallel([
          Animated.spring(zoomAnim, {
            toValue: 1,
            useNativeDriver: true,
            bounciness: 2
          }),
          Animated.spring(panXY, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            bounciness: 2
          })
        ]).start();
      } else {
        setIsZoomed(true);
        currentZoomScale.current = 2.5;
        Animated.spring(zoomAnim, {
          toValue: 2.5,
          useNativeDriver: true,
          bounciness: 2
        }).start();
      }
    } else {
      singleTapTimerRef.current = setTimeout(() => {
        setShowControls((prev) => !prev);
      }, 250);
    }

    lastTapRef.current = now;
  };

  // Save Image safely with fallback
  const handleSaveImage = async () => {
    try {
      let MediaLibraryModule: any = null;
      try {
        MediaLibraryModule = require('expo-media-library');
      } catch (e) {
        console.log('MediaLibrary notice: system share sheet fallback');
      }

      if (MediaLibraryModule && MediaLibraryModule.saveToLibraryAsync) {
        const { status } = await MediaLibraryModule.requestPermissionsAsync();
        if (status === 'granted') {
          const file = await File.downloadFileAsync(imageUrl, Paths.cache);
          await MediaLibraryModule.saveToLibraryAsync(file.uri);
          Alert.alert('Thành công', 'Đã lưu hình ảnh vào Thư viện ảnh!');
          return;
        }
      }

      await Share.share(
        Platform.OS === 'ios'
          ? { url: imageUrl }
          : { message: imageUrl, url: imageUrl }
      );
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('Thông báo', 'Đã mở bảng chia sẻ để lưu hình ảnh.');
    }
  };

  const handleSharePost = async () => {
    try {
      await Share.share({
        url: imageUrl,
        message: post?.title ? `[Findora] ${post.title}\n${imageUrl}` : imageUrl
      });
    } catch (error) {
      console.error('Error sharing image:', error);
    }
  };

  const GlassCardContainer = ({ children, style }: { children: React.ReactNode; style?: any }) => {
    if (Platform.OS === 'ios' && LiquidGlassView) {
      return (
        <LiquidGlassView style={[styles.optionsCard, style]} blurRadius={30} glassColor="rgba(242, 242, 247, 0.75)">
          {children}
        </LiquidGlassView>
      );
    }

    return (
      <View style={[styles.optionsCard, style]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.blurCardOverlay}>
          {children}
        </View>
      </View>
    );
  };

  if (!visible || !imageUrl) return null;

  const opacityY = panXY.y.interpolate({
    inputRange: [-SCREEN_HEIGHT / 2, 0, SCREEN_HEIGHT / 2],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp'
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" hidden={!showControls} />

        {/* 1. Backdrop Background */}
        <Animated.View style={[styles.backdrop, { opacity: opacityY }]} />

        {/* 2. Top Bar Header: Close X (Left) + 3 Dots (Right) - Blue Icon Buttons (No Background Circle) */}
        {showControls ? (
          <Animated.View style={[
            styles.safeTopHeader, 
            { paddingTop: insets.top || (Platform.OS === 'ios' ? 44 : 20), opacity: opacityY }
          ]}>
            <View style={styles.topHeaderRow}>
              <TouchableOpacity 
                style={styles.headerBtn} 
                onPress={onClose}
                activeOpacity={0.7}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Ionicons name="close" size={28} color="#0084FF" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.headerBtn} 
                onPress={() => setIsOptionsModalVisible(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Ionicons name="ellipsis-vertical" size={24} color="#0084FF" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : null}

        {/* 3. Fullscreen Image with Pinch-to-Zoom & Double-Tap Zoom */}
        <Animated.View 
          style={[
            styles.animatedImageWrapper, 
            { transform: [{ translateX: panXY.x }, { translateY: panXY.y }] }
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableWithoutFeedback onPress={handleImageTap}>
            <Animated.Image
              source={{ uri: imageUrl }}
              style={[
                styles.fullImage,
                { transform: [{ scale: zoomAnim }] }
              ]}
              resizeMode="contain"
            />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* 4. Bottom Overlay (Caption & Action Bar) */}
        {!hideBottomOverlay && showControls && post ? (
          <Animated.View style={[styles.safeBottomOverlay, { opacity: opacityY }]}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.bottomOverlayContent}>
                <View style={styles.posterRow}>
                  <View style={styles.avatarCircle}>
                    {posterAvatar ? (
                      <Image source={{ uri: posterAvatar }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={18} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <View style={styles.posterTextCol}>
                    <Text style={styles.posterNameText}>{posterName || 'Người dùng Findora'}</Text>
                    {formattedDate ? <Text style={styles.dateText}>{formattedDate}</Text> : null}
                  </View>
                </View>

                {post.title ? (
                  <Text style={styles.postTitleText} numberOfLines={1}>
                    {post.title}
                  </Text>
                ) : null}
                {post.description ? (
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    onPress={() => setIsDescriptionExpanded((prev) => !prev)}
                  >
                    <Text 
                      style={styles.descriptionText} 
                      numberOfLines={isDescriptionExpanded ? undefined : 1}
                    >
                      {post.description}
                      {!isDescriptionExpanded && post.description.length > 30 ? (
                        <Text style={styles.seeMoreText}> ... Xem thêm</Text>
                      ) : null}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {onToggleLike && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity 
                      style={styles.actionBtn} 
                      onPress={onToggleLike}
                      activeOpacity={0.7}
                    >
                      <Feather 
                        name="thumbs-up" 
                        size={20} 
                        color={isLiked ? '#3B82F6' : '#FFFFFF'} 
                      />
                      {likeCount > 0 && (
                        <Text style={[styles.actionCountText, isLiked && styles.likedText]}>
                          {likeCount}
                        </Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.actionBtn} 
                      onPress={() => {
                        onClose();
                        if (onCommentPress) onCommentPress();
                      }}
                      activeOpacity={0.7}
                    >
                      <Feather name="message-circle" size={20} color="#FFFFFF" />
                      {commentCount > 0 && (
                        <Text style={styles.actionCountText}>{commentCount}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </SafeAreaView>
          </Animated.View>
        ) : null}

        {/* 5. Options Action Sheet Modal */}
        <Modal
          visible={isOptionsModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsOptionsModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setIsOptionsModalVisible(false)}>
            <View style={styles.optionsBackdrop}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={styles.optionsContainer}>
                  <GlassCardContainer>
                    <TouchableOpacity 
                      style={styles.optionItem} 
                      onPress={() => {
                        setIsOptionsModalVisible(false);
                        handleSaveImage();
                      }}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.optionTextBlue}>Lưu ảnh</Text>
                    </TouchableOpacity>

                    <View style={styles.optionDivider} />

                    <TouchableOpacity 
                      style={styles.optionItem} 
                      onPress={() => {
                        setIsOptionsModalVisible(false);
                        handleSharePost();
                      }}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.optionTextBlue}>Sao chép link ảnh</Text>
                    </TouchableOpacity>

                    <View style={styles.optionDivider} />

                    <TouchableOpacity 
                      style={styles.optionItem} 
                      onPress={() => {
                        setIsOptionsModalVisible(false);
                        handleSharePost();
                      }}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.optionTextBlue}>Chia sẻ</Text>
                    </TouchableOpacity>

                    <View style={styles.optionDivider} />

                    <TouchableOpacity 
                      style={styles.optionItem} 
                      onPress={() => {
                        setIsOptionsModalVisible(false);
                        Alert.alert('Báo cáo', 'Cảm ơn bạn đã gửi báo cáo hình ảnh này.');
                      }}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.optionTextBlue}>Báo cáo ảnh</Text>
                    </TouchableOpacity>
                  </GlassCardContainer>

                  <GlassCardContainer style={{ marginTop: 8 }}>
                    <TouchableOpacity 
                      style={styles.optionItem} 
                      onPress={() => setIsOptionsModalVisible(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelText}>Hủy</Text>
                    </TouchableOpacity>
                  </GlassCardContainer>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    position: 'relative'
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 1
  },
  safeTopHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'transparent'
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10
  },
  headerBtn: {
    width: 38,
    height: 38,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animatedImageWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT
  },
  safeBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.85)'
  },
  bottomOverlayContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16
  },
  posterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    marginRight: 10,
    backgroundColor: '#333333'
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center'
  },
  posterTextCol: {
    justifyContent: 'center'
  },
  posterNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1
  },
  postTitleText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3
  },
  descriptionText: {
    fontSize: 13.5,
    color: '#FFFFFF',
    lineHeight: 18,
    marginBottom: 10
  },
  seeMoreText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#9CA3AF'
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 10
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 28
  },
  actionCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8
  },
  likedText: {
    color: '#3B82F6',
    fontWeight: '800'
  },
  optionsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end'
  },
  optionsContainer: {
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20
  },
  optionsCard: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(245, 245, 247, 0.88)'
  },
  blurCardOverlay: {
    backgroundColor: 'rgba(245, 245, 247, 0.78)',
    borderRadius: 14
  },
  optionItem: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  optionDivider: {
    height: 0.5,
    backgroundColor: 'rgba(60, 60, 67, 0.15)'
  },
  optionTextBlue: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '400',
    textAlign: 'center'
  },
  cancelText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '700',
    textAlign: 'center'
  }
});
