const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { start, finish } = req.query;
  if (!start || !finish) {
    return res.status(400).json({ available: false, error: 'Missing start or finish address' });
  }

  try {
    const [startGeo, finishGeo] = await Promise.all([
      geocode(start),
      geocode(finish),
    ]);

    if (!startGeo) return res.status(200).json({ available: false, error: `Could not geocode start: ${start}` });
    if (!finishGeo) return res.status(200).json({ available: false, error: `Could not geocode finish: ${finish}` });

    const osrmUrl = `${OSRM}/${startGeo.lon},${startGeo.lat};${finishGeo.lon},${finishGeo.lat}?overview=false`;
    const osrmRes = await fetch(osrmUrl);
    if (!osrmRes.ok) throw new Error(`OSRM routing failed: ${osrmRes.status}`);

    const osrmData = await osrmRes.json();
    if (!osrmData.routes?.length) {
      return res.status(200).json({ available: false, error: 'No route found between these addresses' });
    }

    const route = osrmData.routes[0];
    return res.status(200).json({
      available: true,
      start: { address: start, lat: startGeo.lat, lon: startGeo.lon },
      finish: { address: finish, lat: finishGeo.lat, lon: finishGeo.lon },
      distance_km: +(route.distance / 1000).toFixed(1),
      duration_min: +(route.duration / 60).toFixed(0),
    });
  } catch (err) {
    return res.status(200).json({ available: false, error: err.message });
  }
}

async function geocode(address) {
  const url = `${NOMINATIM}?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=ie`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'DublinTrafficAdvisor/1.0' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}
