import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchPosts } from '../../services/firebaseService';
import { Post } from '../../models/types';
import { COLORS, SPACING } from '../../constants/theme';

export default function MapScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [region, setRegion] = useState({
    latitude: 10.8505, // HCMUTE / Thu Duc default coordinates
    longitude: 106.7717,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  useEffect(() => {
    fetchPosts('all').then((data) => {
      // Filter posts that have valid lat/lng
      const mappedPosts = data.filter((p) => p.lat != null && p.lng != null);
      setPosts(mappedPosts);
      if (mappedPosts.length > 0 && mappedPosts[0].lat && mappedPosts[0].lng) {
        setRegion({
          latitude: mappedPosts[0].lat,
          longitude: mappedPosts[0].lng,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        });
      }
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="map" size={24} color={COLORS.primary} />
        <Text style={styles.headerTitle}>Bản Đồ Thất Lạc 📍</Text>
      </View>

      <MapView style={styles.map} region={region} onRegionChangeComplete={setRegion}>
        {posts.map((post) => (
          <Marker
            key={post.id}
            coordinate={{
              latitude: post.lat!,
              longitude: post.lng!,
            }}
            pinColor={post.type === 'lost' ? '#EF4444' : '#10B981'}
          >
            <Callout onPress={() => router.push(`/post/${post.id}`)}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 10
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginLeft: SPACING.xs
  },
  map: {
    flex: 1
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
  }
});
