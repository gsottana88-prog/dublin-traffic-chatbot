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
    if (weather.available) sourceParts.push('Weather: OpenWeatherMap');
    if (traffic.available) sourceParts.push('Transport: NTA GTFS-RT');
    if (route.available) sourceParts.push('Routing: OpenStreetMap');

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
- Wind: ${weather.wind_speed} m/s${weather.wind_gust ? ` (gusts ${weather.wind_gust} m/s)` : ''}
- Humidity: ${weather.humidity}%
- Rain (1h): ${weather.rain_1h} mm
- Visibility: ${weather.visibility} m`;
  } else {
    w = '- Weather data currently unavailable';
  }

  let t = '';
  if (traffic.available) {
    const high = traffic.alerts.filter(a => a.severity === 'high');
    const med = traffic.alerts.filter(a => a.severity === 'medium');
    const delays = traffic.trip_updates.filter(u => Math.abs(u.delay_seconds) > 60);

    if (high.length) t += `\n⚠️ HIGH SEVERITY ALERTS:\n${high.map(a => `- ${a.header || a.description || a.effect}${a.route_ids.length ? ` (Routes: ${a.route_ids.join(', ')})` : ''}`).join('\n')}`;
    if (med.length) t += `\n⚠️ MEDIUM SEVERITY ALERTS:\n${med.map(a => `- ${a.header || a.description || a.effect}${a.route_ids.length ? ` (Routes: ${a.route_ids.join(', ')})` : ''}`).join('\n')}`;
    if (!high.length && !med.length) t += '\n- No significant service alerts';
    if (delays.length) {
      t += `\n\n⏱️ NOTABLE DELAYS (${delays.length} trips):`;
      const grouped = {};
      delays.forEach(d => { grouped[d.route_id] = (grouped[d.route_id] || 0) + 1; });
      Object.entries(grouped).slice(0, 5).forEach(([route, count]) => {
        t += `\n- Route ${route}: ${count} trip(s) affected`;
      });
    }
  } else {
    t = '\n- Real-time transport data unavailable';
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

PUBLIC TRANSPORT STATUS:
${t}

ROUTE INFO:
${r}

Based on this data, provide advice covering:
1. Whether weather affects driving conditions today
2. Any public transport disruptions relevant to this route
3. Estimated travel time considering current conditions
4. Best travel option (drive vs public transport)
5. Any specific warnings or recommendations

Keep it concise (2-3 short paragraphs). Be practical and specific to Dublin.`;
}

async function callDeepSeek(prompt) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return 'DeepSeek API key not configured. Please set the DEEPSEEK_API_KEY environment variable.';

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

To get full AI-powered advice, ensure the following API keys are configured:
- DEEPSEEK_API_KEY (required for AI advice)
- OPENWEATHER_API_KEY (for weather data)
- NTA_API_KEY (for real-time transport alerts)`;
}
