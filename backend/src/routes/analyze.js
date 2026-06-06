const { Router } = require('express');
const { z } = require('zod');
const { analyzeDeal } = require('../services/analyzeDeal');

const router = Router();

const analyzeSchema = z.object({
  query: z.string().min(1, 'query is required').max(500),
  buyPrice: z.number().positive('buyPrice must be a positive number'),
  categoryHint: z.string().max(100).optional(),
  conditionHint: z.string().max(50).optional(),
});

router.post('/analyze', async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid request body',
      details: parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  try {
    const result = await analyzeDeal(parsed.data);

    if (!result.ok && result.error) {
      return res.status(result.error === 'eBay credentials not configured' ? 503 : 502).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[analyze] Unexpected error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
      detail: err.message,
    });
  }
});

module.exports = router;
