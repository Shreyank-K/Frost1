const { checkEbayCredentials } = require('../config/env');
const { searchItems } = require('../lib/ebayBrowse');
const { normalizeItems } = require('../utils/normalizeItem');
const {
  analyzeComparablePricing,
  confidenceLabel,
  estimateFees,
  estimateShipping,
  round2,
} = require('../utils/priceMath');

// ─────────────────────────────────────────────────
// Option B: Real eBay Feed — manual refresh only
// ─────────────────────────────────────────────────
// Seeds: small set of popular resale queries
// Concurrency: max 2 upstream eBay searches at a time
// Cache: in-memory, never wiped on failure
// Cooldown: 45 seconds between manual refreshes
// ─────────────────────────────────────────────────

const FEED_SEEDS = [
  { query: 'Nike Dunk Low', category: 'Sneakers' },
  { query: 'AirPods Pro', category: 'Electronics' },
  { query: 'Nintendo Switch OLED', category: 'Gaming' },
  { query: 'Pokemon booster box sealed', category: 'Collectibles' },
  { query: 'Jordan 4 retro', category: 'Sneakers' },
  { query: 'MacBook Air M2', category: 'Electronics' },
];

const MAX_CONCURRENCY = 2;
const REFRESH_COOLDOWN_MS = 45 * 1000; // 45 seconds
const FEED_TIMEOUT_MS = 8 * 1000;
const PER_SEED_TIMEOUT_MS = 4 * 1000;

const FALLBACK_FEED = [
  {
    id: 'fallback-1',
    title: 'Nike Dunk Low Panda',
    category: 'Sneakers',
    condition: 'New',
    buy: 82,
    sell: 128,
    fees: 17.26,
    shipping: 8.5,
    profit: 20.24,
    roi: 24.7,
    confidence: 'MEDIUM',
    confidenceScore: 0.58,
    image: 'https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-2',
    title: 'AirPods Pro 2nd Gen',
    category: 'Electronics',
    condition: 'Used - Good',
    buy: 95,
    sell: 154,
    fees: 20.71,
    shipping: 10.5,
    profit: 27.79,
    roi: 29.3,
    confidence: 'MEDIUM',
    confidenceScore: 0.61,
    image: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-3',
    title: 'Nintendo Switch OLED Console',
    category: 'Gaming',
    condition: 'Used - Good',
    buy: 180,
    sell: 259,
    fees: 34.62,
    shipping: 13.5,
    profit: 30.88,
    roi: 17.2,
    confidence: 'MEDIUM',
    confidenceScore: 0.55,
    image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-4',
    title: 'Pokemon Booster Box Sealed',
    category: 'Collectibles',
    condition: 'New',
    buy: 110,
    sell: 168,
    fees: 22.56,
    shipping: 10.5,
    profit: 24.94,
    roi: 22.7,
    confidence: 'LOW',
    confidenceScore: 0.42,
    image: 'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-5',
    title: 'Jordan 4 Retro Military Black',
    category: 'Sneakers',
    condition: 'Used - Like New',
    buy: 145,
    sell: 219,
    fees: 29.32,
    shipping: 13.5,
    profit: 31.18,
    roi: 21.5,
    confidence: 'MEDIUM',
    confidenceScore: 0.6,
    image: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-6',
    title: 'MacBook Air M2 13-inch',
    category: 'Electronics',
    condition: 'Used - Good',
    buy: 620,
    sell: 785,
    fees: 104.31,
    shipping: 13.5,
    profit: 47.19,
    roi: 7.6,
    confidence: 'LOW',
    confidenceScore: 0.39,
    image: 'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
];

// ── In-memory feed cache ──
let cachedFeed = null;    // { items, meta, generatedAt }
let lastRefreshAt = 0;
let refreshInProgress = false;

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function dedupeKey(title = '') {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapConditionLabel(raw) {
  if (!raw) return 'Used - Good';
  const s = String(raw).toLowerCase();
  if (s.includes('new')) return 'New';
  if (s.includes('like new') || s.includes('excellent')) return 'Used - Like New';
  if (s.includes('good') || s.includes('very good')) return 'Used - Good';
  return 'Used - Good';
}

function categorizeFromSeed(seedCategory) {
  return seedCategory || 'Misc';
}

function buildFallbackFeed(limit) {
  return shuffle(FALLBACK_FEED).slice(0, limit).map((item) => ({ ...item }));
}

/**
 * Run an array of async tasks with a concurrency limit.
 */
async function runWithConcurrency(tasks, limit) {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const p = task().then((r) => {
      executing.delete(p);
      return r;
    });
    executing.add(p);
    results.push(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.allSettled(results);
}

function buildOpportunityCards(normalizedItems, seed) {
  const pricing = analyzeComparablePricing(normalizedItems, { query: seed.query });
  if (!pricing.comparables.length || pricing.estimatedPrice <= 0) {
    return [];
  }

  const marketPrice = pricing.marketPrice || pricing.estimatedPrice;
  const recommendedSell = pricing.estimatedPrice;

  return pricing.scoredComparables
    .filter((item) => item.imageUrl)
    .filter((item) => item.listingType !== 'auction')
    .filter((item) => item.titleScore >= 0.35)
    .map((item) => {
      const buyPrice = item.price;
      const discountToMarket = marketPrice > 0 ? (marketPrice - buyPrice) / marketPrice : 0;
      const sellPrice = round2(Math.max(recommendedSell, buyPrice));
      const fees = estimateFees(sellPrice);
      const shipping = estimateShipping(sellPrice);
      const profit = round2(sellPrice - buyPrice - fees - shipping);
      const roi = buyPrice > 0 ? round2((profit / buyPrice) * 100) : 0;
      const confidenceScore = round2(
        Math.min(
          0.95,
          Math.max(
            0.2,
            pricing.confidence +
              Math.max(0, discountToMarket) * 0.5 +
              (item.qualityScore - 0.55) * 0.18
          )
        )
      );

      return {
        id: item.itemId || `ebay-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        title: item.title,
        category: categorizeFromSeed(seed.category),
        condition: mapConditionLabel(item.condition),
        buy: buyPrice,
        sell: sellPrice,
        fees,
        shipping,
        profit,
        roi,
        confidence: confidenceLabel(confidenceScore),
        confidenceScore,
        image: item.imageUrl || null,
        sourceUrl: item.itemWebUrl || null,
        sourceQuery: seed.query,
      };
    })
    .filter((item) => item.profit >= 8 && item.roi >= 8)
    .filter((item) => item.sell > item.buy)
    .sort((a, b) => (
      (b.profit * b.confidenceScore) - (a.profit * a.confidenceScore) ||
      b.roi - a.roi
    ))
    .slice(0, 4);
}

// ─────────────────────────────────────────────────
// Core: fetch fresh feed from eBay
// ─────────────────────────────────────────────────

function withTimeout(promise, ms, label = 'operation') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

async function fetchFreshFeed(limit) {
  const creds = checkEbayCredentials();
  if (!creds.configured) {
    return {
      items: buildFallbackFeed(limit),
      source: 'fallback',
      reason: `eBay credentials not configured. Missing: ${creds.missing.join(', ')}`,
    };
  }

  // Pick a random subset of seeds (2) to keep request count low and latency fast.
  const seeds = shuffle(FEED_SEEDS).slice(0, 2);

  console.log(`[feedService] Starting feed refresh with ${seeds.length} seeds: ${seeds.map(s => s.query).join(', ')}`);
  const startMs = Date.now();

  const tasks = seeds.map((seed) => async () => {
    try {
      const result = await withTimeout(
        searchItems(seed.query, { limit: 8 }),
        PER_SEED_TIMEOUT_MS,
        `seed "${seed.query}"`,
      );
      const raw = result.itemSummaries || [];
      const normalized = normalizeItems(raw);
      console.log(`[feedService] Seed "${seed.query}": ${raw.length} raw -> ${normalized.length} normalized`);
      return buildOpportunityCards(normalized, seed);
    } catch (err) {
      console.warn(`[feedService] Seed "${seed.query}" failed:`, err.message);
      return []; // individual seed failure is non-fatal
    }
  });

  const settled = await withTimeout(
    runWithConcurrency(tasks, MAX_CONCURRENCY),
    FEED_TIMEOUT_MS,
    'feed refresh',
  );

  const elapsed = Date.now() - startMs;
  console.log(`[feedService] Feed refresh completed in ${elapsed}ms`);

  const allCards = [];
  for (const result of settled) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allCards.push(...result.value);
    }
  }

  console.log(`[feedService] Total cards before dedup: ${allCards.length}`);

  // Dedupe by title similarity
  const seenTitles = new Set();
  const deduped = [];
  for (const card of shuffle(allCards)) {
    const key = dedupeKey(card.title);
    if (!key || seenTitles.has(key)) continue;
    // Only include cards with an image
    if (!card.image) continue;
    seenTitles.add(key);
    deduped.push(card);
    if (deduped.length >= limit) break;
  }

  console.log(`[feedService] Final feed: ${deduped.length} cards`);
  if (deduped.length) {
    return {
      items: deduped,
      source: 'live',
      reason: null,
    };
  }

  return {
    items: buildFallbackFeed(limit),
    source: 'fallback',
    reason: 'Live refresh returned no usable cards',
  };
}

// ─────────────────────────────────────────────────
// getFeed — main entry point
// ─────────────────────────────────────────────────
// force=false → return cache if available
// force=true  → manual refresh (respects cooldown)
// ─────────────────────────────────────────────────

async function getFeed({ limit = 18, force = false } = {}) {
  const now = Date.now();
  const cooldownRemaining = Math.max(0, REFRESH_COOLDOWN_MS - (now - lastRefreshAt));

  // ── Return cache for non-force requests ──
  if (!force && cachedFeed) {
    return {
      ok: true,
      items: cachedFeed.items.slice(0, limit),
      meta: {
        source: 'live',
        fromCache: true,
        generatedAt: cachedFeed.generatedAt,
        ageMs: now - cachedFeed.generatedAt,
        itemCount: Math.min(cachedFeed.items.length, limit),
        cooldownRemaining: 0,
        refreshInProgress: false,
      },
    };
  }

  // ── Cooldown guard for manual refresh ──
  if (force && cooldownRemaining > 0 && cachedFeed) {
    return {
      ok: true,
      items: cachedFeed.items.slice(0, limit),
      meta: {
        source: 'live',
        fromCache: true,
        cooldown: true,
        cooldownRemaining,
        generatedAt: cachedFeed.generatedAt,
        ageMs: now - cachedFeed.generatedAt,
        itemCount: Math.min(cachedFeed.items.length, limit),
        refreshInProgress: false,
        message: `Cooling down — refresh available in ${Math.ceil(cooldownRemaining / 1000)}s`,
      },
    };
  }

  // ── Prevent overlapping refreshes ──
  if (refreshInProgress && cachedFeed) {
    return {
      ok: true,
      items: cachedFeed.items.slice(0, limit),
      meta: {
        source: 'live',
        fromCache: true,
        refreshInProgress: true,
        generatedAt: cachedFeed.generatedAt,
        ageMs: now - cachedFeed.generatedAt,
        itemCount: Math.min(cachedFeed.items.length, limit),
        cooldownRemaining: 0,
      },
    };
  }

  // ── Fetch fresh feed ──
  refreshInProgress = true;
  try {
    const refreshResult = await fetchFreshFeed(limit);
    const items = refreshResult.items || [];

    if (items.length > 0) {
      cachedFeed = {
        items,
        generatedAt: Date.now(),
      };
      lastRefreshAt = Date.now();
    } else if (cachedFeed) {
      // eBay returned nothing useful — keep old cache
      return {
        ok: true,
        items: cachedFeed.items.slice(0, limit),
        meta: {
          source: 'live',
          fromCache: true,
          refreshFailed: true,
          generatedAt: cachedFeed.generatedAt,
          ageMs: Date.now() - cachedFeed.generatedAt,
          itemCount: Math.min(cachedFeed.items.length, limit),
          cooldownRemaining: 0,
          refreshInProgress: false,
          message: 'Refresh returned no results — showing previous feed',
        },
      };
    } else {
      // No cache and no results — truly empty
      return {
        ok: false,
        items: [],
        error: 'No eBay results found and no cached feed available',
        meta: { source: 'empty', refreshInProgress: false },
      };
    }

    const categoryBreakdown = cachedFeed.items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});

    return {
      ok: true,
      items: cachedFeed.items.slice(0, limit),
      meta: {
        source: refreshResult.source || 'live',
        fromCache: false,
        generatedAt: cachedFeed.generatedAt,
        ageMs: 0,
        itemCount: cachedFeed.items.length,
        categoryBreakdown,
        cooldownRemaining: 0,
        refreshInProgress: false,
        message: refreshResult.reason || null,
      },
    };
  } catch (err) {
    console.error('[feedService] Refresh failed:', err.message);

    // On failure, return cached feed if available
    if (cachedFeed) {
      return {
        ok: true,
        items: cachedFeed.items.slice(0, limit),
        meta: {
          source: 'live',
          fromCache: true,
          refreshFailed: true,
          refreshError: err.message,
          generatedAt: cachedFeed.generatedAt,
          ageMs: Date.now() - cachedFeed.generatedAt,
          itemCount: Math.min(cachedFeed.items.length, limit),
          cooldownRemaining: 0,
          refreshInProgress: false,
          message: 'Refresh failed — showing previous feed',
        },
      };
    }

    // No cache at all
    return {
      ok: true,
      items: buildFallbackFeed(limit),
      meta: {
        source: 'fallback',
        refreshFailed: true,
        refreshError: err.message,
        refreshInProgress: false,
        generatedAt: Date.now(),
        ageMs: 0,
        itemCount: limit,
        cooldownRemaining: 0,
        message: 'Live refresh failed — showing fallback feed',
      },
    };
  } finally {
    refreshInProgress = false;
  }
}

module.exports = { getFeed };
