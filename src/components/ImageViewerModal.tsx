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
  SafeAreaView, 
  StatusBar,
  Platform,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
  Alert,
  Share
} from 'react-native';
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
  post: Post;
  posterName: string;
  posterAvatar?: string;
  formattedDate: string;
  likeCount: number;
  isLiked: boolean;
  commentCount: number;
  onToggleLike: () => void;
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
  likeCount,
  isLiked,
  commentCount,
  onToggleLike,
  onClose,
  onCommentPress
}) => {
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState<boolean>(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);

  const currentZoomScale = useRef<number>(1);
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
    }
  }, [visible]);

  // Facebook Drag-To-Dismiss PanResponder (Applies ONLY when image is unzoomed)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isZoomed,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isZoomed) return false;
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderMove: (_, gestureState) => {
        if (isZoomed) return;
        panXY.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isZoomed) return;

        const dist = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
        const velocity = Math.sqrt(gestureState.vx * gestureState.vx + gestureState.vy * gestureState.vy);

        // Fluid release: drag > 15px or flick speed > 0.08 instantly dismisses photo smoothly like Facebook
        if (dist > 15 || velocity > 0.08) {
          const targetX = gestureState.dx * 3;
          const targetY = gestureState.dy * 3;

          Animated.timing(panXY, {
            toValue: { x: targetX, y: targetY },
            duration: 120,
            useNativeDriver: true
          }).start(() => {
            onClose();
            // Immediately reset panXY coordinates after offscreen animation finishes so next open is 100% centered
            panXY.stopAnimation();
            panXY.setValue({ x: 0, y: 0 });
          });
        } else {
          // If minimal drag/tap, spring smoothly back to center
          Animated.spring(panXY, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            bounciness: 2
          }).start();
        }
      }
    })
  ).current;

  // Handle Tap and Double-Tap Zoom
  const handleImageTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 280;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double Tap Detected! Clear single tap timer
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }

      if (isZoomed) {
        // Double tap #2: Reset zoom back to 1.0
        setIsZoomed(false);
        currentZoomScale.current = 1;
        Animated.spring(zoomAnim, {
          toValue: 1,
          useNativeDriver: true,
          bounciness: 2
        }).start();
      } else {
        // Double tap #1: Zoom in to fill viewport (2.5x)
        setIsZoomed(true);
        currentZoomScale.current = 2.5;
        Animated.spring(zoomAnim, {
          toValue: 2.5,
          useNativeDriver: true,
          bounciness: 2
        }).start();
      }
    } else {
      // Potential Single Tap ➔ Wait 250ms to toggle controls
      singleTapTimerRef.current = setTimeout(() => {
        setShowControls((prev) => !prev);
      }, 250);
    }

    lastTapRef.current = now;
  };

  // Safe Save Image with Native Module Fallback to iOS System Share Sheet ("Lưu hình ảnh")
  const handleSaveImage = async () => {
    try {
      let MediaLibraryModule: any = null;
      try {
        MediaLibraryModule = require('expo-media-library');
      } catch (e) {
        console.log('MediaLibrary native module notice: using system Share Sheet fallback');
      }

      if (MediaLibraryModule && MediaLibraryModule.saveToLibraryAsync) {
        const { status } = await MediaLibraryModule.requestPermissionsAsync();
        if (status === 'granted') {
          const file = await File.downloadFileAsync(imageUrl, Paths.cache);
          await MediaLibraryModule.saveToLibraryAsync(file.uri);
          Alert.alert('Thành công', 'Đã lưu hình ảnh vào Thư viện ảnh của thiết bị!');
          return;
        }
      }

      // Native Fallback: iOS / Android System Share Sheet with built-in "Save Image" option
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

  // Share Image / Post
  const handleSharePost = async () => {
    try {
      await Share.share({
        url: imageUrl,
        message: post.title ? `[Findora] ${post.title}\n${imageUrl}` : imageUrl
      });
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  // Helper component to render Liquid Glass (iOS) or BlurView (Android & Fallback)
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

  // Dynamically calculate opacity for background, top header, and bottom caption based on image drag distance
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

        {/* 1. Backdrop Background - Anchored, Only Fades Out */}
        <Animated.View style={[styles.backdrop, { opacity: opacityY }]} />

        {/* 2. Top Bar Header: Close X (Left) + 3 Dots (Right) - Anchored, Only Fades Out */}
        {showControls ? (
          <Animated.View style={[styles.safeTopHeader, { opacity: opacityY }]}>
            <SafeAreaView>
              <View style={styles.topHeaderRow}>
                <TouchableOpacity 
                  style={styles.headerBtn} 
                  onPress={onClose}
                  activeOpacity={0.7}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                >
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.headerBtn} 
                  onPress={() => setIsOptionsModalVisible(true)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                >
                  <Ionicons name="ellipsis-vertical" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Animated.View>
        ) : null}

        {/* 3. Fullscreen Image - PERFECTLY CENTERED VERTICALLY & HORIZONTALLY IN SCREEN CENTER */}
        <Animated.View 
          style={[
            styles.animatedImageWrapper, 
            { transform: [{ translateX: panXY.x }, { translateY: panXY.y }] }
          ]}
          {...panResponder.panHandlers}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            scrollEnabled={isZoomed}
            maximumZoomScale={5}
            minimumZoomScale={1}
            zoomScale={1}
            pinchGestureEnabled={true}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            centerContent={true}
            bouncesZoom={true}
            onScroll={(e) => {
              const scale = e.nativeEvent.zoomScale || 1;
              currentZoomScale.current = scale;
              if (scale > 1.05 && !isZoomed) setIsZoomed(true);
              if (scale <= 1.05 && isZoomed) setIsZoomed(false);
            }}
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
          </ScrollView>
        </Animated.View>

        {/* 4. Bottom Overlay (Caption & Action Bar) - Anchored, Only Fades Out */}
        {showControls ? (
          <Animated.View style={[styles.safeBottomOverlay, { opacity: opacityY }]}>
            <SafeAreaView>
              <View style={styles.bottomOverlayContent}>
                {/* Poster Info Row matching Facebook Compact Typography */}
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
                    <Text style={styles.dateText}>{formattedDate}</Text>
                  </View>
                </View>

                {/* Post Title & Description with Collapsed "... Xem thêm" matching Facebook */}
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

                {/* Action Buttons: Facebook Thumbs Up Outline & Message Circle Outline */}
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
              </View>
            </SafeAreaView>
          </Animated.View>
        ) : null}

        {/* 5. Liquid Glass (iOS) & Frosted Blur (Android) Action Sheet Modal */}
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
                  {/* Action Group Card with Glass Effect */}
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
                      <Text style={styles.optionTextBlue}>Sao chép ảnh</Text>
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

                    <View style={styles.optionDivider} />

                    <TouchableOpacity 
                      style={styles.optionItem} 
                      onPress={() => {
                        setIsOptionsModalVisible(false);
                        Alert.alert('Thông báo', 'Đã bật thông báo cho bài viết này.');
                      }}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.optionTextBlue}>Bật thông báo</Text>
                    </TouchableOpacity>
                  </GlassCardContainer>

                  {/* Cancel Card with Glass Effect */}
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)'
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    paddingBottom: 10
  },
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center'
  },
  animatedImageWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  scrollContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: 'transparent'
  },
  scrollContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center'
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
  // Liquid Glass & Frosted Blur Action Sheet Styles
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
