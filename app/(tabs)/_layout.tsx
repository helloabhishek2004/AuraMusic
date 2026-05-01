import React, { useCallback } from 'react';
import { Tabs } from 'expo-router';
import FloatingNav from '../../src/components/FloatingNav';
import MiniPlayer from '../../src/components/MiniPlayer';
import { AtmosphericBackground } from '../../src/components/ui/atmospheric-background';
import { palette } from '../../src/design/tokens';

export default function TabLayout() {
  const renderTabBar = useCallback((props: any) => <FloatingNav {...props} />, []);

  return (
    <>
      <AtmosphericBackground intensity={0.85} />
      <Tabs
        backBehavior="history"
        detachInactiveScreens
        tabBar={renderTabBar}
        screenOptions={{
          headerShown: false,
          lazy: true,
          freezeOnBlur: true,
          sceneStyle: { backgroundColor: palette.background }
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
          }}
        />
      </Tabs>
      <MiniPlayer />
    </>
  );
}
