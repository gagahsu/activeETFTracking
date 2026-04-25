# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Active ETF Tracking is a full-stack personal tool to monitor holdings of Taiwan's active ETFs from four providers: 統一 (Uni-President), 群益 (Capital), 安聯 (Allianz), and 野村 (Nomura). Holdings data is scraped from MoneyDJ.

## Commands

### Backend (run from `backend/`)
```bash
pip install -r requirements.txt      # Install dependencies
uvicorn app.main:app --reload        # Start dev server on port 8000
pytest                               # Run tests
python -m app.scraper.moneydj       # Test scraper standalone
```

### Frontend (run from `frontend/`)
```bash
npm install          # Install dependencies
ng serve             # Start dev server on port 4200
ng build             # Production build
npx vitest           # Run tests
```

### Formatting
Frontend uses Prettier (configured in `package.json`): `printWidth: 100`, `singleQuote: true`, Angular parser for HTML.

## Architecture

### Backend (`backend/app/`)
- `main.py` — FastAPI app, CORS config, route definitions, and startup ETF seeding
- `models.py` — SQLAlchemy ORM models: `ETF`, `Stock`, `Holding`, `MarketData`
- `schemas.py` — Pydantic models for request/response serialization; includes `HoldingsDiff` and `OverlapStock` for the compare/overlap features
- `crud.py` — Database operations; `update_etf_holdings` deletes and re-inserts today's holdings (idempotent per day); `compute_diff` compares two date snapshots; `get_overlap` finds stocks held by multiple ETFs
- `database.py` — SQLite engine setup; DB file lives at `backend/database.db`
- `scraper/moneydj.py` — Scrapes `https://www.moneydj.com/ETF/X/Basic/Basic0007B.xdjhtm?etfid={ticker}.TW`, parses the `.datalist` table for name, weight, and shares

**API Endpoints:**
- `GET /etfs` — List all ETFs (no holdings)
- `GET /etfs/overlap?date=YYYY-MM-DD&min_count=2` — Stocks held by ≥N ETFs on a given date (⚠️ must be declared **before** `GET /etfs/{ticker}` in `main.py` to avoid route conflict)
- `GET /etfs/{ticker}` — ETF metadata only (holdings array is always empty; use the date-specific endpoint)
- `GET /etfs/{ticker}/dates` — Available historical dates for an ETF
- `GET /etfs/{ticker}/holdings/{date_str}` — Full holdings snapshot for a specific date (`YYYY-MM-DD`)
- `GET /etfs/{ticker}/compare?date1=&date2=` — Holdings diff between two dates; omit params to auto-compare the two most recent dates. Returns `{date1, date2, added, increased, decreased, removed, unchanged}`
- `POST /sync` — Triggers scrape for all ETFs and persists today's holdings

**Startup behavior:** On startup, `seed_etfs()` inserts 6 hardcoded ETF tickers if they don't already exist in the DB.

### Frontend (`frontend/src/app/`)
Angular 21 app using **standalone components only** (no NgModules). All component templates and styles are inline (no separate `.html`/`.css` files).

**Services:**
- `services/api.ts` — `ApiService` wraps all HTTP calls; uses an Angular `signal` to cache the ETF list so all components share it without duplicate requests. Also exports all TypeScript interfaces.

**Components:**
- `components/sidebar/sidebar.ts` — Collapsible fixed sidebar (240px / 60px collapsed) with navigation for all views and a sync button showing per-ETF result counts
- `components/dashboard/dashboard.ts` — ETF card grid with per-ETF diff stats (new/added/reduced/removed counts loaded via `compareHoldings`); search filter; navigates to `/changes/:ticker`
- `components/etf-detail/etf-detail.ts` — Holdings snapshot for a selected date; includes pie chart (top 10 via ngx-echarts), full table with rank badge, sector tag, weight bar, and stock search
- `components/holdings-changes/holdings-changes.ts` — Per-ETF diff view; pick ETF + date; shows 4 sections (added/increased/decreased/removed) with colored cards and delta indicators
- `components/holdings-overlap/holdings-overlap.ts` — Cross-ETF overlap; pair matrix + common-stock list with ETF badges and weight; filter by minimum ETF count

**Routing** (`app.routes.ts`):
- `/` → `DashboardComponent`
- `/etf/:ticker` → `EtfDetailComponent` (daily snapshot + chart)
- `/changes/:ticker` → `HoldingsChangesComponent` (holdings diff)
- `/overlap` → `HoldingsOverlapComponent`

**Charts:** ECharts is provided globally via `provideEchartsCore({ echarts })` in `app.config.ts`. Use `NgxEchartsDirective` and `EChartsOption` from `ngx-echarts`/`echarts` in components. Note: `fontWeight` in ECharts label options must be a number, not a string.

### Data Flow
1. User clicks "同步最新持股" → `POST /sync` → backend scrapes MoneyDJ for each ETF → holdings written to SQLite with today's date
2. `DashboardComponent` loads ETF list then fires one `compareHoldings` call per ETF to populate diff stats
3. `HoldingsChangesComponent` receives a ticker param, fetches available dates, then calls `compareHoldings(ticker, undefined, selectedDate)` — backend auto-finds the preceding date
4. `HoldingsOverlapComponent` calls `getOverlap(date?, minCount)` → `GET /etfs/overlap` → backend queries all ETF holdings for the target date and groups by stock
5. Historical comparison: select a different date in the dropdown → `GET /etfs/{ticker}/holdings/{date}` or `GET /etfs/{ticker}/compare` reloads the view

## Key Conventions

- **Backend runs at `http://localhost:8000`** — hardcoded in `ApiService.apiUrl`. Change there if the port changes.
- SQLite database is at `backend/database.db`. There is also a root-level `database.db` which is unused.
- ETF tickers use the format `00981A` (without `.TW`); the scraper appends `.TW` internally when building the MoneyDJ URL.
- The `Holding` model stores one row per (etf, stock, date). The sync replaces all of today's rows for a given ETF.
- Route order in `main.py` matters: `/etfs/overlap` must appear before `/etfs/{ticker}` to avoid FastAPI matching "overlap" as a ticker parameter.
- `compute_diff` uses a 0.01% threshold to distinguish weight changes from floating-point noise.
- No authentication — designed as a personal local tool.
