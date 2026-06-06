import { handleCors, json } from '../_shared/cors.ts';
import { checkEbayCredentials, searchItems } from '../_shared/ebay.ts';
import { normalizeItems } from '../_shared/normalizeItem.ts';
import {
  analyzeComparablePricing,
  calculateDealScore,
  confidenceLabel,
  estimateBreakEvenPrice,
  estimateFees,
  estimateShipping,
  round2,
} from '../_shared/priceMath.ts';
import { requireUser, supabaseAdmin } from '../_shared/supabaseAdmin.ts';

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

  const { data: profileRow } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle();
  const viewerPlan = profileRow?.plan === 'pro' ? 'pro' : 'free';
  const planLocked = viewerPlan !== 'pro';

  const body = await req.json().catch(() => null);
  const query = String(body?.query || '').trim();
  const buyPrice = Number(body?.buyPrice);
  const conditionHint = body?.conditionHint ? String(body.conditionHint) : undefined;

  if (!query || !Number.isFinite(buyPrice) || buyPrice <= 0) {
    return json({
      ok: false,
      error: 'Invalid request body',
      details: [
        !query ? { field: 'query', message: 'query is required' } : null,
        !Number.isFinite(buyPrice) || buyPrice <= 0 ? { field: 'buyPrice', message: 'buyPrice must be a positive number' } : null,
      ].filter(Boolean),
    }, 400);
  }

  const reasoning: string[] = [];
  const creds = checkEbayCredentials();
  if (!creds.configured) {
    return json({
      ok: false,
      error: 'eBay credentials not configured',
      detail: `Missing environment variables: ${creds.missing.join(', ')}`,
      input: { query, buyPrice },
    }, 503);
  }

  let rawSearchResult: any;
  try {
    rawSearchResult = await searchItems(query, { limit: 18 });
  } catch (err) {
    return json({
      ok: false,
      error: 'eBay search failed',
      detail: err instanceof Error ? err.message : String(err),
      input: { query, buyPrice },
    }, 502);
  }

  const rawItems = rawSearchResult.itemSummaries || [];
  const rawResultCount = rawItems.length;
  reasoning.push(`Fetched ${rawResultCount} raw result${rawResultCount === 1 ? '' : 's'} from eBay`);

  const normalized = normalizeItems(rawItems);
  reasoning.push(`${normalized.length} result${normalized.length === 1 ? '' : 's'} had usable title + price data`);

  if (!normalized.length) {
    return json({
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
        marketplaceId: creds.config.marketplaceId,
        environment: creds.config.env,
      },
    });
  }

  const pricing = analyzeComparablePricing(normalized, { query, conditionHint });
  reasoning.push(...pricing.reasoning);

  if (!pricing.comparables.length) {
    return json({
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
        marketplaceId: creds.config.marketplaceId,
        environment: creds.config.env,
      },
    });
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

  const comparablePayload = pricing.comparables.map((item: any) => ({
    title: item.title,
    price: item.price,
    itemWebUrl: item.itemWebUrl,
    imageUrl: item.imageUrl,
    condition: item.condition,
    matchScore: item.qualityScore,
    source: 'eBay',
  }));

  const analysis: Record<string, unknown> = {
    estimatedSellPrice,
    fees,
    shipping,
    profit,
    roi,
    confidence: dealScore.confidence,
    confidenceScore: dealScore.score,
    comparableCount: pricing.comparables.length,
    comparables: planLocked ? comparablePayload.slice(0, 2) : comparablePayload,
  };

  if (planLocked) {
    analysis.proLocked = true;
    analysis.lockedFeatures = [
      'Break-even price and pricing guardrails',
      'Pricing confidence, strategy, and target percentile',
      'Full comparable list and reasoning trail',
    ];
  } else {
    analysis.marketPrice = pricing.marketPrice;
    analysis.priceFloor = pricing.priceFloor;
    analysis.priceCeiling = pricing.priceCeiling;
    analysis.targetPercentile = pricing.targetPercentile;
    analysis.pricingMethod = pricing.method;
    analysis.pricingStrategy = pricing.strategy;
    analysis.breakEvenPrice = breakEvenPrice;
    analysis.pricingConfidence = confidenceLabel(pricing.confidence);
    analysis.pricingConfidenceScore = pricing.confidence;
    analysis.reasoning = reasoning;
  }

  return json({
    ok: true,
    input: { query, buyPrice },
    analysis,
    meta: {
      userId: user.id,
      viewerPlan,
      planLocked,
      lockedFeatures: planLocked
        ? [
            'Break-even price and pricing guardrails',
            'Pricing confidence, strategy, and target percentile',
            'Full comparable list and reasoning trail',
          ]
        : [],
      marketplaceId: creds.config.marketplaceId,
      environment: creds.config.env,
      rawResultCount,
      confidenceFactors: planLocked ? undefined : pricing.confidenceFactors,
      dealFactors: planLocked ? undefined : dealScore.factors,
      pricingStats: planLocked ? undefined : pricing.stats,
    },
  });
});
