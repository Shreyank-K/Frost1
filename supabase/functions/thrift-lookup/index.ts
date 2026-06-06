import { handleCors, json } from '../_shared/cors.ts';
import { checkEbayCredentials, searchItems } from '../_shared/ebay.ts';
import { normalizeItems } from '../_shared/normalizeItem.ts';
import {
  analyzeComparablePricing,
  confidenceLabel,
  estimateFees,
  estimateShipping,
  round2,
} from '../_shared/priceMath.ts';
import { requireUser } from '../_shared/supabaseAdmin.ts';

function cleanBarcode(value: unknown) {
  return String(value || '').replace(/[^0-9]/g, '').trim();
}

function mapConditionLabel(raw: string) {
  if (!raw) return 'Unknown';
  const value = String(raw).toLowerCase();
  if (value.includes('new')) return 'New';
  if (value.includes('like new') || value.includes('excellent')) return 'Used - Like New';
  if (value.includes('good') || value.includes('very good')) return 'Used - Good';
  return raw;
}

function guessCategory(title = '') {
  const value = String(title).toLowerCase();
  if (/(shoe|sneaker|jordan|nike|adidas|yeezy|new balance|dunk)/.test(value)) return 'Sneakers';
  if (/(game|console|switch|xbox|playstation|ps5|controller|steam deck)/.test(value)) return 'Gaming';
  if (/(lego|pokemon|trading card|funko|collectible|sealed|booster|card)/.test(value)) return 'Collectibles';
  if (/(jacket|hoodie|shirt|fleece|pants|lululemon|patagonia|carhartt|supreme)/.test(value)) return 'Fashion';
  if (/(airpods|ipad|iphone|macbook|sony|dyson|headphones|camera|quest|tablet)/.test(value)) return 'Electronics';
  return 'Thrift';
}

function comparablePayload(items: any[]) {
  return items.slice(0, 6).map((item) => ({
    title: item.title,
    price: item.price,
    itemWebUrl: item.itemWebUrl,
    imageUrl: item.imageUrl,
    condition: item.condition,
    matchScore: item.qualityScore || null,
    source: 'eBay',
  }));
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  const { user, error: authError } = await requireUser(req);
  if (!user) {
    return json({ ok: false, error: authError || 'Unauthorized' }, 401);
  }

  const body = await req.json().catch(() => null);
  const barcode = cleanBarcode(body?.barcode);

  if (barcode.length < 8 || barcode.length > 14) {
    return json({
      ok: false,
      error: 'Scan a valid UPC, EAN, or ISBN barcode.',
      input: { barcode: body?.barcode || null },
    }, 400);
  }

  const creds = checkEbayCredentials();
  if (!creds.configured) {
    return json({
      ok: false,
      error: 'eBay credentials not configured',
      detail: `Missing environment variables: ${creds.missing.join(', ')}`,
    }, 503);
  }

  let rawSearchResult: any = null;
  let matchType = 'gtin';
  try {
    rawSearchResult = await searchItems('', { gtin: barcode, limit: 20, timeoutMs: 10000 });
  } catch (err) {
    return json({
      ok: false,
      error: 'eBay barcode search failed',
      detail: err instanceof Error ? err.message : String(err),
      input: { barcode },
    }, 502);
  }

  let rawItems = rawSearchResult?.itemSummaries || [];
  if (!rawItems.length) {
    matchType = 'barcode-query';
    try {
      rawSearchResult = await searchItems(barcode, { limit: 12, timeoutMs: 8000 });
      rawItems = rawSearchResult?.itemSummaries || [];
    } catch {
      rawItems = [];
    }
  }

  const normalized = normalizeItems(rawItems);
  if (!normalized.length) {
    return json({
      ok: true,
      matched: false,
      barcode,
      error: 'No eBay match found for this barcode.',
      meta: {
        userId: user.id,
        matchType,
        rawResultCount: rawItems.length,
        marketplaceId: creds.config.marketplaceId,
        environment: creds.config.env,
      },
    });
  }

  const primary =
    normalized.find((item: any) => item.imageUrl) ||
    normalized[0];
  const query = primary.title;
  const pricing = analyzeComparablePricing(normalized, { query });
  const pricingComparables = pricing.comparables.length ? pricing.comparables : normalized.slice(0, 6);
  const estimatedSellPrice = pricing.comparables.length
    ? pricing.estimatedPrice
    : round2(primary.price);
  const fees = estimateFees(estimatedSellPrice);
  const shipping = estimateShipping(estimatedSellPrice);
  const confidenceScore = pricing.comparables.length
    ? pricing.confidence
    : 0.32;

  return json({
    ok: true,
    matched: true,
    barcode,
    item: {
      title: primary.title,
      category: guessCategory(primary.title),
      condition: mapConditionLabel(primary.condition),
      image: primary.imageUrl || null,
      sourceUrl: primary.itemWebUrl || null,
      sourceQuery: `barcode:${barcode}`,
    },
    analysis: {
      estimatedSellPrice,
      marketPrice: pricing.marketPrice || estimatedSellPrice,
      fees,
      shipping,
      confidence: confidenceLabel(confidenceScore),
      confidenceScore: round2(confidenceScore),
      comparableCount: pricingComparables.length,
      comparables: comparablePayload(pricingComparables),
      pricingMethod: pricing.method || 'barcode_match',
      pricingStrategy: pricing.strategy || 'barcode match estimate',
    },
    meta: {
      userId: user.id,
      matchType,
      rawResultCount: rawItems.length,
      marketplaceId: creds.config.marketplaceId,
      environment: creds.config.env,
    },
  });
});
