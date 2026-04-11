const { GoogleAuth } = require('google-auth-library');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  const result = {
    placesKeyConfigured: !!placesKey,
    serviceAccountConfigured: !!serviceAccountJson,
    monthlyCost: null,
    placesRequests: null,
    mapsRequests: null,
    note: null,
  };

  if (!serviceAccountJson) {
    result.note = 'Add GOOGLE_SERVICE_ACCOUNT_JSON to Vercel env vars for billing & usage data';
    return res.json(result);
  }

  try {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/cloud-billing.readonly',
        'https://www.googleapis.com/auth/monitoring.read',
      ],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    const accessToken = token.token;

    const projectId = credentials.project_id;

    // Cloud Billing: get this month's costs
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = now.toISOString().split('T')[0];

    const billingResp = await fetch(
      `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (billingResp.ok) {
      const billing = await billingResp.json();
      result.billingEnabled = billing.billingEnabled;
      result.billingAccount = billing.billingAccountName;
    }

    // Cloud Monitoring: Places API request count (last 30 days)
    const monitoringResp = await fetch(
      `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?filter=metric.type%3D"serviceruntime.googleapis.com/api/request_count"%20AND%20resource.label.service%3D"places-backend.googleapis.com"&interval.startTime=${startDate}T00:00:00Z&interval.endTime=${endDate}T23:59:59Z&aggregation.alignmentPeriod=2592000s&aggregation.perSeriesAligner=ALIGN_SUM`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (monitoringResp.ok) {
      const monitoring = await monitoringResp.json();
      const series = monitoring.timeSeries || [];
      let total = 0;
      for (const s of series) {
        for (const p of s.points || []) {
          total += p.value?.int64Value || p.value?.doubleValue || 0;
        }
      }
      result.placesRequests = total;
    }

    return res.json(result);
  } catch (e) {
    result.note = e.message;
    return res.json(result);
  }
};
