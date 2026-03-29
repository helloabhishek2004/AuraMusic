import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { typography, colors, styling } from '../styles/theme';

export default function FloatingNav({ state, descriptors, navigation }: any) {
  return (
    <View style={styles.container}>
      <BlurView intensity={50} style={styles.tabBarBlur} tint="dark">
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.title !== undefined ? options.title : route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate({ name: route.name, merge: true });
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={styles.tabItem}
            >
              <Text style={{ 
                color: isFocused ? colors.primary : colors.on_surface_muted,
                fontFamily: typography.labelFont,
                fontWeight: isFocused ? 'bold' : 'normal',
                fontSize: 12,
              }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    height: 64,
    ...styling.ambientShadow
  },
  tabBarBlur: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: styling.radiusFull,
    backgroundColor: styling.glassBg,
    borderColor: styling.glassBorder,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
