import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { COLORS } from '../constants/theme';

export function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [barWidth, setBarWidth] = useState<number>(Dimensions.get('window').width - 36);

  // Animated values for tab scale feedback
  const homeScale = useRef(new Animated.Value(1)).current;
  const mapScale = useRef(new Animated.Value(1)).current;
  const chatScale = useRef(new Animated.Value(1)).current;
  const profileScale = useRef(new Animated.Value(1)).current;
  const plusScale = useRef(new Animated.Value(1)).current;

  // Determine active tab index (0: index, 1: map, 2: plus, 3: chat, 4: profile)
  const activeRouteName = state.routes[state.index]?.name;
  const isChatActive = pathname?.startsWith('/chat');

  let activeIndex = 0;
  if (isChatActive) {
    activeIndex = 3;
  } else if (activeRouteName === 'map') {
    activeIndex = 1;
  } else if (activeRouteName === 'profile') {
    activeIndex = 4;
  } else {
    activeIndex = 0;
  }

  // Smooth Liquid Glass Sliding Animated Position
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeIndex,
      friction: 7,
      tension: 65,
      useNativeDriver: true,
    }).start();
  }, [activeIndex]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (isKeyboardVisible) {
    return null;
  }

  const animateTabPress = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 0.88,
        duration: 90,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad)
      }),
      Animated.spring(anim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true
      })
    ]).start();
  };

  const handleNavPress = (routeName: string, anim: Animated.Value) => {
    animateTabPress(anim);
    if (routeName === 'chat') {
      router.push('/chat');
    } else {
      const routeIndex = state.routes.findIndex((r: any) => r.name === routeName);
      if (routeIndex !== -1) {
        const event = navigation.emit({
          type: 'tabPress',
          target: state.routes[routeIndex].key,
          canPreventDefault: true,
        });

        if (!event.defaultPrevented) {
          navigation.navigate(routeName);
        }
      } else {
        navigation.navigate(routeName as any);
      }
    }
  };

  const handleCreatePress = () => {
    animateTabPress(plusScale);
    router.push('/post/create');
  };

  const isHomeActive = activeIndex === 0;
  const isMapActive = activeIndex === 1;
  const isProfileActive = activeIndex === 4;

  // Compute 5 equal slot widths & slightly longer active pill indicator (+8px wide)
  const usableWidth = Math.max(barWidth - 8, 200);
  const slotWidth = usableWidth / 5;
  const extraWidth = 8;
  const pillWidth = slotWidth + extraWidth;
  const offsetShift = extraWidth / 2;

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [
      -offsetShift,
      slotWidth - offsetShift,
      slotWidth * 2 - offsetShift,
      slotWidth * 3 - offsetShift,
      slotWidth * 4 - offsetShift,
    ],
  });

  return (
    <View 
      style={[styles.outerWrapper, { bottom: Math.max(insets.bottom + 8, 14) }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - barWidth) > 1) {
          setBarWidth(w);
        }
      }}
    >
      {/* Floating Glassmorphism Pill Container */}
      <View style={styles.floatingBarContainer}>
        {/* Real-time Expo Blur Glassmorphism Background Layer */}
        <View style={styles.blurWrapper}>
          <BlurView 
            intensity={85} 
            tint="light" 
            style={StyleSheet.absoluteFill} 
          />

          {/* 100% Uniform Liquid Glass Sliding Active Pill Indicator (Encloses BOTH Icon and Text) */}
          <Animated.View
            style={[
              styles.liquidActivePill,
              {
                width: pillWidth,
                transform: [{ translateX: translateX }],
              },
            ]}
          />
        </View>

        {/* Item 1: Trang chủ */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleNavPress('index', homeScale)}
          activeOpacity={0.7}
        >
          <Animated.View style={[styles.iconContainer, { transform: [{ scale: homeScale }] }]}>
            <Ionicons
              name={isHomeActive ? 'home' : 'home-outline'}
              size={22}
              color={isHomeActive ? COLORS.primary : '#64748B'}
            />
            <Text style={[styles.tabLabel, isHomeActive && styles.activeTabLabel]} numberOfLines={1}>
              Trang chủ
            </Text>
          </Animated.View>
        </TouchableOpacity>

        {/* Item 2: Bản đồ */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleNavPress('map', mapScale)}
          activeOpacity={0.7}
        >
          <Animated.View style={[styles.iconContainer, { transform: [{ scale: mapScale }] }]}>
            <Ionicons
              name={isMapActive ? 'map' : 'map-outline'}
              size={22}
              color={isMapActive ? COLORS.primary : '#64748B'}
            />
            <Text style={[styles.tabLabel, isMapActive && styles.activeTabLabel]} numberOfLines={1}>
              Bản đồ
            </Text>
          </Animated.View>
        </TouchableOpacity>

        {/* Center Independent Floating Action Button (+), Overlapping Bar */}
        <TouchableOpacity
          style={styles.centerFabSlot}
          onPress={handleCreatePress}
          activeOpacity={0.85}
        >
          <Animated.View style={[styles.fabButton, { transform: [{ scale: plusScale }] }]}>
            <Ionicons name="add" size={32} color="#FFFFFF" />
          </Animated.View>
        </TouchableOpacity>

        {/* Item 3: Chat */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleNavPress('chat', chatScale)}
          activeOpacity={0.7}
        >
          <Animated.View style={[styles.iconContainer, { transform: [{ scale: chatScale }] }]}>
            <Ionicons
              name={isChatActive ? 'chatbubbles' : 'chatbubbles-outline'}
              size={22}
              color={isChatActive ? COLORS.primary : '#64748B'}
            />
            <Text style={[styles.tabLabel, isChatActive && styles.activeTabLabel]} numberOfLines={1}>
              Chat
            </Text>
          </Animated.View>
        </TouchableOpacity>

        {/* Item 4: Cá nhân */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleNavPress('profile', profileScale)}
          activeOpacity={0.7}
        >
          <Animated.View style={[styles.iconContainer, { transform: [{ scale: profileScale }] }]}>
            <Ionicons
              name={isProfileActive ? 'person' : 'person-outline'}
              size={22}
              color={isProfileActive ? COLORS.primary : '#64748B'}
            />
            <Text style={[styles.tabLabel, isProfileActive && styles.activeTabLabel]} numberOfLines={1}>
              Cá nhân
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    left: 18,
    right: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  floatingBarContainer: {
    width: '100%',
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    paddingHorizontal: 4,
  },
  blurWrapper: {
    ...StyleSheet.absoluteFill,
    borderRadius: 33,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  liquidActivePill: {
    position: 'absolute',
    top: 0,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(0, 168, 150, 0.14)',
    overflow: 'hidden',
    zIndex: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    zIndex: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 3,
  },
  activeTabLabel: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  centerFabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  fabButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 9,
  },
});
