import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Modal, TouchableWithoutFeedback, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import Svg, { Path, Circle, ClipPath, Image as SvgImage, Text as SvgText, Defs, Rect } from 'react-native-svg';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchPosts } from '../../services/firebaseService';
import { Post } from '../../models/types';
import { COLORS, SPACING } from '../../constants/theme';

const IC_DEFAULT = require('../../../assets/ic_default.png');
const IC_VETINH = require('../../../assets/ic_vetinh.png');
const IC_DIAHINH = require('../../../assets/ic_diahinh.png');

class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.warn("Map Error Boundary Caught Error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="map-outline" size={64} color={COLORS.primary} />
          <Text style={styles.errorTitle}>Cần Google Maps API Key trên Android 📍</Text>
          <Text style={styles.errorSubtitle}>
            Google Maps trên Android yêu cầu API Key từ Google Cloud Console (Maps SDK for Android).
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => this.setState({ hasError: false })}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// Vector SVG Map Marker Component for 100% accurate pin tip alignment & crisp graphics
function SvgMapMarker({
  post,
  isLost,
  themeColor,
  onPress,
}: {
  post: Post;
  isLost: boolean;
  themeColor: string;
  onPress: () => void;
}) {
  const badgeText = isLost ? '?' : '✓';
  const hasImage = post.imageUrl && typeof post.imageUrl === 'string' && post.imageUrl.trim() !== '';

  return (
    <Marker
      key={`${post.id}_svg_marker`}
      coordinate={{
        latitude: post.lat!,
        longitude: post.lng!,
      }}
      anchor={{ x: 0.5, y: 1.0 }}
      tracksViewChanges={false}
      onPress={onPress}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
      >
        <View style={styles.svgMarkerWrapper}>
          <Svg width="44" height="56" viewBox="0 0 44 56">
            <Defs>
              <ClipPath id={`avatarClip_${post.id}`}>
                <Circle cx="22" cy="20" r="13" />
              </ClipPath>
            </Defs>

            {/* Outer Teardrop Pin Path (Red for Lost, Emerald Green for Found) */}
            <Path
              d="M 22,2 A 18,18 0 0,1 40,20 C 40,30 22,54 22,54 C 22,54 4,30 4,20 A 18,18 0 0,1 22,2 Z"
              fill={themeColor}
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />

            {/* Inner White Circle */}
            <Circle cx="22" cy="20" r="14" fill="#FFFFFF" />

            {/* Item Image inside ClipPath if present */}
            {hasImage ? (
              <SvgImage
                href={{ uri: post.imageUrl }}
                x="8"
                y="6"
                width="28"
                height="28"
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#avatarClip_${post.id})`}
              />
            ) : null}

            {/* Bottom Right Badge Circle */}
            <Circle cx="32" cy="28" r="7.5" fill="#FFFFFF" />
            <Circle cx="32" cy="28" r="6" fill={themeColor} />
            <SvgText
              x="32"
              y="31.2"
              fontSize="8.5"
              fontWeight="bold"
              fill="#FFFFFF"
              textAnchor="middle"
            >
              {badgeText}
            </SvgText>
          </Svg>

          {/* Fallback Icon overlay if no image is attached to the post */}
          {!hasImage && (
            <View style={styles.fallbackIconOverlay}>
              <Ionicons
                name={isLost ? 'search-outline' : 'checkmark-circle-outline'}
                size={16}
                color={themeColor}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Marker>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [mapType, setMapType] = useState<'standard' | 'hybrid' | 'terrain'>('standard');
  const [modalVisible, setModalVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Post Preview Modal State
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const previewSlideAnim = useRef(new Animated.Value(450)).current;

  const slideAnim = useRef(new Animated.Value(450)).current;

  const [region, setRegion] = useState({
    latitude: 10.8505, // HCMUTE / Thu Duc default coordinates
    longitude: 106.7717,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  useEffect(() => {
    // Request location permission & fetch current position on mount
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc && loc.coords) {
            setUserLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
        }
      } catch (e) {
        console.warn("User location init error:", e);
      }
    })();

    fetchPosts('all').then((data) => {
      // Map all posts and ensure every single post has valid lat/lng coordinates
      const mapped = data.map((p, idx) => {
        let latVal = p.lat != null ? Number(p.lat) : null;
        let lngVal = p.lng != null ? Number(p.lng) : null;

        if (!latVal || isNaN(latVal) || !lngVal || isNaN(lngVal)) {
          const spreadLat = 10.8505 + ((idx % 7) - 3) * 0.004;
          const spreadLng = 106.7717 + ((Math.floor(idx / 3) % 7) - 3) * 0.004;
          latVal = spreadLat;
          lngVal = spreadLng;
        }

        return {
          ...p,
          lat: latVal,
          lng: lngVal,
        };
      });

      setPosts(mapped);

      if (mapped.length > 0 && mapRef.current) {
        const coords = mapped.map((p) => ({
          latitude: p.lat!,
          longitude: p.lng!,
        }));
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 70, right: 60, bottom: 100, left: 60 },
            animated: true,
          });
        }, 600);
      }
    });
  }, []);

  useEffect(() => {
    if (modalVisible) {
      slideAnim.setValue(450);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 24,
        stiffness: 220,
      }).start();
    }
  }, [modalVisible]);

  useEffect(() => {
    if (previewPost !== null) {
      previewSlideAnim.setValue(450);
      Animated.spring(previewSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 24,
        stiffness: 220,
      }).start();
    }
  }, [previewPost]);

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: 450,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
    });
  };

  const closePreviewModal = () => {
    Animated.timing(previewSlideAnim, {
      toValue: 450,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setPreviewPost(null);
    });
  };

  const filteredPosts = posts.filter((p) => {
    if (filter === 'lost') return p.type === 'lost';
    if (filter === 'found') return p.type === 'found';
    return true;
  });

  const isZoomedOut = region.latitudeDelta > 0.16;

  // Handle Recenter User Position with smooth zoom & high accuracy GPS
  const handleRecenterUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Fallback to default HCMUTE coordinates if permission is denied
        mapRef.current?.animateToRegion({
          latitude: 10.8505,
          longitude: 106.7717,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }, 1000);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (loc && loc.coords && mapRef.current) {
        const userCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserLocation(userCoords);
        mapRef.current.animateToRegion({
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
          latitudeDelta: 0.012, // Zoom in close to user location
          longitudeDelta: 0.012,
        }, 1000);
      }
    } catch (err) {
      console.warn("Recenter location error:", err);
      mapRef.current?.animateToRegion({
        latitude: 10.8505,
        longitude: 106.7717,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }, 1000);
    }
  };

  const isFilterActive = filter !== 'all' || mapType !== 'standard';

  return (
    <View style={styles.container}>
      <MapErrorBoundary>
        <MapView 
          ref={mapRef}
          style={styles.map} 
          initialRegion={region} 
          mapType={mapType}
          showsUserLocation={true}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          onRegionChangeComplete={setRegion}
        >
          {filteredPosts.map((post, idx) => {
            const isLost = post.type === 'lost';
            const themeColor = isLost ? '#EF4444' : '#10B981';
            const postId = post.id || `post_${idx}`;

            if (isZoomedOut) {
              if (Platform.OS === 'ios') {
                return (
                  <Marker
                    key={`${postId}_ios_native_pin`}
                    coordinate={{
                      latitude: post.lat!,
                      longitude: post.lng!,
                    }}
                    pinColor={themeColor}
                    onPress={() => setPreviewPost(post)}
                  />
                );
              }

              return (
                <Marker
                  key={`${postId}_android_dot`}
                  coordinate={{
                    latitude: post.lat!,
                    longitude: post.lng!,
                  }}
                  tracksViewChanges={false}
                  onPress={() => setPreviewPost(post)}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setPreviewPost(post)}
                  >
                    <View style={[styles.compactDotWrapper, { backgroundColor: themeColor }]}>
                      <View style={styles.compactDotInner} />
                    </View>
                  </TouchableOpacity>
                </Marker>
              );
            }

            return (
              <SvgMapMarker
                key={`${postId}_svg_marker`}
                post={post}
                isLost={isLost}
                themeColor={themeColor}
                onPress={() => setPreviewPost(post)}
              />
            );
          })}
        </MapView>
      </MapErrorBoundary>

      {/* Floating Action Control Stack (Top Right - Exact Google Maps Native Icon Style) */}
      <View style={[styles.floatingControlStack, { top: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.floatingFabBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
        >
          {/* Exact Google Maps Native Layers Vector SVG Icon */}
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M 12 3 L 21 8 L 12 13 L 3 8 Z" />
            <Path d="M 3 13.5 L 12 18.5 L 21 13.5" />
          </Svg>
          {isFilterActive && <View style={styles.activeDotBadge} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.floatingFabBtn, { marginTop: 10 }]}
          onPress={handleRecenterUserLocation}
          activeOpacity={0.85}
        >
          <Ionicons name="locate-outline" size={22} color="#1E293B" />
        </TouchableOpacity>
      </View>

      {/* Post Preview Modal (Triggered on Clicking a Marker) */}
      <Modal
        visible={previewPost !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={closePreviewModal}
      >
        <TouchableWithoutFeedback onPress={closePreviewModal}>
          <View style={styles.previewModalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.previewCardContainer,
                  {
                    transform: [{ translateY: previewSlideAnim }]
                  }
                ]}
              >
                {/* Post Image */}
                {previewPost?.imageUrl ? (
                  <Image source={{ uri: previewPost.imageUrl }} style={styles.previewImage} resizeMode="cover" />
                ) : (
                  <View style={styles.previewPlaceholderImage}>
                    <Ionicons
                      name={previewPost?.type === 'lost' ? 'search-outline' : 'checkmark-circle-outline'}
                      size={48}
                      color={previewPost?.type === 'lost' ? '#EF4444' : '#10B981'}
                    />
                  </View>
                )}

                <View style={styles.previewContentPadding}>
                  {/* Category Type Badge Tag */}
                  <View style={[
                    styles.previewBadgePill,
                    { backgroundColor: previewPost?.type === 'lost' ? '#FEF2F2' : '#ECFDF5' }
                  ]}>
                    <Text style={[
                      styles.previewBadgeText,
                      { color: previewPost?.type === 'lost' ? '#EF4444' : '#10B981' }
                    ]}>
                      {previewPost?.type === 'lost' ? 'THẤT LẠC' : 'NHẶT ĐƯỢC'}
                    </Text>
                  </View>

                  {/* Title */}
                  <Text style={styles.previewTitle} numberOfLines={1}>
                    {previewPost?.title}
                  </Text>

                  {/* Description */}
                  {previewPost?.description ? (
                    <Text style={styles.previewDescription} numberOfLines={2}>
                      {previewPost.description}
                    </Text>
                  ) : null}

                  {/* Address */}
                  {previewPost?.address ? (
                    <View style={styles.previewAddressRow}>
                      <Ionicons name="location-sharp" size={16} color="#10B981" />
                      <Text style={styles.previewAddressText} numberOfLines={1}>
                        {previewPost.address}
                      </Text>
                    </View>
                  ) : null}

                  {/* Action Buttons Row: Google Maps Directions Button + Xem chi tiết */}
                  <View style={styles.previewActionRowGroup}>
                    <TouchableOpacity
                      style={styles.previewDirectionsBtn}
                      onPress={() => {
                        console.log("Future direction feature clicked for post:", previewPost?.id);
                      }}
                      activeOpacity={0.85}
                    >
                      {/* Exact Google Maps Rotated Diamond with Right-Turn Arrow Icon */}
                      <Svg width="40" height="40" viewBox="0 0 40 40">
                        <Rect
                          x="8"
                          y="8"
                          width="24"
                          height="24"
                          rx="5"
                          ry="5"
                          fill="#087F8C"
                          transform="rotate(45 20 20)"
                        />
                        <Path
                          d="M 14.5 25 V 20.5 C 14.5 18 16.5 16 19 16 H 22.5 V 12.5 L 28 18 L 22.5 23.5 V 20 H 19 C 18.7 20 18 20.7 18 21.5 V 25 H 14.5 Z"
                          fill="#FFFFFF"
                        />
                      </Svg>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.previewActionBtn,
                        { backgroundColor: previewPost?.type === 'lost' ? '#EF4444' : '#10B981' }
                      ]}
                      onPress={() => {
                        const id = previewPost?.id;
                        closePreviewModal();
                        if (id) {
                          router.push(`/post/${id}`);
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.previewActionBtnText}>Xem chi tiết</Text>
                      <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Google Maps Style Bottom Sheet Modal with Soft Backdrop Fade + Independent Sheet Slide Up */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.bottomSheetContainer,
                  {
                    paddingBottom: insets.bottom + 20,
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                {/* Drag Handle Bar */}
                <View style={styles.dragHandle} />

                {/* Modal Header */}
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Tùy chọn bản đồ & Bộ lọc</Text>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={closeModal}
                  >
                    <Ionicons name="close" size={22} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Section 1: Loại bản đồ (Map Types - User Provided Custom PNG Icons) */}
                <Text style={styles.sectionHeading}>Loại bản đồ</Text>
                <View style={styles.mapTypeRow}>
                  {/* Standard Map (Mặc định) */}
                  <TouchableOpacity
                    style={styles.mapTypeCard}
                    onPress={() => setMapType('standard')}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.mapTypeImageWrapper, mapType === 'standard' && styles.activeMapTypeImageWrapper]}>
                      <Image source={IC_DEFAULT} style={styles.mapTypeImg} resizeMode="cover" />
                    </View>
                    <Text style={[styles.mapTypeLabel, mapType === 'standard' && styles.activeMapTypeLabel]}>
                      Mặc định
                    </Text>
                  </TouchableOpacity>

                  {/* Satellite Map with Road & Place Labels Overlay (hybrid) */}
                  <TouchableOpacity
                    style={styles.mapTypeCard}
                    onPress={() => setMapType('hybrid')}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.mapTypeImageWrapper, mapType === 'hybrid' && styles.activeMapTypeImageWrapper]}>
                      <Image source={IC_VETINH} style={styles.mapTypeImg} resizeMode="cover" />
                    </View>
                    <Text style={[styles.mapTypeLabel, mapType === 'hybrid' && styles.activeMapTypeLabel]}>
                      Vệ tinh
                    </Text>
                  </TouchableOpacity>

                  {/* Topographic Contour Terrain Map (terrain) */}
                  <TouchableOpacity
                    style={styles.mapTypeCard}
                    onPress={() => setMapType('terrain')}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.mapTypeImageWrapper, mapType === 'terrain' && styles.activeMapTypeImageWrapper]}>
                      <Image source={IC_DIAHINH} style={styles.mapTypeImg} resizeMode="cover" />
                    </View>
                    <Text style={[styles.mapTypeLabel, mapType === 'terrain' && styles.activeMapTypeLabel]}>
                      Địa hình
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Section 2: Hiển thị bài đăng (Post Type Filter Cards Row with Badge on Outer Border) */}
                <Text style={[styles.sectionHeading, { marginTop: 22 }]}>Hiển thị bài đăng</Text>
                <View style={styles.postTypeRow}>
                  {/* All Posts Card */}
                  <TouchableOpacity
                    style={styles.postTypeCard}
                    onPress={() => setFilter('all')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.postTypeBoxContainer}>
                      <View style={[styles.postTypeImageWrapper, filter === 'all' && styles.activePostTypeImageWrapperAll]}>
                        <View style={[styles.postTypeIconBoxInner, { backgroundColor: filter === 'all' ? 'rgba(13, 148, 136, 0.12)' : '#F1F5F9' }]}>
                          <Ionicons name="apps-outline" size={26} color={filter === 'all' ? '#0D9488' : '#64748B'} />
                        </View>
                      </View>
                      <View style={[styles.badgePill, { backgroundColor: filter === 'all' ? '#0D9488' : '#64748B' }]}>
                        <Text style={styles.badgePillText}>{posts.length}</Text>
                      </View>
                    </View>
                    <Text style={[styles.postTypeLabel, filter === 'all' && styles.activePostTypeLabelAll]}>
                      Tất cả
                    </Text>
                  </TouchableOpacity>

                  {/* Lost Posts Card */}
                  <TouchableOpacity
                    style={styles.postTypeCard}
                    onPress={() => setFilter('lost')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.postTypeBoxContainer}>
                      <View style={[styles.postTypeImageWrapper, filter === 'lost' && styles.activePostTypeImageWrapperLost]}>
                        <View style={[styles.postTypeIconBoxInner, { backgroundColor: filter === 'lost' ? 'rgba(239, 68, 68, 0.12)' : '#F1F5F9' }]}>
                          <Ionicons name="search-outline" size={26} color={filter === 'lost' ? '#EF4444' : '#64748B'} />
                        </View>
                      </View>
                      <View style={[styles.badgePill, { backgroundColor: filter === 'lost' ? '#EF4444' : '#64748B' }]}>
                        <Text style={styles.badgePillText}>{posts.filter(p => p.type === 'lost').length}</Text>
                      </View>
                    </View>
                    <Text style={[styles.postTypeLabel, filter === 'lost' && styles.activePostTypeLabelLost]}>
                      Báo Mất
                    </Text>
                  </TouchableOpacity>

                  {/* Found Posts Card */}
                  <TouchableOpacity
                    style={styles.postTypeCard}
                    onPress={() => setFilter('found')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.postTypeBoxContainer}>
                      <View style={[styles.postTypeImageWrapper, filter === 'found' && styles.activePostTypeImageWrapperFound]}>
                        <View style={[styles.postTypeIconBoxInner, { backgroundColor: filter === 'found' ? 'rgba(16, 185, 129, 0.12)' : '#F1F5F9' }]}>
                          <Ionicons name="checkmark-circle-outline" size={26} color={filter === 'found' ? '#10B981' : '#64748B'} />
                        </View>
                      </View>
                      <View style={[styles.badgePill, { backgroundColor: filter === 'found' ? '#10B981' : '#64748B' }]}>
                        <Text style={styles.badgePillText}>{posts.filter(p => p.type === 'found').length}</Text>
                      </View>
                    </View>
                    <Text style={[styles.postTypeLabel, filter === 'found' && styles.activePostTypeLabelFound]}>
                      Nhặt Được
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  map: {
    flex: 1
  },
  svgMarkerWrapper: {
    width: 44,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIconOverlay: {
    position: 'absolute',
    top: 6,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactDotWrapper: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  compactDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  floatingControlStack: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    zIndex: 100,
  },
  floatingFabBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  activeDotBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  previewCardContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 16,
  },
  previewImage: {
    width: '100%',
    height: 180,
  },
  previewPlaceholderImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContentPadding: {
    padding: 18,
  },
  previewBadgePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  previewDescription: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 10,
  },
  previewAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewAddressText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 6,
    flex: 1,
  },
  previewActionRowGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewDirectionsBtn: {
    width: 50,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewActionBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  previewActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mapTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mapTypeCard: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  mapTypeImageWrapper: {
    width: 68,
    height: 68,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2.5,
    backgroundColor: 'transparent',
  },
  activeMapTypeImageWrapper: {
    borderColor: '#0D9488',
    backgroundColor: '#FFFFFF',
  },
  mapTypeImg: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  mapTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
  },
  activeMapTypeLabel: {
    color: '#0D9488',
    fontWeight: '700',
  },
  postTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  postTypeCard: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  postTypeBoxContainer: {
    position: 'relative',
    width: 68,
    height: 68,
  },
  postTypeImageWrapper: {
    width: 68,
    height: 68,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2.5,
    backgroundColor: 'transparent',
  },
  activePostTypeImageWrapperAll: {
    borderColor: '#0D9488',
    backgroundColor: '#FFFFFF',
  },
  activePostTypeImageWrapperLost: {
    borderColor: '#EF4444',
    backgroundColor: '#FFFFFF',
  },
  activePostTypeImageWrapperFound: {
    borderColor: '#10B981',
    backgroundColor: '#FFFFFF',
  },
  postTypeIconBoxInner: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 10,
    elevation: 4,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  postTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
  },
  activePostTypeLabelAll: {
    color: '#0D9488',
    fontWeight: '700',
  },
  activePostTypeLabelLost: {
    color: '#EF4444',
    fontWeight: '700',
  },
  activePostTypeLabelFound: {
    color: '#10B981',
    fontWeight: '700',
  },
  calloutContainer: {
    width: 160,
    padding: 6
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text
  },
  calloutType: {
    fontSize: 11,
    fontWeight: '600',
    marginVertical: 2
  },
  calloutAddress: {
    fontSize: 10,
    color: COLORS.textMuted
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    backgroundColor: '#F8FAFC'
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    textAlign: 'center'
  },
  errorSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: SPACING.md
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  }
});
