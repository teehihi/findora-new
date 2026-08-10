import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ScrollView } from 'react-native';
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
            edgePadding: { top: 60, right: 60, bottom: 100, left: 60 },
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

  return (
    <View style={styles.container}>
      <MapErrorBoundary>
        <MapView 
          ref={mapRef}
          style={styles.map} 
          region={region} 
          onRegionChangeComplete={setRegion}
        >
          {filteredPosts.map((post) => (
            <Marker
              key={post.id}
              coordinate={{
                latitude: post.lat!,
                longitude: post.lng!,
              }}
              pinColor={post.type === 'lost' ? '#EF4444' : '#10B981'}
            >
              <Callout tooltip={Platform.OS === 'android'} onPress={() => router.push(`/post/${post.id}`)}>
                <View style={styles.calloutContainer}>
                  <Text style={styles.calloutTitle} numberOfLines={1}>{post.title}</Text>
                  <Text style={styles.calloutType}>
                    {post.type === 'lost' ? '🔴 Báo Mất' : '🟢 Nhặt Được'}
                  </Text>
                  {post.address ? (
                    <Text style={styles.calloutAddress} numberOfLines={1}>{post.address}</Text>
                  ) : null}
                </View>
              </Callout>
            </Marker>
          ))}
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
