import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SwipeCard from '../components/SwipeCard';
import FrostHeader from '../components/FrostHeader';
import SurfaceCard from '../components/SurfaceCard';
import ThriftModeModal from '../components/ThriftModeModal';
import { useTheme } from '../utils/theme';

function FilterChip({ label, active, onPress, favored, count }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: active ? theme.accentBorder : theme.cardBorder,
        marginRight: 8,
        opacity: pressed ? 0.92 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: theme.accent,
        shadowOpacity: active ? 0.25 : 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: active ? 4 : 2,
      })}
    >
      {favored ? <Ionicons name="star" size={11} color={active ? theme.accent : theme.muted} style={{ marginRight: 6 }} /> : null}
      <Text style={{ color: active ? theme.accent : theme.text, fontSize: 12, fontWeight: '800' }}>{label}</Text>
      {Number.isFinite(count) ? (
        <View
          style={{
            marginLeft: 8,
            minWidth: 22,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 999,
            backgroundColor: active ? theme.surface : theme.surfaceSoft,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: active ? theme.accent : theme.muted, fontSize: 10, fontWeight: '900' }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ThriftModeButton({ onPress, onPass, onSave, swipeDisabled = false }) {
  const { theme } = useTheme();
  const leftArrowAnim = useRef(new Animated.Value(0)).current;
  const rightArrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const arrowCue = Animated.sequence([
      Animated.delay(320),
      Animated.parallel([
        Animated.timing(leftArrowAnim, {
          toValue: -8,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rightArrowAnim, {
          toValue: 8,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(leftArrowAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rightArrowAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(leftArrowAnim, {
          toValue: -8,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rightArrowAnim, {
          toValue: 8,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(leftArrowAnim, {
          toValue: 0,
          duration: 160,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rightArrowAnim, {
          toValue: 0,
          duration: 160,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);

    arrowCue.start();
    return () => arrowCue.stop();
  }, [leftArrowAnim, rightArrowAnim]);

  const arrowBubble = (direction, color, backgroundColor, action) => (
    <Pressable
      onPress={action}
      disabled={swipeDisabled}
      hitSlop={8}
      style={({ pressed }) => ({
        opacity: swipeDisabled ? 0.45 : pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
          borderWidth: 1,
          borderColor: color,
          shadowColor: color,
          shadowOpacity: theme.mode === 'dark' ? 0.52 : 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        }}
      >
        <Ionicons
          name={direction === 'left' ? 'arrow-back' : 'arrow-forward'}
          size={21}
          color={color}
          style={{
            textShadowColor: color,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 10,
          }}
        />
      </View>
    </Pressable>
  );

  return (
    <View style={{ alignItems: 'center', marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ translateX: leftArrowAnim }] }}>
          {arrowBubble('left', theme.loss, theme.lossSoft, onPass)}
        </Animated.View>

        <Pressable
          onPress={onPress}
          style={({ pressed }) => ({
            borderRadius: 22,
            overflow: 'hidden',
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
            borderWidth: 1,
            borderColor: theme.accent,
            shadowColor: theme.accent,
            shadowOpacity: theme.mode === 'dark' ? 0.4 : 0.3,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 5,
            marginHorizontal: 12,
          })}
        >
          <View
            style={{
              backgroundColor: 'transparent',
              paddingVertical: 18,
              paddingHorizontal: 28,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center', textShadowColor: theme.accent, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }}>Thrift Mode</Text>
          </View>
        </Pressable>

        <Animated.View style={{ transform: [{ translateX: rightArrowAnim }] }}>
          {arrowBubble('right', theme.profit, theme.profitSoft, onSave)}
        </Animated.View>
      </View>
    </View>
  );
}

export default function FlipScreen({
  current,
  nextItem = null,
  onPass,
  onSave,
  onRefresh,
  refreshing = false,
  feedMeta = null,
  feedFilter = 'All',
  onChangeFeedFilter = () => {},
  preferredCategories = [],
  availableCategories = [],
  categoryCounts = {},
  totalCardCount = 0,
  onSaveScannedFlip = async () => ({ ok: false }),
  userId = null,
}) {
  const { theme } = useTheme();
  const [thriftVisible, setThriftVisible] = useState(false);
  const [swipeRequest, setSwipeRequest] = useState(null);
  const swipeTokenRef = useRef(0);
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entry, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entry]);

  const entryStyle = {
    opacity: entry,
    transform: [{ translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };

  const feedIsLive = feedMeta?.source === 'live';
  const feedIsFallback = feedMeta?.source === 'fallback';
  const feedHasError = feedMeta?.source === 'error' && !feedMeta?.refreshedAt;
  const feedNotLoaded = !feedMeta?.source;

  const filters = ['All', ...availableCategories.filter((category) => category && category !== 'All')];
  const emptyTitle = feedFilter === 'All' ? 'All caught up' : `No ${feedFilter} cards left`;
  const emptyBody = feedFilter === 'All'
    ? 'You’ve swiped through the current batch. Hit Refresh for a deeper set of real eBay products.'
    : `The ${feedFilter} lane is empty in this batch. Switch back to All or refresh for more.`;

  const handleArrowPass = () => {
    if (!current) return;
    swipeTokenRef.current += 1;
    setSwipeRequest({ direction: 'left', token: swipeTokenRef.current, itemId: current.id });
  };

  const handleArrowSave = () => {
    if (!current) return;
    swipeTokenRef.current += 1;
    setSwipeRequest({ direction: 'right', token: swipeTokenRef.current, itemId: current.id });
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: theme.background, paddingBottom: 0, ...entryStyle }}>
      <FrostHeader
        branded
        right={
          <Pressable
            onPress={onRefresh}
            disabled={refreshing}
            style={({ pressed }) => ({
              backgroundColor: 'transparent',
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: theme.cardBorder,
              opacity: refreshing ? 0.8 : pressed ? 0.92 : 1,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            })}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={theme.secondaryButtonText} />
            ) : (
              <Ionicons name="refresh" size={15} color={theme.secondaryButtonText} />
            )}
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: 18, marginTop: -2, zIndex: 2 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          {filters.map((category) => (
            <FilterChip
              key={category}
              label={category}
              count={category === 'All' ? totalCardCount : categoryCounts[category] || 0}
              active={feedFilter === category}
              favored={preferredCategories.includes(category)}
              onPress={() => onChangeFeedFilter(category)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingHorizontal: 14, paddingTop: 4, paddingBottom: 0, zIndex: 1 }}>
        {nextItem && current ? (
          <View style={{ position: 'absolute', top: -100, alignSelf: 'center', opacity: 0 }}>
            <SwipeCard key={`preview-${nextItem.id}`} item={nextItem} preview disabled />
          </View>
        ) : null}

        {current ? (
          <SwipeCard key={`current-${current.id}`} item={current} onPass={onPass} onSave={onSave} programmaticSwipe={swipeRequest} />
        ) : (
          <SurfaceCard style={{ width: '92%', padding: 28, alignItems: 'center' }}>
            <Ionicons name={feedIsLive || feedIsFallback ? 'sparkles-outline' : feedHasError ? 'cloud-offline-outline' : 'hourglass-outline'} size={40} color={theme.accent} />
            <Text style={{ color: theme.text, fontSize: 24, fontWeight: '900', marginTop: 16 }}>
              {feedIsLive || feedIsFallback ? emptyTitle : feedHasError ? 'Feed unavailable' : 'Loading deals\u2026'}
            </Text>
            <Text style={{ color: theme.subtext, textAlign: 'center', lineHeight: 22, marginTop: 10 }}>
              {feedIsLive || feedIsFallback
                ? emptyBody
                : feedHasError
                ? 'The eBay feed couldn\u2019t load right now. Hit Refresh to try again, or check back shortly.'
                : 'Fetching real eBay products\u2026'}
            </Text>
            {feedFilter !== 'All' && !current ? (
              <Pressable
                onPress={() => onChangeFeedFilter('All')}
                style={({ pressed }) => ({
                  marginTop: 14,
                  backgroundColor: 'transparent',
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.cardBorder,
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: theme.secondaryButtonText, fontWeight: '900' }}>Show all categories</Text>
              </Pressable>
            ) : null}
            {feedMeta?.lastError ? (
              <Text style={{ color: theme.muted, textAlign: 'center', lineHeight: 20, marginTop: 12, fontSize: 12 }}>
                {feedMeta.lastError}
              </Text>
            ) : null}
            {!feedNotLoaded ? (
              <Pressable
                onPress={onRefresh}
                disabled={refreshing}
                style={({ pressed }) => ({
                  marginTop: 18,
                  backgroundColor: 'transparent',
                  paddingVertical: 13,
                  paddingHorizontal: 20,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.accent,
                  opacity: refreshing ? 0.82 : pressed ? 0.94 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                })}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="refresh" size={16} color="#FFFFFF" />
                )}
                <Text style={{ color: '#FFFFFF', fontWeight: '900', marginLeft: 8 }}>
                  {refreshing ? 'Refreshing feed' : 'Get more deals'}
                </Text>
              </Pressable>
            ) : null}
          </SurfaceCard>
        )}

        <View style={{ flex: 1 }} />

        <ThriftModeButton
          onPress={() => setThriftVisible(true)}
          onPass={current ? handleArrowPass : undefined}
          onSave={current ? handleArrowSave : undefined}
          swipeDisabled={!current}
        />
      </View>

      <ThriftModeModal
        visible={thriftVisible}
        onClose={() => setThriftVisible(false)}
        onSaveFlip={onSaveScannedFlip}
        userId={userId}
      />
    </Animated.View>
  );
}
