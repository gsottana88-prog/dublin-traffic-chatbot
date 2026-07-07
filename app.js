const WORKER_URL = 'https://dublin-traffic-chatbot.gsottana88.workers.dev';
const DUBLIN_LAT = 53.35;
const DUBLIN_LON = -6.26;

const WMO_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};

const elements = {
  start: document.getElementById('start'),
  finish: document.getElementById('finish'),
  send: document.getElementById('send-btn'),
  messages: document.getElementById('messages'),
  typing: document.getElementById('typing'),
};

function validate() {
  elements.send.disabled = !elements.start.value.trim() || !elements.finish.value.trim();
}

elements.start.addEventListener('input', validate);
elements.finish.addEventListener('input', validate);
elements.send.addEventListener('click', handleSubmit);
elements.start.addEventListener('keydown', (e) => { if (e.key === 'Enter') elements.finish.focus(); });
elements.finish.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !elements.send.disabled) handleSubmit(); });

async function handleSubmit() {
  const start = elements.start.value.trim();
  const finish = elements.finish.value.trim();
  if (!start || !finish) return;

  addMessage(start + '\n' + finish, '', 'user');
  elements.send.disabled = true;
  showTyping();

  try {
    const res = await fetch(`${WORKER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, finish }),
    });

    if (!res.ok) throw new Error(`Worker error (${res.status})`);
    const data = await res.json();
    hideTyping();
    addMessage(data.advice || 'No advice returned.', '', 'bot', data.source);
  } catch (err) {
    hideTyping();
    addMessage('Worker not reachable yet (DNS propagating). Showing data directly from free APIs:\n', '', 'bot');
    await showDirectData(start, finish);
  } finally {
    elements.send.disabled = false;
    validate();
  }
}

async function showDirectData(start, finish) {
  showTyping();
  try {
    const [weather, routeData] = await Promise.all([
      fetchDirectWeather(),
      fetchDirectRoute(start, finish),
    ]);
    hideTyping();

    let text = '';
    if (weather) text += weather;
    if (routeData) text += '\n\n' + routeData;
    if (!text) text = 'Could not fetch data. Try again in a few minutes when DNS propagates.';

    addMessage(text, '', 'bot', 'Direct API (no backend)');
  } catch (e) {
    hideTyping();
    addMessage('DNS still propagating. Try again in a few minutes.\n\nWorker URL: ' + WORKER_URL + '/api/weather', '', 'bot');
  }
}

async function fetchDirectWeather() {
  const resp = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${DUBLIN_LAT}&longitude=${DUBLIN_LON}` +
    '&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility' +
    '&timezone=Europe/Dublin&forecast_days=1'
  );
  if (!resp.ok) return null;
  const d = await resp.json();
  const c = d.current;
  const cond = WMO_CODES[c.weather_code] || `Code ${c.weather_code}`;
  return `🌤️ Dublin Weather Now\n` +
    `${cond}, ${c.temperature_2m}°C (feels ${c.apparent_temperature}°C)\n` +
    `Wind: ${c.wind_speed_10m} km/h${c.wind_gusts_10m ? ` (gusts ${c.wind_gusts_10m})` : ''}\n` +
    `Precipitation: ${c.precipitation} mm  ·  Visibility: ${c.visibility} m`;
}

async function fetchDirectRoute(start, finish) {
  const geocode = async (addr) => {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&countrycodes=ie`,
      { headers: { 'User-Agent': 'DublinTrafficAdvisor/1.0' } }
    );
    const data = await r.json();
    return data.length ? `${data[0].lon},${data[0].lat}` : null;
  };

  const [startCoords, finishCoords] = await Promise.all([geocode(start), geocode(finish)]);
  if (!startCoords || !finishCoords) return 'Could not find one or both addresses.';

  const r = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${startCoords};${finishCoords}?overview=false`
  );
  if (!r.ok) return null;
  const d = await r.json();
  if (!d.routes?.length) return 'No route found.';
  const route = d.routes[0];
  const km = (route.distance / 1000).toFixed(1);
  const min = (route.duration / 60).toFixed(0);
  return `🚗 Route: "${start}" → "${finish}"\n` +
    `Distance: ${km} km  ·  Est. driving: ${min} min\n` +
    `*Tap "Get Traffic Advice" again once DNS propagates for AI analysis.*`;
}

function addMessage(text, address, role, source) {
  const div = document.createElement('div');
  div.className = `message ${role === 'error' ? 'bot' : role}`;

  if (role === 'user') {
    const lines = text.split('\n');
    div.innerHTML = `
      <div class="avatar">Y</div>
      <div class="bubble">
        <p><strong>From:</strong> ${esc(lines[0])}</p>
        <p><strong>To:</strong> ${esc(lines[1] || '')}</p>
      </div>`;
  } else {
    div.innerHTML = `
      <div class="avatar">
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#3b82f6"/><path d="M16 6c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9zm0 16c-3.9 0-7-3.1-7-7s3.1-7 7-7 7 3.1 7 7-3.1 7-7 7z" fill="#fff"/><path d="M16 10l-1.5 3H12l2 2.5L13 18l3-1.5L19 18l-1-2.5 2-2.5h-2.5z" fill="#fff"/></svg>
      </div>
      <div class="bubble">
        <p>${esc(text).replace(/\n/g, '<br>')}</p>
        ${source ? `<div class="data-source">${esc(source)}</div>` : ''}
      </div>`;
  }

  elements.messages.appendChild(div);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function showTyping() { elements.typing.classList.remove('hidden'); }
function hideTyping() { elements.typing.classList.add('hidden'); }
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
