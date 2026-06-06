import { handleCors, json } from '../_shared/cors.ts';
import { requireUser, supabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  const { user, error: authError } = await requireUser(req);
  if (!user) {
    return json({ ok: false, error: authError || 'Unauthorized' }, 401);
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (error) {
    return json({ ok: false, error: error.message || 'Could not delete account' }, 500);
  }

  return json({ ok: true });
});
