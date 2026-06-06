const { config, checkEbayCredentials } = require('../config/env');

let tokenCache = {
  accessToken: null,
  expiresAt: 0,
  environment: config.ebay.env,
};

// Single-flight: only one mint request in progress at a time
let mintInFlight = null;

async function mintToken() {
  const creds = checkEbayCredentials();
  if (!creds.configured) {
    throw new Error(`eBay credentials not configured. Missing: ${creds.missing.join(', ')}`);
  }

  const credentials = Buffer.from(`${config.ebay.clientId}:${config.ebay.clientSecret}`).toString('base64');

  const response = await fetch(config.ebay.authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[ebayAuth] Token mint failed:', response.status, errorBody);
    throw new Error(`eBay token mint failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    environment: config.ebay.env,
  };

  console.log(`[ebayAuth] Token minted. Expires in ${data.expires_in}s (env: ${config.ebay.env})`);
  return tokenCache.accessToken;
}

async function getToken() {
  // Return cached token if still valid
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  // Single-flight: if a mint is already in progress, wait for it
  if (mintInFlight) {
    console.log('[ebayAuth] Token mint already in-flight, awaiting...');
    return mintInFlight;
  }

  // Start the single mint and share the promise
  mintInFlight = mintToken().finally(() => {
    mintInFlight = null;
  });

  return mintInFlight;
}

function getTokenMeta() {
  return {
    hasToken: !!tokenCache.accessToken,
    expiresAt: tokenCache.expiresAt ? new Date(tokenCache.expiresAt).toISOString() : null,
    isExpired: tokenCache.expiresAt ? Date.now() >= tokenCache.expiresAt : true,
    environment: tokenCache.environment,
    credentialsConfigured: checkEbayCredentials().configured,
  };
}

module.exports = { getToken, getTokenMeta, mintToken };
