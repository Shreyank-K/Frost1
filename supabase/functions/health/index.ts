import { checkEbayCredentials } from '../_shared/ebay.ts';
import { handleCors, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const creds = checkEbayCredentials();

  return json({
    ok: true,
    service: 'frost-analyzer-supabase',
    timestamp: new Date().toISOString(),
    environment: creds.config.env,
    ebayCredentials: creds.configured ? 'configured' : 'missing',
    missingVars: creds.missing,
    backend: 'supabase-edge-functions',
  });
});
