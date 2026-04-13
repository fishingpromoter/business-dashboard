module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const url  = process.env.SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Optional: add SUPABASE_MANAGEMENT_TOKEN in Vercel for API request metrics.
  // Get it from app.supabase.com → Account → Access Tokens.
  const mgmtToken = process.env.SUPABASE_MANAGEMENT_TOKEN;

  if (!url || !key) {
    return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' });
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Auth users total count.
    //    Use per_page=1000 so we get total even if the API omits the `total` field.
    //    The GoTrue admin response includes `total` at the root level.
    const authResp = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, { headers });
    let totalUsers = 0;
    if (authResp.ok) {
      const authData = await authResp.json();
      // `total` is the canonical field; fall back to counting returned users
      totalUsers = authData.total ?? (authData.users || []).length;
    }

    // 2. Storage buckets
    const storageResp = await fetch(`${url}/storage/v1/bucket`, { headers });
    const buckets     = storageResp.ok ? await storageResp.json() : [];
    const bucketCount = Array.isArray(buckets) ? buckets.length : 0;

    // 3. DB row estimates via pg_stat_user_tables.
    //    Requires a Postgres function named get_db_stats in your Supabase project:
    //
    //    CREATE OR REPLACE FUNCTION get_db_stats()
    //    RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
    //      SELECT json_build_object(
    //        'total_rows', COALESCE(SUM(n_live_tup), 0)
    //      ) FROM pg_stat_user_tables;
    //    $$;
    //
    //    Run this SQL in the Supabase SQL editor to enable the DB rows metric.
    let totalRows = null;
    const dbResp = await fetch(`${url}/rest/v1/rpc/get_db_stats`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({}),
    });
    if (dbResp.ok) {
      const dbData = await dbResp.json();
      totalRows = dbData?.total_rows ?? null;
    }

    // 4. API request metrics via Supabase Management API (optional).
    //    Requires SUPABASE_MANAGEMENT_TOKEN — get it at app.supabase.com → Account → Access Tokens.
    let apiRequests = null;
    if (mgmtToken) {
      const ref      = url.replace('https://', '').split('.')[0];
      const mgmtResp = await fetch(`https://api.supabase.com/v1/projects/${ref}/usage`, {
        headers: { Authorization: `Bearer ${mgmtToken}` },
      });
      if (mgmtResp.ok) {
        const usage = await mgmtResp.json();
        apiRequests = usage?.api_requests?.total ?? null;
      }
    }

    return res.json({ totalUsers, bucketCount, totalRows, apiRequests });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
