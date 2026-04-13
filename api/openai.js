module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY not set in Vercel env vars',
      note: 'Add your OpenAI Admin API key (not a project key). Go to platform.openai.com → API Keys → create an Admin key.',
    });
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // The /v1/organization/costs endpoint requires Unix timestamps (seconds)
    const startTime = Math.floor(startOfMonth.getTime() / 1000);
    const endTime   = Math.floor(now.getTime() / 1000);

    const resp = await fetch(
      `https://api.openai.com/v1/organization/costs?start_time=${startTime}&end_time=${endTime}&bucket_width=1d`,
      { headers: { Authorization: `Bearer ${key}` } }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      // Provide a helpful message for auth failures
      if (resp.status === 403 || resp.status === 401) {
        return res.status(resp.status).json({
          error: `OpenAI ${resp.status}: Access denied`,
          note: 'The /v1/organization/costs endpoint requires an Admin API key. Go to platform.openai.com → Organization → API Keys and create a key with "Billing" read permissions.',
          raw: errText,
        });
      }
      return res.status(resp.status).json({ error: `OpenAI ${resp.status}: ${errText}` });
    }

    const data = await resp.json();
    // Response: { object: "page", data: [{ object: "bucket", start_time, end_time, results: [{ amount: { value, currency } }] }] }
    let totalCostUsd = 0;
    for (const bucket of (data.data || [])) {
      for (const result of (bucket.results || [])) {
        totalCostUsd += result?.amount?.value || 0;
      }
    }

    return res.json({
      cost_usd: +totalCostUsd.toFixed(4),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
