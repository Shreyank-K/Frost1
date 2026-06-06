import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FrostHeader from '../components/FrostHeader';
import SurfaceCard from '../components/SurfaceCard';
import { useTheme } from '../utils/theme';

function SnapshotTile({ label, value, tone = 'default' }) {
  const { theme } = useTheme();
  const valueColor = tone === 'profit'
    ? theme.profit
    : tone === 'warning'
    ? theme.warning
    : tone === 'accent'
    ? theme.accent
    : theme.text;

  return (
    <View
      style={{
        width: '48%',
        backgroundColor: theme.surfaceElevated,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <Text style={{ color: theme.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }}>{label}</Text>
      <Text style={{ color: valueColor, fontSize: 18, fontWeight: '900', marginTop: 8 }}>{value}</Text>
    </View>
  );
}

function BetaBullet({ icon, title, body }) {
  const { theme } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
      <View style={{ width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSoft, marginRight: 12 }}>
        <Ionicons name={icon} size={18} color={theme.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '900' }}>{title}</Text>
        <Text style={{ color: theme.subtext, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{body}</Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen({ user, stats }) {
  const { theme } = useTheme();

  const snapshot = [
    { label: 'LEVEL', value: String(stats?.level || 1), tone: 'accent' },
    { label: 'XP', value: `${stats?.totalPoints || 0}`, tone: 'warning' },
    { label: 'PROFIT', value: `$${Number(stats?.totalProfit || 0).toFixed(2)}`, tone: 'profit' },
    { label: 'STREAK', value: `${stats?.streakDays || 1} days`, tone: 'default' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FrostHeader title="Community" subtitle="Beta board for your early-access momentum and what opens next." compact />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 122, paddingTop: 0 }}>
        <SurfaceCard style={{ padding: 22, marginBottom: 12, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -16, top: -20, width: 180, height: 100, borderRadius: 28, backgroundColor: theme.warningSoft, transform: [{ rotate: '-8deg' }] }} />
          <View style={{ position: 'absolute', left: -18, bottom: -22, width: 130, height: 80, borderRadius: 24, backgroundColor: theme.accentIndigoSoft }} />

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.cardBorder }}>
              <Ionicons name="rocket-outline" size={26} color={theme.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>BETA COMMUNITY</Text>
              <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900', marginTop: 4 }}>Community board opens later</Text>
            </View>
          </View>

          <Text style={{ color: theme.subtext, lineHeight: 21, marginTop: 14 }}>
            Frost is live as an iOS beta first. Instead of fake rankings, this tab tracks your own momentum and previews the community layers that unlock once the beta has enough active flippers.
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.cardBorder }}>
              <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '900' }}>iOS BETA</Text>
            </View>
            <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.cardBorder }}>
              <Text style={{ color: theme.text, fontSize: 11, fontWeight: '900' }}>REAL DATA FIRST</Text>
            </View>
          </View>
        </SurfaceCard>

        <SurfaceCard style={{ padding: 18, marginBottom: 12 }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>
            {user?.name || 'You'} in beta
          </Text>
          <Text style={{ color: theme.subtext, lineHeight: 20, marginTop: 6 }}>
            Your activity already shapes the foundation for future community rankings.
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14 }}>
            {snapshot.map((item) => (
              <SnapshotTile key={item.label} {...item} />
            ))}
          </View>
        </SurfaceCard>

        <SurfaceCard style={{ padding: 18, marginBottom: 12 }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>What opens first</Text>
          <View style={{ marginTop: 14 }}>
            {[
              {
                icon: 'trophy-outline',
                title: 'Weekly leaders',
                body: 'Once the beta has enough consistent activity, Frost can publish real weekly movers instead of fake global ranks.',
              },
              {
                icon: 'grid-outline',
                title: 'Category ladders',
                body: 'Sneakers, electronics, collectibles, and other lanes can each get their own board once the traffic is there.',
              },
              {
                icon: 'people-outline',
                title: 'Friend circles',
                body: 'Smaller private boards and local bragging rights fit better than noisy global rankings in the early stage.',
              },
            ].map((item) => (
              <BetaBullet key={item.title} {...item} />
            ))}
          </View>
        </SurfaceCard>

        <SurfaceCard style={{ padding: 18 }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>How ranking will work</Text>
          <View style={{ marginTop: 14 }}>
            {[
              {
                icon: 'flash-outline',
                title: 'XP momentum',
                body: 'Analyses, saved flips, and sold wins will build the weekly score instead of raw taps alone.',
              },
              {
                icon: 'cash-outline',
                title: 'Profit quality',
                body: 'Margin and consistency should matter more than spam so the board stays useful for real flippers.',
              },
              {
                icon: 'shield-checkmark-outline',
                title: 'Real before loud',
                body: 'The beta version stays honest: better to show your real progress now than fake community numbers too early.',
              },
            ].map((item) => (
              <BetaBullet key={item.title} {...item} />
            ))}
          </View>
        </SurfaceCard>
      </ScrollView>
    </View>
  );
}
