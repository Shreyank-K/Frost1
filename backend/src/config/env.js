const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function parseCorsOrigins(value) {
  if (!value || value === '*') return true;

  return String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const config = {
  port: parseInt(process.env.PORT, 10) || 4000,
  ebay: {
    clientId: process.env.EBAY_CLIENT_ID || '',
    clientSecret: process.env.EBAY_CLIENT_SECRET || '',
    env: process.env.EBAY_ENV || 'sandbox',
    marketplaceId: process.env.EBAY_MARKETPLACE_ID || 'EBAY_US',
  },
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
};

const EBAY_BASE_URLS = {
  sandbox: {
    auth: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
    browse: 'https://api.sandbox.ebay.com/buy/browse/v1',
  },
  production: {
    auth: 'https://api.ebay.com/identity/v1/oauth2/token',
    browse: 'https://api.ebay.com/buy/browse/v1',
  },
};

config.ebay.authUrl = EBAY_BASE_URLS[config.ebay.env]?.auth || EBAY_BASE_URLS.sandbox.auth;
config.ebay.browseUrl = EBAY_BASE_URLS[config.ebay.env]?.browse || EBAY_BASE_URLS.sandbox.browse;

function checkEbayCredentials() {
  const missing = [];
  if (!config.ebay.clientId || config.ebay.clientId === 'your_client_id_here') {
    missing.push('EBAY_CLIENT_ID');
  }
  if (!config.ebay.clientSecret || config.ebay.clientSecret === 'your_client_secret_here') {
    missing.push('EBAY_CLIENT_SECRET');
  }
  return {
    configured: missing.length === 0,
    missing,
  };
}

module.exports = { config, checkEbayCredentials, parseCorsOrigins };
