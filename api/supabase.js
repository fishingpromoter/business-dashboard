module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mgmtToken = process.env.SUPABASE_MANAGEMENT_TOKEN; // optional — add in Vercel for API request stats

  if (!url || !key) return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' });

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Auth users count
    const authResp = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1`, { headers });
    const authData = await authResp.json();
    const totalUsers = authData.total || (authData.users || []).length;

    // 2. Storage buckets
    const storageResp = await fetch(`${url}/storage/v1/bucket`, { headers });
    const buckets = storageResp.ok ? await storageResp.json() : [];
    const bucketCount = Array.isArray(buckets) ? buckets.length : 0;

    // 3. DB table row estimates via pg_stat_user_tables (requires postgres schema access)
    const dbResp = await fetch(`${url}/rest/v1/rpc/get_db_stats`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({}),
    });
    let totalRows = null;
    if (dbResp.ok) {
      const dbData = await dbResp.json();
      totalRows = dbData?.total_rows ?? null;
    }

    // 4. Optional: Management API for API request metrics
    let apiRequests = null;
    if (mgmtToken) {
      const ref = url.replace('https://', '').split('.')[0];
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
