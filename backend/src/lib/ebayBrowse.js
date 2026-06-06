const { config } = require('../config/env');
const { getToken } = require('./ebayAuth');

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const SEARCH_CACHE_STALE_MS = 2 * 60 * 60 * 1000;
const RATE_LIMIT_COOLDOWN_MS = 3 * 60 * 1000;
const MIN_REQUEST_GAP_MS = 400; // 400ms between eBay requests (safe for <10 calls/batch)

const searchCache = new Map();
let browseCooldownUntil = 0;
let lastRequestAt = 0;
let requestQueue = Promise.resolve();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKeyFor(query, options = {}) {
  return JSON.stringify({
    q: String(query || '').trim().toLowerCase(),
    limit: Math.min(options.limit || 25, 200),
    categoryId: options.categoryId || '',
    filter: options.filter || '',
  });
}

function getCachedEntry(key, { allowStale = false } = {}) {
  const entry = searchCache.get(key);
  if (!entry) return null;

  const ageMs = Date.now() - entry.cachedAt;
  const maxAge = allowStale ? SEARCH_CACHE_STALE_MS : SEARCH_CACHE_TTL_MS;
  if (ageMs > maxAge) {
    if (!allowStale) {
      searchCache.delete(key);
    }
    return null;
  }

  return entry;
}

function setCachedEntry(key, value) {
  searchCache.set(key, {
    value,
    cachedAt: Date.now(),
  });
}

async function runWithRequestPacing(task) {
  const run = async () => {
    const waitMs = Math.max(0, MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt));
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    const result = await task();
    lastRequestAt = Date.now();
    return result;
  };

  const queued = requestQueue.then(run, run);
  requestQueue = queued.catch(() => undefined);
  return queued;
}

function getBrowseState() {
  const cooldownRemainingMs = Math.max(0, browseCooldownUntil - Date.now());
  return {
    cooldownActive: cooldownRemainingMs > 0,
    cooldownRemainingMs,
    cacheEntries: searchCache.size,
    searchCacheTtlMs: SEARCH_CACHE_TTL_MS,
    staleCacheTtlMs: SEARCH_CACHE_STALE_MS,
    minRequestGapMs: MIN_REQUEST_GAP_MS,
  };
}

async function searchItems(query, options = {}) {
  const key = cacheKeyFor(query, options);
  const freshCache = getCachedEntry(key);
  if (freshCache) {
    return {
      ...freshCache.value,
      _cacheMeta: {
        fromCache: true,
        stale: false,
        ageMs: Date.now() - freshCache.cachedAt,
      },
    };
  }

  const staleCache = getCachedEntry(key, { allowStale: true });
  if (Date.now() < browseCooldownUntil) {
    if (staleCache) {
      console.warn('[ebayBrowse] Cooldown active, serving stale cache for query:', query);
      return {
        ...staleCache.value,
        _cacheMeta: {
          fromCache: true,
          stale: true,
          ageMs: Date.now() - staleCache.cachedAt,
        },
      };
    }

    const remainingSeconds = Math.ceil((browseCooldownUntil - Date.now()) / 1000);
    const err = new Error(`eBay search temporarily cooling down after rate limiting. Try again in ${remainingSeconds}s.`);
    err.status = 429;
    err.cooldownActive = true;
    err.retryAfterSeconds = remainingSeconds;
    throw err;
  }

  const token = await getToken();
  const limit = Math.min(options.limit || 25, 200);

  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });

  if (options.categoryId) {
    params.set('category_ids', options.categoryId);
  }

  if (options.filter) {
    params.set('filter', options.filter);
  }

  const url = `${config.ebay.browseUrl}/item_summary/search?${params.toString()}`;
  console.log(`[ebayBrowse] Searching: ${url}`);

  const response = await runWithRequestPacing(() =>
    fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': config.ebay.marketplaceId,
      },
    })
  );

  if (response.status === 429) {
    browseCooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    console.warn('[ebayBrowse] eBay rate limit hit (429) for query:', query);

    if (staleCache) {
      return {
        ...staleCache.value,
        _cacheMeta: {
          fromCache: true,
          stale: true,
          ageMs: Date.now() - staleCache.cachedAt,
        },
      };
    }

    const err = new Error('eBay rate limit exceeded (429). Analyzer is cooling down briefly.');
    err.status = 429;
    err.cooldownActive = true;
    err.retryAfterSeconds = Math.ceil(RATE_LIMIT_COOLDOWN_MS / 1000);
    throw err;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[ebayBrowse] Search failed:', response.status, errorBody);
    const err = new Error(`eBay search failed (${response.status}): ${errorBody}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  setCachedEntry(key, data);

  return {
    ...data,
    _cacheMeta: {
      fromCache: false,
      stale: false,
      ageMs: 0,
    },
  };
}

async function getItem(itemId) {
  const token = await getToken();
  const url = `${config.ebay.browseUrl}/item/${encodeURIComponent(itemId)}`;

  const response = await runWithRequestPacing(() =>
    fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': config.ebay.marketplaceId,
      },
    })
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[ebayBrowse] Get item failed:', response.status, errorBody);
    throw new Error(`eBay get item failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

module.exports = { searchItems, getItem, getBrowseState };
