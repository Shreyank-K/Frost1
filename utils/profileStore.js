import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentAuthUser, requireSupabase } from './supabase';

const PROFILE_KEY = '@frost:profile_prefs';
const ACTIVITY_KEY = '@frost:activity';

export const CATEGORY_OPTIONS = ['All', 'Sneakers', 'Electronics', 'Gaming', 'Collectibles', 'Fashion'];
export const STYLE_OPTIONS = ['Quick Flips', 'High ROI', 'Collector Finds', 'Steady Volume', 'Premium Gear'];
export const AVATAR_OPTIONS = ['🧊', '💸', '📦', '🔥', '🎯', '📈', '👟', '🎮', '🎧', '🃏'];

const defaultProfile = {
  avatar: '🧊',
  headline: 'Deal hunter',
  mainNiche: 'Electronics',
  flipStyle: 'Quick Flips',
  favoriteCategories: [],
};

const defaultActivity = {
  analysesCount: 0,
  savedFromFeedCount: 0,
  manualAddsCount: 0,
  soldCount: 0,
  refreshCount: 0,
  totalSessions: 0,
  streakDays: 1,
  longestStreak: 1,
  lastActiveDate: null,
  lastFeedCategory: 'All',
};

function isoDay(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function coerceArray(value) {
  return Array.isArray(value) ? value : [];
}

async function readLegacyJSON(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function mapProfileRow(row) {
  if (!row) return { ...defaultProfile };
  const favoriteCategories = coerceArray(row.favorite_categories).filter(Boolean).slice(0, 3);

  return {
    avatar: row.avatar || defaultProfile.avatar,
    headline: row.headline || defaultProfile.headline,
    mainNiche: row.main_niche || defaultProfile.mainNiche,
    flipStyle: row.flip_style || defaultProfile.flipStyle,
    favoriteCategories,
  };
}

function mapActivityRow(row) {
  if (!row) return { ...defaultActivity };

  return {
    analysesCount: Number(row.analyses_count || 0),
    savedFromFeedCount: Number(row.saved_from_feed_count || 0),
    manualAddsCount: Number(row.manual_adds_count || 0),
    soldCount: Number(row.sold_count || 0),
    refreshCount: Number(row.refresh_count || 0),
    totalSessions: Number(row.total_sessions || 0),
    streakDays: Number(row.streak_days || 1),
    longestStreak: Number(row.longest_streak || 1),
    lastActiveDate: row.last_active_date || null,
    lastFeedCategory: row.last_feed_category || 'All',
  };
}

async function getCurrentUserId() {
  const user = await getCurrentAuthUser();
  return user?.id || null;
}

async function getProfileRow(userId) {
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

async function getActivityRow(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('user_activity')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message);
  }

  return data || null;
}

function isDefaultProfileState(profile) {
  return (
    profile.avatar === defaultProfile.avatar &&
    profile.headline === defaultProfile.headline &&
    profile.mainNiche === defaultProfile.mainNiche &&
    profile.flipStyle === defaultProfile.flipStyle &&
    JSON.stringify(profile.favoriteCategories) === JSON.stringify(defaultProfile.favoriteCategories)
  );
}

function isDefaultActivityState(activity) {
  return (
    activity.analysesCount === defaultActivity.analysesCount &&
    activity.savedFromFeedCount === defaultActivity.savedFromFeedCount &&
    activity.manualAddsCount === defaultActivity.manualAddsCount &&
    activity.soldCount === defaultActivity.soldCount &&
    activity.refreshCount === defaultActivity.refreshCount &&
    activity.totalSessions === defaultActivity.totalSessions &&
    activity.streakDays === defaultActivity.streakDays &&
    activity.longestStreak === defaultActivity.longestStreak &&
    activity.lastActiveDate === defaultActivity.lastActiveDate &&
    activity.lastFeedCategory === defaultActivity.lastFeedCategory
  );
}

export async function migrateLegacyProfileStoreToSupabase(userId) {
  const supabase = requireSupabase();
  if (!userId) return false;

  const [legacyProfileRaw, legacyActivityRaw, profileRow, activityRow] = await Promise.all([
    readLegacyJSON(PROFILE_KEY, null),
    readLegacyJSON(ACTIVITY_KEY, null),
    getProfileRow(userId),
    getActivityRow(userId),
  ]);

  let migrated = false;
  const currentProfile = mapProfileRow(profileRow);
  const currentActivity = mapActivityRow(activityRow);

  if (legacyProfileRaw && isDefaultProfileState(currentProfile)) {
    const nextProfile = {
      id: userId,
      avatar: legacyProfileRaw.avatar || defaultProfile.avatar,
      headline: legacyProfileRaw.headline || defaultProfile.headline,
      main_niche: legacyProfileRaw.mainNiche || defaultProfile.mainNiche,
      flip_style: legacyProfileRaw.flipStyle || defaultProfile.flipStyle,
      favorite_categories: coerceArray(legacyProfileRaw.favoriteCategories).filter(Boolean).slice(0, 3),
    };

    const { error } = await supabase.from('profiles').upsert(nextProfile, { onConflict: 'id' });
    if (error) {
      throw new Error(error.message);
    }
    migrated = true;
  }

  if (legacyActivityRaw && isDefaultActivityState(currentActivity)) {
    const nextActivity = {
      user_id: userId,
      analyses_count: Number(legacyActivityRaw.analysesCount || 0),
      saved_from_feed_count: Number(legacyActivityRaw.savedFromFeedCount || 0),
      manual_adds_count: Number(legacyActivityRaw.manualAddsCount || 0),
      sold_count: Number(legacyActivityRaw.soldCount || 0),
      refresh_count: Number(legacyActivityRaw.refreshCount || 0),
      total_sessions: Number(legacyActivityRaw.totalSessions || 0),
      streak_days: Number(legacyActivityRaw.streakDays || 1),
      longest_streak: Number(legacyActivityRaw.longestStreak || 1),
      last_active_date: legacyActivityRaw.lastActiveDate || null,
      last_feed_category: legacyActivityRaw.lastFeedCategory || 'All',
    };

    const { error } = await supabase.from('user_activity').upsert(nextActivity, { onConflict: 'user_id' });
    if (error) {
      throw new Error(error.message);
    }
    migrated = true;
  }

  return migrated;
}

export async function getProfilePrefs() {
  const userId = await getCurrentUserId();
  if (!userId) {
      return { ...defaultProfile };
  }

  const row = await getProfileRow(userId);
  return mapProfileRow(row);
}

export async function updateProfilePrefs(patch) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ...defaultProfile };
  }

  const current = await getProfilePrefs();
  const hasFavoritePatch = Object.prototype.hasOwnProperty.call(patch || {}, 'favoriteCategories');
  const next = {
    ...current,
    ...patch,
    favoriteCategories: hasFavoritePatch
      ? coerceArray(patch.favoriteCategories).filter(Boolean).slice(0, 3)
      : current.favoriteCategories,
  };

  const supabase = requireSupabase();
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      avatar: next.avatar,
      headline: next.headline,
      main_niche: next.mainNiche,
      flip_style: next.flipStyle,
      favorite_categories: next.favoriteCategories,
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw new Error(error.message);
  }

  return next;
}

export async function getActivityState() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ...defaultActivity };
  }

  const row = await getActivityRow(userId);
  return mapActivityRow(row);
}

async function saveActivity(userId, activity) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('user_activity').upsert(
    {
      user_id: userId,
      analyses_count: activity.analysesCount,
      saved_from_feed_count: activity.savedFromFeedCount,
      manual_adds_count: activity.manualAddsCount,
      sold_count: activity.soldCount,
      refresh_count: activity.refreshCount,
      total_sessions: activity.totalSessions,
      streak_days: activity.streakDays,
      longest_streak: activity.longestStreak,
      last_active_date: activity.lastActiveDate,
      last_feed_category: activity.lastFeedCategory,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(error.message);
  }

  return activity;
}

export async function recordActivity(type, payload = {}) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ...defaultActivity };
  }

  const current = await getActivityState();
  const today = isoDay();
  let next = { ...current };

  if (!current.lastActiveDate) {
    next.lastActiveDate = today;
    next.streakDays = 1;
    next.longestStreak = Math.max(current.longestStreak || 1, 1);
  } else if (current.lastActiveDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    next.streakDays = current.lastActiveDate === yesterday ? (current.streakDays || 1) + 1 : 1;
    next.longestStreak = Math.max(current.longestStreak || 1, next.streakDays);
    next.lastActiveDate = today;
  }

  switch (type) {
    case 'session':
      next.totalSessions = (next.totalSessions || 0) + 1;
      break;
    case 'analyze':
      next.analysesCount = (next.analysesCount || 0) + 1;
      break;
    case 'save_feed':
      next.savedFromFeedCount = (next.savedFromFeedCount || 0) + 1;
      break;
    case 'manual_add':
      next.manualAddsCount = (next.manualAddsCount || 0) + 1;
      break;
    case 'sold':
      next.soldCount = (next.soldCount || 0) + 1;
      break;
    case 'refresh':
      next.refreshCount = (next.refreshCount || 0) + 1;
      if (payload.category) next.lastFeedCategory = payload.category;
      break;
    default:
      break;
  }

  return saveActivity(userId, next);
}

export function buildBadges({ stats, profile, activity }) {
  const badges = [];

  if (stats.savedCount >= 1) badges.push({ key: 'first-save', emoji: '🔖', title: 'First Save', tone: 'accent', detail: 'Locked in your first candidate.' });
  if (activity.analysesCount >= 5) badges.push({ key: 'analyst', emoji: '🧠', title: 'Analyst', tone: 'accent', detail: 'Ran 5+ market checks.' });
  if (stats.totalProfit >= 100) badges.push({ key: 'profit-100', emoji: '💰', title: '$100 Club', tone: 'profit', detail: 'Cleared your first profit milestone.' });
  if (stats.totalProfit >= 500) badges.push({ key: 'profit-500', emoji: '🏦', title: '$500 Club', tone: 'profit', detail: 'Consistent wins are stacking up.' });
  if (stats.soldCount >= 3) badges.push({ key: 'seller', emoji: '📦', title: 'Closer', tone: 'profit', detail: 'Logged 3 successful sells.' });
  if (stats.avgRoi >= 25 && stats.soldCount >= 2) badges.push({ key: 'roi', emoji: '📈', title: 'High ROI', tone: 'profit', detail: 'Your flips are staying efficient.' });
  if (activity.streakDays >= 3) badges.push({ key: 'streak', emoji: '🔥', title: `${activity.streakDays}-Day Streak`, tone: 'accent', detail: 'Showing up daily keeps the edge sharp.' });
  if ((profile.favoriteCategories || []).includes('Sneakers')) badges.push({ key: 'sneaker', emoji: '👟', title: 'Sneaker Eye', tone: 'accent', detail: 'You lean into fast-moving pairs.' });
  if ((profile.favoriteCategories || []).includes('Electronics')) badges.push({ key: 'electronics', emoji: '🎧', title: 'Tech Scout', tone: 'accent', detail: 'Electronics are part of your lane.' });
  if (activity.refreshCount >= 10) badges.push({ key: 'scanner', emoji: '🔎', title: 'Scanner', tone: 'accent', detail: 'Refreshed the live feed 10+ times.' });
  return badges.slice(0, 8);
}
