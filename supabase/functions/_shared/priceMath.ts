const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'edition',
  'for',
  'in',
  'of',
  'on',
  'or',
  'packaging',
  'pair',
  'set',
  'the',
  'to',
  'with',
]);

const GENERIC_TITLE_TOKENS = new Set([
  'big',
  'box',
  'bundle',
  'clean',
  'lot',
  'low',
  'men',
  'mens',
  'new',
  'pair',
  'size',
  'used',
  'w',
  'women',
  'womens',
]);

const CONDITION_RANK: Record<string, number> = {
  parts: 1.4,
  fair: 2.2,
  good: 3.0,
  very_good: 3.4,
  refurbished: 3.8,
  like_new: 4.2,
  new: 5.0,
  unknown: 3.1,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function ordinal(n: number) {
  const value = Math.round(n);
  const remainder10 = value % 10;
  const remainder100 = value % 100;
  if (remainder10 === 1 && remainder100 !== 11) return `${value}st`;
  if (remainder10 === 2 && remainder100 !== 12) return `${value}nd`;
  if (remainder10 === 3 && remainder100 !== 13) return `${value}rd`;
  return `${value}th`;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function stddev(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
}

function weightedMean(values: number[], weights: number[] = []) {
  if (!values.length) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (let index = 0; index < values.length; index += 1) {
    const weight = Number.isFinite(weights[index]) && weights[index] > 0 ? weights[index] : 1;
    totalWeight += weight;
    weightedSum += values[index] * weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : mean(values);
}

function weightedPercentile(values: number[], weights: number[] = [], percentile = 0.5) {
  if (!values.length) return 0;

  const ordered = values
    .map((value, index) => ({
      value,
      weight: Number.isFinite(weights[index]) && weights[index] > 0 ? weights[index] : 1,
    }))
    .sort((a, b) => a.value - b.value);

  const totalWeight = ordered.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return median(values);
  }

  const threshold = clamp(percentile, 0, 1) * totalWeight;
  let runningWeight = 0;

  for (const entry of ordered) {
    runningWeight += entry.weight;
    if (runningWeight >= threshold) {
      return entry.value;
    }
  }

  return ordered[ordered.length - 1].value;
}

function normalizeText(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeTitle(text: string) {
  return normalizeText(text)
    .split(' ')
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => token.length > 1 || /\d/.test(token));
}

function uniqueTokens(tokens: string[]) {
  return [...new Set(tokens)];
}

function normalizeCondition(raw: string) {
  const condition = normalizeText(raw);
  if (!condition) return 'unknown';
  if (condition.includes('for parts') || condition.includes('not working')) return 'parts';
  if (condition.includes('acceptable') || condition.includes('fair')) return 'fair';
  if (condition.includes('very good')) return 'very_good';
  if (condition.includes('good')) return 'good';
  if (
    condition.includes('seller refurbished') ||
    condition.includes('manufacturer refurbished') ||
    condition.includes('certified refurbished') ||
    condition.includes('refurbished')
  ) return 'refurbished';
  if (condition.includes('open box') || condition.includes('like new') || condition.includes('excellent')) return 'like_new';
  if (condition.includes('new')) return 'new';
  if (condition.includes('used')) return 'good';
  return 'unknown';
}

function detectListingType(buyingOptions: string[] = []) {
  const options = Array.isArray(buyingOptions) ? buyingOptions : [];
  if (options.includes('FIXED_PRICE')) return 'fixed_price';
  if (options.includes('BEST_OFFER')) return 'best_offer';
  if (options.includes('AUCTION')) return 'auction';
  return 'unknown';
}

function scoreListingType(listingType: string) {
  if (listingType === 'fixed_price') return 1;
  if (listingType === 'best_offer') return 0.95;
  if (listingType === 'auction') return 0.68;
  return 0.84;
}

function scoreTitleSimilarity(query: string, title: string) {
  const queryTokens = uniqueTokens(tokenizeTitle(query));
  const titleTokens = uniqueTokens(tokenizeTitle(title));

  if (!queryTokens.length || !titleTokens.length) {
    return 0.5;
  }

  const titleSet = new Set(titleTokens);
  const sharedTokens = queryTokens.filter((token) => titleSet.has(token));
  const anchorTokens = queryTokens.filter((token) => !/^\d+$/.test(token) && !GENERIC_TITLE_TOKENS.has(token));
  const sharedAnchorTokens = sharedTokens.filter((token) => anchorTokens.includes(token));

  const coverage = sharedTokens.length / queryTokens.length;
  const precision = sharedTokens.length / titleTokens.length;
  const anchorCoverage = anchorTokens.length
    ? sharedAnchorTokens.length / anchorTokens.length
    : coverage;
  const phraseMatch = normalizeText(title).includes(normalizeText(query)) ? 1 : 0;

  return round2(clamp(
    (coverage * 0.28) +
      (anchorCoverage * 0.48) +
      (precision * 0.14) +
      (phraseMatch * 0.10),
    0,
    1
  ));
}

function scoreConditionSimilarity(targetCondition: string, compCondition: string) {
  const compKey = normalizeCondition(compCondition);
  const targetKey = normalizeCondition(targetCondition);

  if (!targetCondition) {
    return compKey === 'unknown' ? 0.65 : 0.8;
  }

  if (compKey === targetKey) return 1;

  const targetRank = CONDITION_RANK[targetKey] || CONDITION_RANK.unknown;
  const compRank = CONDITION_RANK[compKey] || CONDITION_RANK.unknown;
  const distance = Math.abs(targetRank - compRank);

  if (distance <= 0.4) return 0.92;
  if (distance <= 0.8) return 0.84;
  if (distance <= 1.4) return 0.72;
  if (distance <= 2.0) return 0.58;
  return 0.42;
}

function scoreComparable(item: any, options: any = {}) {
  const titleScore = scoreTitleSimilarity(options.query, item.title);
  const conditionScore = scoreConditionSimilarity(options.conditionHint, item.condition);
  const listingType = detectListingType(item.buyingOptions);
  const listingScore = scoreListingType(listingType);
  const completenessScore = item.itemWebUrl ? 1 : 0.95;
  const qualityScore = round2(clamp(
    (titleScore * 0.58) +
      (conditionScore * 0.18) +
      (listingScore * 0.16) +
      (completenessScore * 0.08),
    0,
    1
  ));

  return {
    ...item,
    normalizedCondition: normalizeCondition(item.condition),
    listingType,
    titleScore,
    conditionScore,
    listingScore,
    qualityScore,
    weight: round2(0.35 + (qualityScore * 1.9)),
  };
}

function selectRelevantComparables(items: any[]) {
  if (!items.length) {
    return { items: [], reasoning: 'No comparable listings available after scoring' };
  }

  const ranked = [...items].sort((a, b) => (
    b.qualityScore - a.qualityScore ||
    b.titleScore - a.titleScore ||
    a.price - b.price
  ));

  let selected = ranked.filter((item) => item.qualityScore >= 0.55 && item.titleScore >= 0.34);
  let thresholdLabel = 'strict';

  if (selected.length < 5) {
    selected = ranked.filter((item) => item.qualityScore >= 0.46 && item.titleScore >= 0.26);
    thresholdLabel = 'balanced';
  }

  if (selected.length < 3) {
    selected = ranked.filter((item) => item.qualityScore >= 0.34 && item.titleScore >= 0.18);
    thresholdLabel = 'relaxed';
  }

  if (selected.length < 3) {
    selected = ranked.slice(0, Math.min(ranked.length, 8));
    thresholdLabel = 'top_ranked';
  }

  const pricedListings = selected.filter((item) => item.listingType !== 'auction');
  if (pricedListings.length >= 4) {
    return {
      items: pricedListings,
      reasoning: `Kept ${pricedListings.length} higher-quality fixed-price comparable${pricedListings.length === 1 ? '' : 's'} using a ${thresholdLabel.replace('_', ' ')} relevance filter`,
    };
  }

  return {
    items: selected,
    reasoning: `Kept ${selected.length} higher-relevance comparable${selected.length === 1 ? '' : 's'} using a ${thresholdLabel.replace('_', ' ')} relevance filter`,
  };
}

function removeOutliers(items: any[]) {
  if (items.length < 4) {
    return { filtered: items, removed: [], reasoning: 'Too few strong comparables to remove price outliers' };
  }

  const prices = items.map((item) => item.price);
  const weights = items.map((item) => item.weight || 1);
  const center = weightedPercentile(prices, weights, 0.5);
  const absoluteDeviations = items.map((item) => Math.abs(item.price - center));
  const mad = weightedPercentile(absoluteDeviations, weights, 0.5);

  let filtered: any[] = [];
  let removed: any[] = [];

  if (mad > 0) {
    const maxDistance = Math.max((1.4826 * mad * 2.8), center * 0.38);

    for (const item of items) {
      if (Math.abs(item.price - center) <= maxDistance) {
        filtered.push(item);
      } else {
        removed.push(item);
      }
    }
  } else {
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const q1 = median(sortedPrices.slice(0, Math.floor(sortedPrices.length / 2)));
    const q3 = median(sortedPrices.slice(Math.ceil(sortedPrices.length / 2)));
    const iqr = q3 - q1;
    const lowerBound = q1 - (1.5 * iqr);
    const upperBound = q3 + (1.5 * iqr);

    for (const item of items) {
      if (item.price >= lowerBound && item.price <= upperBound) {
        filtered.push(item);
      } else {
        removed.push(item);
      }
    }
  }

  if (filtered.length < 3) {
    const orderedByDistance = [...items].sort((a, b) => Math.abs(a.price - center) - Math.abs(b.price - center));
    filtered = orderedByDistance.slice(0, Math.min(items.length, 3));
    const kept = new Set(filtered.map((item) => item.itemId || `${item.title}-${item.price}`));
    removed = items.filter((item) => !kept.has(item.itemId || `${item.title}-${item.price}`));
  }

  return {
    filtered,
    removed,
    reasoning: removed.length > 0
      ? `Removed ${removed.length} price outlier${removed.length === 1 ? '' : 's'} outside the tighter market cluster`
      : 'No pricing outliers were removed from the comparable set',
  };
}

function calculateConfidence(input: any, rawCount = 0) {
  if (Array.isArray(input)) {
    const prices = input.map((item) => item.price);
    const avg = mean(prices);
    const sd = stddev(prices);
    const cv = avg > 0 ? sd / avg : 1;
    const compCount = input.length;
    const yieldRatio = rawCount > 0 ? compCount / rawCount : 0;
    const confidence = round2(clamp(
      (Math.min(0.3, compCount * 0.04)) +
        (0.3 * (1 - Math.min(cv / 0.45, 1))) +
        (0.2 * Math.min(yieldRatio * 1.5, 1)),
      0,
      1
    ));

    return {
      confidence,
      factors: {
        compCount,
        coefficientOfVariation: round2(cv),
        retentionRatio: round2(yieldRatio),
      },
    };
  }

  const compCount = Number(input?.compCount ?? input?.comparableCount ?? 0);
  if (!compCount) {
    return { confidence: 0, factors: { compCount: 0, reason: 'No usable comparables' } };
  }

  const comparableYield = Number(input?.rawCount || 0) > 0
    ? compCount / Number(input.rawCount)
    : 0;
  const avgQuality = clamp(Number(input?.avgQuality ?? 0.5), 0, 1);
  const fixedPriceShare = clamp(Number(input?.fixedPriceShare ?? 0.5), 0, 1);
  const coefficientOfVariation = Math.max(0, Number(input?.coefficientOfVariation ?? input?.cv ?? 0));
  const iqrRatio = Math.max(0, Number(input?.iqrRatio ?? 0));

  const compFactor = 0.3 * Math.min(compCount / 8, 1);
  const relevanceFactor = 0.28 * avgQuality;
  const consistencyFactor = 0.22 * (1 - Math.min(coefficientOfVariation / 0.35, 1));
  const spreadFactor = 0.12 * (1 - Math.min(iqrRatio / 0.3, 1));
  const listingFactor = 0.05 * fixedPriceShare;
  const retentionFactor = 0.03 * Math.min(comparableYield / 0.6, 1);

  const confidence = round2(clamp(
    compFactor +
      relevanceFactor +
      consistencyFactor +
      spreadFactor +
      listingFactor +
      retentionFactor,
    0,
    1
  ));

  return {
    confidence,
    factors: {
      compCount,
      avgQuality: round2(avgQuality),
      fixedPriceShare: round2(fixedPriceShare),
      coefficientOfVariation: round2(coefficientOfVariation),
      iqrRatio: round2(iqrRatio),
      comparableYield: round2(comparableYield),
      compFactor: round2(compFactor),
      relevanceFactor: round2(relevanceFactor),
      consistencyFactor: round2(consistencyFactor),
      spreadFactor: round2(spreadFactor),
      listingFactor: round2(listingFactor),
      retentionFactor: round2(retentionFactor),
    },
  };
}

export function analyzeComparablePricing(comparables: any[], options: any = {}) {
  if (!comparables.length) {
    return {
      estimatedPrice: 0,
      marketPrice: 0,
      priceFloor: 0,
      priceCeiling: 0,
      targetPercentile: 0,
      method: 'no_data',
      strategy: 'insufficient_data',
      confidence: 0,
      confidenceFactors: { compCount: 0, reason: 'No comparable listings' },
      comparables: [],
      scoredComparables: [],
      reasoning: ['No usable comparable listings were available for pricing'],
      stats: {
        rawComparableCount: 0,
        relevantComparableCount: 0,
        avgQuality: 0,
        fixedPriceShare: 0,
        coefficientOfVariation: 0,
        iqrRatio: 0,
      },
    };
  }

  const scoredComparables = comparables.map((item) => scoreComparable(item, options));
  const selection = selectRelevantComparables(scoredComparables);
  const outlierStep = removeOutliers(selection.items);
  const usableComparables = outlierStep.filtered.length
    ? outlierStep.filtered
    : selection.items;

  if (!usableComparables.length) {
    return {
      estimatedPrice: 0,
      marketPrice: 0,
      priceFloor: 0,
      priceCeiling: 0,
      targetPercentile: 0,
      method: 'no_data',
      strategy: 'insufficient_data',
      confidence: 0,
      confidenceFactors: { compCount: 0, reason: 'No comparable listings survived filtering' },
      comparables: [],
      scoredComparables,
      reasoning: ['Comparable filtering removed every candidate from the pricing set'],
      stats: {
        rawComparableCount: comparables.length,
        relevantComparableCount: 0,
        avgQuality: 0,
        fixedPriceShare: 0,
        coefficientOfVariation: 0,
        iqrRatio: 0,
      },
    };
  }

  const prices = usableComparables.map((item) => item.price);
  const weights = usableComparables.map((item) => item.weight || 1);
  const marketPrice = round2(weightedPercentile(prices, weights, 0.5));
  const priceFloor = round2(weightedPercentile(prices, weights, 0.25));
  const priceCeiling = round2(weightedPercentile(prices, weights, 0.75));
  const avgQuality = round2(weightedMean(usableComparables.map((item) => item.qualityScore), weights));
  const fixedPriceCount = usableComparables.filter((item) => item.listingType !== 'auction').length;
  const fixedPriceShare = usableComparables.length ? fixedPriceCount / usableComparables.length : 0;
  const coefficientOfVariation = marketPrice > 0 ? stddev(prices) / marketPrice : 1;
  const iqrRatio = marketPrice > 0 ? (priceCeiling - priceFloor) / marketPrice : 1;
  const { confidence, factors } = calculateConfidence({
    comparableCount: usableComparables.length,
    rawCount: comparables.length,
    avgQuality,
    fixedPriceShare,
    coefficientOfVariation,
    iqrRatio,
  });

  const targetPercentile = clamp(
    0.39 +
      (confidence * 0.1) +
      (avgQuality * 0.06) -
      (Math.min(iqrRatio, 0.35) * 0.18),
    0.38,
    0.5
  );

  const estimatedPrice = round2(weightedPercentile(prices, weights, targetPercentile));
  const strategy = targetPercentile < 0.44
    ? 'competitive'
    : targetPercentile > 0.51
      ? 'hold_firm'
      : 'balanced';

  const reasoning = [
    selection.reasoning,
    outlierStep.reasoning,
    `Market band settled around $${priceFloor.toFixed(2)}-$${priceCeiling.toFixed(2)} with a weighted midpoint near $${marketPrice.toFixed(2)}`,
    `Recommended list price uses the ${ordinal(targetPercentile * 100)} weighted percentile for a ${strategy.replace('_', ' ')} pricing stance`,
  ];

  return {
    estimatedPrice,
    marketPrice,
    priceFloor,
    priceCeiling,
    targetPercentile: round2(targetPercentile),
    method: 'weighted_market_percentile',
    strategy,
    confidence,
    confidenceFactors: factors,
    comparables: [...usableComparables].sort((a, b) => (
      b.qualityScore - a.qualityScore ||
      a.price - b.price
    )),
    scoredComparables,
    reasoning,
    stats: {
      rawComparableCount: comparables.length,
      relevantComparableCount: usableComparables.length,
      avgQuality,
      fixedPriceShare: round2(fixedPriceShare),
      coefficientOfVariation: round2(coefficientOfVariation),
      iqrRatio: round2(iqrRatio),
    },
  };
}

export function estimateFees(sellPrice: number) {
  const feeRate = 0.1325;
  const perOrderFee = 0.3;
  return round2(sellPrice * feeRate + perOrderFee);
}

export function estimateShipping(sellPrice: number) {
  if (sellPrice < 20) return 4.5;
  if (sellPrice < 50) return 6.5;
  if (sellPrice < 100) return 8.5;
  if (sellPrice < 200) return 10.5;
  return 13.5;
}

export function estimateBreakEvenPrice(buyPrice: number) {
  const safeBuyPrice = Math.max(0, Number(buyPrice) || 0);
  if (!safeBuyPrice) return 0;

  const profitAtPrice = (sellPrice: number) => sellPrice - safeBuyPrice - estimateFees(sellPrice) - estimateShipping(sellPrice);

  let low = safeBuyPrice;
  let high = Math.max(25, safeBuyPrice * 2.5);

  while (profitAtPrice(high) < 0 && high < (safeBuyPrice * 10) + 250) {
    high *= 1.25;
  }

  for (let step = 0; step < 32; step += 1) {
    const mid = (low + high) / 2;
    if (profitAtPrice(mid) >= 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return round2(high);
}

export function calculateDealScore({
  buyPrice = 0,
  estimatedSellPrice = 0,
  marketPrice = 0,
  fees = 0,
  shipping = 0,
  profit = 0,
  roi = 0,
  pricingConfidence = 0,
}: any) {
  const safeBuyPrice = Math.max(0, Number(buyPrice) || 0);
  const safeSellPrice = Math.max(0, Number(estimatedSellPrice) || 0);
  const safeMarketPrice = Math.max(safeSellPrice, Number(marketPrice) || 0);
  const safePricingConfidence = clamp(Number(pricingConfidence) || 0, 0, 1);
  const safeFees = Math.max(0, Number(fees) || 0);
  const safeShipping = Math.max(0, Number(shipping) || 0);
  const safeProfit = Number(profit) || 0;
  const safeRoi = Number(roi) || 0;

  const breakEvenPrice = estimateBreakEvenPrice(safeBuyPrice);
  const spreadToBreakEven = round2(safeSellPrice - breakEvenPrice);
  const bufferRatio = safeSellPrice > 0 ? spreadToBreakEven / safeSellPrice : 0;
  const marketDiscountRatio = safeMarketPrice > 0 ? (safeMarketPrice - safeBuyPrice) / safeMarketPrice : 0;
  const costLoadRatio = safeSellPrice > 0 ? (safeFees + safeShipping) / safeSellPrice : 1;

  const profitScore = clamp(safeProfit / Math.max(18, safeSellPrice * 0.16), 0, 1);
  const roiScore = clamp(safeRoi / 28, 0, 1);
  const bufferScore = clamp(bufferRatio / 0.16, 0, 1);
  const discountScore = clamp(marketDiscountRatio / 0.18, 0, 1);
  const efficiencyScore = clamp((0.26 - costLoadRatio) / 0.12, 0, 1);

  const baseScore = (
    (safePricingConfidence * 0.26) +
    (profitScore * 0.24) +
    (roiScore * 0.20) +
    (bufferScore * 0.16) +
    (discountScore * 0.10) +
    (efficiencyScore * 0.04)
  );

  const lossPenalty = clamp(Math.max(0, -safeProfit) / Math.max(18, safeSellPrice * 0.15), 0, 0.48);
  const roiPenalty = clamp(Math.max(0, -safeRoi) / 35, 0, 0.28);
  const overMarketPenalty = clamp(Math.max(0, -marketDiscountRatio) / 0.12, 0, 0.18);
  const score = round2(clamp(baseScore - lossPenalty - roiPenalty - overMarketPenalty, 0, 1));

  const reasoning = [];
  if (spreadToBreakEven >= 0) {
    reasoning.push(`The buy price leaves about $${round2(spreadToBreakEven)} of room above break-even after fees and shipping`);
  } else {
    reasoning.push(`The buy price sits about $${Math.abs(round2(spreadToBreakEven))} above break-even, so the margin is underwater`);
  }

  if (marketDiscountRatio >= 0.12) {
    reasoning.push('The current buy price is well below the estimated resale market, which gives the flip healthy margin room');
  } else if (marketDiscountRatio >= 0.04) {
    reasoning.push('The current buy price is below the estimated resale market, but the margin buffer is moderate');
  } else if (marketDiscountRatio >= 0) {
    reasoning.push('The current buy price is close to the estimated resale market, so execution risk matters a lot');
  } else {
    reasoning.push('The current buy price is already above the estimated resale target, which makes this a likely pass');
  }

  return {
    score,
    confidence: confidenceLabel(score),
    breakEvenPrice,
    spreadToBreakEven,
    marketDiscountRatio: round2(marketDiscountRatio),
    factors: {
      pricingConfidence: round2(safePricingConfidence),
      profitScore: round2(profitScore),
      roiScore: round2(roiScore),
      bufferScore: round2(bufferScore),
      discountScore: round2(discountScore),
      efficiencyScore: round2(efficiencyScore),
      lossPenalty: round2(lossPenalty),
      roiPenalty: round2(roiPenalty),
      overMarketPenalty: round2(overMarketPenalty),
      costLoadRatio: round2(costLoadRatio),
    },
    reasoning,
  };
}

export function confidenceLabel(score: number) {
  if (score >= 0.72) return 'HIGH';
  if (score >= 0.42) return 'MEDIUM';
  return 'LOW';
}
