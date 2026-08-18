import React from 'react';
import { Tabs } from 'expo-router';
import { CustomTabBar } from '../../components/CustomTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Trang Chủ' }} />
      <Tabs.Screen name="map" options={{ title: 'Bản Đồ' }} />
      <Tabs.Screen name="chat" options={{ title: 'Trò Chuyện' }} />
      <Tabs.Screen name="profile" options={{ title: 'Cá Nhân' }} />
    </Tabs>
  );
}
