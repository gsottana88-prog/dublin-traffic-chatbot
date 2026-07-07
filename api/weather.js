export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ available: false, error: 'OpenWeatherMap API key not configured' });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=Dublin,IE&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenWeatherMap returned ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json({
      available: true,
      temperature: Math.round(data.main.temp),
      feels_like: Math.round(data.main.feels_like),
      conditions: data.weather[0].description,
      humidity: data.main.humidity,
      wind_speed: data.wind.speed,
      wind_gust: data.wind.gust || null,
      rain_1h: data.rain ? data.rain['1h'] || 0 : 0,
      visibility: data.visibility,
      icon: data.weather[0].icon,
    });
  } catch (err) {
    return res.status(200).json({ available: false, error: err.message });
  }
}
