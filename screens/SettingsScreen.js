import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Switch, Pressable, Modal, Animated, Easing, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FrostHeader from '../components/FrostHeader';
import SurfaceCard from '../components/SurfaceCard';
import { useTheme } from '../utils/theme';
import { deleteAccount, sendPasswordResetEmail, signOutOtherSessions, updatePassword } from '../utils/auth';

function Row({ icon, title, subtitle, right, onPress, showDivider = false }) {
  const { theme } = useTheme();
  const content = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.accentSoft,
            marginRight: 14
          }}
        >
          <Ionicons name={icon} size={20} color={theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>{title}</Text>
          {subtitle ? <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 4, lineHeight: 18 }}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {showDivider ? <View style={{ height: 1, backgroundColor: theme.divider }} /> : null}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
}

function ModalShell({ visible, onClose, title, subtitle, children }) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [visible, anim]);

  const containerStyle = {
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }
    ]
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 }}>
        <Animated.View style={containerStyle}>
          <SurfaceCard style={{ padding: 22, borderRadius: 28, maxHeight: '80%' }} elevated>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900' }}>{title}</Text>
                {subtitle ? <Text style={{ color: theme.subtext, fontSize: 13, lineHeight: 19, marginTop: 5 }}>{subtitle}</Text> : null}
              </View>
              <Pressable onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }} style={{ padding: 6, marginTop: -2 }}>
                <Ionicons name="close" size={22} color={theme.muted} />
              </Pressable>
            </View>
            <ScrollView style={{ marginTop: 16 }} showsVerticalScrollIndicator={false} bounces={false}>
              {children}
            </ScrollView>
          </SurfaceCard>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PlanCard({ title, price, period, featured = false, items, cta, current = false, onPress, disabled = false, badgeLabel = null }) {
  const { theme } = useTheme();
  return (
    <SurfaceCard
      style={{
        flex: 1,
        padding: 14,
        backgroundColor: featured ? theme.accentSoft : theme.surfaceElevated,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '900' }}>{title}</Text>
        {current ? (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: theme.surface }}>
            <Text style={{ color: theme.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>CURRENT</Text>
          </View>
        ) : null}
        {!current && badgeLabel ? (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: theme.surface }}>
            <Text style={{ color: theme.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '900', marginTop: 10 }}>${price}</Text>
      <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 1 }}>{period}</Text>
      <View style={{ marginTop: 12, gap: 7 }}>
        {items.map(line => (
          <View key={line} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={15} color={featured ? theme.accent : theme.profit} />
            <Text style={{ color: theme.subtext, fontSize: 12, lineHeight: 17, marginLeft: 6, flex: 1 }}>{line}</Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => ({
          marginTop: 14,
          backgroundColor: featured ? theme.accent : theme.surface,
          borderWidth: 1,
          borderColor: featured ? theme.accentBorder : theme.cardBorder,
          borderRadius: 16,
          paddingVertical: 11,
          alignItems: 'center',
          opacity: disabled || pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }]
        })}
      >
        <Text style={{ color: featured ? theme.primaryButtonText : theme.text, fontSize: 13, fontWeight: '900' }}>{cta}</Text>
      </Pressable>
    </SurfaceCard>
  );
}

function InfoRow({ label, value, fullWidthValue = false }) {
  const { theme } = useTheme();

  if (fullWidthValue) {
    return (
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.divider }}>
        <Text
          numberOfLines={1}
          ellipsizeMode="middle"
          style={{ color: theme.text, fontSize: 14, fontWeight: '800' }}
        >
          {value}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.divider }}>
      <Text style={{ color: theme.muted, fontSize: 12, letterSpacing: 1.1, fontWeight: '800' }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800', maxWidth: '56%', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function formatUserSince(createdAt) {
  if (!createdAt) return 'Unavailable';

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Unavailable';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SecurityInput({ label, value, onChangeText, placeholder }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ color: theme.muted, fontSize: 11, letterSpacing: 1.1, fontWeight: '800', marginBottom: 8 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        style={{
          backgroundColor: theme.inputBg,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: theme.inputBorder,
          color: theme.text,
          paddingHorizontal: 14,
          paddingVertical: 14,
          fontSize: 15,
        }}
      />
    </View>
  );
}

export default function SettingsScreen({ user, onSignOut, onBack }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const [accountVisible, setAccountVisible] = useState(false);
  const [pricingVisible, setPricingVisible] = useState(false);
  const [securityVisible, setSecurityVisible] = useState(false);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [securityNotice, setSecurityNotice] = useState('');

  const openSecurity = () => {
    setSecurityError('');
    setSecurityNotice('');
    setCurrentPassword('');
    setNextPassword('');
    setConfirmPassword('');
    setSecurityVisible(true);
  };

  const submitPasswordChange = async () => {
    if (!currentPassword || !nextPassword || !confirmPassword) {
      setSecurityError('Enter your current password and confirm the new one.');
      setSecurityNotice('');
      return;
    }

    if (nextPassword !== confirmPassword) {
      setSecurityError('New password and confirm password must match.');
      setSecurityNotice('');
      return;
    }

    setSecurityBusy(true);
    setSecurityError('');
    setSecurityNotice('');
    try {
      const result = await updatePassword({ password: nextPassword, currentPassword });
      if (!result?.ok) {
        setSecurityError(result?.error || 'Could not update password.');
        return;
      }
      setSecurityNotice(result.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
    } finally {
      setSecurityBusy(false);
    }
  };

  const emailResetLink = async () => {
    if (!user?.email) return;
    setSecurityBusy(true);
    setSecurityError('');
    setSecurityNotice('');
    try {
      const result = await sendPasswordResetEmail({ email: user.email });
      if (!result?.ok) {
        setSecurityError(result?.error || 'Could not send reset email.');
        return;
      }
      setSecurityNotice(result.message || 'Reset email sent.');
    } finally {
      setSecurityBusy(false);
    }
  };

  const revokeOtherSessions = async () => {
    setSecurityBusy(true);
    setSecurityError('');
    setSecurityNotice('');
    try {
      const result = await signOutOtherSessions();
      if (!result?.ok) {
        setSecurityError(result?.error || 'Could not sign out other sessions.');
        return;
      }
      setSecurityNotice(result.message || 'Signed out other active sessions.');
    } finally {
      setSecurityBusy(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'You’ll be returned to the login screen. Your Frost data will remain in your synced account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          if (!onSignOut) return;
          try {
            await onSignOut();
          } catch (e) {}
        }
      }
    ]);
  };

  const confirmDeleteAccount = () => {
    if (accountBusy) return;

    Alert.alert(
      'Delete account?',
      'This permanently deletes your Frost account, saved flips, profile, and activity from Supabase. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setAccountBusy(true);
            try {
              const result = await deleteAccount();
              if (!result?.ok) {
                Alert.alert('Delete failed', result?.error || 'Could not delete your account right now.');
                return;
              }

              setAccountVisible(false);
              if (onSignOut) {
                await onSignOut({ skipLogout: true });
              }
            } catch (error) {
              Alert.alert('Delete failed', error?.message || 'Could not delete your account right now.');
            } finally {
              setAccountBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FrostHeader
        title="Settings"
        subtitle="Customize Frost and review your synced account setup."
        compact
        right={onBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 16,
              backgroundColor: pressed ? theme.surface : theme.surfaceElevated,
              borderWidth: 1,
              borderColor: theme.cardBorder,
            })}
          >
            <Ionicons name="chevron-back" size={16} color={theme.text} />
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '800', marginLeft: 4 }}>Profile</Text>
          </Pressable>
        ) : null}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 122, paddingTop: 0 }}>
        <SurfaceCard style={{ paddingHorizontal: 16, paddingVertical: 6, marginBottom: 12 }}>
          <Row
            icon="contrast-outline"
            title="Appearance"
            subtitle={isDark ? 'Dark mode enabled' : 'Light mode enabled'}
            right={<Switch value={isDark} onValueChange={toggleTheme} thumbColor="#ffffff" trackColor={{ false: '#CBD5E1', true: theme.accent }} />}
          />
        </SurfaceCard>

        <SurfaceCard style={{ paddingHorizontal: 16, paddingVertical: 6, marginBottom: 12 }}>
          <Row
            icon="person-outline"
            title="Account"
            subtitle="View your account details and sync setup"
            onPress={() => setAccountVisible(true)}
            right={<Ionicons name="chevron-forward" size={18} color={theme.muted} />}
            showDivider
          />
          <Row
            icon="shield-checkmark-outline"
            title="Security"
            subtitle="Change password and manage active sessions"
            onPress={openSecurity}
            right={<Ionicons name="chevron-forward" size={18} color={theme.muted} />}
            showDivider
          />
          <Row
            icon="notifications-outline"
            title="Notifications"
            subtitle="Push alerts join after the beta launch"
            showDivider
          />
          <Row
            icon="card-outline"
            title="Plans"
            subtitle="Free plan active — Pro beta opens later"
            onPress={() => setPricingVisible(true)}
            right={<Ionicons name="chevron-forward" size={18} color={theme.muted} />}
          />
        </SurfaceCard>

        <SurfaceCard style={{ padding: 18 }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>About</Text>
          <Text style={{ color: theme.subtext, lineHeight: 21, marginTop: 10 }}>
            Frost helps resellers evaluate, save, and track flips in one place. It’s built to stay fast, synced across devices, and practical while still feeling premium.
          </Text>
        </SurfaceCard>

        <SurfaceCard style={{ padding: 16, marginTop: 12 }}>
          <Pressable
            onPress={confirmSignOut}
            style={({ pressed }) => ({
              backgroundColor: theme.destructiveButtonBg,
              borderRadius: 18,
              paddingVertical: 15,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: theme.cardBorder,
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              shadowColor: theme.destructiveButtonText,
              shadowOpacity: pressed ? 0.04 : 0.08,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 6 }
            })}
          >
            <Text style={{ color: theme.destructiveButtonText, fontWeight: '900', fontSize: 15 }}>Sign Out</Text>
          </Pressable>
        </SurfaceCard>
      </ScrollView>

      <ModalShell
        visible={accountVisible}
        onClose={() => setAccountVisible(false)}
        title="Account"
        subtitle="Basic profile details and how Frost stores your data in Supabase."
      >
        <InfoRow label="NAME" value={user?.name || 'Local user'} />
        <InfoRow label="USER SINCE" value={formatUserSince(user?.createdAt)} />
        <InfoRow label="SYNC" value="Enabled" />
        <InfoRow label="PLAN" value="Free beta" />
        <Text style={{ color: theme.subtext, lineHeight: 21, marginTop: 14 }}>
          Frost now stores your account, saved flips, profile preferences, and activity in Supabase so your setup can survive reinstalling the app or switching devices.
        </Text>

        <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.divider }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>Delete account</Text>
          <Text style={{ color: theme.subtext, lineHeight: 20, marginTop: 6 }}>
            Permanently remove your auth user and synced Frost data from Supabase.
          </Text>
          <Pressable
            onPress={confirmDeleteAccount}
            disabled={accountBusy}
            style={({ pressed }) => ({
              marginTop: 14,
              backgroundColor: theme.destructiveButtonBg,
              borderRadius: 18,
              paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: theme.cardBorder,
              opacity: accountBusy || pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: theme.destructiveButtonText, fontWeight: '900' }}>
              {accountBusy ? 'Deleting account...' : 'Delete your account'}
            </Text>
          </Pressable>
        </View>
      </ModalShell>

      <ModalShell
        visible={securityVisible}
        onClose={() => setSecurityVisible(false)}
        title="Security"
        subtitle="Update your password, send yourself a reset link, or revoke other active sessions."
      >
        <InfoRow value={user?.email || 'Unavailable'} fullWidthValue />
        <SecurityInput
          label="CURRENT PASSWORD"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Your current password"
        />
        <SecurityInput
          label="NEW PASSWORD"
          value={nextPassword}
          onChangeText={setNextPassword}
          placeholder="Choose a stronger password"
        />
        <SecurityInput
          label="CONFIRM NEW PASSWORD"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Repeat the new password"
        />
        <Text style={{ color: theme.subtext, fontSize: 12, lineHeight: 18, marginTop: 10 }}>
          Passwords now require at least 8 characters with uppercase, lowercase, a number, and a special character.
        </Text>

        {securityError ? (
          <View style={{ backgroundColor: theme.lossSoft, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginTop: 14 }}>
            <Text style={{ color: theme.loss, fontWeight: '800' }}>{securityError}</Text>
          </View>
        ) : null}

        {securityNotice ? (
          <View style={{ backgroundColor: theme.accentSoft, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginTop: 14 }}>
            <Text style={{ color: theme.accent, fontWeight: '800' }}>{securityNotice}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={submitPasswordChange}
          disabled={securityBusy}
          style={({ pressed }) => ({
            marginTop: 16,
            backgroundColor: theme.accent,
            borderRadius: 18,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: securityBusy || pressed ? 0.92 : 1,
          })}
        >
          <Text style={{ color: theme.primaryButtonText, fontWeight: '900' }}>
            {securityBusy ? 'Please wait...' : 'Update password'}
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Pressable
            onPress={emailResetLink}
            disabled={securityBusy}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: theme.secondaryButtonBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.cardBorder,
              paddingVertical: 13,
              alignItems: 'center',
              opacity: securityBusy || pressed ? 0.92 : 1,
            })}
          >
            <Text style={{ color: theme.secondaryButtonText, fontWeight: '900', fontSize: 12 }}>Email reset link</Text>
          </Pressable>

          <Pressable
            onPress={revokeOtherSessions}
            disabled={securityBusy}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: theme.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.cardBorder,
              paddingVertical: 13,
              alignItems: 'center',
              opacity: securityBusy || pressed ? 0.92 : 1,
            })}
          >
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 12 }}>Sign out other devices</Text>
          </Pressable>
        </View>
      </ModalShell>

      <ModalShell
        visible={pricingVisible}
        onClose={() => setPricingVisible(false)}
        title="Plans"
        subtitle="Free keeps the core loop open during beta. Pro opens later with deeper pricing tools and ad-free scanning."
      >
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <PlanCard
            title="Free"
            price="0"
            period="forever"
            current
            items={[
              'Synced account and saved inventory',
              'Core profit, ROI, and deal confidence',
              'Comparable sample',
              'Profile stats and streaks'
            ]}
            cta="Current plan"
            disabled
          />
          <PlanCard
            title="Pro"
            price="4.99"
            period="monthly"
            featured
            badgeLabel="BETA LATER"
            items={[
              'Removes ads across Frost',
              'Break-even price and guardrails',
              'Pricing strategy, range, and confidence',
              'Full comparable trail and reasoning',
              'Priority access to future power-user tools'
            ]}
            cta="Coming soon"
            disabled
          />
        </View>
        <Text style={{ color: theme.subtext, lineHeight: 21, marginTop: 16 }}>
          Pro stays off during this launch. When beta expands, it will focus on safer pricing context, full comparable trails, and ad-free scanning.
        </Text>
      </ModalShell>
    </View>
  );
}
