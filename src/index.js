// ─── Weather ──────────────────────────────────────────────────────────────
const WMO_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};

async function getWeather() {
  const url = 'https://api.open-meteo.com/v1/forecast' +
    '?latitude=53.35&longitude=-6.26' +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility' +
    '&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m' +
    '&timezone=Europe%2FDublin&forecast_days=1';

  const resp = await fetch(url);
  if (!resp.ok) return { available: false, error: `Open-Meteo returned ${resp.status}` };

  const data = await resp.json();
  const c = data.current;
  const code = c.weather_code;
  const hourly = data.hourly;

  const now = new Date(c.time).getTime();
  const upcoming = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i] + 'Z').getTime();
    if (t > now && t <= now + 4 * 3600_000) {
      upcoming.push({
        time: hourly.time[i],
        temp: hourly.temperature_2m[i],
        precip_prob: hourly.precipitation_probability[i],
        conditions: WMO_CODES[hourly.weather_code[i]] || `Code ${hourly.weather_code[i]}`,
        wind: hourly.wind_speed_10m[i],
      });
    }
  }

  return {
    available: true,
    source: 'Open-Meteo (free, no key)',
    temperature: c.temperature_2m,
    feels_like: c.apparent_temperature,
    conditions: WMO_CODES[code] || `Code ${code}`,
    humidity: c.relative_humidity_2m,
    wind_speed: c.wind_speed_10m,
    wind_gust: c.wind_gusts_10m,
    precipitation: c.precipitation,
    visibility: c.visibility,
    upcoming_hours: upcoming,
  };
}

// ─── Geocoding ────────────────────────────────────────────────────────────
async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=ie`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'DublinTrafficAdvisor/1.0' } });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

// ─── Routing ──────────────────────────────────────────────────────────────
async function getRoute(start, finish) {
  const [startGeo, finishGeo] = await Promise.all([geocode(start), geocode(finish)]);
  if (!startGeo) return { available: false, error: `Could not find: ${start}` };
  if (!finishGeo) return { available: false, error: `Could not find: ${finish}` };

  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startGeo.lon},${startGeo.lat};${finishGeo.lon},${finishGeo.lat}?overview=false`;
  const resp = await fetch(osrmUrl);
  if (!resp.ok) return { available: false, error: `Routing failed: ${resp.status}` };

  const data = await resp.json();
  if (!data.routes?.length) return { available: false, error: 'No route found' };

  const route = data.routes[0];
  return {
    available: true,
    start: { address: start, lat: startGeo.lat, lon: startGeo.lon },
    finish: { address: finish, lat: finishGeo.lat, lon: finishGeo.lon },
    distance_km: +(route.distance / 1000).toFixed(1),
    duration_min: +(route.duration / 60).toFixed(0),
  };
}

// ─── Traffic / Transport ─────────────────────────────────────────────────
async function getTraffic(env) {
  const result = { available: true, alerts: [], trains: null };

  await Promise.all([
    fetchNTA(result, env),
    fetchIrishRail(result),
  ]);

  return result;
}

async function fetchNTA(result, env) {
  const apiKey = env.NTA_API_KEY;
  if (!apiKey) return;

  try {
    const [alertsRes, tripsRes] = await Promise.all([
      fetch('https://api.nationaltransport.ie/gtfsr/v2/ServiceAlerts?format=json', {
        headers: { 'x-api-key': apiKey },
      }),
      fetch('https://api.nationaltransport.ie/gtfsr/v2/TripUpdates?format=json', {
        headers: { 'x-api-key': apiKey },
      }),
    ]);

    if (alertsRes.ok) {
      const d = await alertsRes.json();
      for (const e of d.entity || []) {
        const a = e.alert;
        if (!a) continue;
        result.alerts.push({
          source: 'NTA',
          route_ids: [...new Set((a.informed_entity || []).map(en => en.route_id).filter(Boolean))],
          header: (a.header_text?.translation?.[0]?.text || '').trim(),
          severity: a.effect === 'NO_SERVICE' || a.effect === 'SIGNIFICANT_DELAYS' ? 'high' : 'medium',
        });
      }
    }

    if (tripsRes.ok) {
      const d = await tripsRes.json();
      for (const e of d.entity || []) {
        const tu = e.trip_update;
        if (!tu?.trip) continue;
        const delay = tu.stop_time_update?.[0]?.departure?.delay || 0;
        if (Math.abs(delay) > 60) {
          result.alerts.push({
            source: 'NTA',
            route_ids: [tu.trip.route_id],
            header: `Route ${tu.trip.route_id}: ${delay > 0 ? '+' : ''}${Math.round(delay / 60)} min`,
            severity: delay > 300 ? 'high' : delay > 120 ? 'medium' : 'low',
          });
        }
      }
    }
  } catch (_) {}
}

async function fetchIrishRail(result) {
  try {
    const resp = await fetch('https://irishrail-realtime.irishmcp.ie/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name: 'get_current_trains', arguments: { train_type: 'A' } },
      }),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const text = data?.result?.content?.[0]?.text;
    if (!text) return;
    const trains = JSON.parse(text);
    result.trains = {
      total: trains.length,
      dart: trains.filter(t => t.TrainType === 'DART').length,
      stations: Object.entries(
        trains.reduce((acc, t) => { const d = t.Destination || 'Unknown'; acc[d] = (acc[d] || 0) + 1; return acc; }, {})
      ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s, c]) => ({ station: s, count: c })),
    };
  } catch (_) {}
}

// ─── DeepSeek ─────────────────────────────────────────────────────────────
async function callDeepSeek(prompt, env) {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) return 'DeepSeek API key not configured. Add it as a Cloudflare Worker secret.';

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: 'You are a helpful Dublin traffic advisor. Respond concisely with practical advice.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 600,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DeepSeek API error (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || 'No response from DeepSeek.';
}

function buildPrompt(start, finish, weather, traffic, route) {
  let w = weather.available
    ? `- Temperature: ${weather.temperature}°C (feels like ${weather.feels_like}°C)\n- Conditions: ${weather.conditions}\n- Wind: ${weather.wind_speed} km/h${weather.wind_gust ? ` (gusts ${weather.wind_gust} km/h)` : ''}\n- Humidity: ${weather.humidity}%\n- Precipitation: ${weather.precipitation} mm\n- Visibility: ${weather.visibility} m`
    : '- Weather data unavailable';

  if (weather.available && weather.upcoming_hours?.length) {
    w += '\n- Next hours:';
    for (const h of weather.upcoming_hours.slice(0, 4)) {
      w += `\n  ${h.time.slice(11, 16)}: ${h.conditions}, ${h.temp}°C, rain ${h.precip_prob}%`;
    }
  }

  let t = '';
  if (traffic.available) {
    const high = traffic.alerts.filter(a => a.severity === 'high');
    const med = traffic.alerts.filter(a => a.severity === 'medium');
    if (high.length) t += `\n⚠️ ALERTS:\n${high.map(a => `- ${a.header}${a.route_ids?.length ? ` (${a.route_ids.join(', ')})` : ''}`).join('\n')}`;
    if (med.length) t += `\n⚠️ ADVISORIES:\n${med.map(a => `- ${a.header}${a.route_ids?.length ? ` (${a.route_ids.join(', ')})` : ''}`).join('\n')}`;
    if (traffic.trains) t += `\n🚆 Irish Rail: ${traffic.trains.total} active (${traffic.trains.dart} DART)`;
    if (!high.length && !med.length && !traffic.trains) t += '\n- No transport alerts currently';
  } else {
    t = '\n- Transport data unavailable';
  }

  let r = route.available
    ? `- Distance: ${route.distance_km} km\n- Driving time: ${route.duration_min} min\n- From: ${route.start.address}\n- To: ${route.finish.address}`
    : '- Route info unavailable';

  return `You are a Dublin traffic advisor. Provide concise, practical advice for a Dublin commute.

COMMUTE: "${start}" → "${finish}"

WEATHER:
${w}

TRANSPORT:
${t}

ROUTE:
${r}

Cover: weather impact on driving, public transport disruptions, estimated travel time, best option (drive vs PT), and specific recommendations. 2-3 short paragraphs, practical.`;
}

// ─── HTTP Handlers ────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

async function handleWeather() {
  return json(await getWeather());
}

async function handleTraffic(request, env) {
  return json(await getTraffic(env));
}

async function handleRoute(request) {
  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const finish = url.searchParams.get('finish');
  if (!start || !finish) return json({ available: false, error: 'Missing start/finish' }, 400);
  return json(await getRoute(start, finish));
}

async function handleChat(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const { start, finish } = await request.json();
  if (!start || !finish) return json({ error: 'Missing start/finish' }, 400);

  try {
    const [weather, traffic, route] = await Promise.all([
      getWeather().catch(() => ({ available: false })),
      getTraffic(env).catch(() => ({ available: false })),
      getRoute(start, finish).catch(() => ({ available: false })),
    ]);

    const prompt = buildPrompt(start, finish, weather, traffic, route);
    const advice = await callDeepSeek(prompt, env);

    const sources = [];
    if (weather.available) sources.push('Weather: Open-Meteo');
    if (traffic.alerts.length) sources.push('Transport: NTA GTFS-RT');
    if (traffic.trains) sources.push('Irish Rail');
    if (route.available) sources.push('Routing: OpenStreetMap');

    return json({
      advice,
      source: sources.length ? `Data: ${sources.join(' · ')}` : '',
    });
  } catch (err) {
    return json({
      advice: `I couldn't get the full AI analysis. Try again shortly.\n\nError: ${err.message}`,
    });
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    switch (url.pathname) {
      case '/api/weather':  return handleWeather(request, env);
      case '/api/traffic':  return handleTraffic(request, env);
      case '/api/route':    return handleRoute(request, env);
      case '/api/chat':     return handleChat(request, env);
      default:              return new Response('Not found', { status: 404 });
    }
  },
};
