import { handleCors, json } from '../_shared/cors.ts';
import { analyzeComparablePricing, confidenceLabel, estimateFees, estimateShipping, round2 } from '../_shared/priceMath.ts';
import { checkEbayCredentials, searchItems } from '../_shared/ebay.ts';
import { normalizeItems } from '../_shared/normalizeItem.ts';
import { requireUser, supabaseAdmin } from '../_shared/supabaseAdmin.ts';

const CACHE_KEY = 'global-v2';
const FEED_CACHE_TTL_MS = 15 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 45 * 1000;
const FEED_SEEDS = [
  { query: 'Nike Dunk Low', category: 'Sneakers' },
  { query: 'Jordan 4 retro', category: 'Sneakers' },
  { query: 'Adidas Samba OG', category: 'Sneakers' },
  { query: 'New Balance 550', category: 'Sneakers' },
  { query: 'Yeezy 350', category: 'Sneakers' },
  { query: 'AirPods Pro', category: 'Electronics' },
  { query: 'Sony WH-1000XM4', category: 'Electronics' },
  { query: 'iPad 9th generation', category: 'Electronics' },
  { query: 'MacBook Air M2', category: 'Electronics' },
  { query: 'Meta Quest 2', category: 'Electronics' },
  { query: 'Dyson Supersonic', category: 'Electronics' },
  { query: 'Nintendo Switch OLED', category: 'Gaming' },
  { query: 'PS5 DualSense controller', category: 'Gaming' },
  { query: 'Xbox Series S console', category: 'Gaming' },
  { query: 'Steam Deck 512GB', category: 'Gaming' },
  { query: 'Pokemon booster box sealed', category: 'Collectibles' },
  { query: 'Lego Star Wars sealed set', category: 'Collectibles' },
  { query: 'Magic commander deck sealed', category: 'Collectibles' },
  { query: 'Funko Pop Chase', category: 'Collectibles' },
  { query: 'Patagonia Synchilla fleece', category: 'Fashion' },
  { query: 'vintage Carhartt jacket', category: 'Fashion' },
  { query: 'Lululemon Define jacket', category: 'Fashion' },
  { query: "Arc'teryx Beta jacket", category: 'Fashion' },
  { query: 'Supreme hoodie', category: 'Fashion' },
];

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
  {
    id: 'fallback-7',
    title: 'PS5 DualSense Controller',
    category: 'Gaming',
    condition: 'Used - Good',
    buy: 38,
    sell: 63,
    fees: 8.87,
    shipping: 7.5,
    profit: 8.63,
    roi: 22.7,
    confidence: 'MEDIUM',
    confidenceScore: 0.52,
    image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-8',
    title: 'Xbox Series S Console',
    category: 'Gaming',
    condition: 'Used - Good',
    buy: 155,
    sell: 224,
    fees: 30.01,
    shipping: 13.5,
    profit: 25.49,
    roi: 16.4,
    confidence: 'MEDIUM',
    confidenceScore: 0.54,
    image: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-9',
    title: 'Sony WH-1000XM4 Headphones',
    category: 'Electronics',
    condition: 'Used - Good',
    buy: 128,
    sell: 188,
    fees: 25.19,
    shipping: 10.5,
    profit: 24.31,
    roi: 19.0,
    confidence: 'MEDIUM',
    confidenceScore: 0.57,
    image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-10',
    title: 'iPad 9th Gen 64GB',
    category: 'Electronics',
    condition: 'Used - Good',
    buy: 185,
    sell: 258,
    fees: 34.49,
    shipping: 10.5,
    profit: 28.01,
    roi: 15.1,
    confidence: 'MEDIUM',
    confidenceScore: 0.53,
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-11',
    title: 'Lego Star Wars Sealed Set',
    category: 'Collectibles',
    condition: 'New',
    buy: 72,
    sell: 118,
    fees: 15.92,
    shipping: 9.5,
    profit: 20.58,
    roi: 28.6,
    confidence: 'MEDIUM',
    confidenceScore: 0.56,
    image: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-12',
    title: 'Funko Pop Chase Variant',
    category: 'Collectibles',
    condition: 'New',
    buy: 24,
    sell: 48,
    fees: 6.98,
    shipping: 6.5,
    profit: 10.52,
    roi: 43.8,
    confidence: 'LOW',
    confidenceScore: 0.4,
    image: 'https://images.unsplash.com/photo-1608278047522-58806a6ac85b?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-13',
    title: 'Vintage Carhartt Detroit Jacket',
    category: 'Fashion',
    condition: 'Used - Good',
    buy: 68,
    sell: 124,
    fees: 16.7,
    shipping: 9.5,
    profit: 29.8,
    roi: 43.8,
    confidence: 'MEDIUM',
    confidenceScore: 0.58,
    image: 'https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-14',
    title: 'Patagonia Synchilla Fleece',
    category: 'Fashion',
    condition: 'Used - Good',
    buy: 42,
    sell: 78,
    fees: 10.9,
    shipping: 8.5,
    profit: 16.6,
    roi: 39.5,
    confidence: 'MEDIUM',
    confidenceScore: 0.55,
    image: 'https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-15',
    title: 'Lululemon Define Jacket',
    category: 'Fashion',
    condition: 'Used - Like New',
    buy: 54,
    sell: 96,
    fees: 13.34,
    shipping: 8.5,
    profit: 20.16,
    roi: 37.3,
    confidence: 'MEDIUM',
    confidenceScore: 0.55,
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-16',
    title: 'Adidas Samba OG',
    category: 'Sneakers',
    condition: 'Used - Like New',
    buy: 61,
    sell: 104,
    fees: 14.34,
    shipping: 8.5,
    profit: 20.16,
    roi: 33.0,
    confidence: 'MEDIUM',
    confidenceScore: 0.56,
    image: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-17',
    title: 'Meta Quest 2 128GB',
    category: 'Electronics',
    condition: 'Used - Good',
    buy: 140,
    sell: 209,
    fees: 28.08,
    shipping: 13.5,
    profit: 27.42,
    roi: 19.6,
    confidence: 'MEDIUM',
    confidenceScore: 0.54,
    image: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-18',
    title: 'Sealed Magic Commander Deck',
    category: 'Collectibles',
    condition: 'New',
    buy: 31,
    sell: 58,
    fees: 8.2,
    shipping: 6.5,
    profit: 12.3,
    roi: 39.7,
    confidence: 'LOW',
    confidenceScore: 0.43,
    image: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-19',
    title: "Arc'teryx Beta Jacket",
    category: 'Fashion',
    condition: 'Used - Good',
    buy: 185,
    sell: 294,
    fees: 39.24,
    shipping: 10.5,
    profit: 59.26,
    roi: 32.0,
    confidence: 'MEDIUM',
    confidenceScore: 0.57,
    image: 'https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
  {
    id: 'fallback-20',
    title: 'New Balance 550',
    category: 'Sneakers',
    condition: 'New',
    buy: 73,
    sell: 116,
    fees: 15.66,
    shipping: 8.5,
    profit: 18.84,
    roi: 25.8,
    confidence: 'MEDIUM',
    confidenceScore: 0.52,
    image: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: null,
    sourceQuery: 'fallback',
  },
];

function shuffle<T>(array: T[]) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function dedupeKey(title = '') {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapConditionLabel(raw: string) {
  if (!raw) return 'Used - Good';
  const value = String(raw).toLowerCase();
  if (value.includes('new')) return 'New';
  if (value.includes('like new') || value.includes('excellent')) return 'Used - Like New';
  if (value.includes('good') || value.includes('very good')) return 'Used - Good';
  return 'Used - Good';
}

function buildFallbackFeed(limit: number) {
  return shuffle(FALLBACK_FEED).slice(0, limit).map((item) => ({ ...item }));
}

function buildCategoryBreakdown(items: any[]) {
  return items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function buildOpportunityCards(normalizedItems: any[], seed: { query: string; category: string }) {
  const pricing = analyzeComparablePricing(normalizedItems, { query: seed.query });
  if (!pricing.comparables.length || pricing.estimatedPrice <= 0) {
    return [];
  }

  const marketPrice = pricing.marketPrice || pricing.estimatedPrice;
  const recommendedSell = pricing.estimatedPrice;

  return pricing.scoredComparables
    .filter((item: any) => item.listingType !== 'auction')
    .filter((item: any) => item.titleScore >= 0.26)
    .map((item: any) => {
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
              (item.qualityScore - 0.55) * 0.18,
          ),
        ),
      );

      return {
        id: item.itemId || `ebay-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        title: item.title,
        category: seed.category,
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
    .filter((item) => item.profit >= 4 && item.roi >= 4)
    .filter((item) => item.sell > item.buy)
    .sort((a, b) => ((b.profit * b.confidenceScore) - (a.profit * a.confidenceScore)) || (b.roi - a.roi))
    .slice(0, 6);
}

async function readCache() {
  const { data, error } = await supabaseAdmin
    .from('feed_cache')
    .select('*')
    .eq('key', CACHE_KEY)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message);
  }

  return data || null;
}

async function writeCache(items: any[], source: string, message: string | null) {
  const generatedAt = new Date().toISOString();
  const metadata = {
    itemCount: items.length,
    categoryBreakdown: buildCategoryBreakdown(items),
  };

  const { error } = await supabaseAdmin.from('feed_cache').upsert(
    {
      key: CACHE_KEY,
      payload: items,
      source,
      message,
      metadata,
      generated_at: generatedAt,
    },
    { onConflict: 'key' },
  );

  if (error) {
    throw new Error(error.message);
  }

  return {
    items,
    source,
    message,
    generatedAt,
    metadata,
  };
}

async function fetchFreshFeed(limit: number) {
  const creds = checkEbayCredentials();
  if (!creds.configured) {
    return {
      items: buildFallbackFeed(limit),
      source: 'fallback',
      reason: `eBay credentials not configured. Missing: ${creds.missing.join(', ')}`,
    };
  }

  const seedCount = Math.min(FEED_SEEDS.length, Math.max(5, Math.ceil(limit / 4)));
  const seeds = shuffle(FEED_SEEDS).slice(0, seedCount);
  const results = await Promise.allSettled(
    seeds.map(async (seed) => {
      const result = await searchItems(seed.query, { limit: 14, timeoutMs: 9000 });
      const raw = result.itemSummaries || [];
      const normalized = normalizeItems(raw);
      return buildOpportunityCards(normalized, seed);
    }),
  );

  const cards = results.flatMap((entry) => (entry.status === 'fulfilled' ? entry.value : []));
  const deduped: any[] = [];
  const seen = new Set<string>();

  for (const card of shuffle(cards)) {
    const key = dedupeKey(card.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(card);
    if (deduped.length >= limit) break;
  }

  if (deduped.length) {
    const minTarget = Math.min(limit, 18);
    if (deduped.length < minTarget) {
      for (const card of buildFallbackFeed(limit)) {
        const key = dedupeKey(card.title);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(card);
        if (deduped.length >= limit) break;
      }
    }

    const failedSearches = results.filter((entry) => entry.status === 'rejected').length;
    const mixedWithFallback = deduped.some((item) => item.sourceQuery === 'fallback');
    return {
      items: deduped,
      source: 'live',
      reason: mixedWithFallback
        ? `Live feed found ${cards.length} eBay candidates, then filled the batch with starter cards.`
        : failedSearches
        ? `${failedSearches} live search${failedSearches === 1 ? '' : 'es'} skipped, showing the usable results.`
        : null,
    };
  }

  return {
    items: buildFallbackFeed(limit),
    source: 'fallback',
    reason: 'Live refresh returned no usable cards',
  };
}

function buildFeedResponse(items: any[], meta: Record<string, unknown>) {
  return {
    ok: true,
    items,
    meta,
  };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user, error: authError } = await requireUser(req);
  if (!user) {
    return json({ ok: false, error: authError || 'Unauthorized' }, 401);
  }

  if (req.method !== 'GET') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  const url = new URL(req.url);
  const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '18', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 6), 30) : 18;
  const force = url.searchParams.get('force') === 'true' || url.searchParams.get('force') === '1';

  let cache = null;
  try {
    cache = await readCache();
  } catch (err) {
    console.warn('[feed] failed to read cache', err);
  }

  const now = Date.now();
  const cacheAgeMs = cache?.generated_at ? now - new Date(cache.generated_at).getTime() : Number.POSITIVE_INFINITY;
  const cooldownRemaining = Math.max(0, REFRESH_COOLDOWN_MS - cacheAgeMs);
  const cacheItems = Array.isArray(cache?.payload) ? cache.payload.slice(0, limit) : [];

  if (!force && cacheItems.length && cacheAgeMs < FEED_CACHE_TTL_MS) {
    return json(
      buildFeedResponse(cacheItems, {
        source: cache.source || 'live',
        fromCache: true,
        generatedAt: cache.generated_at,
        ageMs: cacheAgeMs,
        itemCount: cacheItems.length,
        cooldownRemaining: 0,
        refreshInProgress: false,
        userId: user.id,
        message: cache.message || null,
        ...(cache.metadata || {}),
      }),
    );
  }

  if (force && cacheItems.length && cooldownRemaining > 0) {
    return json(
      buildFeedResponse(cacheItems, {
        source: cache.source || 'live',
        fromCache: true,
        cooldown: true,
        cooldownRemaining,
        generatedAt: cache.generated_at,
        ageMs: cacheAgeMs,
        itemCount: cacheItems.length,
        refreshInProgress: false,
        userId: user.id,
        message: `Cooling down — refresh available in ${Math.ceil(cooldownRemaining / 1000)}s`,
        ...(cache.metadata || {}),
      }),
    );
  }

  try {
    const refreshResult = await fetchFreshFeed(limit);
    const saved = await writeCache(refreshResult.items, refreshResult.source, refreshResult.reason || null);

    return json(
      buildFeedResponse(saved.items.slice(0, limit), {
        source: refreshResult.source,
        fromCache: false,
        generatedAt: saved.generatedAt,
        ageMs: 0,
        itemCount: saved.items.length,
        cooldownRemaining: 0,
        refreshInProgress: false,
        userId: user.id,
        message: refreshResult.reason || null,
        ...(saved.metadata || {}),
      }),
    );
  } catch (err) {
    if (cacheItems.length) {
      return json(
        buildFeedResponse(cacheItems, {
          source: cache.source || 'live',
          fromCache: true,
          refreshFailed: true,
          refreshError: err instanceof Error ? err.message : String(err),
          generatedAt: cache.generated_at,
          ageMs: cacheAgeMs,
          itemCount: cacheItems.length,
          cooldownRemaining: 0,
          refreshInProgress: false,
          userId: user.id,
          message: 'Refresh failed — showing previous feed',
          ...(cache.metadata || {}),
        }),
      );
    }

    const fallbackItems = buildFallbackFeed(limit);
    return json(
      buildFeedResponse(fallbackItems, {
        source: 'fallback',
        fromCache: false,
        refreshFailed: true,
        refreshError: err instanceof Error ? err.message : String(err),
        generatedAt: new Date().toISOString(),
        ageMs: 0,
        itemCount: fallbackItems.length,
        cooldownRemaining: 0,
        refreshInProgress: false,
        userId: user.id,
        message: 'Live refresh failed — showing fallback feed',
        categoryBreakdown: buildCategoryBreakdown(fallbackItems),
      }),
    );
  }
});
