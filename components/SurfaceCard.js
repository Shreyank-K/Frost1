import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../utils/theme';

export default function SurfaceCard({ children, style, elevated = false }) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: elevated ? theme.surfaceElevated : 'transparent',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.accentBorder || theme.cardBorder || 'rgba(0,0,0,0.08)',
          shadowColor: theme.accent,
          shadowOpacity: theme.mode === 'dark' ? 0.36 : 0.16,
          shadowRadius: theme.mode === 'dark' ? 20 : 14,
          shadowOffset: { width: 0, height: 0 },
          elevation: elevated ? 12 : 8,
          overflow: 'visible'
        },
        style
      ]}
    >
      {children}
    </View>
  );
}
