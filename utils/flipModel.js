const DEFAULT_SHIPPING = 8;

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function optionalClampedUnit(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(1, num));
}

function normalizeConfidence(confidence) {
  const value = String(confidence || "LOW").toUpperCase();
  if (value === "HIGH" || value === "MEDIUM" || value === "LOW") return value;
  return "LOW";
}

export function computeProfit({ buy = 0, sell = 0, fees = 0, shipping = DEFAULT_SHIPPING }) {
  return Number((toNumber(sell) - toNumber(buy) - toNumber(fees) - toNumber(shipping)).toFixed(2));
}

export function computeRoi({ buy = 0, profit = 0 }) {
  const safeBuy = toNumber(buy);
  if (!safeBuy) return 0;
  return Number(((toNumber(profit) / safeBuy) * 100).toFixed(1));
}

export function normalizeFlip(input = {}, overrides = {}) {
  const merged = { ...input, ...overrides };

  const buy = toNumber(merged.buy);
  const sell = toNumber(merged.sell);
  const fees = toNumber(merged.fees);
  const shipping = toNumber(merged.shipping, DEFAULT_SHIPPING);
  const confidenceScore = optionalClampedUnit(merged.confidenceScore);

  const profit = merged.profit != null ? toNumber(merged.profit) : computeProfit({ buy, sell, fees, shipping });
  const roi = merged.roi != null ? toNumber(merged.roi) : computeRoi({ buy, profit });

  return {
    id: String(merged.id ?? `flip-${Date.now()}`),
    title: String(merged.title ?? "Untitled flip"),
    category: String(merged.category ?? "Misc"),
    condition: String(merged.condition ?? "Unknown"),
    buy,
    sell,
    fees,
    shipping,
    profit,
    roi,
    confidence: normalizeConfidence(merged.confidence),
    confidenceScore,
    image: String(merged.image ?? "https://via.placeholder.com/800x600.png?text=Item"),
    sourceUrl: merged.sourceUrl || null,
    sourceQuery: merged.sourceQuery || null,
    sold: !!merged.sold,
    createdAt: Number(merged.createdAt ?? Date.now()),
    user_id: merged.user_id ? String(merged.user_id) : null
  };
}

export function cloneFlips(list = []) {
  return list.map(item => normalizeFlip(item));
}
