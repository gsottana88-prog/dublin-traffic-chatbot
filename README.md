# Dublin Traffic Advisor Chatbot

AI-powered traffic advisor for Dublin, Ireland. Enter a start and finish address and get practical advice on driving conditions, public transport disruptions, and weather impact.

Built with **DeepSeek V4 Flash**, **Open-Meteo**, **NTA GTFS-RT**, **Irish Rail MCP**, and **OpenStreetMap** routing.

## Architecture

```
Frontend (index.html + app.js)
       ↕ POST /api/chat
Vercel Serverless Functions
  ├── /api/weather   → Open-Meteo (free, no key needed)
  ├── /api/traffic   → NTA GTFS-RT (optional) + Irish Rail MCP (free)
  ├── /api/route     → Nominatim + OSRM (free, no key needed)
  └── /api/chat      → DeepSeek V4 Flash
```

## API Keys

### Required (one key)
| Key | Cost | Sign Up |
|---|---|---|
| DeepSeek API Key | Free 5M tokens (new accounts), then ~$0.14/1M | [platform.deepseek.com](https://platform.deepseek.com) |

### No keys needed for these
| Service | What it provides |
|---|---|
| **Open-Meteo** | Dublin weather forecast (temperature, rain, wind, visibility) |
| **OpenStreetMap (Nominatim)** | Address geocoding |
| **OpenStreetMap (OSRM)** | Driving route calculation |
| **Irish Rail MCP** | Live train positions and DART info |

### Optional (for richer transport data)
| Key | Cost | Sign Up |
|---|---|---|
| NTA Transport API Key | Free | [developer.nationaltransport.ie](https://developer.nationaltransport.ie) — adds real-time bus/ Luas alerts |

## Setup

### 1. Deploy to Vercel

Push to GitHub → go to [vercel.com](https://vercel.com) → **Add New Project** → import `dublin-traffic-chatbot` → **Deploy**

### 2. Set Environment Variables

In Vercel project **Settings** → **Environment Variables**, add:

| Name | Required | Value |
|---|---|---|
| `DEEPSEEK_API_KEY` | ✅ Yes | Your DeepSeek API key |
| `NTA_API_KEY` | ❌ Optional | NTA key for bus/tram alerts |

### 3. Redeploy

After adding env vars, go to **Deployments** → click **Redeploy** on the latest deployment.

### 4. Enable GitHub Pages

**Settings** → **Pages** → Deploy from `main` branch, `/ (root)` folder.

## Usage

1. Open the app (Vercel URL or GitHub Pages)
2. Enter a **Start Address** (e.g. "Temple Bar, Dublin")
3. Enter a **Finish Address** (e.g. "Dun Laoghaire, Dublin")
4. Click **Get Traffic Advice**
5. The AI analyzes weather, transport, and route data to give you practical advice

## Data Sources

- **Open-Meteo** — Free weather forecasts (no API key required)
- **NTA GTFS-RT** — Real-time transport alerts (optional, free key)
- **Irish Rail MCP** — Live train/DART positions (free, no key)
- **OpenStreetMap** — Geocoding (Nominatim) and routing (OSRM)

## License

MIT
