import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeFlip } from './flipModel';
import { getCurrentAuthUser, requireSupabase } from './supabase';

const LEGACY_KEYS = {
  session: '@frost:session',
  flips: '@frost:flips',
};

function safeArray(value) {
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

function mapFlipRow(row) {
  return normalizeFlip({
    id: row.id,
    title: row.title,
    category: row.category,
    condition: row.condition,
    buy: row.buy,
    sell: row.sell,
    fees: row.fees,
    shipping: row.shipping,
    profit: row.profit,
    roi: row.roi,
    confidence: row.confidence,
    image: row.image,
    sourceUrl: row.source_url,
    sourceQuery: row.source_query,
    sold: row.sold,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    user_id: row.user_id,
  });
}

function toFlipRow(flip, userId) {
  const normalized = normalizeFlip(flip, { user_id: userId });
  return {
    id: normalized.id,
    user_id: userId,
    title: normalized.title,
    category: normalized.category,
    condition: normalized.condition,
    buy: normalized.buy,
    sell: normalized.sell,
    fees: normalized.fees,
    shipping: normalized.shipping,
    profit: normalized.profit,
    roi: normalized.roi,
    confidence: normalized.confidence,
    image: normalized.image,
    source_url: normalized.sourceUrl,
    source_query: normalized.sourceQuery,
    sold: !!normalized.sold,
    sold_at: normalized.sold ? new Date().toISOString() : null,
    created_at: new Date(normalized.createdAt).toISOString(),
  };
}

export async function initDB() {
  requireSupabase();
  return true;
}

export async function migrateLegacyFlipsToSupabase(userId) {
  const supabase = requireSupabase();
  if (!userId) return false;

  const { count, error: countError } = await supabase
    .from('flips')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count || 0) > 0) {
    return false;
  }

  const legacySessionId = await readLegacyJSON(LEGACY_KEYS.session, null);
  const legacyFlips = safeArray(await readLegacyJSON(LEGACY_KEYS.flips, []));

  const filteredFlips = legacyFlips.filter((item) => {
    if (!legacySessionId) return true;
    return !item?.user_id || item.user_id === legacySessionId;
  });

  if (!filteredFlips.length) {
    return false;
  }

  const rows = filteredFlips.map((item) => toFlipRow(item, userId));
  const { error } = await supabase.from('flips').upsert(rows, { onConflict: 'id' });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function upsertFlip(flip) {
  const supabase = requireSupabase();
  const user = await getCurrentAuthUser();
  if (!user) throw new Error('Not authenticated');

  const row = toFlipRow(flip, user.id);
  const { data, error } = await supabase
    .from('flips')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapFlipRow(data);
}

export async function deleteFlipById(id) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('flips').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function markFlipSoldById(id) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('flips')
    .update({ sold: true, sold_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
  return true;
}

export async function getFlipsForUser(userId) {
  const supabase = requireSupabase();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('flips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return safeArray(data).map(mapFlipRow);
}
