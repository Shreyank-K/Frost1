import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Image, Pressable, ScrollView, Alert, Platform, Animated, Easing, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FrostHeader from '../components/FrostHeader';
import SurfaceCard from '../components/SurfaceCard';
import { useTheme } from '../utils/theme';

function StatPill({ label, value, accent }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.surfaceElevated,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        paddingVertical: 14,
        paddingHorizontal: 14
      }}
    >
      <Text style={{ color: theme.muted, fontSize: 10, letterSpacing: 1.2, fontWeight: '800' }}>{label}</Text>
      <Text style={{ color: accent || theme.text, fontSize: 19, fontWeight: '900', marginTop: 8 }}>{value}</Text>
    </View>
  );
}

function FooterAction({ label, icon, onPress, primary = false }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 140,
        paddingHorizontal: 20,
        paddingVertical: 13,
        borderRadius: 18,
        backgroundColor: primary ? theme.accent : theme.secondaryButtonBg,
        borderWidth: 1,
        borderColor: primary ? theme.accentBorder : theme.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }]
      })}
    >
      <Ionicons name={icon} size={16} color={primary ? theme.primaryButtonText : theme.secondaryButtonText} />
      <Text style={{ color: primary ? theme.primaryButtonText : theme.secondaryButtonText, fontSize: 14, fontWeight: '900', marginLeft: 8 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function FlipImage({ uri }) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: 18,
          marginRight: 14,
          backgroundColor: theme.surfaceElevated,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: theme.cardBorder
        }}
      >
        <Ionicons name="image-outline" size={24} color={theme.muted} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width: 84, height: 84, borderRadius: 18, marginRight: 14, backgroundColor: theme.surfaceElevated }}
      onError={() => setFailed(true)}
    />
  );
}

function SoldFlipRow({ item, onRemove }) {
  const { theme } = useTheme();
  const profit = Number(item.profit || 0);
  const roi = Number(item.roi || 0);

  return (
    <SurfaceCard
      style={{
        backgroundColor: theme.surfaceElevated,
        padding: 12,
        marginBottom: 10
      }}
    >
      <View style={{ flexDirection: 'row' }}>
        <FlipImage uri={item.image} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ color: theme.text, fontSize: 15, fontWeight: '900', lineHeight: 20 }}>
            {item.title}
          </Text>
          <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 5 }}>
            {item.category} · {item.condition}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <View>
              <Text style={{ color: theme.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>PROFIT</Text>
              <Text style={{ color: profit >= 0 ? theme.profit : theme.loss, fontSize: 18, fontWeight: '900', marginTop: 3 }}>
                {profit >= 0 ? '+' : '-'}${Math.abs(profit).toFixed(2)}
              </Text>
            </View>
            <View>
              <Text style={{ color: theme.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>ROI</Text>
              <Text style={{ color: theme.accent, fontSize: 18, fontWeight: '900', marginTop: 3 }}>
                {roi.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => onRemove(item.id)}
        style={({ pressed }) => ({
          marginTop: 12,
          backgroundColor: theme.lossSoft,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.cardBorder,
          paddingVertical: 11,
          alignItems: 'center',
          opacity: pressed ? 0.92 : 1
        })}
      >
        <Text style={{ color: theme.loss, fontWeight: '900' }}>Remove from history</Text>
      </Pressable>
    </SurfaceCard>
  );
}

function SoldFlipsModal({ visible, onClose, items, totalProfit, onRemove }) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'center', padding: 18 }}>
        <SurfaceCard style={{ maxHeight: '86%', borderRadius: 28, overflow: 'hidden' }} elevated>
          <View
            style={{
              padding: 18,
              borderBottomWidth: 1,
              borderBottomColor: theme.divider,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900' }}>Sold Flips</Text>
              <Text style={{ color: theme.subtext, fontSize: 13, marginTop: 4 }}>
                {items.length} closed flip{items.length === 1 ? '' : 's'} · ${totalProfit.toFixed(2)} realized
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }} style={{ padding: 8 }}>
              <Ionicons name="close" size={22} color={theme.muted} />
            </Pressable>
          </View>

          {items.length ? (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 22 }} showsVerticalScrollIndicator={false}>
              {items.map(item => (
                <SoldFlipRow key={item.id} item={item} onRemove={onRemove} />
              ))}
            </ScrollView>
          ) : (
            <View style={{ padding: 26, alignItems: 'center' }}>
              <Ionicons name="receipt-outline" size={38} color={theme.accent} />
              <Text style={{ color: theme.text, fontSize: 19, fontWeight: '900', marginTop: 14 }}>No sold flips yet</Text>
              <Text style={{ color: theme.subtext, textAlign: 'center', lineHeight: 21, marginTop: 8 }}>
                Mark a flip sold and it will move here automatically.
              </Text>
            </View>
          )}
        </SurfaceCard>
      </View>
    </Modal>
  );
}

export default function MyFlips({ items, soldIds, onMarkSold, onRemove, onAddFlip, onAnalyze }) {
  const { theme } = useTheme();
  const [soldVisible, setSoldVisible] = useState(false);

  const soldItems = items.filter(item => soldIds.includes(item.id) || item.sold);
  const activeItems = items.filter(item => !(soldIds.includes(item.id) || item.sold));
  const soldCount = soldItems.length;
  const totalProfit = soldItems.reduce((sum, item) => sum + Number(item.profit || 0), 0);

  const confirmRemove = (id) => {
    Alert.alert('Remove flip', 'This will remove the flip from your saved list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemove(id) }
    ]);
  };

  // animations
  const screenAnim = useRef(new Animated.Value(0)).current;
  const fabAnim = useRef(new Animated.Value(0)).current;
  const cardAnimsRef = useRef([]);
  const prevItemCountRef = useRef(-1);

  useEffect(() => {
    Animated.timing(screenAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.spring(fabAnim, { toValue: 1, friction: 10, tension: 80, useNativeDriver: true }).start();
  }, [screenAnim, fabAnim]);

  // Only rebuild card animations when the number of items changes, not on every render
  useEffect(() => {
    if (activeItems.length === prevItemCountRef.current) return;
    prevItemCountRef.current = activeItems.length;

    cardAnimsRef.current = activeItems.map(() => new Animated.Value(0));
    const springs = cardAnimsRef.current.map((a) => Animated.spring(a, { toValue: 1, friction: 10, tension: 80, useNativeDriver: true }));
    Animated.stagger(60, springs).start();
  }, [activeItems.length]);

  const screenStyle = {
    opacity: screenAnim,
    transform: [{ translateY: screenAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }]
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Animated.View style={{ ...screenStyle }}>
        <FrostHeader title="My Flips" subtitle="Track your saved inventory and lock in profitable sales." compact />
      </Animated.View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, paddingTop: 0 }}>
        <Animated.View style={{ opacity: 1, transform: [{ translateY: 0 }], marginBottom: 12 }}>
          <SurfaceCard style={{ padding: 18, marginBottom: 16 }}>
            <Text style={{ color: theme.muted, fontSize: 11, letterSpacing: 1.4, fontWeight: '800' }}>PORTFOLIO SNAPSHOT</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <StatPill label="ACTIVE" value={String(activeItems.length)} />
              <StatPill label="SOLD" value={String(soldCount)} accent={theme.profit} />
              <StatPill label="REALIZED" value={`$${totalProfit.toFixed(0)}`} accent={totalProfit >= 0 ? theme.profit : theme.loss} />
            </View>
            <Pressable
              onPress={() => setSoldVisible(true)}
              style={({ pressed }) => ({
                marginTop: 14,
                backgroundColor: theme.profitSoft,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: theme.cardBorder,
                paddingVertical: 13,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: pressed ? 0.92 : 1
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="receipt-outline" size={17} color={theme.profit} />
                <Text style={{ color: theme.profit, fontWeight: '900', marginLeft: 8 }}>Sold Flips</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: theme.profit, fontWeight: '900', marginRight: 7 }}>{soldCount}</Text>
                <Ionicons name="chevron-forward" size={17} color={theme.profit} />
              </View>
            </Pressable>
          </SurfaceCard>
        </Animated.View>

        {activeItems.length === 0 ? (
          <Animated.View
            style={{ opacity: screenAnim, transform: [{ translateY: screenAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }], marginTop: 20 }}
          >
            <SurfaceCard style={{ padding: 30, alignItems: 'center', marginTop: 20 }}>
              <Ionicons name={soldCount ? 'checkmark-done-circle-outline' : 'bookmark-outline'} size={42} color={theme.accent} />
              <Text style={{ color: theme.text, fontSize: 25, fontWeight: Platform.OS === 'ios' ? '700' : '800', marginTop: 16 }}>
                {soldCount ? 'No active flips' : 'No flips yet'}
              </Text>
              <Text style={{ color: theme.subtext, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
                {soldCount
                  ? 'Everything active has been closed. Open Sold Flips to review your wins, or add another candidate.'
                  : 'Save a winner from the feed, add one manually, or run a quick analysis to start building your list.'}
              </Text>
            </SurfaceCard>
          </Animated.View>
        ) : (
          activeItems.map((item, idx) => {
            const anim = cardAnimsRef.current[idx] || new Animated.Value(1);
            const profit = Number(item.profit || 0);
            const roi = Number(item.roi || 0);
            return (
              <Animated.View
                key={item.id}
                style={{
                  opacity: anim,
                  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }]
                }}
              >
                <SurfaceCard style={{ marginBottom: 14, padding: 16 }}>
                  <View style={{ flexDirection: 'row' }}>
                    <FlipImage uri={item.image} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={2} style={{ color: theme.text, fontSize: 17, fontWeight: '900', lineHeight: 22 }}>
                            {item.title}
                          </Text>
                          <Text style={{ color: theme.subtext, fontSize: 12, marginTop: 6 }}>
                            {item.category} · {item.condition}
                          </Text>
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                            borderRadius: 999,
                            backgroundColor: theme.accentSoft,
                            borderWidth: 1,
                            borderColor: theme.cardBorder
                          }}
                        >
                          <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '900' }}>
                            {roi.toFixed(1)}% ROI
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.muted, fontSize: 10, letterSpacing: 1.2, fontWeight: '800' }}>BUY</Text>
                          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800', marginTop: 4 }}>${Number(item.buy || 0).toFixed(2)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.muted, fontSize: 10, letterSpacing: 1.2, fontWeight: '800' }}>SELL</Text>
                          <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '800', marginTop: 4 }}>${Number(item.sell || 0).toFixed(2)}</Text>
                        </View>
                        <View style={{ flex: 1.2 }}>
                          <Text style={{ color: theme.muted, fontSize: 10, letterSpacing: 1.2, fontWeight: '800' }}>PROFIT</Text>
                          <Text style={{ color: profit >= 0 ? theme.profit : theme.loss, fontSize: 14, fontWeight: '800', marginTop: 4 }}>
                            {profit >= 0 ? '+' : '-'}${Math.abs(profit).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <Pressable
                      onPress={() => onMarkSold(item.id)}
                      style={({ pressed }) => ({
                        flex: 1,
                        backgroundColor: theme.profitSoft,
                        borderRadius: 16,
                        paddingVertical: 13,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: theme.cardBorder,
                        opacity: pressed ? 0.92 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }]
                      })}
                    >
                      <Text style={{ color: theme.profit, fontWeight: '900' }}>Mark Sold</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmRemove(item.id)}
                      style={({ pressed }) => ({
                        flex: 0.65,
                        backgroundColor: theme.lossSoft,
                        borderRadius: 16,
                        paddingVertical: 13,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: theme.cardBorder,
                        opacity: pressed ? 0.92 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }]
                      })}
                    >
                      <Text style={{ color: theme.loss, fontWeight: '900' }}>Remove</Text>
                    </Pressable>
                  </View>
                </SurfaceCard>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 18,
          alignItems: 'center',
          opacity: fabAnim,
          transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }]
        }}
      >
        <SurfaceCard style={{ padding: 10, borderRadius: 22, backgroundColor: theme.surfaceOverlay }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <FooterAction label="Analyze" icon="analytics-outline" onPress={onAnalyze} />
            <FooterAction label="Add Flip" icon="add-outline" onPress={onAddFlip} primary />
          </View>
        </SurfaceCard>
      </Animated.View>

      <SoldFlipsModal
        visible={soldVisible}
        onClose={() => setSoldVisible(false)}
        items={soldItems}
        totalProfit={totalProfit}
        onRemove={confirmRemove}
      />
    </View>
  );
}
