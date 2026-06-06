import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, StatusBar, ActivityIndicator, Text, Linking } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import FlipScreen from './screens/FlipScreen';
import MyFlips from './screens/MyFlips';
import Profile from './screens/Profile';
import SettingsScreen from './screens/SettingsScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import BottomNav from './components/BottomNav';
import AuthScreen from './screens/AuthScreen';
import { getCurrentUser, logoutUser } from './utils/auth';
import * as syncClient from './utils/syncClient';
import { cloneFlips } from './utils/flipModel';
import AddFlipScreen from './screens/AddFlipScreen';
import AnalyzeFlipScreen from './screens/AnalyzeFlipScreen';
import { ThemeProvider, useTheme } from './utils/theme';
import { createSessionFromUrl } from './utils/supabase';
import {
  getProfilePrefs,
  updateProfilePrefs,
  getActivityState,
  recordActivity,
  buildBadges,
} from './utils/profileStore';
import { feedItemKey, getDismissedFeedIds, rememberDismissedFeedIds } from './utils/feedHistory';

const FEED_BATCH_SIZE = 30;

function FrostApp() {
  const { theme, isDark } = useTheme();
  const [tab, setTab] = useState('flip');
  const [profileSection, setProfileSection] = useState('profile');
  const [queue, setQueue] = useState([]);
  const [saved, setSaved] = useState([]);
  const [soldIds, setSoldIds] = useState([]);
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState(null);
  const [showAddFlip, setShowAddFlip] = useState(false);
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedMeta, setFeedMeta] = useState({ source: null, lastError: null, refreshedAt: null });
  const [profilePrefs, setProfilePrefs] = useState(null);
  const [activity, setActivity] = useState(null);
  const [feedFilter, setFeedFilter] = useState('All');
  const [dismissedFeedIds, setDismissedFeedIds] = useState([]);
  const hasLoadedFeedRef = useRef(false);

  const categoryCounts = useMemo(() => (
    queue.reduce((counts, item) => {
      const category = String(item?.category || '').trim();
      if (!category) return counts;
      counts[category] = (counts[category] || 0) + 1;
      return counts;
    }, {})
  ), [queue]);

  const availableCategories = useMemo(() => (
    Object.keys(categoryCounts).sort((a, b) => {
      const countDelta = (categoryCounts[b] || 0) - (categoryCounts[a] || 0);
      return countDelta || a.localeCompare(b);
    })
  ), [categoryCounts]);

  const sortByPreference = useCallback((items, prefs) => {
    const preferred = prefs?.favoriteCategories || [];
    if (!preferred.length) return cloneFlips(items);
    return cloneFlips(items).sort((a, b) => {
      const aIdx = preferred.indexOf(a.category);
      const bIdx = preferred.indexOf(b.category);
      const aScore = aIdx === -1 ? 999 : aIdx;
      const bScore = bIdx === -1 ? 999 : bIdx;
      if (aScore !== bScore) return aScore - bScore;
      return Number(b.profit || 0) - Number(a.profit || 0);
    });
  }, []);

  // Use refs to read latest state inside refreshFeed without recreating its identity
  const profilePrefsRef = useRef(profilePrefs);
  profilePrefsRef.current = profilePrefs;
  const feedFilterRef = useRef(feedFilter);
  feedFilterRef.current = feedFilter;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const dismissedFeedIdsRef = useRef(dismissedFeedIds);
  dismissedFeedIdsRef.current = dismissedFeedIds;
  const isFetchingRef = useRef(false);

  const filterNewFeedItems = useCallback((items) => {
    const dismissed = new Set(dismissedFeedIdsRef.current);
    const alreadySaved = new Set(savedRef.current.map(feedItemKey).filter(Boolean));
    const seen = new Set();

    return items.filter((item) => {
      const key = feedItemKey(item);
      if (!key || seen.has(key) || dismissed.has(key) || alreadySaved.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const rememberFeedDecision = useCallback(async (item) => {
    const key = feedItemKey(item);
    if (!key) return dismissedFeedIdsRef.current;

    const currentUserId = user?.id || null;
    const nextIds = Array.from(new Set([...dismissedFeedIdsRef.current, key])).slice(-600);
    dismissedFeedIdsRef.current = nextIds;
    setDismissedFeedIds(nextIds);
    await rememberDismissedFeedIds(currentUserId, [key]);
    return nextIds;
  }, [user?.id]);

  const refreshFeed = useCallback(async ({ silent = false, selectedCategory, force = false } = {}) => {
    // Prevent overlapping fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!silent) setFeedLoading(true);

    try {
      const response = await syncClient.getLiveFeed(FEED_BATCH_SIZE, { force });
      const effectivePrefs = profilePrefsRef.current || { favoriteCategories: [] };

      if (response?.ok && response.items?.length) {
        const filteredItems = filterNewFeedItems(response.items);
        setQueue(sortByPreference(filteredItems, effectivePrefs));
        const meta = response.meta || {};
        setFeedMeta({
          source: meta.source || 'live',
          lastError: null,
          refreshedAt: meta.generatedAt || Date.now(),
          fromCache: !!meta.fromCache,
          cooldown: !!meta.cooldown,
          cooldownRemaining: meta.cooldownRemaining || 0,
          refreshFailed: !!meta.refreshFailed,
          message: filteredItems.length
            ? meta.message || null
            : 'No unseen cards in this batch yet. Refresh again after the feed cools down for new eBay results.',
          info: meta,
          hiddenSeenCount: response.items.length - filteredItems.length,
        });
      } else {
        // Do NOT clear the current queue — keep showing previous cards
        setFeedMeta(prev => ({
          ...prev,
          source: prev?.source || 'error',
          lastError: response?.error || 'Feed unavailable',
          refreshFailed: true,
          message: response?.meta?.message || response?.error || 'Refresh failed',
          info: response?.meta || response?.detail || null,
        }));
      }

      const nextActivity = await recordActivity('refresh', { category: selectedCategory || feedFilterRef.current });
      setActivity(nextActivity);
    } finally {
      isFetchingRef.current = false;
      if (!silent) setFeedLoading(false);
    }
  }, [filterNewFeedItems, sortByPreference]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [currentUser, prefs, activityState] = await Promise.all([
        getCurrentUser(),
        getProfilePrefs(),
        getActivityState(),
      ]);
      if (!mounted) return;
      setProfilePrefs(prefs);
      setActivity(activityState);
      setFeedFilter('All');
      setUser(currentUser);
      setCheckingAuth(false);
      if (currentUser) {
        try {
          const [flips, nextDismissedIds] = await Promise.all([
            syncClient.getFlips(),
            getDismissedFeedIds(currentUser.id),
          ]);
          if (!mounted) return;
          savedRef.current = flips;
          dismissedFeedIdsRef.current = nextDismissedIds;
          setSaved(flips);
          setSoldIds(flips.filter(item => item.sold).map(item => item.id));
          setDismissedFeedIds(nextDismissedIds);
        } catch (e) {}
        const nextActivity = await recordActivity('session');
        if (mounted) setActivity(nextActivity);
        if (mounted && !hasLoadedFeedRef.current) {
          hasLoadedFeedRef.current = true;
          refreshFeed({ silent: false, selectedCategory: 'All', force: false });
        }
      }
    })();
    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;

    const handleAuthUrl = async (url) => {
      if (!url) return;
      try {
        const result = await createSessionFromUrl(url);
        if (!active) return;
        if (result?.type === 'recovery') {
          setAuthMode('resetPassword');
        }
      } catch (error) {
        console.warn('[auth] failed to handle auth link', error?.message || error);
      }
    };

    Linking.getInitialURL().then(handleAuthUrl).catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthUrl(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const visibleQueue = useMemo(() => {
    if (feedFilter === 'All') return queue;
    return queue.filter(item => item.category === feedFilter);
  }, [feedFilter, queue]);

  useEffect(() => {
    if (feedFilter !== 'All' && !categoryCounts[feedFilter]) {
      setFeedFilter('All');
    }
  }, [categoryCounts, feedFilter]);

  const current = visibleQueue[0] || null;
  const nextItem = visibleQueue[1] || null;

  const stats = useMemo(() => {
    const soldItems = saved.filter(item => soldIds.includes(item.id) || item.sold);
    const totalProfit = soldItems.reduce((sum, item) => sum + Number(item.profit || 0), 0);
    const avgRoi = soldItems.length ? soldItems.reduce((sum, item) => sum + Number(item.roi || 0), 0) / soldItems.length : 0;
    const totalPoints =
      (saved.length * 4) +
      ((activity?.analysesCount || 0) * 3) +
      (soldItems.length * 14) +
      Math.round(totalProfit / 20) +
      ((activity?.streakDays || 1) * 2);
    const level = Math.max(1, Math.floor(totalPoints / 80) + 1);
    const nextLevelAt = level * 80;
    return {
      savedCount: saved.length,
      soldCount: soldItems.length,
      totalProfit,
      avgRoi,
      totalPoints,
      level,
      nextLevelAt,
      analysesCount: activity?.analysesCount || 0,
      refreshCount: activity?.refreshCount || 0,
      streakDays: activity?.streakDays || 1,
      longestStreak: activity?.longestStreak || 1,
      savedFromFeedCount: activity?.savedFromFeedCount || 0,
      manualAddsCount: activity?.manualAddsCount || 0,
      favoriteCategories: profilePrefs?.favoriteCategories || [],
      badges: buildBadges({ stats: {
        savedCount: saved.length,
        soldCount: soldItems.length,
        totalProfit,
        avgRoi,
      }, profile: profilePrefs || {}, activity: activity || {} }),
    };
  }, [saved, soldIds, activity, profilePrefs]);

  const removeFromQueue = useCallback((id) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const passItem = () => {
    const item = current;
    if (!item) return;
    removeFromQueue(item.id);
    rememberFeedDecision(item);
  };

  const saveItem = async () => {
    const item = current;
    if (!item) return;

    removeFromQueue(item.id);
    try {
      const res = await syncClient.createFlip(item);
      if (res?.flip) {
        setSaved(prev => (prev.find(item => item.id === res.flip.id) ? prev : [res.flip, ...prev]));
        rememberFeedDecision(item);
        try {
          const nextActivity = await recordActivity('save_feed');
          setActivity(nextActivity);
        } catch (activityError) {}
        return;
      }
      setQueue(prev => (prev.find(candidate => candidate.id === item.id) ? prev : [item, ...prev]));
    } catch (e) {
      setQueue(prev => (prev.find(candidate => candidate.id === item.id) ? prev : [item, ...prev]));
    }
  };

  const saveScannedFlip = async (flip) => {
    try {
      const res = await syncClient.createFlip(flip);
      if (res?.flip) {
        setSaved(prev => (prev.find(item => item.id === res.flip.id) ? prev : [res.flip, ...prev]));
        const nextActivity = await recordActivity('manual_add');
        setActivity(nextActivity);
        return { ok: true, flip: res.flip };
      }
      return { ok: false, error: 'Could not save scanned flip.' };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not save scanned flip.' };
    }
  };

  const markSold = async (id) => {
    setSoldIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    setSaved(prev => prev.map(item => (item.id === id ? { ...item, sold: true } : item)));
    const nextActivity = await recordActivity('sold');
    setActivity(nextActivity);
    try {
      await syncClient.markFlipSold(id);
    } catch (e) {}
  };

  const removeSaved = async (id) => {
    setSaved(prev => prev.filter(item => item.id !== id));
    setSoldIds(prev => prev.filter(savedId => savedId !== id));
    try {
      await syncClient.deleteFlip(id);
    } catch (e) {}
  };

  const handleAuth = async (currentUser) => {
    setUser(currentUser);
    const [flips, nextDismissedIds] = await Promise.all([
      syncClient.getFlips(),
      getDismissedFeedIds(currentUser.id),
    ]);
    savedRef.current = flips;
    dismissedFeedIdsRef.current = nextDismissedIds;
    setSaved(flips);
    setSoldIds(flips.filter(item => item.sold).map(item => item.id));
    setDismissedFeedIds(nextDismissedIds);
    const [prefs, nextActivity] = await Promise.all([getProfilePrefs(), recordActivity('session')]);
    setProfilePrefs(prefs);
    setActivity(nextActivity);
    setFeedFilter('All');
    hasLoadedFeedRef.current = true;
    await refreshFeed({ silent: false, selectedCategory: 'All', force: false });
  };

  const handleSignOut = async ({ skipLogout = false } = {}) => {
    const result = skipLogout ? { ok: true } : await logoutUser();
    if (!result?.ok) return result;
    setUser(null);
    setAuthMode(null);
    setTab('flip');
    setProfileSection('profile');
    setSaved([]);
    setSoldIds([]);
    setQueue([]);
    setFeedMeta({ source: null, lastError: null, refreshedAt: null });
    setShowAddFlip(false);
    setShowAnalyze(false);
    hasLoadedFeedRef.current = false;
    return result;
  };

  const cancelRecoveryMode = async () => {
    setAuthMode(null);
    await logoutUser();
    setUser(null);
  };

  const onFlipSavedFromForm = async (flip, source = 'manual_add') => {
    setSaved(prev => (prev.find(item => item.id === flip.id) ? prev : [flip, ...prev]));
    if (flip.sold) setSoldIds(prev => (prev.includes(flip.id) ? prev : [...prev, flip.id]));
    const nextActivity = await recordActivity(source === 'analyze' ? 'analyze' : 'manual_add');
    setActivity(nextActivity);
    setTab('flips');
    setShowAddFlip(false);
    setShowAnalyze(false);
  };

  const openAddFlip = () => {
    setTab('flips');
    setShowAnalyze(false);
    setShowAddFlip(true);
  };

  const openAnalyze = () => {
    setTab('flips');
    setShowAddFlip(false);
    setShowAnalyze(true);
  };

  const openProfileSettings = () => {
    setTab('profile');
    setProfileSection('settings');
    setShowAddFlip(false);
    setShowAnalyze(false);
  };

  const closeProfileSettings = () => {
    setProfileSection('profile');
  };

  const handleAnalyzeComplete = async () => {
    const nextActivity = await recordActivity('analyze');
    setActivity(nextActivity);
  };

  const handleUpdateProfile = async (patch) => {
    const nextPrefs = await updateProfilePrefs(patch);
    setProfilePrefs(nextPrefs);
    setQueue(prev => sortByPreference(prev, nextPrefs));
  };

  if (checkingAuth) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={{ color: theme.subtext, marginTop: 14, fontSize: 14 }}>Loading Frost…</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <AuthScreen
          onAuth={handleAuth}
          forcedMode={authMode}
          onExitForcedMode={cancelRecoveryMode}
          onPasswordResetComplete={async () => {
            const currentUser = await getCurrentUser();
            if (currentUser) {
              await handleAuth(currentUser);
            }
            setAuthMode(null);
          }}
        />
      </SafeAreaView>
    );
  }

  if (authMode === 'resetPassword') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <AuthScreen
          onAuth={handleAuth}
          forcedMode={authMode}
          onExitForcedMode={cancelRecoveryMode}
          onPasswordResetComplete={async () => {
            const currentUser = await getCurrentUser();
            if (currentUser) {
              await handleAuth(currentUser);
            }
            setAuthMode(null);
          }}
        />
      </SafeAreaView>
    );
  }

  const changeTab = (nextTab) => {
    setTab(nextTab);
    setShowAddFlip(false);
    setShowAnalyze(false);
    if (nextTab !== 'profile') {
      setProfileSection('profile');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1 }}>
        {tab === 'flip' && (
          <FlipScreen
            current={current}
            nextItem={nextItem}
            onPass={passItem}
            onSave={saveItem}
            onRefresh={() => refreshFeed({ silent: false, selectedCategory: feedFilter, force: true })}
            refreshing={feedLoading}
            feedMeta={feedMeta}
            feedFilter={feedFilter}
            onChangeFeedFilter={setFeedFilter}
            preferredCategories={profilePrefs?.favoriteCategories || []}
            availableCategories={availableCategories}
            categoryCounts={categoryCounts}
            totalCardCount={queue.length}
            onSaveScannedFlip={saveScannedFlip}
            userId={user?.id || null}
          />
        )}

        {tab === 'flips' && !showAddFlip && !showAnalyze && (
          <MyFlips items={saved} soldIds={soldIds} onMarkSold={markSold} onRemove={removeSaved} onAddFlip={openAddFlip} onAnalyze={openAnalyze} />
        )}

        {tab === 'flips' && showAddFlip && <AddFlipScreen onClose={() => setShowAddFlip(false)} onSaved={(flip) => onFlipSavedFromForm(flip, 'manual_add')} />}

        {tab === 'flips' && showAnalyze && (
          <AnalyzeFlipScreen
            onClose={() => setShowAnalyze(false)}
            onSaved={(flip) => onFlipSavedFromForm(flip, 'analyze')}
            onAnalyzeComplete={handleAnalyzeComplete}
          />
        )}
        {tab === 'profile' && profileSection === 'profile' && (
          <Profile
            stats={stats}
            user={user}
            profilePrefs={profilePrefs}
            onUpdateProfile={handleUpdateProfile}
            onOpenSettings={openProfileSettings}
          />
        )}

        {tab === 'profile' && profileSection === 'settings' && (
          <SettingsScreen
            user={user}
            onSignOut={handleSignOut}
            onBack={closeProfileSettings}
          />
        )}

        {tab === 'leaderboard' && <LeaderboardScreen user={user} stats={stats} />}
      </View>
      <BottomNav activeTab={tab} onChange={changeTab} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <FrostApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
