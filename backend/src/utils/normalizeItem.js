function normalizeItem(rawItem) {
  if (!rawItem) return null;

  const title = (rawItem.title || '').trim();
  if (!title) return null;

  const priceValue = parsePrice(rawItem.price);
  if (priceValue === null || priceValue <= 0) return null;

  return {
    title,
    price: priceValue,
    currency: rawItem.price?.currency || 'USD',
    itemId: rawItem.itemId || null,
    itemWebUrl: rawItem.itemWebUrl || null,
    imageUrl: rawItem.image?.imageUrl || rawItem.thumbnailImages?.[0]?.imageUrl || null,
    condition: rawItem.condition || rawItem.conditionId || null,
    buyingOptions: rawItem.buyingOptions || [],
    seller: rawItem.seller?.username || null,
    itemLocation: rawItem.itemLocation?.country || null,
  };
}

function parsePrice(priceObj) {
  if (!priceObj || priceObj.value === undefined || priceObj.value === null) return null;

  const num = typeof priceObj.value === 'number'
    ? priceObj.value
    : parseFloat(String(priceObj.value).replace(/[^0-9.]/g, ''));

  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map(normalizeItem).filter(Boolean);
}

module.exports = { normalizeItem, normalizeItems, parsePrice };
