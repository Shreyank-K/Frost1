import { getCurrentUser as getCurrentUserAuth } from './auth';
import { upsertFlip, getFlipsForUser, deleteFlipById, markFlipSoldById } from './db';
import { normalizeFlip } from './flipModel';
import { ANALYZER_URL } from './config';
import { getAuthToken, supabaseProjectKey } from './supabase';

function makeId() {
  return `flip-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function confidenceLabelFromScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 'LOW';
  if (value >= 0.72) return 'HIGH';
  if (value >= 0.42) return 'MEDIUM';
  return 'LOW';
}

function buildBackendUnavailableMessage(featureLabel) {
  return `${featureLabel} could not reach the backend at ${ANALYZER_URL}. Open ${ANALYZER_URL}/health on your phone or computer to verify the server is reachable.`;
}

async function buildFunctionHeaders() {
  const token = await getAuthToken();
  return {
    ...(supabaseProjectKey ? { apikey: supabaseProjectKey } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function normalizeAnalyzerResponse(json) {
  if (!json || typeof json !== 'object') return null;

  if (json.ok && json.analysis) {
    return {
      ok: true,
      analysis: {
        estimatedSellPrice: Number(json.analysis.estimatedSellPrice || 0),
        fees: Number(json.analysis.fees || 0),
        shipping: Number(json.analysis.shipping || 0),
        profit: Number(json.analysis.profit || 0),
        roi: Number(json.analysis.roi || 0),
        confidence: json.analysis.confidence || confidenceLabelFromScore(json.analysis.confidenceScore),
        confidenceScore: Number(json.analysis.confidenceScore || 0),
        comparableCount: Number(json.analysis.comparableCount || 0),
        comparables: Array.isArray(json.analysis.comparables) ? json.analysis.comparables : [],
        proLocked: Boolean(json.meta?.planLocked),
        lockedFeatures: Array.isArray(json.meta?.lockedFeatures) ? json.meta.lockedFeatures : [],
      },
      meta: json.meta || null
    };
  }

  if (json.success && json.analysis) {
    return {
      ok: true,
      analysis: {
        estimatedSellPrice: Number(json.analysis.estimatedSellPrice || 0),
        fees: Number(json.analysis.estimatedFees || 0),
        shipping: Number(json.analysis.estimatedShipping || 0),
        profit: Number(json.analysis.estimatedProfit || 0),
        roi: Number(json.analysis.estimatedROI || 0),
        confidence: confidenceLabelFromScore(json.analysis.confidence),
        confidenceScore: Number(json.analysis.confidence || 0),
        comparableCount: Number(json.meta?.compCount || 0),
        comparables: Array.isArray(json.comparables) ? json.comparables : []
      },
      meta: json.meta || null
    };
  }

  return null;
}

function normalizeFeedResponse(json) {
  if (!json || typeof json !== 'object' || !json.ok || !Array.isArray(json.items)) return null;

  return {
    ok: true,
    items: json.items.map((item) => normalizeFlip({
      id: item.id || makeId(),
      title: item.title,
      category: item.category,
      condition: item.condition,
      buy: item.buy,
      sell: item.sell,
      fees: item.fees,
      shipping: item.shipping,
      profit: item.profit,
      roi: item.roi,
      confidence: item.confidence,
      confidenceScore: item.confidenceScore,
      image: item.image,
      sourceUrl: item.sourceUrl,
      sourceQuery: item.sourceQuery,
    })),
    meta: json.meta || null,
  };
}

function normalizeThriftLookupResponse(json) {
  if (!json || typeof json !== 'object' || !json.ok) return null;

  if (!json.matched) {
    return {
      ok: true,
      matched: false,
      barcode: String(json.barcode || ''),
      error: json.error || 'No eBay match found for this barcode.',
      meta: json.meta || null,
    };
  }

  return {
    ok: true,
    matched: true,
    barcode: String(json.barcode || ''),
    item: {
      title: json.item?.title || 'Scanned item',
      category: json.item?.category || 'Thrift',
      condition: json.item?.condition || 'Unknown',
      image: json.item?.image || null,
      sourceUrl: json.item?.sourceUrl || null,
      sourceQuery: json.item?.sourceQuery || `barcode:${json.barcode || ''}`,
    },
    analysis: {
      estimatedSellPrice: Number(json.analysis?.estimatedSellPrice || 0),
      fees: Number(json.analysis?.fees || 0),
      shipping: Number(json.analysis?.shipping || 0),
      confidence: json.analysis?.confidence || confidenceLabelFromScore(json.analysis?.confidenceScore),
      confidenceScore: Number(json.analysis?.confidenceScore || 0),
      comparableCount: Number(json.analysis?.comparableCount || 0),
      comparables: Array.isArray(json.analysis?.comparables) ? json.analysis.comparables : [],
    },
    meta: json.meta || null,
  };
}

export async function getFlips() {
  const user = await getCurrentUserAuth();
  if (!user) return [];

  const flips = await getFlipsForUser(user.id);
  return flips.map(item => normalizeFlip(item, { user_id: user.id }));
}

export async function createFlip(flip) {
  const user = await getCurrentUserAuth();
  if (!user) throw new Error('Not authenticated');

  const item = normalizeFlip(flip, {
    id: flip.id || makeId(),
    user_id: user.id,
    createdAt: flip.createdAt || Date.now()
  });

  const saved = await upsertFlip(item);
  return { ok: true, flip: saved };
}

export async function markFlipSold(id) {
  await markFlipSoldById(id);
  return { ok: true };
}

export async function deleteFlip(id) {
  await deleteFlipById(id);
  return { ok: true };
}

export async function analyzeFlip({ query, buyPrice }) {
  try {
    const headers = await buildFunctionHeaders();
    const resp = await fetch(`${ANALYZER_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ query, buyPrice })
    });

    const json = await resp.json().catch(() => null);
    const normalized = normalizeAnalyzerResponse(json);

    if (!resp.ok) {
      const retryHint = json?.retryAfterSeconds ? ` Try again in about ${json.retryAfterSeconds}s.` : '';
      const detailHint = json?.detail ? ` ${json.detail}` : '';
      const errMsg = json?.error || `Analyzer returned ${resp.status}`;
      return { ok: false, error: `${errMsg}.${detailHint}${retryHint}`.trim() };
    }

    if (normalized?.ok && normalized.analysis) {
      return normalized;
    }

    return { ok: false, error: 'Unexpected analyzer response', detail: json };
  } catch (err) {
    console.warn('[syncClient] analyzeFlip failed', err?.message || err);
    return { ok: false, error: buildBackendUnavailableMessage('Analyze Flip') };
  }
}

export async function getLiveFeed(limit = 18, { force = false } = {}) {
  try {
    const forceParam = force ? '&force=true' : '';
    const headers = await buildFunctionHeaders();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    let resp;
    try {
      resp = await fetch(`${ANALYZER_URL}/feed?limit=${encodeURIComponent(limit)}${forceParam}`, {
        signal: controller.signal,
        headers,
      });
    } finally {
      clearTimeout(timeout);
    }
    const json = await resp.json().catch(() => null);
    const normalized = normalizeFeedResponse(json);

    if (!resp.ok) {
      return { ok: false, error: json?.error || `Feed returned ${resp.status}`, detail: json, meta: json?.meta || null };
    }

    if (normalized?.ok && normalized.items?.length) {
      return normalized;
    }

    // Return meta even when items are empty so frontend can show status
    return { ok: false, error: 'Feed did not return usable cards', detail: json, meta: json?.meta || null };
  } catch (err) {
    const isTimeout = err?.name === 'AbortError';
    console.warn('[syncClient] getLiveFeed failed', isTimeout ? '(timeout)' : err?.message || err);
    return {
      ok: false,
      error: isTimeout
        ? `Feed request timed out while waiting for ${ANALYZER_URL}/feed. The backend may be slow fetching from eBay — try again shortly.`
        : buildBackendUnavailableMessage('Live feed'),
    };
  }
}

export async function lookupBarcode({ barcode }) {
  try {
    const headers = await buildFunctionHeaders();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let resp;
    try {
      resp = await fetch(`${ANALYZER_URL}/thrift-lookup`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ barcode }),
      });
    } finally {
      clearTimeout(timeout);
    }

    const json = await resp.json().catch(() => null);
    const normalized = normalizeThriftLookupResponse(json);

    if (!resp.ok) {
      return { ok: false, error: json?.error || `Thrift lookup returned ${resp.status}`, detail: json };
    }

    if (normalized?.ok) {
      return normalized;
    }

    return { ok: false, error: 'Unexpected thrift lookup response', detail: json };
  } catch (err) {
    const isTimeout = err?.name === 'AbortError';
    console.warn('[syncClient] lookupBarcode failed', isTimeout ? '(timeout)' : err?.message || err);
    return {
      ok: false,
      error: isTimeout
        ? `Thrift lookup timed out while waiting for ${ANALYZER_URL}/thrift-lookup. Try scanning again.`
        : buildBackendUnavailableMessage('Thrift Mode'),
    };
  }
}
