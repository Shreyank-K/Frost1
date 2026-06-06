import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SurfaceCard from '../components/SurfaceCard';
import {
  registerUser,
  loginUser,
  sendPasswordResetEmail,
  updatePassword,
} from '../utils/auth';
import { useTheme } from '../utils/theme';

function InputField({ label, icon, ...props }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: theme.subtext, fontSize: 11, letterSpacing: 1.2, fontWeight: '800', marginBottom: 8 }}>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 18,
          backgroundColor: theme.inputBg,
          borderWidth: 1,
          borderColor: theme.inputBorder,
          paddingHorizontal: 14,
        }}
      >
        <Ionicons name={icon} size={18} color={theme.muted} />
        <TextInput
          placeholderTextColor={theme.muted}
          style={{
            flex: 1,
            color: theme.text,
            paddingVertical: 15,
            paddingLeft: 10,
            fontSize: 15,
          }}
          {...props}
        />
      </View>
    </View>
  );
}

const SCREEN_COPY = {
  login: {
    title: 'Sign in',
    subtitle: 'Pick up where you left off with your synced Frost account.',
    button: 'Sign in',
  },
  register: {
    title: 'Create your account',
    subtitle: 'Create a synced Frost account so your flips, profile, and progress live in the cloud.',
    button: 'Create account',
  },
  forgot: {
    title: 'Reset your password',
    subtitle: 'Enter your email and Frost will send a recovery link to open the password reset flow.',
    button: 'Send reset link',
  },
  resetPassword: {
    title: 'Choose a new password',
    subtitle: 'Set a stronger password for your Frost account. After that, you’ll be signed back in here.',
    button: 'Update password',
  },
};

export default function AuthScreen({
  onAuth = () => {},
  forcedMode = null,
  onExitForcedMode = () => {},
  onPasswordResetComplete = () => {},
}) {
  const { theme } = useTheme();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const activeMode = forcedMode || mode;
  const copy = useMemo(() => SCREEN_COPY[activeMode] || SCREEN_COPY.login, [activeMode]);
  const inResetRecovery = activeMode === 'resetPassword';
  const inRegister = activeMode === 'register';
  const inForgot = activeMode === 'forgot';
  const loginAction = activeMode === 'login';

  useEffect(() => {
    setError(null);
    setPassword('');
    setConfirmPassword('');
  }, [activeMode]);

  const switchMode = (nextMode) => {
    if (forcedMode) return;
    setMode(nextMode);
    setError(null);
    setNotice(null);
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      if (activeMode === 'login') {
        const res = await loginUser({ email, password });
        if (res.ok && res.user) {
          onAuth(res.user);
        } else {
          setError(res.error || 'Login failed');
        }
        return;
      }

      if (activeMode === 'register') {
        const res = await registerUser({ name, email, password });
        if (res.ok && res.user) {
          onAuth(res.user);
        } else if (res.ok && res.pendingConfirmation) {
          setNotice(res.message || 'Account created. Check your email to confirm it, then sign in.');
          setMode('login');
          setPassword('');
        } else {
          setError(res.error || 'Registration failed');
        }
        return;
      }

      if (activeMode === 'forgot') {
        const res = await sendPasswordResetEmail({ email });
        if (res.ok) {
          setNotice(res.message);
          setMode('login');
        } else {
          setError(res.error || 'Could not send reset link');
        }
        return;
      }

      if (activeMode === 'resetPassword') {
        if (!password || !confirmPassword) {
          setError('Enter and confirm your new password');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }

        const res = await updatePassword({ password });
        if (!res.ok) {
          setError(res.error || 'Could not update password');
          return;
        }

        await onPasswordResetComplete();
        return;
      }
    } catch (err) {
      setError('Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={['#000000', '#050505', '#0A0A0A']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 }}
          >
            <SurfaceCard style={{ padding: 22 }}>
              <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900' }}>{copy.title}</Text>
              <Text style={{ color: theme.subtext, lineHeight: 20, marginTop: 6, marginBottom: 18 }}>
                {copy.subtitle}
              </Text>

              {!forcedMode ? (
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 22 }}>
                  <Pressable
                    onPress={() => switchMode('login')}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 14,
                      alignItems: 'center',
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: activeMode === 'login' ? theme.accent : theme.accentBorder,
                    }}
                  >
                    <Text style={{ color: activeMode === 'login' ? theme.accent : theme.muted, fontWeight: '900' }}>SIGN IN</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => switchMode('register')}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 14,
                      alignItems: 'center',
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: activeMode === 'register' ? theme.accent : theme.accentBorder,
                    }}
                  >
                    <Text style={{ color: activeMode === 'register' ? theme.accent : theme.muted, fontWeight: '900' }}>REGISTER</Text>
                  </Pressable>
                </View>
              ) : null}

              {inRegister ? (
                <InputField
                  label="NAME"
                  icon="person-outline"
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                />
              ) : null}

              {!inResetRecovery ? (
                <InputField
                  label="EMAIL"
                  icon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              ) : null}

              {!inForgot ? (
                <InputField
                  label={inResetRecovery ? 'NEW PASSWORD' : 'PASSWORD'}
                  icon="lock-closed-outline"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                />
              ) : null}

              {inResetRecovery ? (
                <InputField
                  label="CONFIRM PASSWORD"
                  icon="shield-checkmark-outline"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  secureTextEntry
                />
              ) : null}

              {(inRegister || inResetRecovery) ? (
                <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 18, marginTop: -6, marginBottom: 12 }}>
                  Use at least 8 characters with uppercase, lowercase, a number, and a special character.
                </Text>
              ) : null}

              {activeMode === 'login' ? (
                <Pressable onPress={() => switchMode('forgot')} style={{ alignSelf: 'flex-end', marginTop: -4, marginBottom: 12 }}>
                  <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '800' }}>Forgot password?</Text>
                </Pressable>
              ) : null}

              {error ? (
                <View style={{ backgroundColor: theme.lossSoft, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 }}>
                  <Text style={{ color: theme.loss, fontWeight: '800' }}>{error}</Text>
                </View>
              ) : null}

              {notice ? (
                <View style={{ backgroundColor: theme.accentSoft, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 }}>
                  <Text style={{ color: theme.accent, fontWeight: '800' }}>{notice}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={submit}
                disabled={busy}
                style={{
                  marginTop: 8,
                  backgroundColor: loginAction ? 'transparent' : theme.accent,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: loginAction ? theme.accentBorder : theme.accent,
                  paddingVertical: 16,
                  alignItems: 'center',
                  opacity: busy ? 0.7 : 1,
                }}
              >
                <Text style={{ color: loginAction ? theme.text : theme.primaryButtonText, fontSize: 15, fontWeight: '900' }}>
                  {busy ? 'Please wait...' : copy.button}
                </Text>
              </Pressable>

              {inForgot ? (
                <Pressable onPress={() => switchMode('login')} style={{ marginTop: 14, alignItems: 'center' }}>
                  <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '800' }}>Back to sign in</Text>
                </Pressable>
              ) : null}

              {forcedMode ? (
                <Pressable onPress={onExitForcedMode} style={{ marginTop: 14, alignItems: 'center' }}>
                  <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '800' }}>Cancel recovery</Text>
                </Pressable>
              ) : null}
            </SurfaceCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
