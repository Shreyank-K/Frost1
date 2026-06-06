import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'frost_theme';

const themes = {
  dark: {
    mode: 'dark',
    // layered backgrounds (base -> layer1 -> layer2)
    background: '#000000',
    backgroundLayer1: '#050505',
    backgroundLayer2: '#0A0A0A',

    // core surfaces and cards
    surface: '#0C1620',
    cardSurface: 'rgba(15,32,44,0.78)',
    surfaceElevated: 'rgba(18,39,52,0.78)',
    surfaceSoft: 'rgba(22,48,68,0.58)',
    surfaceOverlay: 'rgba(18,39,52,0.88)',

    // semi-opaque overlay used on images
    overlay: 'rgba(4,12,20,0.42)',

    // borders & dividers
    cardBorder: 'rgba(92,200,255,0.24)',
    cardBorderSoft: 'rgba(92,200,255,0.08)',
    divider: 'rgba(255,255,255,0.06)',

    // typography
    text: '#EFF8FF',
    subtext: '#9FB0C6',
    muted: '#7F98B0',

    // primary accent family (brighter, with glow)
    accent: '#5CC8FF',
    accentSoft: 'rgba(92,200,255,0.12)',
    accentGlow: 'rgba(92,200,255,0.22)',
    accentBorder: 'rgba(92,200,255,0.32)',

    // secondary accent for depth
    accentIndigo: '#7D5CFF',
    accentIndigoSoft: 'rgba(125,92,255,0.08)',

    // profit / loss
    profit: '#23C552',
    profitSoft: 'rgba(35,197,82,0.16)',
    loss: '#FF6B6B',
    lossSoft: 'rgba(255,107,107,0.12)',

    // warnings
    warning: '#FACC15',
    warningSoft: 'rgba(250,204,21,0.14)',

    // inputs & buttons
    inputBg: '#08121A',
    inputBorder: 'rgba(255,255,255,0.06)',
    inputFocus: 'rgba(92,200,255,0.36)',

    navBg: 'rgba(0,0,0,0.96)',

    primaryButtonText: '#041018',
    secondaryButtonBg: '#122734',
    secondaryButtonText: '#C7D8E8',
    destructiveButtonBg: 'rgba(255,107,107,0.12)',
    destructiveButtonText: '#FF6B6B'
  },
  light: {
    mode: 'light',
    // layered backgrounds
    background: '#F6FBFF',
    backgroundLayer1: '#EEF6FF',
    backgroundLayer2: '#E6F0FA',

    surface: '#FFFFFF',
    cardSurface: 'rgba(255,255,255,0.74)',
    surfaceElevated: 'rgba(251,253,255,0.78)',
    surfaceSoft: 'rgba(242,249,255,0.62)',
    surfaceOverlay: 'rgba(255,255,255,0.96)',

    overlay: 'rgba(255,255,255,0.6)',

    cardBorder: 'rgba(29,143,225,0.18)',
    cardBorderSoft: 'rgba(29,143,225,0.06)',
    divider: 'rgba(15,23,42,0.08)',

    text: '#041423',
    subtext: '#53677A',
    muted: '#64748B',

    accent: '#1D8FE1',
    accentSoft: 'rgba(29,143,225,0.10)',
    accentGlow: 'rgba(29,143,225,0.18)',
    accentBorder: 'rgba(29,143,225,0.26)',

    accentIndigo: '#6D5AFF',
    accentIndigoSoft: 'rgba(109,90,255,0.06)',

    profit: '#16A34A',
    profitSoft: 'rgba(22,163,74,0.10)',
    loss: '#DC2626',
    lossSoft: 'rgba(220,38,38,0.10)',

    warning: '#CA8A04',
    warningSoft: 'rgba(202,138,4,0.10)',

    inputBg: '#F8FBFD',
    inputBorder: 'rgba(15,23,42,0.08)',
    inputFocus: 'rgba(29,143,225,0.32)',

    navBg: 'rgba(255,255,255,0.96)',

    primaryButtonText: '#FFFFFF',
    secondaryButtonBg: '#F7FAFC',
    secondaryButtonText: '#334155',
    destructiveButtonBg: 'rgba(220,38,38,0.10)',
    destructiveButtonText: '#DC2626'
  }
};

const ThemeContext = createContext({
  theme: themes.dark,
  isDark: true,
  toggleTheme: () => {},
  setMode: () => {}
});

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('dark');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_KEY)
      .then(value => {
        if (mounted && (value === 'dark' || value === 'light')) {
          setModeState(value);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const setMode = async (nextMode) => {
    const resolvedMode = nextMode === 'light' ? 'light' : 'dark';
    setModeState(resolvedMode);
    try {
      await AsyncStorage.setItem(THEME_KEY, resolvedMode);
    } catch (e) {}
  };

  const toggleTheme = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const value = useMemo(() => ({
    theme: themes[mode] || themes.dark,
    isDark: mode === 'dark',
    toggleTheme,
    setMode
  }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
