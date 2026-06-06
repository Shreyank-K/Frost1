import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FREE_THRIFT_SCANS_PER_DAY,
  MAX_REWARDED_THRIFT_ADS_PER_DAY,
  REWARDED_THRIFT_SCANS_PER_AD,
} from './adConfig';

const STORAGE_PREFIX = '@frost:thrift_scan_allowance:v1';

function localDay() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function storageKey(userId) {
  return `${STORAGE_PREFIX}:${userId || 'anonymous'}`;
}

function baseState(day = localDay()) {
  return {
    day,
    freeScansUsed: 0,
    rewardAdsWatched: 0,
    rewardScansRemaining: 0,
  };
}

function numberInRange(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

function normalizeState(raw) {
  const today = localDay();
  if (!raw || typeof raw !== 'object' || raw.day !== today) {
    return baseState(today);
  }

  return {
    day: today,
    freeScansUsed: numberInRange(raw.freeScansUsed, 0, FREE_THRIFT_SCANS_PER_DAY),
    rewardAdsWatched: numberInRange(raw.rewardAdsWatched, 0, MAX_REWARDED_THRIFT_ADS_PER_DAY),
    rewardScansRemaining: numberInRange(
      raw.rewardScansRemaining,
      0,
      MAX_REWARDED_THRIFT_ADS_PER_DAY * REWARDED_THRIFT_SCANS_PER_AD
    ),
  };
}

function decorateState(state) {
  const freeScansRemaining = Math.max(0, FREE_THRIFT_SCANS_PER_DAY - state.freeScansUsed);
  const rewardAdsRemaining = Math.max(0, MAX_REWARDED_THRIFT_ADS_PER_DAY - state.rewardAdsWatched);
  const rewardScansRemaining = Math.max(0, state.rewardScansRemaining);

  return {
    ...state,
    freeScansRemaining,
    rewardAdsRemaining,
    rewardScansRemaining,
    remainingScans: freeScansRemaining + rewardScansRemaining,
  };
}

async function readState(userId) {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    return normalizeState(raw ? JSON.parse(raw) : null);
  } catch {
    return baseState();
  }
}

async function writeState(userId, state) {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(normalizeState(state)));
  } catch {}
}

export async function getThriftScanAllowance({ userId } = {}) {
  const state = await readState(userId);
  return decorateState(state);
}

export async function consumeThriftScan({ userId } = {}) {
  const state = await readState(userId);

  if (state.freeScansUsed < FREE_THRIFT_SCANS_PER_DAY) {
    const next = { ...state, freeScansUsed: state.freeScansUsed + 1 };
    await writeState(userId, next);
    return { ok: true, used: 'free', allowance: decorateState(next) };
  }

  if (state.rewardScansRemaining > 0) {
    const next = { ...state, rewardScansRemaining: state.rewardScansRemaining - 1 };
    await writeState(userId, next);
    return { ok: true, used: 'reward', allowance: decorateState(next) };
  }

  return { ok: false, used: null, allowance: decorateState(state) };
}

export async function grantRewardedThriftScans({ userId } = {}) {
  const state = await readState(userId);

  if (state.rewardAdsWatched >= MAX_REWARDED_THRIFT_ADS_PER_DAY) {
    return { ok: false, allowance: decorateState(state), error: 'Daily ad unlock limit reached.' };
  }

  const next = {
    ...state,
    rewardAdsWatched: state.rewardAdsWatched + 1,
    rewardScansRemaining: state.rewardScansRemaining + REWARDED_THRIFT_SCANS_PER_AD,
  };

  await writeState(userId, next);
  return { ok: true, allowance: decorateState(next) };
}
