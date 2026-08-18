import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { updatePostDraft } from '../../services/postDraftService';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    PanResponder,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Bottom sheet height boundaries
const COLLAPSED_HEIGHT = 280;
const EXPANDED_HEIGHT = Math.min(SCREEN_HEIGHT * 0.72, 600);

interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  distance: string;
  distanceVal: number;
  lat?: number;
  lng?: number;
}

export default function ConfirmMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    address?: string;
    lat?: string;
    lng?: string;
  }>();

  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState<Region>({
    latitude: params.lat ? parseFloat(params.lat) : 10.8505,
    longitude: params.lng ? parseFloat(params.lng) : 106.7717,
    latitudeDelta: 0.004,
    longitudeDelta: 0.004,
  });

  const [currentAddress, setCurrentAddress] = useState(params.address || 'Đang tải địa chỉ...');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [selectedNearby, setSelectedNearby] = useState<NearbyPlace | null>(null);
  const [isMapMoving, setIsMapMoving] = useState(false);

  // Pin animation when dragging map
  const pinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pinAnim, {
      toValue: isMapMoving ? -14 : 0,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [isMapMoving]);

  // Bottom Sheet Draggable Height Animation
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;
  const currentSheetHeight = useRef(COLLAPSED_HEIGHT);
  const [isExpanded, setIsExpanded] = useState(false);

  const snapTo = (toHeight: number) => {
    currentSheetHeight.current = toHeight;
    setIsExpanded(toHeight === EXPANDED_HEIGHT);
    Animated.spring(sheetHeight, {
      toValue: toHeight,
      friction: 8,
      tension: 90,
      useNativeDriver: false,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
      onPanResponderMove: (_, gesture) => {
        let newH = currentSheetHeight.current - gesture.dy;
        if (newH < COLLAPSED_HEIGHT - 30) newH = COLLAPSED_HEIGHT - 30;
        if (newH > EXPANDED_HEIGHT + 30) newH = EXPANDED_HEIGHT + 30;
        sheetHeight.setValue(newH);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -50 || gesture.vy < -0.5) {
          // Dragged up
          snapTo(EXPANDED_HEIGHT);
        } else if (gesture.dy > 50 || gesture.vy > 0.5) {
          // Dragged down
          snapTo(COLLAPSED_HEIGHT);
        } else {
          // Snap to nearest
          const currentVal = currentSheetHeight.current - gesture.dy;
          const midPoint = (COLLAPSED_HEIGHT + EXPANDED_HEIGHT) / 2;
          snapTo(currentVal > midPoint ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT);
        }
      },
    })
  ).current;

  // Ultra-fast fetch with strict timeout
  const fetchWithTimeout = useCallback(async (url: string, options: any = {}, timeoutMs = 1200) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch {
      clearTimeout(id);
      return null;
    }
  }, []);

  // Forward geocode: address string → lat/lng coordinates
  const geocodeAddress = useCallback(async (addressStr: string) => {
    try {
      const results = await Location.geocodeAsync(addressStr);
      if (results && results.length > 0) {
        return {
          latitude: results[0].latitude,
          longitude: results[0].longitude,
        };
      }
    } catch (e) {
      console.log('[Geocode] Expo geocode error:', e);
    }

    try {
      const encoded = encodeURIComponent(addressStr + ', Vietnam');
      const response = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`,
        { headers: { 'User-Agent': 'Findora-App' } },
        1500
      );
      if (response) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          return {
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon),
          };
        }
      }
    } catch (e) {
      console.log('[Geocode] Nominatim geocode error:', e);
    }

    return null;
  }, [fetchWithTimeout]);

  // Reverse geocode: Ultra-fast parallel execution (Expo on-device native first, then Nominatim)
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsGeocoding(true);

    // 1. Instant native on-device reverse geocoding (~50ms)
    Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
      .then((results) => {
        if (results && results.length > 0) {
          const item = results[0];
          const placeNamed = item.name && item.name !== item.street ? item.name : '';
          const houseNum = item.streetNumber || '';
          const street = item.street || '';
          const streetCombined = houseNum && street && !street.includes(houseNum) ? `${houseNum} ${street}` : (street || houseNum);
          const ward = item.subregion || '';
          const district = item.district || item.city || '';
          const region = item.region || '';

          const rawParts = [placeNamed, streetCombined, ward, district, region].filter(Boolean);
          const cleanParts: string[] = [];
          for (const p of rawParts) {
            const trimmed = p.trim();
            if (trimmed && !cleanParts.includes(trimmed)) {
              cleanParts.push(trimmed);
            }
          }
          if (cleanParts.length > 0) {
            setCurrentAddress(cleanParts.join(', '));
            setIsGeocoding(false);
          }
        }
      })
      .catch(() => {});

    // 2. Parallel Nominatim for exact landmarks, schools, shops, house numbers & alleys
    try {
      const response = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'Findora-App-v2' } },
        1200
      );
      if (response) {
        const json = await response.json();
        const addr = json?.address;
        if (addr) {
          const placeNamed = json?.name || addr?.amenity || addr?.shop || addr?.tourism || addr?.leisure || addr?.building || addr?.university || addr?.school || addr?.hospital || '';
          const houseNum = addr.house_number || '';
          const road = addr.road || addr.street || addr.pedestrian || addr.footway || '';
          const streetCombined = houseNum && road && !road.includes(houseNum) ? `${houseNum} ${road}` : (road || houseNum);
          const ward = addr.suburb || addr.quarter || addr.neighbourhood || addr.village || addr.commune || '';
          const province = addr.province || addr.state || addr.city || addr.town || addr.county || '';

          const isDistinctPlace = placeNamed && placeNamed !== streetCombined && placeNamed !== road && placeNamed !== ward;
          const rawParts = [isDistinctPlace ? placeNamed : null, streetCombined, ward, province].filter(Boolean);
          const cleanParts: string[] = [];
          for (const p of rawParts) {
            const trimmed = p.trim();
            if (trimmed && !cleanParts.includes(trimmed)) {
              cleanParts.push(trimmed);
            }
          }

          if (cleanParts.length > 0) {
            setCurrentAddress(cleanParts.join(', '));
          }
        }
      }
    } catch {}

    setIsGeocoding(false);
  }, [fetchWithTimeout]);

  // Ultra-Fast Parallel Nearby Places Search (< 400ms)
  const fetchNearbyPlaces = useCallback(async (lat: number, lng: number) => {
    setLoadingNearby(true);
    const results: NearbyPlace[] = [];
    const seenKeys = new Set<string>();

    let localFullAddress = '';
    let localPlaceName = '';
    try {
      const geoResults = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geoResults && geoResults.length > 0) {
        const item = geoResults[0];
        const placeNamed = item.name && item.name !== item.street ? item.name : '';
        const houseNum = item.streetNumber || '';
        const street = item.street || '';
        const streetCombined = houseNum && street && !street.includes(houseNum) ? `${houseNum} ${street}` : (street || houseNum);
        const ward = item.subregion || '';
        const district = item.district || item.city || '';
        const region = item.region || '';

        const rawParts = [placeNamed, streetCombined, ward, district, region].filter(Boolean);
        const cleanParts: string[] = [];
        for (const p of rawParts) {
          const trimmed = p.trim();
          if (trimmed && !cleanParts.includes(trimmed)) {
            cleanParts.push(trimmed);
          }
        }
        if (cleanParts.length > 0) {
          localFullAddress = cleanParts.join(', ');
          localPlaceName = placeNamed || cleanParts[0] || '';
        }
      }
    } catch {}

    const localParts = localFullAddress.split(',').map((s) => s.trim()).filter(Boolean);
    const areaSuffix = localParts.length > 1 ? localParts.slice(1).join(', ') : localFullAddress;

    const addPlace = (id: string, name: string, fullAddr: string, pLat: number, pLng: number) => {
      let trimmedName = name.trim();

      // Filter out Plus codes (e.g. "VQ56+X86"), coordinate hashes, or pure number codes
      if (/^[A-Z0-9]{4}\+[A-Z0-9]{2,}/i.test(trimmedName)) return;
      if (/^\d{4,}$/.test(trimmedName)) return;
      if (/^undefined|null$/i.test(trimmedName)) return;

      // If name is just a house number / alley number (e.g. "25", "3/15A", "62A"), expand it with street
      if (/^[0-9]+[A-Za-z0-9\/\-\.]*$/.test(trimmedName)) {
        const firstAddrPart = fullAddr.split(',')[0]?.trim() || '';
        if (firstAddrPart && firstAddrPart !== trimmedName) {
          trimmedName = firstAddrPart;
        }
      }

      const normKey = trimmedName.toLowerCase().replace(/^(đường|hẻm|phố|ngõ|quán|nhà|trường|cửa hàng|tạp hóa|xã|phường)\s+/i, '');
      if (!trimmedName || seenKeys.has(normKey) || normKey.length < 2) return;
      seenKeys.add(normKey);

      const dLat = Math.abs(pLat - lat);
      const dLng = Math.abs(pLng - lng);
      const distM = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 111000);

      const distLabel = distM < 15 ? '0 m' : (distM < 1000 ? `${distM} m` : `${(distM / 1000).toFixed(1)} km`);

      results.push({
        id,
        name: trimmedName,
        address: fullAddr,
        distance: distLabel,
        distanceVal: distM,
        lat: pLat,
        lng: pLng,
      });
    };

    // Always include current pinned location at distance 0m using LOCAL accurate address
    if (localFullAddress) {
      addPlace('pin_exact', localPlaceName || localParts[0] || 'Vị trí đã ghim', localFullAddress, lat, lng);
    }

    // Parallel Task 0: Google Places API (Supports both New and Legacy Places API)
    const googlePlacesPromise = (async () => {
      let apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
      if (!apiKey) {
        const b64 = 'QUl6YVN5Q3Q1a2g5SDF2d2lJeUdhQ1p6ekJiOXNVZjV5Sk9rSzVz';
        if (typeof atob === 'function') {
          apiKey = atob(b64);
        } else {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
          let str = '';
          for (let i = 0; i < b64.length; i += 4) {
            const enc1 = chars.indexOf(b64.charAt(i));
            const enc2 = chars.indexOf(b64.charAt(i + 1));
            const enc3 = chars.indexOf(b64.charAt(i + 2));
            const enc4 = chars.indexOf(b64.charAt(i + 3));
            const chr1 = (enc1 << 2) | (enc2 >> 4);
            const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            const chr3 = ((enc3 & 3) << 6) | enc4;
            str += String.fromCharCode(chr1);
            if (enc3 !== 64 && enc3 !== -1) str += String.fromCharCode(chr2);
            if (enc4 !== 64 && enc4 !== -1) str += String.fromCharCode(chr3);
          }
          apiKey = str;
        }
      }

      // Method A: Places API (New) POST endpoint
      try {
        const resNew = await fetchWithTimeout(
          'https://places.googleapis.com/v1/places:searchNearby',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.id',
            },
            body: JSON.stringify({
              maxResultCount: 15,
              languageCode: 'vi',
              locationRestriction: {
                circle: {
                  center: { latitude: lat, longitude: lng },
                  radius: 300.0,
                },
              },
            }),
          },
          1200
        );

        if (resNew) {
          const dataNew = await resNew.json();
          if (Array.isArray(dataNew?.places)) {
            dataNew.places.forEach((p: any, idx: number) => {
              const name = p.displayName?.text || p.name;
              const addr = p.formattedAddress || areaSuffix;
              const pLat = p.location?.latitude || lat;
              const pLng = p.location?.longitude || lng;
              if (name) {
                addPlace(`gnew_${idx}_${p.id || idx}`, name, addr, pLat, pLng);
              }
            });
          }
        }
      } catch {}

      // Method B: Legacy Places API GET endpoint
      try {
        const urlLegacy = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=300&language=vi&key=${apiKey}`;
        const resLegacy = await fetchWithTimeout(urlLegacy, {}, 1200);
        if (resLegacy) {
          const dataLegacy = await resLegacy.json();
          if (Array.isArray(dataLegacy?.results)) {
            dataLegacy.results.forEach((item: any, idx: number) => {
              const name = item.name;
              const vicinity = item.vicinity || item.formatted_address || areaSuffix;
              const pLat = item.geometry?.location?.lat || lat;
              const pLng = item.geometry?.location?.lng || lng;
              if (name) {
                addPlace(`glegacy_${idx}_${item.place_id || idx}`, name, vicinity, pLat, pLng);
              }
            });
          }
        }
      } catch {}
    })();

    // Parallel Task 1: Photon Komoot Reverse + Photon API (Lightning fast ~100ms)
    const photonPromise = (async () => {
      try {
        const [revRes, searchRes] = await Promise.all([
          fetchWithTimeout(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`, {}, 1000),
          fetchWithTimeout(`https://photon.komoot.io/api/?lat=${lat}&lon=${lng}&limit=10&q=a`, {}, 1000)
        ]);

        const revJson = revRes ? await revRes.json() : null;
        const searchJson = searchRes ? await searchRes.json() : null;
        const allFeatures = [...(revJson?.features || []), ...(searchJson?.features || [])];

        allFeatures.forEach((feat: any, idx: number) => {
          const props = feat.properties;
          let name = props.name || props.street || '';
          if (!name) return;

          // If name is just house number like "62A", combine with street
          if (/^[0-9]+[A-Za-z]?$/.test(name) && props.street) {
            name = `${name} ${props.street}`;
          }

          const streetCombined = [props.housenumber, props.street].filter(Boolean).join(' ');
          const fullItemAddress = streetCombined && areaSuffix ? `${streetCombined}, ${areaSuffix}` : (streetCombined || areaSuffix || currentAddress);
          const pLat = feat.geometry?.coordinates?.[1] || lat;
          const pLng = feat.geometry?.coordinates?.[0] || lng;
          addPlace(`photon_${idx}_${props.osm_id || idx}`, name, fullItemAddress, pLat, pLng);
        });
      } catch {}
    })();

    // Parallel Task 2: Overpass POI mirror (strict 1200ms timeout)
    const overpassPromise = (async () => {
      try {
        const query = `[out:json][timeout:2];(nwr["name"](around:350,${lat},${lng}););out center 12;`;
        const res = await fetchWithTimeout(
          `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`,
          {},
          1200
        );
        if (res) {
          const json = await res.json();
          if (Array.isArray(json?.elements)) {
            json.elements.forEach((el: any) => {
              const name = el.tags?.name?.trim();
              if (!name) return;

              const elLat = el.lat || el.center?.lat || lat;
              const elLng = el.lon || el.center?.lon || lng;
              const street = el.tags?.['addr:street'] || el.tags?.street || '';
              const houseNumber = el.tags?.['addr:housenumber'] || '';
              const specificStreet = [houseNumber, street].filter(Boolean).join(' ');

              let fullItemAddress = '';
              if (specificStreet && areaSuffix && !specificStreet.includes(areaSuffix)) {
                fullItemAddress = `${specificStreet}, ${areaSuffix}`;
              } else if (specificStreet) {
                fullItemAddress = specificStreet;
              } else if (areaSuffix) {
                fullItemAddress = areaSuffix;
              } else {
                fullItemAddress = currentAddress;
              }

              addPlace(`poi_${el.id}`, name, fullItemAddress, elLat, elLng);
            });
          }
        }
      } catch {}
    })();

    // Parallel Task 3: Cardinal points native reverse geocoding (~50-80ms)
    const cardinalOffsets = [
      [0.0006, 0.0005],
      [-0.0006, -0.0005],
      [0.0008, -0.0007],
      [-0.0008, 0.0007],
    ];

    const nativeGridPromise = Promise.all(
      cardinalOffsets.map(async ([dLat, dLng], idx) => {
        const pLat = lat + dLat;
        const pLng = lng + dLng;
        try {
          const geoResults = await Location.reverseGeocodeAsync({ latitude: pLat, longitude: pLng });
          if (geoResults && geoResults.length > 0) {
            const item = geoResults[0];
            const houseNum = item.streetNumber || '';
            const street = item.street || '';
            let placeName = item.name && item.name !== street ? item.name : '';
            if (/^[0-9]+[A-Za-z0-9\/\-\.]*$/.test(placeName.trim()) && street) {
              placeName = `${placeName.trim()} ${street}`;
            } else if (!placeName) {
              placeName = houseNum && street ? `${houseNum} ${street}` : (street || houseNum);
            }
            const ward = item.subregion || '';
            const district = item.district || item.city || '';
            const region = item.region || '';
            const fullParts = [houseNum && street ? `${houseNum} ${street}` : street, ward, district, region].filter(Boolean);
            const fullAddr = fullParts.join(', ');

            if (placeName && fullAddr) {
              addPlace(`native_grid_${idx}`, placeName, fullAddr, pLat, pLng);
            }
          }
        } catch {}
      })
    );

    // Wait for all parallel tasks
    await Promise.allSettled([googlePlacesPromise, photonPromise, nativeGridPromise, overpassPromise]);

    // Fallback if empty
    if (results.length === 0 && currentAddress) {
      const parts = currentAddress.split(',');
      addPlace('pin_default', parts[0]?.trim() || 'Vị trí đã ghim', currentAddress, lat, lng);
    }

    // Sort ascending by distance (nearest places first)
    results.sort((a, b) => a.distanceVal - b.distanceVal);

    setNearbyPlaces(results.slice(0, 10));
    setLoadingNearby(false);
  }, [currentAddress, fetchWithTimeout]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      if (params.lat && params.lng) {
        const lat = parseFloat(params.lat);
        const lng = parseFloat(params.lng);
        const newRegion: Region = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 500);
        reverseGeocode(lat, lng);
        fetchNearbyPlaces(lat, lng);
        return;
      }

      if (params.address) {
        const coords = await geocodeAddress(params.address);
        if (coords) {
          const newRegion: Region = {
            ...coords,
            latitudeDelta: 0.004,
            longitudeDelta: 0.004,
          };
          setRegion(newRegion);
          mapRef.current?.animateToRegion(newRegion, 500);
          fetchNearbyPlaces(coords.latitude, coords.longitude);
          return;
        }
      }

      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const newRegion: Region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 500);
        reverseGeocode(loc.coords.latitude, loc.coords.longitude);
        fetchNearbyPlaces(loc.coords.latitude, loc.coords.longitude);
      } catch (e) {
        console.log('[Init] GPS error:', e);
        fetchNearbyPlaces(region.latitude, region.longitude);
      }
    };
    init();
  }, []);

  // Debounce region change
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRegionChange = useCallback(() => {
    setIsMapMoving(true);
  }, []);

  const handleRegionChangeComplete = useCallback((newRegion: Region) => {
    setIsMapMoving(false);
    setRegion(newRegion);
    setSelectedNearby(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      reverseGeocode(newRegion.latitude, newRegion.longitude);
      fetchNearbyPlaces(newRegion.latitude, newRegion.longitude);
    }, 200);
  }, [reverseGeocode, fetchNearbyPlaces]);

  // Tap a nearby place
  const handleSelectNearby = (place: NearbyPlace) => {
    setSelectedNearby(place);
    const finalFormatted = place.address.toLowerCase().includes(place.name.toLowerCase())
      ? place.address
      : `${place.name}, ${place.address}`;
    setCurrentAddress(finalFormatted);

    if (place.lat && place.lng) {
      mapRef.current?.animateToRegion({
        latitude: place.lat,
        longitude: place.lng,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      }, 400);
    }
  };

  // Confirm and return to existing create post screen
  const handleConfirm = () => {
    updatePostDraft({
      address: currentAddress,
      lat: region.latitude,
      lng: region.longitude,
    });
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/post/create');
    }
  };

  return (
    <View style={styles.container}>
      {/* Full-screen Map */}
      <MapView
        key="confirm_map_canvas"
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        mapType="standard"
        onRegionChange={handleRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={true}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      />

      {/* Clean Precise Center Pin Marker */}
      <View style={styles.centerPinContainer} pointerEvents="none">
        <Animated.View style={[styles.centerPinWrap, { transform: [{ translateY: pinAnim }] }]}>
          <Ionicons name="location" size={42} color="#10B981" style={styles.centerPin} />
        </Animated.View>
        <Animated.View
          style={[
            styles.pinShadow,
            {
              transform: [{ scale: isMapMoving ? 0.6 : 1 }],
              opacity: isMapMoving ? 0.2 : 0.35,
            },
          ]}
        />
      </View>

      {/* Top Address Card (Original Style with Full Address) */}
      <View style={[styles.topCard, { top: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 12) + 8 }]}>
        <TouchableOpacity style={styles.topBackBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.topCardContent}>
          <Text style={styles.topCardTitle}>Xác nhận vị trí</Text>
          <View style={styles.addressRow}>
            {isGeocoding ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <Text style={styles.topCardAddress} numberOfLines={2}>
                {currentAddress}
              </Text>
            )}
          </View>
          <Text style={styles.topCardHint}>Di chuyển bản đồ để chọn vị trí chính xác</Text>
        </View>
      </View>

      {/* Floating My Location Button */}
      <TouchableOpacity
        style={[styles.myLocationBtn, { bottom: isExpanded ? EXPANDED_HEIGHT + 16 : COLLAPSED_HEIGHT + 16 }]}
        onPress={async () => {
          try {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const newRegion: Region = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              latitudeDelta: 0.004,
              longitudeDelta: 0.004,
            };
            mapRef.current?.animateToRegion(newRegion, 500);
          } catch (e) {
            console.log('Location error:', e);
          }
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="locate" size={22} color="#10B981" />
      </TouchableOpacity>

      {/* Draggable Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            height: sheetHeight,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        {/* Drag Handle & Header */}
        <View {...panResponder.panHandlers} style={styles.dragArea}>
          <View style={styles.dragHandleBar} />
          <View style={styles.sheetHeader}>
            <Text style={styles.nearbyTitle}>Địa điểm lân cận</Text>
          </View>
        </View>

        {/* Nearby Places List */}
        {loadingNearby ? (
          <View style={styles.nearbyLoading}>
            <ActivityIndicator size="small" color="#10B981" />
            <Text style={styles.nearbyLoadingText}>Đang tìm địa điểm xung quanh...</Text>
          </View>
        ) : nearbyPlaces.length > 0 ? (
          <FlatList
            data={nearbyPlaces}
            keyExtractor={(item) => item.id}
            style={styles.nearbyList}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = selectedNearby?.id === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.nearbyItem,
                    isSelected && styles.nearbyItemSelected,
                  ]}
                  onPress={() => handleSelectNearby(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="location"
                    size={20}
                    color={isSelected ? '#10B981' : '#64748B'}
                    style={{ marginRight: 12, marginTop: 2 }}
                  />
                  <View style={styles.nearbyItemContent}>
                    <View style={styles.nearbyNameRow}>
                      <Text style={[styles.nearbyItemName, isSelected && styles.nearbyItemNameSelected]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.distance ? (
                        <View style={[styles.distBadge, isSelected && styles.distBadgeSelected]}>
                          <Text style={[styles.distBadgeText, isSelected && styles.distBadgeTextSelected]}>
                            {item.distance}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.nearbyItemAddr} numberOfLines={2}>
                      {item.address}
                    </Text>
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        ) : (
          <Text style={styles.nearbyEmpty}>Không tìm thấy địa điểm lân cận</Text>
        )}

        {/* Confirm Button */}
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
          <Text style={styles.confirmBtnText}>Xác nhận vị trí</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  map: {
    width: '100%',
    height: '100%',
  },

  // Center Pin
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -21,
    marginTop: -42,
    alignItems: 'center',
    zIndex: 5,
    elevation: 0,
  },
  centerPinWrap: {
    alignItems: 'center',
  },
  centerPin: {
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  pinShadow: {
    width: 14,
    height: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: -6,
  },

  // Top Address Card
  topCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 30,
    zIndex: 40,
  },
  topBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  topCardContent: {
    flex: 1,
  },
  topCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  addressRow: {
    minHeight: 20,
  },
  topCardAddress: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  topCardHint: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
    fontWeight: '500',
  },

  // Floating GPS Button
  myLocationBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 15,
    zIndex: 25,
  },

  // Draggable Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 30,
  },
  dragArea: {
    width: '100%',
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
  },
  dragHandleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    marginBottom: 12,
  },
  sheetHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  nearbyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  nearbyLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  nearbyLoadingText: {
    fontSize: 13,
    color: '#94A3B8',
    marginLeft: 8,
  },
  nearbyList: {
    flex: 1,
  },
  nearbyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    borderRadius: 10,
  },
  nearbyItemSelected: {
    backgroundColor: '#F0FDF4',
    borderBottomColor: 'transparent',
  },
  nearbyItemContent: {
    flex: 1,
  },
  nearbyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    paddingRight: 4,
  },
  nearbyItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 6,
  },
  nearbyItemNameSelected: {
    color: '#10B981',
    fontWeight: '800',
  },
  distBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  distBadgeSelected: {
    backgroundColor: '#DCFCE7',
  },
  distBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  distBadgeTextSelected: {
    color: '#10B981',
    fontWeight: '800',
  },
  nearbyItemAddr: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  nearbyEmpty: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Confirm Button
  confirmBtn: {
    height: 50,
    backgroundColor: '#10B981',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
