const { Router } = require('express');
const { getFeed } = require('../services/feedService');

const router = Router();

router.get('/feed', async (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 6), 30) : 18;
  const force = req.query.force === 'true' || req.query.force === '1';

  const start = Date.now();
  console.log(`[feed] Request: limit=${limit} force=${force}`);

  try {
    const result = await getFeed({ limit, force });
    console.log(`[feed] Response: ok=${result.ok} items=${result.items?.length || 0} source=${result.meta?.source} fromCache=${result.meta?.fromCache} elapsed=${Date.now() - start}ms`);
    return res.json(result);
  } catch (err) {
    console.error(`[feed] Unexpected error after ${Date.now() - start}ms:`, err);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
      detail: err.message,
    });
  }
});

module.exports = router;
