import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchPosts } from '../../services/firebaseService';
import { Post } from '../../models/types';
import { COLORS, SPACING } from '../../constants/theme';

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

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [region, setRegion] = useState({
    latitude: 10.8505, // HCMUTE / Thu Duc default coordinates
    longitude: 106.7717,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  useEffect(() => {
    fetchPosts('all').then((data) => {
      // Map all posts and ensure every single post has valid lat/lng coordinates
      const mapped = data.map((p, idx) => {
        let latVal = p.lat != null ? Number(p.lat) : null;
        let lngVal = p.lng != null ? Number(p.lng) : null;

        // Smart coordinate assignment for posts created without explicit GPS coordinates
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

  const filteredPosts = posts.filter((p) => {
    if (filter === 'lost') return p.type === 'lost';
    if (filter === 'found') return p.type === 'found';
    return true;
  });

  // Dynamic zoom check: If map is zoomed far out (latitudeDelta > 0.16), show compact default pins
  const isZoomedOut = region.latitudeDelta > 0.16;

  return (
    <View style={styles.container}>
      <MapErrorBoundary>
        <MapView 
          ref={mapRef}
          style={styles.map} 
          region={region} 
          onRegionChangeComplete={setRegion}
        >
          {filteredPosts.map((post) => {
            const isLost = post.type === 'lost';
            const themeColor = isLost ? '#EF4444' : '#10B981';

            if (isZoomedOut) {
              // Compact custom dot pin when zoomed far out (No native pinColor prop to avoid Android crashes)
              return (
                <Marker
                  key={post.id}
                  coordinate={{
                    latitude: post.lat!,
                    longitude: post.lng!,
                  }}
                  tracksViewChanges={false}
                >
                  <View style={[styles.compactDotWrapper, { backgroundColor: themeColor }]}>
                    <View style={styles.compactDotInner} />
                  </View>

                  <Callout tooltip={Platform.OS === 'android'} onPress={() => router.push(`/post/${post.id}`)}>
                    <View style={styles.calloutContainer}>
                      <Text style={styles.calloutTitle} numberOfLines={1}>{post.title}</Text>
                      <Text style={styles.calloutType}>
                        {isLost ? '🔴 Báo Mất' : '🟢 Nhặt Được'}
                      </Text>
                      {post.address ? (
                        <Text style={styles.calloutAddress} numberOfLines={1}>{post.address}</Text>
                      ) : null}
                    </View>
                  </Callout>
                </Marker>
              );
            }

            // Custom Avatar Image Pin Marker when zoomed in
            return (
              <Marker
                key={post.id}
                coordinate={{
                  latitude: post.lat!,
                  longitude: post.lng!,
                }}
                tracksViewChanges={false}
              >
                <View style={styles.customMarkerContainer}>
                  <View style={[styles.avatarWrapper, { borderColor: themeColor }]}>
                    {post.imageUrl ? (
                      <Image source={{ uri: post.imageUrl }} style={styles.avatarImage} />
                    ) : (
                      <Ionicons
                        name={isLost ? 'search-outline' : 'checkmark-circle-outline'}
                        size={22}
                        color={themeColor}
                      />
                    )}
                    <View style={[styles.badgeContainer, { backgroundColor: themeColor }]}>
                      <Text style={styles.badgeText}>{isLost ? '?' : '✓'}</Text>
                    </View>
                  </View>
                  <View style={[styles.pinTip, { borderTopColor: themeColor }]} />
                </View>

                <Callout tooltip={Platform.OS === 'android'} onPress={() => router.push(`/post/${post.id}`)}>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>{post.title}</Text>
                    <Text style={styles.calloutType}>
                      {isLost ? '🔴 Báo Mất' : '🟢 Nhặt Được'}
                    </Text>
                    {post.address ? (
                      <Text style={styles.calloutAddress} numberOfLines={1}>{post.address}</Text>
                    ) : null}
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>
      </MapErrorBoundary>

      {/* Floating Filter Chips Header Bar */}
      <View style={[styles.filterBarWrapper, { top: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.activeFilterChip]}
          onPress={() => setFilter('all')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterChipText, filter === 'all' && styles.activeFilterChipText]}>
            Tất cả ({posts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'lost' && styles.activeFilterChipLost]}
          onPress={() => setFilter('lost')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterChipText, filter === 'lost' && styles.activeFilterChipTextWhite]}>
            🔴 Báo Mất ({posts.filter((p) => p.type === 'lost').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, filter === 'found' && styles.activeFilterChipFound]}
          onPress={() => setFilter('found')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterChipText, filter === 'found' && styles.activeFilterChipTextWhite]}>
            🟢 Nhặt Được ({posts.filter((p) => p.type === 'found').length})
          </Text>
        </TouchableOpacity>
      </View>
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
  customMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 60,
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
  avatarWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  badgeContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  pinTip: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  filterBarWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  activeFilterChip: {
    backgroundColor: COLORS.primary,
  },
  activeFilterChipLost: {
    backgroundColor: '#EF4444',
  },
  activeFilterChipFound: {
    backgroundColor: '#10B981',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  activeFilterChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activeFilterChipTextWhite: {
    color: '#FFFFFF',
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
