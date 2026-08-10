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
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Post } from '../models/types';

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
  const currentZoomScale = useRef<number>(1);
  const scrollViewRef = useRef<ScrollView>(null);

  const panXY = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const zoomAnim = useRef(new Animated.Value(1)).current;
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<any>(null);

  // Reset positions safely on open
  useEffect(() => {
    if (visible) {
      setShowControls(true);
      setIsZoomed(false);
      currentZoomScale.current = 1;
      panXY.setValue({ x: 0, y: 0 });
      zoomAnim.setValue(1);
    }
  }, [visible]);

  // Facebook Drag-To-Dismiss PanResponder (Applies ONLY to Image view)
  // Disabled when image is zoomed in (currentZoomScale > 1.05)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => currentZoomScale.current <= 1.05,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (currentZoomScale.current > 1.05) return false;
        const dist = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
        return dist > 3;
      },
      onPanResponderMove: (_, gestureState) => {
        if (currentZoomScale.current > 1.05) return;
        panXY.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        if (currentZoomScale.current > 1.05) return;

        const dist = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
        const velocity = Math.sqrt(gestureState.vx * gestureState.vx + gestureState.vy * gestureState.vy);

        // Fluid release: drag > 45px or flick speed > 0.2 triggers instant smooth exit
        if (dist > 45 || velocity > 0.2) {
          const targetX = gestureState.dx * 4;
          const targetY = gestureState.dy * 4;

          Animated.timing(panXY, {
            toValue: { x: targetX, y: targetY },
            duration: 130,
            useNativeDriver: true
          }).start(() => {
            // Call onClose while offscreen, DO NOT reset panXY to 0 before unmounting!
            onClose();
          });
        } else {
          // If minimal drag, spring smoothly back to center
          Animated.spring(panXY, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            bounciness: 3
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
                  onPress={() => {}}
                  activeOpacity={0.7}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                >
                  <Ionicons name="ellipsis-vertical" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Animated.View>
        ) : null}

        {/* 3. Fullscreen Image - ONLY THIS COMPONENT SLIDES / TRANSLATES WITH FINGER */}
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
                {/* Poster Info Row */}
                <View style={styles.posterRow}>
                  <View style={styles.avatarCircle}>
                    {posterAvatar ? (
                      <Image source={{ uri: posterAvatar }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={22} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <View style={styles.posterTextCol}>
                    <Text style={styles.posterNameText}>{posterName || 'Người dùng Findora'}</Text>
                    <Text style={styles.dateText}>{formattedDate}</Text>
                  </View>
                </View>

                {/* Post Title & Description */}
                {post.title ? (
                  <Text style={styles.postTitleText} numberOfLines={1}>
                    {post.title}
                  </Text>
                ) : null}
                {post.description ? (
                  <Text style={styles.descriptionText} numberOfLines={4}>
                    {post.description}
                  </Text>
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
                      size={22} 
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
                    <Feather name="message-circle" size={22} color="#FFFFFF" />
                    {commentCount > 0 && (
                      <Text style={styles.actionCountText}>{commentCount}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>
          </Animated.View>
        ) : null}
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
    flex: 1,
    width: '100%',
    height: '100%',
    zIndex: 10
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.65
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
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 12 : 20
  },
  posterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#333333'
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center'
  },
  posterTextCol: {
    justifyContent: 'center'
  },
  posterNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  dateText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2
  },
  postTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4
  },
  descriptionText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 12
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 12
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 28
  },
  actionCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8
  },
  likedText: {
    color: '#3B82F6',
    fontWeight: '800'
  }
});
