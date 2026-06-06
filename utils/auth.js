import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initDB,
  migrateLegacyFlipsToSupabase,
} from './db';
import { migrateLegacyProfileStoreToSupabase } from './profileStore';
import {
  getCurrentAuthUser,
  getAuthToken,
  getAuthRedirectUrl,
  requireSupabase,
  supabaseAuthStorageKey,
  supabaseProjectKey,
} from './supabase';
import { ANALYZER_URL } from './config';

let initPromise = null;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESERVED_DEFAULT_NAMES = new Set(['heisenberg']);

async function ensureInit() {
  if (!initPromise) initPromise = initDB();
  return initPromise;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function nameFromEmail(email) {
  return normalizeEmail(email).split('@')[0] || 'You';
}

function cleanDisplayName(name) {
  return String(name || '').trim();
}

function isReservedDefaultName(name) {
  return RESERVED_DEFAULT_NAMES.has(cleanDisplayName(name).toLowerCase());
}

function normalizeDisplayName(name, email) {
  const explicitName = cleanDisplayName(name);
  if (explicitName && !isReservedDefaultName(explicitName)) {
    return explicitName;
  }

  return nameFromEmail(email);
}

function validateEmail(email) {
  const value = normalizeEmail(email);
  if (!value) {
    return 'Email is required';
  }
  if (!EMAIL_REGEX.test(value)) {
    return 'Enter a valid email address';
  }
  return null;
}

export function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(value)) {
    return 'Password must include at least one uppercase letter';
  }
  if (!/[a-z]/.test(value)) {
    return 'Password must include at least one lowercase letter';
  }
  if (!/[0-9]/.test(value)) {
    return 'Password must include at least one number';
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return 'Password must include at least one special character';
  }
  return null;
}

function mapAuthError(error, context = 'default') {
  const message = String(error?.message || error || '').trim();
  const normalized = message.toLowerCase();

  if (!message) {
    return context === 'login' ? 'Could not sign in right now.' : 'Authentication failed.';
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Email or password is incorrect';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Check your inbox and confirm your email before signing in';
  }

  if (normalized.includes('user already registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }

  if (normalized.includes('email address') && normalized.includes('invalid')) {
    return 'Enter a valid email address';
  }

  if (normalized.includes('password should be at least') || normalized.includes('password should contain')) {
    return 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character';
  }

  if (normalized.includes('same password')) {
    return 'Choose a new password that is different from your current one';
  }

  if (normalized.includes('reauthentication') || normalized.includes('recently signed in')) {
    return 'For security, enter your current password and try again';
  }

  if (normalized.includes('rate limit') || normalized.includes('security purposes') || normalized.includes('too many requests')) {
    return context === 'recovery'
      ? 'Too many reset requests. Wait a minute and try again.'
      : 'Too many attempts right now. Wait a minute and try again.';
  }

  return message;
}

async function loadProfile(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message);
  }

  return data || null;
}

function mapCurrentUser(authUser, profile) {
  const email = String(authUser?.email || profile?.email || '');
  const profileName = cleanDisplayName(profile?.name);
  const metadataName = cleanDisplayName(authUser?.user_metadata?.name);
  return {
    id: String(authUser?.id || profile?.id || ''),
    email,
    name:
      profileName ||
      metadataName ||
      nameFromEmail(email),
    createdAt: profile?.created_at
      ? new Date(profile.created_at).getTime()
      : Date.now(),
  };
}

async function syncProfileFromAuth(authUser, fallbackName) {
  const supabase = requireSupabase();
  if (!authUser?.id) return null;

  const existingProfile = await loadProfile(authUser.id);
  const existingName = cleanDisplayName(existingProfile?.name);
  const normalizedFallbackName = normalizeDisplayName(fallbackName || authUser.user_metadata?.name, authUser.email);
  const shouldRepairReservedName =
    existingName &&
    isReservedDefaultName(existingName) &&
    cleanDisplayName(fallbackName) &&
    !isReservedDefaultName(fallbackName);
  const nextName = shouldRepairReservedName || !existingName ? normalizedFallbackName : existingName;

  const payload = {
    id: authUser.id,
    email: String(authUser.email || existingProfile?.email || ''),
    name: nextName,
  };

  const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
  if (error) {
    throw new Error(error.message);
  }

  return loadProfile(authUser.id);
}

async function migrateLocalStateIfNeeded(userId) {
  try {
    await Promise.all([
      migrateLegacyFlipsToSupabase(userId),
      migrateLegacyProfileStoreToSupabase(userId),
    ]);
  } catch (err) {
    console.warn('[auth] local data migration skipped', err?.message || err);
  }
}

async function finalizeSignedInUser(authUser, fallbackName) {
  const profile = await syncProfileFromAuth(authUser, fallbackName);
  await migrateLocalStateIfNeeded(authUser.id);
  const refreshedProfile = await loadProfile(authUser.id);
  return mapCurrentUser(authUser, refreshedProfile || profile);
}

export async function registerUser({ name, email, password }) {
  await ensureInit();

  const supabase = requireSupabase();
  const normalizedEmail = normalizeEmail(email);
  const emailError = validateEmail(normalizedEmail);
  if (emailError) {
    return { ok: false, error: emailError };
  }

  if (!password) {
    return { ok: false, error: 'Password is required' };
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  const displayName = normalizeDisplayName(name, normalizedEmail);

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: String(password),
    options: {
      data: {
        name: displayName,
      },
    },
  });

  if (error) {
    return { ok: false, error: mapAuthError(error, 'register') };
  }

  const activeUser = data.session?.user || (await getCurrentAuthUser());
  if (!activeUser) {
    return {
      ok: true,
      pendingConfirmation: true,
      message: 'Account created. Check your email to confirm it, then sign in.',
    };
  }

  try {
    const user = await finalizeSignedInUser(activeUser, displayName);
    return { ok: true, user };
  } catch (err) {
    return { ok: false, error: err?.message || 'Registration failed' };
  }
}

export async function loginUser({ email, password }) {
  await ensureInit();

  const supabase = requireSupabase();
  const normalizedEmail = normalizeEmail(email);
  const emailError = validateEmail(normalizedEmail);
  if (emailError) {
    return { ok: false, error: emailError };
  }

  if (!password) {
    return { ok: false, error: 'Password is required' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: String(password),
  });

  if (error) {
    return { ok: false, error: mapAuthError(error, 'login') };
  }

  try {
    const user = await finalizeSignedInUser(data.user, data.user?.user_metadata?.name);
    return { ok: true, user };
  } catch (err) {
    return { ok: false, error: err?.message || 'Login failed' };
  }
}

export async function getCurrentUser() {
  await ensureInit();

  try {
    const authUser = await getCurrentAuthUser();
    if (!authUser) return null;
    const profile = await loadProfile(authUser.id);
    return mapCurrentUser(authUser, profile);
  } catch {
    return null;
  }
}

async function clearLocalSupabaseSession() {
  try {
    await AsyncStorage.multiRemove([
      supabaseAuthStorageKey,
      `${supabaseAuthStorageKey}-code-verifier`,
      `${supabaseAuthStorageKey}-user`,
    ]);
  } catch {}
}

export async function logoutUser() {
  await ensureInit();
  try {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      const message = mapAuthError(error, 'logout');
      if (String(message).toLowerCase().includes('network request failed')) {
        await clearLocalSupabaseSession();
        return { ok: true, offline: true };
      }
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch (err) {
    const message = err?.message || 'Logout failed';
    if (String(message).toLowerCase().includes('network request failed')) {
      await clearLocalSupabaseSession();
      return { ok: true, offline: true };
    }
    return { ok: false, error: message };
  }
}

export async function deleteAccount() {
  await ensureInit();
  try {
    const token = await getAuthToken();
    if (!token) {
      return { ok: false, error: 'Sign in again before deleting your account.' };
    }

    const response = await fetch(`${ANALYZER_URL}/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(supabaseProjectKey ? { apikey: supabaseProjectKey } : {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const json = await response.json().catch(() => null);

    if (!response.ok || !json?.ok) {
      return { ok: false, error: json?.error || `Delete account returned ${response.status}` };
    }

    try {
      const supabase = requireSupabase();
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'Could not delete your account right now.' };
  }
}

export async function signOutOtherSessions() {
  await ensureInit();
  try {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) {
      return { ok: false, error: mapAuthError(error, 'logout') };
    }
    return { ok: true, message: 'Signed out other active sessions.' };
  } catch (err) {
    return { ok: false, error: err?.message || 'Could not sign out other sessions' };
  }
}

export async function sendPasswordResetEmail({ email }) {
  await ensureInit();

  const supabase = requireSupabase();
  const normalizedEmail = normalizeEmail(email);
  const emailError = validateEmail(normalizedEmail);
  if (emailError) {
    return { ok: false, error: emailError };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: getAuthRedirectUrl(),
  });

  if (error) {
    return { ok: false, error: mapAuthError(error, 'recovery') };
  }

  return {
    ok: true,
    message: 'If an account exists for this email, a password reset link has been sent.',
  };
}

export async function updatePassword({ password, currentPassword } = {}) {
  await ensureInit();

  const supabase = requireSupabase();
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  const currentPasswordValue = String(currentPassword || '').trim();
  if (currentPasswordValue) {
    const authUser = await getCurrentAuthUser();
    const normalizedEmail = normalizeEmail(authUser?.email);
    if (!normalizedEmail) {
      return { ok: false, error: 'Could not verify your current password right now' };
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: currentPasswordValue,
    });

    if (verifyError) {
      return { ok: false, error: 'Current password is incorrect' };
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: String(password),
  });
  if (error) {
    return { ok: false, error: mapAuthError(error, 'password_update') };
  }

  return { ok: true, message: 'Password updated successfully.' };
}
