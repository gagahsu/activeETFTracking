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
- `schemas.py` — Pydantic models for request/response serialization
- `crud.py` — Database operations; `update_etf_holdings` deletes and re-inserts today's holdings on each sync (idempotent per day)
- `database.py` — SQLite engine setup; DB file lives at `backend/database.db`
- `scraper/moneydj.py` — Scrapes `https://www.moneydj.com/ETF/X/Basic/Basic0007B.xdjhtm?etfid={ticker}.TW`, parses the `.datalist` table for name, weight, and shares

**API Endpoints:**
- `GET /etfs` — List all ETFs
- `GET /etfs/{ticker}` — ETF detail with latest holdings
- `GET /etfs/{ticker}/dates` — Available historical dates for an ETF
- `GET /etfs/{ticker}/holdings/{date_str}` — Holdings snapshot for a specific date (`YYYY-MM-DD`)
- `POST /sync` — Triggers scrape for all ETFs and persists today's holdings

**Startup behavior:** On startup, `seed_etfs()` inserts 6 hardcoded ETF tickers if they don't already exist in the DB.

### Frontend (`frontend/src/app/`)
Angular 21 app using **standalone components only** (no NgModules). All component templates and styles are inline (no separate `.html`/`.css` files).

- `services/api.ts` — `ApiService` wraps all HTTP calls; uses an Angular `signal` to cache the ETF list so both `SidebarComponent` and `DashboardComponent` share it without duplicate requests
- `components/sidebar/sidebar.ts` — Fixed sidebar with ETF nav links and a "同步最新持股" sync button
- `components/dashboard/dashboard.ts` — ETF card grid, navigates to `/etf/:ticker`
- `components/etf-detail/etf-detail.ts` — Detail view with a date picker, donut pie chart (top 10 holdings via ngx-echarts/ECharts), and full holdings table sorted by weight descending

**Routing:** `app.routes.ts` defines two routes: `/` → `DashboardComponent`, `/etf/:ticker` → `EtfDetailComponent`.

**Charts:** ECharts is provided globally via `provideEchartsCore({ echarts })` in `app.config.ts`. Use `NgxEchartsDirective` and `EChartsOption` from `ngx-echarts`/`echarts` in components.

### Data Flow
1. User clicks "同步最新持股" → `POST /sync` → backend scrapes MoneyDJ for each ETF → holdings written to SQLite with today's date
2. `EtfDetailComponent` loads: fetches ETF detail + available dates in parallel via `forkJoin`, then fetches holdings for the most recent date
3. Historical comparison: select a different date in the dropdown → `GET /etfs/{ticker}/holdings/{date}` reloads the chart and table

## Key Conventions

- **Backend runs at `http://localhost:8000`** — hardcoded in `ApiService.apiUrl`. Change there if the port changes.
- SQLite database is at `backend/database.db`. There is also a root-level `database.db` which is unused.
- ETF tickers use the format `00981A` (without `.TW`); the scraper appends `.TW` internally when building the MoneyDJ URL.
- The `Holding` model stores one row per (etf, stock, date). The sync replaces all of today's rows for a given ETF.
- No authentication — designed as a personal local tool.
