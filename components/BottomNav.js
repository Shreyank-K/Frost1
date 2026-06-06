import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../utils/theme';

const tabs = [
  { key: 'flip', label: 'Home', icon: 'flash-outline' },
  { key: 'flips', label: 'My Flips', icon: 'bookmark-outline' },
  { key: 'leaderboard', label: 'Community', icon: 'people-outline' },
  { key: 'profile', label: 'Profile', icon: 'person-outline' }
];

export default function BottomNav({ activeTab, onChange }) {
  const { theme } = useTheme();
  const indicatorX = useRef(new Animated.Value(0)).current;
  const [tabLayouts, setTabLayouts] = useState({});
  const activeLayout = tabLayouts[activeTab] || null;

  useEffect(() => {
    if (!activeLayout) return;
    Animated.spring(indicatorX, {
      toValue: activeLayout.x,
      useNativeDriver: true,
      friction: 14,
      tension: 120
    }).start();
  }, [activeLayout, indicatorX]);

  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: theme.divider,
        backgroundColor: theme.navBg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      {/* animated active background */}
      {activeLayout ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: Math.max(0, activeLayout.y - 1),
            width: activeLayout.width,
            height: activeLayout.height,
            borderRadius: 18,
            backgroundColor: theme.accentSoft,
            borderWidth: 1,
            borderColor: theme.accentBorder,
            shadowColor: theme.accent,
            shadowOpacity: 0.12,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            transform: [{ translateX: indicatorX }]
          }}
        />
      ) : null}

      {tabs.map(tab => {
        const active = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            onLayout={(e) => {
              const { x, y, width, height } = e.nativeEvent.layout;
              setTabLayouts((prev) => {
                const existing = prev[tab.key];
                if (
                  existing &&
                  existing.x === x &&
                  existing.y === y &&
                  existing.width === width &&
                  existing.height === height
                ) {
                  return prev;
                }

                return {
                  ...prev,
                  [tab.key]: { x, y, width, height },
                };
              });
            }}
            style={({ pressed }) => ({
              flex: 1,
              marginHorizontal: 4,
              paddingHorizontal: 8,
              paddingVertical: 6,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              transform: [{ scale: pressed ? 0.97 : 1 }]
            })}
          >
            <Ionicons name={tab.icon} size={20} color={active ? theme.accent : theme.muted} />
            <Text
              style={{
                color: active ? theme.accent : theme.muted,
                fontSize: 11,
                fontWeight: active ? '800' : '700',
                marginTop: 5
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
