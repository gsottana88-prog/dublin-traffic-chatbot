const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

// Dublin coordinates
const LAT = 53.35;
const LON = -6.26;

const WMO_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Light freezing rain', 67: 'Heavy freezing rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const url = `${OPEN_METEO}?latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
      `&timezone=Europe%2FDublin&forecast_days=2`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);

    const data = await response.json();
    const current = data.current;
    const code = current.weather_code;

    const hourly = data.hourly;
    const now = new Date().getTime();
    const upcoming = [];
    for (let i = 0; i < hourly.time.length; i++) {
      const t = new Date(hourly.time[i] + ':00').getTime();
      if (t > now && t <= now + 4 * 3600 * 1000) {
        upcoming.push({
          time: hourly.time[i],
          temp: hourly.temperature_2m[i],
          precip_prob: hourly.precipitation_probability[i],
          conditions: WMO_CODES[hourly.weather_code[i]] || `Code ${hourly.weather_code[i]}`,
          wind: hourly.wind_speed_10m[i],
        });
      }
    }

    return res.status(200).json({
      available: true,
      source: 'Open-Meteo (free, no key needed)',
      temperature: current.temperature_2m,
      feels_like: current.apparent_temperature,
      conditions: WMO_CODES[code] || `Code ${code}`,
      humidity: current.relative_humidity_2m,
      wind_speed: current.wind_speed_10m,
      wind_gust: current.wind_gusts_10m,
      precipitation: current.precipitation,
      visibility: current.visibility,
      upcoming_hours: upcoming,
    });
  } catch (err) {
    return res.status(200).json({ available: false, error: err.message });
  }
}
