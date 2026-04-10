module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' });
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfDay = now.toISOString();

    const resp = await fetch(
      `https://api.anthropic.com/v1/usage/messages?start_time=${encodeURIComponent(startOfMonth)}&end_time=${encodeURIComponent(endOfDay)}&limit=100`,
      {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: `Anthropic API error ${resp.status}: ${errText}` });
    }

    const data = await resp.json();
    const entries = data.data || [];
    let inputTokens = 0, outputTokens = 0, costUsd = 0;
    for (const entry of entries) {
      inputTokens += entry.input_tokens || 0;
      outputTokens += entry.output_tokens || 0;
      costUsd += entry.cost_usd || 0;
    }

    return res.json({
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      cost_usd: +costUsd.toFixed(4),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
