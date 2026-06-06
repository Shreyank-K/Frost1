/**
 * Analyzer backend base URL.
 *
 * Supabase-hosted default:
 *   https://<project-ref>.supabase.co/functions/v1
 *
 * Local override examples:
 *   http://localhost:4000
 *   http://<your-computer-ip>:4000
 */
const DEFAULT_SUPABASE_URL = 'https://eqiakgiwjubsnrgsylxc.supabase.co';
const FALLBACK_ANALYZER_URL = `${DEFAULT_SUPABASE_URL}/functions/v1`;
const SUPABASE_FUNCTIONS_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`
  : '';

export const ANALYZER_URL = (
  process.env.EXPO_PUBLIC_ANALYZER_URL ||
  SUPABASE_FUNCTIONS_URL ||
  FALLBACK_ANALYZER_URL
).replace(/\/$/, '');
