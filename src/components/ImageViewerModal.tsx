import React from 'react';
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
  Platform
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
  if (!visible || !imageUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" hidden={false} />

        {/* 1. Top Header Bar (Close X + 3-Dots) */}
        <SafeAreaView style={styles.safeTopHeader}>
          <View style={styles.topHeaderRow}>
            <TouchableOpacity 
              style={styles.headerBtn} 
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.headerBtn} 
              onPress={() => {}}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* 2. Center Image with Native Pinch-to-Zoom */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          maximumZoomScale={4}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent
          bouncesZoom
        >
          <Image
            source={{ uri: imageUrl }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </ScrollView>

        {/* 3. Bottom Overlay (Poster Info + Title + Description + Facebook Action Bar) */}
        <SafeAreaView style={styles.safeBottomOverlay}>
          <View style={styles.bottomOverlayContent}>
            {/* Poster Info Row */}
            <View style={styles.posterRow}>
              <View style={styles.avatarCircle}>
                {posterAvatar ? (
                  <Image source={{ uri: posterAvatar }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {(posterName || 'U').charAt(0).toUpperCase()}
                    </Text>
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
              <Text style={styles.descriptionText} numberOfLines={3}>
                {post.description}
              </Text>
            ) : null}

            {/* Action Buttons: Facebook Thumbs Up & Message Circle */}
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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative'
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
    paddingTop: Platform.OS === 'ios' ? 10 : 16
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollContainer: {
    flex: 1
  },
  scrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: SCREEN_HEIGHT
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7
  },
  safeBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  },
  bottomOverlayContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 10 : 20
  },
  posterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
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
    backgroundColor: '#00C853',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  posterTextCol: {
    justifyContent: 'center'
  },
  posterNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  dateText: {
    fontSize: 12,
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
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
    marginBottom: 14
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: 12
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 32
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
