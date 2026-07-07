export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const apiKey = process.env.NTA_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ available: false, error: 'NTA API key not configured' });
    }

    const [alertsRes, tripsRes] = await Promise.all([
      fetch('https://api.nationaltransport.ie/gtfsr/v2/ServiceAlerts?format=json', {
        headers: { 'x-api-key': apiKey },
      }),
      fetch('https://api.nationaltransport.ie/gtfsr/v2/TripUpdates?format=json', {
        headers: { 'x-api-key': apiKey },
      }),
    ]);

    const result = { available: true, alerts: [], trip_updates: [] };

    if (alertsRes.ok) {
      const alertsData = await alertsRes.json();
      const entities = alertsData.entity || [];
      for (const e of entities) {
        const alert = e.alert;
        if (!alert) continue;
        const header = alert.header_text?.translation?.[0]?.text || '';
        const desc = alert.description_text?.translation?.[0]?.text || '';
        const routes = (alert.informed_entity || []).map(en => en.route_id).filter(Boolean);
        const effect = alert.effect || 'UNKNOWN_EFFECT';
        result.alerts.push({
          route_ids: [...new Set(routes)],
          header,
          description: desc,
          severity: getSeverity(effect),
          effect,
        });
      }
    }

    if (tripsRes.ok) {
      const tripsData = await tripsRes.json();
      const entities = tripsData.entity || [];
      for (const e of entities) {
        const tripUpdate = e.trip_update;
        if (!tripUpdate?.trip) continue;
        const { trip, vehicle, timestamp } = tripUpdate;
        const delay = tripUpdate.stop_time_update?.[0]?.departure?.delay || 0;
        result.trip_updates.push({
          route_id: trip.route_id,
          trip_id: trip.trip_id,
          direction: trip.direction_id,
          delay_seconds: delay,
          vehicle_id: vehicle?.id || null,
          timestamp: timestamp || null,
        });
      }
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ available: false, error: err.message });
  }
}

function getSeverity(effect) {
  const map = {
    NO_SERVICE: 'high',
    REDUCED_SERVICE: 'high',
    SIGNIFICANT_DELAYS: 'high',
    DETOUR: 'medium',
    ADDITIONAL_SERVICE: 'low',
    MODIFIED_SERVICE: 'medium',
    OTHER_EFFECT: 'medium',
    STOP_MOVED: 'low',
  };
  return map[effect] || 'unknown';
}
