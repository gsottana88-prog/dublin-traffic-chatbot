# Dublin Traffic Advisor Chatbot

AI-powered traffic advisor for Dublin, Ireland. Enter a start and finish address and get practical advice on driving conditions, public transport disruptions, and weather impact.

Built with **DeepSeek V4 Flash**, **OpenWeatherMap**, **NTA GTFS-RT**, and **OpenStreetMap** routing.

## Architecture

```
Frontend (index.html + app.js)
       ↕ POST /api/chat
Vercel Serverless Functions
  ├── /api/weather   → OpenWeatherMap
  ├── /api/traffic   → NTA GTFS-RT
  ├── /api/route     → Nominatim + OSRM
  └── /api/chat      → DeepSeek V4 Flash
```

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [GitHub](https://github.com) account
- [Vercel](https://vercel.com) account (connected to GitHub)

## API Keys (Free)

| Key | Required | Sign Up |
|---|---|---|
| DeepSeek API Key | ✅ Yes | [platform.deepseek.com](https://platform.deepseek.com) |
| OpenWeatherMap | ✅ Yes | [openweathermap.org](https://openweathermap.org/api) (free tier) |
| NTA Transport | ❌ Optional | [developer.nationaltransport.ie](https://developer.nationaltransport.ie) (free) |

## Setup

### 1. Clone & Deploy

```bash
git clone https://github.com/gsottana88-prog/dublin-traffic-chatbot.git
cd dublin-traffic-chatbot
```

Push to GitHub — Vercel auto-deploys.

### 2. Set Environment Variables in Vercel

Go to your Vercel project dashboard → **Settings** → **Environment Variables** and add:

| Name | Value |
|---|---|
| `DEEPSEEK_API_KEY` | Your DeepSeek API key |
| `OPENWEATHER_API_KEY` | Your OpenWeatherMap API key |
| `NTA_API_KEY` | Your NTA API key (optional) |

### 3. Enable GitHub Pages

1. Go to repo **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main`, folder: `/ (root)`
4. Save

Your site will be available at: `https://gsottana88-prog.github.io/dublin-traffic-chatbot/`

## Usage

1. Open the app (Vercel URL or GitHub Pages)
2. Enter a **Start Address** (e.g. "Temple Bar, Dublin")
3. Enter a **Finish Address** (e.g. "Dun Laoghaire, Dublin")
4. Click **Get Traffic Advice**
5. The AI analyzes weather, transport alerts, and route data to give you practical advice

## How It Works

1. **Weather** — Current Dublin conditions from OpenWeatherMap (temp, rain, wind, visibility)
2. **Transport** — Real-time service alerts and trip delays from NTA GTFS-RT feeds
3. **Route** — Geocoding via Nominatim (OpenStreetMap) + routing via OSRM
4. **AI** — DeepSeek V4 Flash generates contextual advice based on all data sources

All API calls are proxied through Vercel serverless functions — no API keys exposed in the browser.

## Data Sources

- **OpenWeatherMap** — Current weather conditions
- **National Transport Authority** — GTFS-RT real-time transport alerts
- **OpenStreetMap** — Geocoding (Nominatim) and routing (OSRM)

## License

MIT
