# Dublin Traffic Advisor Chatbot

AI-powered traffic advisor for Dublin. Enter start/finish addresses and get practical advice on driving conditions, public transport, and weather impact.

- **Frontend**: GitHub Pages
- **Backend**: Cloudflare Worker
- **AI**: DeepSeek V4 Flash

## Architecture

```
GitHub Pages (static frontend)          Cloudflare Worker (API)
┌─────────────────────┐          ┌──────────────────────────────┐
│ index.html           │  fetch() │  /api/weather → Open-Meteo   │
│ style.css            │ ◄──────► │  /api/traffic → Irish Rail   │
│ app.js               │          │                + NTA (opt.)  │
└─────────────────────┘          │  /api/route   → OpenStreetMap │
                                  │  /api/chat    → DeepSeek V4   │
                                  └──────────────────────────────┘
```

## API Keys

### Required (one key)
- **DeepSeek API** — your key: `sk-0d310c99e519466e995436d8c8f568c7`
  - 5M free tokens for new accounts, then ~$0.14/1M input tokens

### No keys needed
- **Open-Meteo** — Dublin weather (free)
- **OpenStreetMap** — geocoding + routing (free)
- **Irish Rail MCP** — live DART/train positions (free)

### Optional
- **NTA API Key** — free signup at [developer.nationaltransport.ie](https://developer.nationaltransport.ie) for bus/Luas alerts

## Deployment

### 1. Cloudflare Worker (back-end)

```bash
npm install
npx wrangler login
npm run deploy      # deploys to <name>.<your-subdomain>.workers.dev
```

Then set your DeepSeek key:

```bash
npx wrangler secret put DEEPSEEK_API_KEY
# Paste: sk-0d310c99e519466e995436d8c8f568c7
```

Optional — add NTA key:

```bash
npx wrangler secret put NTA_API_KEY
```

### 2. Connect app.js to your Worker

Edit `app.js` and replace `<YOUR_CLOUDFLARE_SUBDOMAIN>` with your actual Cloudflare subdomain.

### 3. Enable GitHub Pages (frontend)

**Settings** → **Pages** → Deploy from `main`, folder `/ (root)`.

## Files

| File | Purpose |
|---|---|
| `index.html` + `style.css` + `app.js` | Chatbot frontend (GitHub Pages) |
| `src/index.js` | Cloudflare Worker (all API endpoints) |
| `wrangler.toml` | Worker configuration |
| `package.json` | Dependencies (wrangler) |

## Data Sources

- **Open-Meteo** — Free weather (no key)
- **Irish Rail MCP** — Live train/DART positions (free, no key)
- **NTA GTFS-RT** — Bus/tram alerts (optional, free key)
- **OpenStreetMap** — Geocoding (Nominatim) + routing (OSRM)
- **DeepSeek V4 Flash** — AI traffic advice

## License MIT
