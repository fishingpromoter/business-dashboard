module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const key = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!key) return res.status(500).json({ error: 'GHL_API_KEY not set in Vercel env vars' });
  if (!locationId) return res.status(500).json({ error: 'GHL_LOCATION_ID not set in Vercel env vars' });

  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  try {
    const [cResp, vResp] = await Promise.all([
      fetch(`https://rest.gohighlevel.com/v1/contacts/?locationId=${locationId}&limit=100`, { headers }),
      fetch(`https://rest.gohighlevel.com/v1/conversations/?locationId=${locationId}&limit=100`, { headers }),
    ]);

    const cData = await cResp.json();
    const vData = await vResp.json();
    const contacts = cData.contacts || [];
    const convs = vData.conversations || [];

    return res.json({
      totalContacts: cData.total || contacts.length,
      newLeadsToday: contacts.filter(c => new Date(c.dateAdded || c.dateCreated || 0) >= today).length,
      monthLeads: contacts.filter(c => new Date(c.dateAdded || c.dateCreated || 0) >= startOfMonth).length,
      newConvsToday: convs.filter(c => new Date(c.dateAdded || c.lastMessageDate || 0) >= today).length,
      unread: convs.filter(c => (c.unreadCount || 0) > 0).length,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
