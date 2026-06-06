const { Router } = require('express');
const { checkEbayCredentials } = require('../config/env');
const { getTokenMeta } = require('../lib/ebayAuth');
const { searchItems, getBrowseState } = require('../lib/ebayBrowse');
const { normalizeItems } = require('../utils/normalizeItem');

const router = Router();

router.get('/debug/search', async (req, res) => {
  const query = req.query.q;
  const limit = Math.min(parseInt(req.query.limit, 10) || 18, 30);

  if (!query) {
    return res.status(400).json({
      ok: false,
      error: 'Missing query parameter "q"',
    });
  }

  const creds = checkEbayCredentials();
  if (!creds.configured) {
    return res.status(503).json({
      ok: false,
      error: 'eBay credentials not configured',
      missing: creds.missing,
    });
  }

  try {
    const rawResult = await searchItems(query, { limit });
    const rawItems = rawResult.itemSummaries || [];
    const normalized = normalizeItems(rawItems);

    return res.json({
      ok: true,
      query,
      rawCount: rawItems.length,
      normalizedCount: normalized.length,
      cache: rawResult._cacheMeta || null,
      browseState: getBrowseState(),
      items: normalized,
    });
  } catch (err) {
    console.error('[debug/search] Error:', err);
    return res.status(err.status === 429 ? 429 : 502).json({
      ok: false,
      error: 'eBay search failed',
      detail: err.message,
      cooldownActive: !!err.cooldownActive,
      retryAfterSeconds: err.retryAfterSeconds || null,
      browseState: getBrowseState(),
    });
  }
});

router.get('/debug/token', (req, res) => {
  const meta = getTokenMeta();
  res.json({
    ok: true,
    token: meta,
    browseState: getBrowseState(),
  });
});

module.exports = router;
