# Sentinel AI — Community ActionGrid

A real-time community disaster response platform powered by Gemini AI. Citizens report incidents, authorities monitor risk, and AI generates multilingual alerts and prioritised action recommendations.

---

## Quick Start (5 minutes)

### Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 18+ |
| Python | 3.11+ |
| npm or pnpm | latest |

A Gemini API key is **optional** — the app runs in full demo mode with rich mock data when no key is set.

---

### Step 1 — Clone and configure

```bash
git clone <repo-url>
cd sentinel-ai
cp .env.example .env
```

To enable real AI (optional), open `.env` and set:
```
GEMINI_API_KEY=your_key_here
```
Get a free key at https://aistudio.google.com/

---

### Step 2 — Start the backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows PowerShell
.\venv\Scripts\Activate.ps1

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload --port 8000
```

Backend is ready at http://localhost:8000  
Interactive API docs: http://localhost:8000/docs

---

### Step 3 — Start the frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

App is live at http://localhost:3000

> The frontend falls back to rich mock data automatically if the backend is offline — you can demo without running Step 2.

---

## Routes

| URL | Description |
|-----|-------------|
| `/` | Landing page |
| `/dashboard` | Authority command centre — live stats, risk map, AI summary, shelter status |
| `/map` | Full-screen interactive Leaflet risk map with severity filter |
| `/report` | Community incident submission form (AI-classified on submit) |
| `/ai-summary` | Full Gemini SITREP: risk level, multilingual alerts, action priorities |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Maps | Leaflet + react-leaflet |
| Forms | React Hook Form + Zod |
| Backend | FastAPI, Pydantic v2 |
| AI | Google Gemini 1.5 Flash |
| Database | In-memory mock (drop-in PostgreSQL via `DATABASE_URL` env var) |

---

## AI Features (Gemini)

| Feature | Endpoint | Fallback |
|---------|----------|---------|
| Incident classification | `POST /api/ai/classify` | Returns `medium` confidence mock |
| Full situation report (SITREP) | `GET /api/ai/risk-summary` | Returns rich mock SITREP |
| Multilingual alerts | `POST /api/ai/multilingual-alert` | Returns mock EN/SW/FR/AR |
| Action recommendations | `POST /api/ai/recommend` | Returns 4-step mock action list |

---

## Backend API Reference

```
GET    /api/incidents              List all incidents (filter: ?severity=critical&status=active)
POST   /api/incidents              Submit incident → triggers AI classification
GET    /api/incidents/{id}         Get single incident

GET    /api/alerts                 List active public alerts
POST   /api/alerts                 Create alert (auto-translates to SW + FR)

GET    /api/resources              List shelters and resources
GET    /api/resources/nearest      Nearest shelters (?lat=-1.29&lng=36.82&limit=3)

POST   /api/ai/classify            Classify free-text incident description
GET    /api/ai/risk-summary        Generate full SITREP
POST   /api/ai/multilingual-alert  Translate alert to SW / FR / AR
POST   /api/ai/recommend           Generate prioritised action list
```

---

## Environment Variables

```bash
# .env (copy from .env.example)

# AI (optional — app works without this)
GEMINI_API_KEY=

# Backend
DATABASE_URL=          # leave blank to use in-memory mock
SECRET_KEY=change-me
CORS_ORIGINS=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MAP_CENTER_LAT=-1.2921
NEXT_PUBLIC_MAP_CENTER_LNG=36.8219
NEXT_PUBLIC_MAP_ZOOM=12
```

---

## Project Structure

```
sentinel-ai/
├── frontend/
│   └── src/
│       ├── app/               # Next.js App Router pages
│       │   ├── dashboard/     # Authority command centre
│       │   ├── map/           # Full-screen risk map
│       │   ├── report/        # Incident submission form
│       │   └── ai-summary/    # AI SITREP + multilingual alerts
│       ├── components/
│       │   ├── dashboard/     # StatsCard, IncidentTable, AlertsFeed, RiskSummary
│       │   ├── map/           # RiskMap (Leaflet)
│       │   ├── report/        # IncidentForm
│       │   ├── shared/        # Navbar, ShelterPanel
│       │   └── ui/            # Button, Card, Badge, Input, Select …
│       ├── lib/
│       │   ├── api.ts         # API client with mock fallbacks
│       │   ├── mock-data.ts   # Client-side demo data
│       │   └── utils.ts       # cn(), severity colours, formatRelativeTime
│       └── types/index.ts     # Shared TypeScript interfaces
├── backend/
│   └── app/
│       ├── main.py            # FastAPI entry point + CORS
│       ├── api/routes/        # incidents · alerts · resources · ai
│       ├── services/
│       │   └── gemini_service.py  # Gemini calls + mock fallbacks
│       ├── db/mock_data.py    # In-memory store (loads sample_data JSON)
│       └── schemas/           # Pydantic models
├── sample_data/               # Seed JSON: incidents · alerts · shelters
├── docker-compose.yml         # PostgreSQL + backend + frontend
└── .env.example
```

---

## Docker (optional)

```bash
docker-compose up --build
```

Services: PostgreSQL on 5432, backend on 8000, frontend on 3000.

---

## Demo Credentials

No authentication required. All endpoints are open for hackathon demo purposes.

The mock dataset contains 8 incidents, 4 alerts, and 5 shelters across Nairobi — enough to demonstrate all features without any external services.
