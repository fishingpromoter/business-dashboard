module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const key        = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!key)        return res.status(500).json({ error: 'GHL_API_KEY not set in Vercel env vars' });
  if (!locationId) return res.status(500).json({ error: 'GHL_LOCATION_ID not set in Vercel env vars' });

  const today        = new Date(); today.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // GHL v2 (services.leadconnectorhq.com) is the current API.
  // Falls back to v1 (rest.gohighlevel.com) if v2 returns 4xx.
  const v2Headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };
  const v1Headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  try {
    // --- Contacts ---
    let contacts = [], totalContacts = 0;

    const cV2Resp = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=100&sortBy=dateAdded&sortDirection=desc`,
      { headers: v2Headers }
    );

    if (cV2Resp.ok) {
      const d = await cV2Resp.json();
      contacts      = d.contacts || [];
      totalContacts = d.meta?.total ?? contacts.length;
    } else {
      // Fall back to v1
      const cV1Resp = await fetch(
        `https://rest.gohighlevel.com/v1/contacts/?locationId=${locationId}&limit=100`,
        { headers: v1Headers }
      );
      if (cV1Resp.ok) {
        const d = await cV1Resp.json();
        contacts      = d.contacts || [];
        totalContacts = d.total ?? contacts.length;
      }
    }

    // --- Conversations ---
    let convs = [];

    const vV2Resp = await fetch(
      `https://services.leadconnectorhq.com/conversations/?locationId=${locationId}&limit=100`,
      { headers: v2Headers }
    );

    if (vV2Resp.ok) {
      const d = await vV2Resp.json();
      convs = d.conversations || [];
    } else {
      // Fall back to v1
      const vV1Resp = await fetch(
        `https://rest.gohighlevel.com/v1/conversations/?locationId=${locationId}&limit=100`,
        { headers: v1Headers }
      );
      if (vV1Resp.ok) {
        const d = await vV1Resp.json();
        convs = d.conversations || [];
      }
    }

    // Date helpers — GHL uses both dateAdded and dateCreated depending on API version
    const getDate = c => new Date(c.dateAdded || c.dateCreated || c.createdAt || 0);
    const getConvDate = c => new Date(c.dateAdded || c.lastMessageDate || c.dateUpdated || 0);

    return res.json({
      totalContacts,
      newLeadsToday: contacts.filter(c => getDate(c) >= today).length,
      monthLeads:    contacts.filter(c => getDate(c) >= startOfMonth).length,
      newConvsToday: convs.filter(c => getConvDate(c) >= today).length,
      unread:        convs.filter(c => (c.unreadCount || 0) > 0).length,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
