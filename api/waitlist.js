import { createClient } from '@supabase/supabase-js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function getClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return json(res, 400, { error: 'Invalid JSON' });
  }

  const name = (payload?.name ?? '').toString().trim();
  const email = (payload?.email ?? '').toString().trim().toLowerCase();
  const gender = (payload?.gender ?? '').toString().trim();
  const salary_min = payload?.salaryMin ? payload.salaryMin.toString().trim() : null;
  const city = payload?.city ? payload.city.toString().trim() : null;

  if (!name || !email || !gender) {
    return json(res, 400, { error: 'Missing required fields' });
  }

  if (!isValidEmail(email)) {
    return json(res, 400, { error: 'Invalid email address' });
  }

  try {
    const supabase = getClient();

    const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() || null;
    const user_agent = (req.headers['user-agent'] || '').toString() || null;

    const { error } = await supabase.from('waitlist').insert({
      name,
      email,
      gender,
      salary_min,
      city,
      ip,
      user_agent
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already')) {
        return json(res, 409, { error: 'This email is already on the waitlist.' });
      }
      return json(res, 500, { error: 'Failed to save signup' });
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { error: 'Server misconfigured' });
  }
}
