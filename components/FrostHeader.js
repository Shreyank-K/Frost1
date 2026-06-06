import React from 'react';
import { View, Text, Platform } from 'react-native';
import { useTheme } from '../utils/theme';

export default function FrostHeader({
  title,
  subtitle,
  compact = false,
  right,
  branded = false,
  contentStyle
}) {
  const { theme } = useTheme();

  if (branded) {
    return (
      <View
        style={[
          {
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 8,
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between'
          },
          contentStyle
        ]}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: '900', letterSpacing: 2, textShadowColor: 'rgba(0, 123, 255, 0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }}>FROST</Text>
        </View>
        {right ? <View style={{ marginTop: 4 }}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View
      style={[
        {
          paddingHorizontal: 20,
          paddingTop: compact ? 8 : 14,
          paddingBottom: compact ? 18 : 22,
          backgroundColor: 'transparent'
        },
        contentStyle
      ]}
    >
      <View
        style={{
          borderRadius: 26,
          borderWidth: 1,
          borderColor: theme.accentBorder || theme.cardBorder,
          backgroundColor: 'transparent',
          shadowColor: theme.accent,
          shadowOpacity: theme.mode === 'dark' ? 0.34 : 0.14,
          shadowRadius: theme.mode === 'dark' ? 18 : 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        }}
      >
        <View
          style={{
            borderRadius: 25,
            overflow: 'hidden',
            backgroundColor: theme.surface,
            paddingHorizontal: 18,
            paddingVertical: compact ? 16 : 20,
          }}
        >
          {/* subtle decorative backdrops for depth */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: -34,
              top: -30,
              width: 180,
              height: 160,
              borderRadius: 999,
              backgroundColor: theme.accentGlow
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: -26,
              bottom: -48,
              width: 140,
              height: 120,
              borderRadius: 999,
              backgroundColor: theme.accentIndigoSoft || (theme.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(29,143,225,0.06)')
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: right ? 12 : 0 }}>
              {title ? (
                <Text
                  style={{
                    color: theme.text,
                    fontSize: compact ? 30 : 34,
                    fontWeight: Platform.OS === 'ios' ? '700' : '800',
                    letterSpacing: -0.6,
                    textTransform: 'capitalize',
                    textShadowColor: theme.accent,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 12,
                  }}
                >
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text style={{ color: theme.subtext, fontSize: 13.5, lineHeight: 20, marginTop: 6 }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {right ? <View style={{ marginTop: 2 }}>{right}</View> : null}
          </View>

          {!right ? (
            <Text
              style={{
                marginTop: 14,
                color: theme.accent,
                fontSize: 11,
                letterSpacing: 1.7,
                fontWeight: '900',
                opacity: 0.95
              }}
            >
              RESALE CONTROL PANEL
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
