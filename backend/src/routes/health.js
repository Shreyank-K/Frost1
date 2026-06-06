const { Router } = require('express');
const { config, checkEbayCredentials } = require('../config/env');
const { getBrowseState } = require('../lib/ebayBrowse');

const router = Router();

router.get('/health', (req, res) => {
  const creds = checkEbayCredentials();
  res.json({
    ok: true,
    service: 'frost-analyzer',
    timestamp: new Date().toISOString(),
    environment: config.ebay.env,
    ebayCredentials: creds.configured ? 'configured' : 'missing',
    missingVars: creds.configured ? [] : creds.missing,
    browseState: getBrowseState(),
  });
});

module.exports = router;
