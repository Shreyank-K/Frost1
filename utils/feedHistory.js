import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = '@frost:feed_history:v1';
const MAX_REMEMBERED_IDS = 600;

function storageKey(userId) {
  return `${STORAGE_PREFIX}:${userId || 'anonymous'}`;
}

export function feedItemKey(item) {
  const value = item?.id || item?.sourceUrl || item?.title;
  return String(value || '').trim().toLowerCase();
}

function normalizeIds(ids) {
  const seen = new Set();
  const normalized = [];

  for (const id of Array.isArray(ids) ? ids : []) {
    const key = String(id || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }

  return normalized.slice(-MAX_REMEMBERED_IDS);
}

export async function getDismissedFeedIds(userId) {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeIds(parsed?.dismissedIds || []);
  } catch {
    return [];
  }
}

export async function rememberDismissedFeedIds(userId, ids) {
  const existing = await getDismissedFeedIds(userId);
  const merged = normalizeIds([...existing, ...normalizeIds(ids)]);

  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify({ dismissedIds: merged }));
  } catch {}

  return merged;
}

