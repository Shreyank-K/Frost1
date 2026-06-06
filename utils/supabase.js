import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import * as ExpoLinking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://eqiakgiwjubsnrgsylxc.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wNawtmCZ3fwUyh-ptK526w_dRtKLFc8';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

const supabaseHost = (() => {
  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    return '';
  }
})();

export const supabaseAuthStorageKey = supabaseHost
  ? `sb-${supabaseHost.split('.')[0]}-auth-token`
  : 'supabase-auth-token';

const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
export const supabaseProjectKey = supabasePublishableKey;

const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
        storageKey: supabaseAuthStorageKey,
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your .env.'
    );
  }

  return supabase;
}

export function getAuthRedirectUrl() {
  return ExpoLinking.createURL('auth/reset-password');
}

function parseAuthUrlParams(url) {
  const value = String(url || '').trim();
  if (!value) return {};

  const queryIndex = value.indexOf('?');
  const hashIndex = value.indexOf('#');
  const queryString = queryIndex >= 0
    ? value.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
    : '';
  const hashString = hashIndex >= 0 ? value.slice(hashIndex + 1) : '';
  const params = new URLSearchParams();

  for (const entry of [queryString, hashString]) {
    const parsed = new URLSearchParams(entry);
    parsed.forEach((paramValue, key) => {
      params.set(key, paramValue);
    });
  }

  return Object.fromEntries(params.entries());
}

export async function createSessionFromUrl(url) {
  if (!supabase) return null;

  const params = parseAuthUrlParams(url);
  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  const type = String(params.type || '').toLowerCase() || null;

  if (!accessToken || !refreshToken) {
    return { session: null, type, params };
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }

  return { session: data.session || null, type, params };
}

export async function getAuthToken() {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export async function getCurrentAuthUser() {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user || null;
}
