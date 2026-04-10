module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENAI_API_KEY not set in Vercel env vars' });

  try {
    const now = new Date();
    const startStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(now); endDate.setDate(endDate.getDate() + 1);
    const endStr = endDate.toISOString().split('T')[0];

    const resp = await fetch(
      `https://api.openai.com/dashboard/billing/usage?start_date=${startStr}&end_date=${endStr}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: `OpenAI ${resp.status}: ${errText}` });
    }

    const data = await resp.json();
    return res.json({
      cost_usd: +((data.total_usage || 0) / 100).toFixed(4),
      raw_cents: data.total_usage || 0,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
