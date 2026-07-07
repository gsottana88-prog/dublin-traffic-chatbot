const IRISH_RAIL_MCP = 'https://irishrail-realtime.irishmcp.ie/mcp';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const result = { available: true, alerts: [], trains: [], luas: [] };

  await Promise.all([
    fetchFromNTA(result),
    fetchFromIrishRail(result),
  ]);

  return res.status(200).json(result);
}

async function fetchFromNTA(result) {
  try {
    const apiKey = process.env.NTA_API_KEY;
    if (!apiKey) {
      result.nta_status = 'not_configured';
      return;
    }

    const [alertsRes, tripsRes] = await Promise.all([
      fetch('https://api.nationaltransport.ie/gtfsr/v2/ServiceAlerts?format=json', {
        headers: { 'x-api-key': apiKey },
      }),
      fetch('https://api.nationaltransport.ie/gtfsr/v2/TripUpdates?format=json', {
        headers: { 'x-api-key': apiKey },
      }),
    ]);

    if (alertsRes.ok) {
      const alertsData = await alertsRes.json();
      for (const e of alertsData.entity || []) {
        const alert = e.alert;
        if (!alert) continue;
        result.alerts.push({
          source: 'NTA',
          route_ids: [...new Set((alert.informed_entity || []).map(en => en.route_id).filter(Boolean))],
          header: (alert.header_text?.translation?.[0]?.text || '').trim(),
          description: (alert.description_text?.translation?.[0]?.text || '').trim(),
          severity: getSeverity(alert.effect),
          effect: alert.effect,
        });
      }
    }

    if (tripsRes.ok) {
      const tripsData = await tripsRes.json();
      for (const e of tripsData.entity || []) {
        const tu = e.trip_update;
        if (!tu?.trip) continue;
        const delay = tu.stop_time_update?.[0]?.departure?.delay || 0;
        if (Math.abs(delay) > 60) {
          result.alerts.push({
            source: 'NTA',
            route_ids: [tu.trip.route_id],
            header: `Route ${tu.trip.route_id}: ${delay > 0 ? '+' : ''}${Math.round(delay / 60)} min delay`,
            severity: delay > 300 ? 'high' : delay > 120 ? 'medium' : 'low',
            effect: delay > 0 ? 'DELAY' : 'AHEAD_OF_SCHEDULE',
          });
        }
      }
    }

    result.nta_status = 'active';
  } catch (err) {
    result.nta_status = 'error';
  }
}

async function fetchFromIrishRail(result) {
  try {
    const resp = await fetch(IRISH_RAIL_MCP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'get_current_trains',
          arguments: { train_type: 'A' },
        },
      }),
    });

    if (!resp.ok) return;
    const data = await resp.json();
    const content = data?.result?.content?.[0]?.text;
    if (!content) return;

    const trains = JSON.parse(content);
    const dartTrains = trains.filter(t => t.TrainType === 'DART');
    const total = trains.length;

    const stationCounts = {};
    for (const t of trains) {
      const dest = t.Destination || 'Unknown';
      stationCounts[dest] = (stationCounts[dest] || 0) + 1;
    }

    result.trains = {
      total,
      dart: dartTrains.length,
      stations: Object.entries(stationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([station, count]) => ({ station, count })),
    };

    result.irish_rail_status = 'active';
  } catch (err) {
    result.irish_rail_status = 'unavailable';
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
