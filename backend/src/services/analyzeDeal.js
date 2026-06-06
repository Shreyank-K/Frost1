const { checkEbayCredentials, config } = require('../config/env');
const { searchItems } = require('../lib/ebayBrowse');
const { normalizeItems } = require('../utils/normalizeItem');
const {
  analyzeComparablePricing,
  calculateDealScore,
  estimateBreakEvenPrice,
  estimateFees,
  estimateShipping,
  confidenceLabel,
  round2,
} = require('../utils/priceMath');

async function analyzeDeal(input) {
  const { query, buyPrice, conditionHint } = input;
  const reasoning = [];

  const creds = checkEbayCredentials();
  if (!creds.configured) {
    return {
      ok: false,
      error: 'eBay credentials not configured',
      detail: `Missing environment variables: ${creds.missing.join(', ')}. See .env.example for setup instructions.`,
      input: { query, buyPrice },
    };
  }

  let rawSearchResult;
  try {
    rawSearchResult = await searchItems(query, { limit: 18 });
  } catch (err) {
    return {
      ok: false,
      error: 'eBay search failed',
      detail: err.message,
      cooldownActive: !!err.cooldownActive,
      retryAfterSeconds: err.retryAfterSeconds || null,
      input: { query, buyPrice },
    };
  }

  const rawItems = rawSearchResult.itemSummaries || [];
  const rawResultCount = rawItems.length;
  reasoning.push(`Fetched ${rawResultCount} raw result${rawResultCount === 1 ? '' : 's'} from eBay`);

  if (rawSearchResult?._cacheMeta?.fromCache) {
    const cacheAgeSeconds = Math.max(0, Math.round((rawSearchResult._cacheMeta.ageMs || 0) / 1000));
    reasoning.push(
      rawSearchResult._cacheMeta.stale
        ? `Used cached eBay results from ${cacheAgeSeconds}s ago while search is cooling down`
        : `Used cached eBay results from ${cacheAgeSeconds}s ago`
    );
  }

  const normalized = normalizeItems(rawItems);
  reasoning.push(`${normalized.length} result${normalized.length === 1 ? '' : 's'} had usable title + price data`);

  if (normalized.length === 0) {
    return {
      ok: true,
      input: { query, buyPrice },
      analysis: {
        estimatedSellPrice: 0,
        fees: 0,
        shipping: 0,
        profit: 0,
        roi: 0,
        confidence: 'LOW',
        confidenceScore: 0,
        comparableCount: 0,
        reasoning: [...reasoning, 'No usable comparables found. Try a broader search term.'],
        comparables: [],
      },
      meta: {
        marketplaceId: config.ebay.marketplaceId,
        environment: config.ebay.env,
        cache: rawSearchResult?._cacheMeta || null,
      },
    };
  }

  const pricing = analyzeComparablePricing(normalized, { query, conditionHint });
  reasoning.push(...pricing.reasoning);

  if (pricing.comparables.length === 0) {
    return {
      ok: true,
      input: { query, buyPrice },
      analysis: {
        estimatedSellPrice: 0,
        fees: 0,
        shipping: 0,
        profit: 0,
        roi: 0,
        confidence: 'LOW',
        confidenceScore: 0,
        comparableCount: 0,
        reasoning: [...reasoning, 'Comparable filtering removed all candidates. Try a more specific product search.'],
        comparables: [],
      },
      meta: {
        marketplaceId: config.ebay.marketplaceId,
        environment: config.ebay.env,
        cache: rawSearchResult?._cacheMeta || null,
      },
    };
  }

  const estimatedSellPrice = pricing.estimatedPrice;
  const fees = estimateFees(estimatedSellPrice);
  const shipping = estimateShipping(estimatedSellPrice);
  const profit = round2(estimatedSellPrice - buyPrice - fees - shipping);
  const roi = buyPrice > 0 ? round2((profit / buyPrice) * 100) : 0;
  const breakEvenPrice = estimateBreakEvenPrice(buyPrice);
  const dealScore = calculateDealScore({
    buyPrice,
    estimatedSellPrice,
    marketPrice: pricing.marketPrice,
    fees,
    shipping,
    profit,
    roi,
    pricingConfidence: pricing.confidence,
  });

  reasoning.push(`Estimated sell price ($${estimatedSellPrice}) using ${pricing.method} across ${pricing.comparables.length} comparable${pricing.comparables.length === 1 ? '' : 's'}`);
  reasoning.push(`Estimated fees: $${fees} (13.25% + $0.30)`);
  reasoning.push(`Estimated shipping: $${shipping}`);
  reasoning.push(`Break-even resale price is about $${breakEvenPrice}`);
  reasoning.push(...dealScore.reasoning);

  return {
    ok: true,
    input: { query, buyPrice },
    analysis: {
      estimatedSellPrice,
      marketPrice: pricing.marketPrice,
      priceFloor: pricing.priceFloor,
      priceCeiling: pricing.priceCeiling,
      targetPercentile: pricing.targetPercentile,
      pricingMethod: pricing.method,
      pricingStrategy: pricing.strategy,
      breakEvenPrice,
      fees,
      shipping,
      profit,
      roi,
      confidence: dealScore.confidence,
      confidenceScore: dealScore.score,
      pricingConfidence: confidenceLabel(pricing.confidence),
      pricingConfidenceScore: pricing.confidence,
      comparableCount: pricing.comparables.length,
      reasoning,
      comparables: pricing.comparables.map((c) => ({
        title: c.title,
        price: c.price,
        itemWebUrl: c.itemWebUrl,
        imageUrl: c.imageUrl,
        condition: c.condition,
        matchScore: c.qualityScore,
        source: 'eBay',
      })),
    },
    meta: {
      marketplaceId: config.ebay.marketplaceId,
      environment: config.ebay.env,
      rawResultCount,
      confidenceFactors: pricing.confidenceFactors,
      dealFactors: dealScore.factors,
      pricingStats: pricing.stats,
      cache: rawSearchResult?._cacheMeta || null,
    },
  };
}

module.exports = { analyzeDeal };
