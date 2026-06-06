const test = require('node:test');
const assert = require('node:assert/strict');

const {
  analyzeComparablePricing,
  calculateDealScore,
  estimateFees,
  estimateShipping,
  estimateBreakEvenPrice,
} = require('./priceMath');

function makeComp({
  title,
  price,
  condition = 'Used - Good',
  buyingOptions = ['FIXED_PRICE'],
}) {
  return {
    title,
    price,
    condition,
    buyingOptions,
    itemWebUrl: 'https://example.com/item',
    imageUrl: 'https://example.com/image.jpg',
  };
}

test('analyzeComparablePricing prioritizes close title matches and fixed-price comps', () => {
  const comps = [
    makeComp({ title: 'Nike Air Force 1 White Size 10', price: 118 }),
    makeComp({ title: 'Nike Air Force 1 White Men 10', price: 121 }),
    makeComp({ title: 'Nike Air Force 1 Low White Size 10', price: 123 }),
    makeComp({ title: 'Nike Air Force 1 White Clean Pair Sz 10', price: 124 }),
    makeComp({ title: 'Nike Air Force 1 White Size 10', price: 58, buyingOptions: ['AUCTION'] }),
    makeComp({ title: 'Jordan 1 Retro Size 10', price: 161 }),
  ];

  const analysis = analyzeComparablePricing(comps, {
    query: 'Nike Air Force 1 White Size 10',
    conditionHint: 'Used - Good',
  });

  assert.ok(analysis.estimatedPrice >= 118 && analysis.estimatedPrice <= 124);
  assert.ok(analysis.marketPrice >= 120 && analysis.marketPrice <= 124);
  assert.ok(analysis.confidence >= 0.55);
  assert.ok(analysis.comparables.every((item) => item.title.toLowerCase().includes('air force')));
});

test('analyzeComparablePricing gets more conservative when the market spread is wide', () => {
  const comps = [
    makeComp({ title: 'Nintendo Switch OLED White', price: 210 }),
    makeComp({ title: 'Nintendo Switch OLED White', price: 222 }),
    makeComp({ title: 'Nintendo Switch OLED White', price: 239 }),
    makeComp({ title: 'Nintendo Switch OLED White', price: 268 }),
    makeComp({ title: 'Nintendo Switch OLED White', price: 289 }),
    makeComp({ title: 'Nintendo Switch OLED White Bundle', price: 319 }),
  ];

  const analysis = analyzeComparablePricing(comps, {
    query: 'Nintendo Switch OLED White',
    conditionHint: 'Used - Good',
  });

  assert.ok(analysis.marketPrice > 0);
  assert.ok(analysis.estimatedPrice <= analysis.marketPrice);
  assert.ok(analysis.targetPercentile < 0.5);
});

test('estimateBreakEvenPrice includes fees and shipping bands', () => {
  const breakEven = estimateBreakEvenPrice(100);
  assert.ok(breakEven >= 127 && breakEven <= 130);
});

test('calculateDealScore changes materially when the buy price changes', () => {
  const comps = [
    makeComp({ title: 'Nintendo Switch OLED White', price: 210 }),
    makeComp({ title: 'Nintendo Switch OLED White', price: 222 }),
    makeComp({ title: 'Nintendo Switch OLED White', price: 239 }),
    makeComp({ title: 'Nintendo Switch OLED White', price: 268 }),
    makeComp({ title: 'Nintendo Switch OLED White', price: 289 }),
    makeComp({ title: 'Nintendo Switch OLED White Bundle', price: 319 }),
  ];

  const pricing = analyzeComparablePricing(comps, {
    query: 'Nintendo Switch OLED White',
    conditionHint: 'Used - Good',
  });

  function scoreForBuyPrice(buyPrice) {
    const fees = estimateFees(pricing.estimatedPrice);
    const shipping = estimateShipping(pricing.estimatedPrice);
    const profit = pricing.estimatedPrice - buyPrice - fees - shipping;
    const roi = (profit / buyPrice) * 100;
    return calculateDealScore({
      buyPrice,
      estimatedSellPrice: pricing.estimatedPrice,
      marketPrice: pricing.marketPrice,
      fees,
      shipping,
      profit,
      roi,
      pricingConfidence: pricing.confidence,
    });
  }

  const strongDeal = scoreForBuyPrice(60);
  const weakDeal = scoreForBuyPrice(185);
  const badDeal = scoreForBuyPrice(285);

  assert.ok(strongDeal.score >= 0.72);
  assert.equal(strongDeal.confidence, 'HIGH');
  assert.ok(weakDeal.score < strongDeal.score);
  assert.ok(badDeal.score < 0.42);
  assert.equal(badDeal.confidence, 'LOW');
});
