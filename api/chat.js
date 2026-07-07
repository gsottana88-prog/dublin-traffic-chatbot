const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-v4-flash';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { start, finish } = req.body || {};
  if (!start || !finish) {
    return res.status(400).json({ error: 'Missing start or finish address' });
  }

  try {
    const baseUrl = `https://${req.headers.host || 'localhost'}`;
    const [weather, traffic, route] = await Promise.all([
      fetch(`${baseUrl}/api/weather`).then(r => r.json()).catch(() => ({ available: false, error: 'Weather service unavailable' })),
      fetch(`${baseUrl}/api/traffic`).then(r => r.json()).catch(() => ({ available: false, error: 'Traffic service unavailable' })),
      fetch(`${baseUrl}/api/route?start=${encodeURIComponent(start)}&finish=${encodeURIComponent(finish)}`).then(r => r.json()).catch(() => ({ available: false, error: 'Route service unavailable' })),
    ]);

    const prompt = buildPrompt(start, finish, weather, traffic, route);
    const advice = await callDeepSeek(prompt);

    const sourceParts = [];
    if (weather.available) sourceParts.push('Weather: Open-Meteo');
    if (traffic.available) {
      if (traffic.nta_status === 'active') sourceParts.push('Transport: NTA GTFS-RT');
      if (traffic.irish_rail_status === 'active') sourceParts.push('Irish Rail');
    }
    if (route.available) sourceParts.push('Routing: OpenStreetMap');
    if (traffic?.nta_status === 'not_configured') sourceParts.push('NTA key not set (free transport data limited)');

    return res.status(200).json({
      advice,
      source: sourceParts.length ? `Data sources: ${sourceParts.join(' · ')}` : '',
    });
  } catch (err) {
    return res.status(200).json({
      advice: `I couldn't generate a full analysis, but here's what I know:\n\n${buildFallbackText(start, finish)}`,
      error: err.message,
    });
  }
}

function buildPrompt(start, finish, weather, traffic, route) {
  let w = '';
  if (weather.available) {
    w = `- Temperature: ${weather.temperature}°C (feels like ${weather.feels_like}°C)
- Conditions: ${weather.conditions}
- Wind: ${weather.wind_speed} km/h${weather.wind_gust ? ` (gusts ${weather.wind_gust} km/h)` : ''}
- Humidity: ${weather.humidity}%
- Precipitation: ${weather.precipitation} mm
- Visibility: ${weather.visibility} m`;
    if (weather.upcoming_hours?.length) {
      w += '\n- Next few hours:';
      for (const h of weather.upcoming_hours.slice(0, 4)) {
        w += `\n  ${h.time.slice(11, 16)}: ${h.conditions}, ${h.temp}°C, rain ${h.precip_prob}%`;
      }
    }
  } else {
    w = '- Weather data unavailable';
  }

  let t = '';
  if (traffic.available) {
    const ntaAlerts = traffic.alerts?.filter(a => a.source === 'NTA') || [];
    const high = ntaAlerts.filter(a => a.severity === 'high');
    const med = ntaAlerts.filter(a => a.severity === 'medium');

    if (high.length) {
      t += `\n⚠️ HIGH SEVERITY:\n${high.map(a => `- ${a.header || a.description || a.effect}${a.route_ids?.length ? ` (Routes: ${a.route_ids.join(', ')})` : ''}`).join('\n')}`;
    }
    if (med.length) {
      t += `\n⚠️ MEDIUM SEVERITY:\n${med.map(a => `- ${a.header || a.description || a.effect}${a.route_ids?.length ? ` (Routes: ${a.route_ids.join(', ')})` : ''}`).join('\n')}`;
    }

    if (traffic.trains?.total) {
      t += `\n\n🚆 Irish Rail: ${traffic.trains.total} active trains (${traffic.trains.dart} DART)`;
      if (traffic.trains.stations?.length) {
        t += `\nBusiest destinations: ${traffic.trains.stations.map(s => `${s.station} (${s.count})`).join(', ')}`;
      }
    }

    if (!high.length && !med.length && !traffic.trains?.total) {
      t += '\n- No transport alerts currently reported';
    }
  } else {
    t = '\n- Real-time transport data currently unavailable';
  }

  let r = '';
  if (route.available) {
    r = `- Distance: ${route.distance_km} km
- Estimated driving time: ${route.duration_min} minutes
- From: ${route.start.address}
- To: ${route.finish.address}`;
  } else {
    r = '- Route information unavailable';
  }

  return `You are a Dublin traffic advisor. Provide concise, practical advice for a commute in Dublin, Ireland.

COMMUTE:
- Start: ${start}
- Finish: ${finish}

CURRENT WEATHER IN DUBLIN:
${w}

TRANSPORT STATUS:
${t}

ROUTE INFO:
${r}

Based on this data, provide advice covering:
1. Whether weather affects driving conditions
2. Any public transport disruptions
3. Estimated travel time considering current conditions
4. Best travel option (drive vs public transport)
5. Any specific warnings or recommendations

Keep it concise (2-3 short paragraphs). Be practical and specific to Dublin.`;
}

async function callDeepSeek(prompt) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return 'DeepSeek API key not configured. Add DEEPSEEK_API_KEY to your Vercel environment variables and redeploy.';
  }

  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful Dublin traffic advisor. Respond concisely with practical advice.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response from DeepSeek.';
}

function buildFallbackText(start, finish) {
  return `Route requested: "${start}" → "${finish}" in Dublin.

Weather and routing data are available. To get AI-powered advice, add your DEEPSEEK_API_KEY to Vercel environment variables.

For richer transport data, also add NTA_API_KEY (free signup at developer.nationaltransport.ie).`;
}
