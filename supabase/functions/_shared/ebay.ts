const EBAY_BASE_URLS = {
  sandbox: {
    auth: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
    browse: 'https://api.sandbox.ebay.com/buy/browse/v1',
  },
  production: {
    auth: 'https://api.ebay.com/identity/v1/oauth2/token',
    browse: 'https://api.ebay.com/buy/browse/v1',
  },
} as const;

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function getConfig() {
  const env = Deno.env.get('EBAY_ENV') || 'production';
  const marketplaceId = Deno.env.get('EBAY_MARKETPLACE_ID') || 'EBAY_US';
  const clientId = Deno.env.get('EBAY_CLIENT_ID') || '';
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET') || '';
  const base = EBAY_BASE_URLS[env as keyof typeof EBAY_BASE_URLS] || EBAY_BASE_URLS.production;

  return {
    env,
    marketplaceId,
    clientId,
    clientSecret,
    authUrl: base.auth,
    browseUrl: base.browse,
  };
}

export function checkEbayCredentials() {
  const config = getConfig();
  const missing = [];
  if (!config.clientId) missing.push('EBAY_CLIENT_ID');
  if (!config.clientSecret) missing.push('EBAY_CLIENT_SECRET');

  return {
    configured: missing.length === 0,
    missing,
    config,
  };
}

async function getToken() {
  const { configured, missing, config } = checkEbayCredentials();
  if (!configured) {
    throw new Error(`Missing eBay credentials: ${missing.join(', ')}`);
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
  const response = await fetch(config.authUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`eBay auth failed (${response.status}): ${errorBody}`);
  }

  const json = await response.json();
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + ((Number(json.expires_in) || 7200) * 1000),
  };

  return cachedToken.accessToken;
}

export async function searchItems(query: string, options: { limit?: number; timeoutMs?: number; gtin?: string } = {}) {
  const { config } = checkEbayCredentials();
  const token = await getToken();
  const limit = Math.min(options.limit || 25, 200);
  const timeoutMs = Math.min(Math.max(options.timeoutMs || 12000, 3000), 20000);
  const gtin = String(options.gtin || '').trim();
  const keyword = String(query || '').trim();
  if (!gtin && !keyword) {
    throw new Error('eBay search requires a keyword query or GTIN');
  }

  const params = new URLSearchParams({ limit: String(limit) });
  if (gtin) {
    params.set('gtin', gtin);
  } else {
    params.set('q', keyword);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response | null = null;
  try {
    response = await fetch(`${config.browseUrl}/item_summary/search?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': config.marketplaceId,
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response) {
    throw new Error('eBay search did not return a response');
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`eBay search failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}
