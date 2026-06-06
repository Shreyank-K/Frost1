import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  Easing,
  Pressable,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FrostHeader from '../components/FrostHeader';
import SurfaceCard from '../components/SurfaceCard';
import { useTheme } from '../utils/theme';
import { AVATAR_OPTIONS, CATEGORY_OPTIONS, STYLE_OPTIONS } from '../utils/profileStore';

function StatCard({ label, value, icon, color, subtitle }) {
  const { theme } = useTheme();
  return (
    <SurfaceCard style={{ flex: 1, padding: 14, minHeight: 106 }}>
      <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={color || theme.accent} />
      </View>
      <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900', marginTop: 12 }}>{value}</Text>
      <Text style={{ color: theme.muted, fontSize: 10.5, letterSpacing: 1.2, fontWeight: '800', marginTop: 4 }}>{label}</Text>
      {subtitle ? <Text style={{ color: theme.subtext, fontSize: 11, marginTop: 6 }}>{subtitle}</Text> : null}
    </SurfaceCard>
  );
}

function BadgeCard({ badge }) {
  const { theme } = useTheme();
  const color = badge.tone === 'profit' ? theme.profit : theme.accent;
  const bg = badge.tone === 'profit' ? theme.profitSoft : theme.accentSoft;
  return (
    <SurfaceCard style={{ width: '48%', backgroundColor: bg, padding: 14, marginBottom: 10 }}>
      <Text style={{ fontSize: 28 }}>{badge.emoji}</Text>
      <Text style={{ color, fontSize: 15, fontWeight: '900', marginTop: 8 }}>{badge.title}</Text>
      <Text style={{ color: theme.subtext, fontSize: 12, lineHeight: 18, marginTop: 5 }}>{badge.detail}</Text>
    </SurfaceCard>
  );
}

function ChoiceChip({ label, active, onPress }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: active ? theme.accentSoft : theme.surfaceElevated,
        borderWidth: 1,
        borderColor: active ? theme.accentBorder : theme.cardBorder,
        marginRight: 8,
        marginBottom: 8,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <Text style={{ color: active ? theme.accent : theme.text, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

function ProfileEditorModal({ visible, onClose, profilePrefs, onSave }) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState(profilePrefs);

  useEffect(() => {
    setDraft(profilePrefs);
  }, [profilePrefs]);

  if (!draft) return null;

  const toggleCategory = (category) => {
    const selected = draft.favoriteCategories || [];
    const exists = selected.includes(category);
    let next = exists ? selected.filter((item) => item !== category) : [...selected, category];
    next = next.slice(0, 3);
    setDraft({ ...draft, favoriteCategories: next });
  };

  const save = () => {
    onSave(draft);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 }}>
        <SurfaceCard style={{ padding: 20, borderRadius: 28, maxHeight: '86%' }} elevated>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900' }}>Customize profile</Text>
              <Text style={{ color: theme.subtext, lineHeight: 20, marginTop: 6 }}>Shape Frost around your lane and the way you like to source.</Text>
            </View>
            <Pressable onPress={onClose} style={{ padding: 6 }}>
              <Ionicons name="close" size={22} color={theme.muted} />
            </Pressable>
          </View>

          <ScrollView style={{ marginTop: 14 }} showsVerticalScrollIndicator={false}>
            <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 }}>AVATAR</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {AVATAR_OPTIONS.map((avatar) => (
                <Pressable
                  key={avatar}
                  onPress={() => setDraft({ ...draft, avatar })}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 18,
                    backgroundColor: draft.avatar === avatar ? theme.accentSoft : theme.surfaceElevated,
                    borderWidth: 1,
                    borderColor: draft.avatar === avatar ? theme.accentBorder : theme.cardBorder,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{avatar}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 10 }}>HEADLINE</Text>
            <TextInput
              value={draft.headline}
              onChangeText={(headline) => setDraft({ ...draft, headline })}
              placeholder="Quick-flip specialist"
              placeholderTextColor={theme.muted}
              style={{
                marginTop: 8,
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

            <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 16, marginBottom: 8 }}>MAIN NICHE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {CATEGORY_OPTIONS.filter((item) => item !== 'All').map((category) => (
                <ChoiceChip
                  key={category}
                  label={category}
                  active={draft.mainNiche === category}
                  onPress={() => setDraft({ ...draft, mainNiche: category })}
                />
              ))}
            </View>

            <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 16, marginBottom: 8 }}>FLIP STYLE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {STYLE_OPTIONS.map((style) => (
                <ChoiceChip
                  key={style}
                  label={style}
                  active={draft.flipStyle === style}
                  onPress={() => setDraft({ ...draft, flipStyle: style })}
                />
              ))}
            </View>

            <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 16, marginBottom: 8 }}>FAVORITE FEED CATEGORIES (UP TO 3)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {CATEGORY_OPTIONS.filter((item) => item !== 'All').map((category) => (
                <ChoiceChip
                  key={category}
                  label={category}
                  active={(draft.favoriteCategories || []).includes(category)}
                  onPress={() => toggleCategory(category)}
                />
              ))}
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: theme.secondaryButtonBg,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: theme.cardBorder,
                paddingVertical: 14,
                alignItems: 'center',
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <Text style={{ color: theme.secondaryButtonText, fontWeight: '900' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: theme.accent,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: theme.accentBorder,
                paddingVertical: 14,
                alignItems: 'center',
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <Text style={{ color: theme.primaryButtonText, fontWeight: '900' }}>Save profile</Text>
            </Pressable>
          </View>
        </SurfaceCard>
      </View>
    </Modal>
  );
}

export default function Profile({ stats, user, profilePrefs, onUpdateProfile, onOpenSettings = () => {} }) {
  const { theme } = useTheme();
  const [editorVisible, setEditorVisible] = useState(false);
  const cards = [
    { label: 'ANALYSES', value: stats.analysesCount, color: theme.accent, icon: 'sparkles-outline', subtitle: 'Market checks logged' },
    { label: 'AVG ROI', value: `${stats.avgRoi.toFixed(1)}%`, color: theme.profit, icon: 'trending-up-outline', subtitle: 'Across completed flips' },
    { label: 'SAVED', value: stats.savedCount, color: theme.text, icon: 'bookmark-outline', subtitle: 'In your inventory' },
    { label: 'STREAK', value: `${stats.streakDays}d`, color: theme.warning, icon: 'flame-outline', subtitle: 'Consecutive active days' },
  ];

  const screenAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenAnim, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.timing(progressAnim, {
      toValue: Math.min((stats.totalPoints % 80) / 80 || 0.05, 1),
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progressAnim, screenAnim, stats.totalPoints]);

  const levelTitles = ['Scout', 'Hustler', 'Closer', 'Reseller', 'Operator', 'Market Killer'];
  const levelTitle = levelTitles[Math.min(levelTitles.length - 1, Math.floor((stats.level - 1) / 3))];
  const nextXp = stats.nextLevelAt - stats.totalPoints;

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        opacity: screenAnim,
        transform: [{ translateY: screenAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      <FrostHeader
        title="Profile"
        subtitle={user ? `@${user.name || user.email}` : 'Your dashboard'}
        compact
        right={(
          <Pressable
            onPress={onOpenSettings}
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
            <Ionicons name="settings-outline" size={16} color={theme.accent} />
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '800', marginLeft: 5 }}>Settings</Text>
          </Pressable>
        )}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 122, paddingTop: 6 }}>
      <SurfaceCard style={{ padding: 22, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 66, height: 66, borderRadius: 22, backgroundColor: theme.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.cardBorder }}>
            <Text style={{ fontSize: 32 }}>{profilePrefs?.avatar || '🧊'}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900' }}>{user?.name || 'You'}</Text>
            <Text style={{ color: theme.subtext, marginTop: 3 }}>{profilePrefs?.headline || 'Deal hunter'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
              <ChoiceChip label={profilePrefs?.mainNiche || 'Electronics'} active onPress={() => setEditorVisible(true)} />
              <ChoiceChip label={profilePrefs?.flipStyle || 'Quick Flips'} active={false} onPress={() => setEditorVisible(true)} />
            </View>
          </View>
          <Pressable onPress={() => setEditorVisible(true)} style={{ padding: 8 }}>
            <Ionicons name="create-outline" size={20} color={theme.accent} />
          </Pressable>
        </View>
      </SurfaceCard>

        <SurfaceCard style={{ padding: 22, marginBottom: 12, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -10, top: -12, width: 190, height: 90, backgroundColor: theme.profitSoft, borderRadius: 28, transform: [{ rotate: '-6deg' }] }} />
          <View style={{ position: 'absolute', left: -10, bottom: -18, width: 120, height: 70, backgroundColor: theme.accentIndigoSoft, borderRadius: 22, transform: [{ rotate: '-7deg' }] }} />
          <Text style={{ color: theme.muted, fontSize: 12, letterSpacing: 1.4, fontWeight: '800' }}>💰 TOTAL PROFIT</Text>
          <Text style={{ color: '#EAF9F0', fontSize: 46, fontWeight: '900', marginTop: 8, letterSpacing: -1.2, textShadowColor: theme.profit, textShadowRadius: 16 }}>
            ${stats.totalProfit.toFixed(2)}
          </Text>
          <Text style={{ color: theme.profit, fontSize: 16, fontWeight: '800', marginTop: 2 }}>+{stats.soldCount} closed flips · {stats.avgRoi.toFixed(1)}% avg ROI</Text>
        </SurfaceCard>

        <SurfaceCard style={{ padding: 20, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: theme.muted, fontSize: 11, letterSpacing: 1.3, fontWeight: '800' }}>LEVEL {stats.level}</Text>
              <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900', marginTop: 4 }}>{levelTitle}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>{stats.totalPoints} XP</Text>
              <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 3 }}>{nextXp} XP to next level</Text>
            </View>
          </View>
          <View style={{ marginTop: 16, height: 12, borderRadius: 999, backgroundColor: theme.surfaceElevated, overflow: 'hidden' }}>
            <Animated.View
              style={{
                width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                height: '100%',
                borderRadius: 999,
                backgroundColor: theme.accent,
              }}
            />
          </View>
          <Text style={{ color: theme.subtext, lineHeight: 20, marginTop: 12 }}>
            Keep analyzing, saving, and closing flips to level up and unlock more badge moments inside Frost.
          </Text>
        </SurfaceCard>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          {cards.slice(0, 2).map((card) => <StatCard key={card.label} {...card} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          {cards.slice(2).map((card) => <StatCard key={card.label} {...card} />)}
        </View>

        <SurfaceCard style={{ padding: 18, marginBottom: 12 }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>Favorite lanes</Text>
          <Text style={{ color: theme.subtext, lineHeight: 20, marginTop: 6 }}>Pick up to 3 lanes when you want Frost to sort those cards first. New accounts start with none selected.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
            {(stats.favoriteCategories || []).length ? (
              (stats.favoriteCategories || []).map((category) => (
                <ChoiceChip key={category} label={category} active onPress={() => setEditorVisible(true)} />
              ))
            ) : (
              <ChoiceChip label="Choose favorite lanes" active={false} onPress={() => setEditorVisible(true)} />
            )}
          </View>
        </SurfaceCard>

        <SurfaceCard style={{ padding: 18 }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>Badge cabinet</Text>
          <Text style={{ color: theme.subtext, lineHeight: 20, marginTop: 6 }}>Tiny reward loops make Frost feel more like your lane and less like a calculator.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14 }}>
            {stats.badges.map((badge) => (
              <BadgeCard key={badge.key} badge={badge} />
            ))}
          </View>
        </SurfaceCard>
      </ScrollView>

      <ProfileEditorModal
        visible={editorVisible}
        onClose={() => setEditorVisible(false)}
        profilePrefs={profilePrefs}
        onSave={onUpdateProfile}
      />
    </Animated.View>
  );
}
