module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set in Vercel env vars' });

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${key}` },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: `OpenRouter ${resp.status}: ${errText}` });
    }

    const data = await resp.json();
    const keyData = data.data || {};

    // OpenRouter: 1 credit = $0.000001 (USD)
    const usageCredits = keyData.usage || 0;
    const costUsd = usageCredits / 1000000;
    const limitUsd = keyData.limit != null ? keyData.limit / 1000000 : null;

    return res.json({
      cost_usd: +costUsd.toFixed(4),
      usage_credits: usageCredits,
      limit_usd: limitUsd,
      label: keyData.label || 'OpenRouter',
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
