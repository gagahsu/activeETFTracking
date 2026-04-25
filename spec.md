# Spec: Active ETF Holding Tracking System

## Objective
Develop a personal full-stack application to track and analyze Active ETF holdings from specific providers (**統一, 群益, 安聯, 野村**). The system will provide a real-time dashboard for monitoring changes in ETF compositions and performance.

## Tech Stack
- **Frontend:** Angular 17+ (with TypeScript, RxJS)
- **Backend:** Python 3.10+ (FastAPI)
- **Database:** SQLite
- **Styling:** CSS (Modular) or Angular Material
- **Charts:** Chart.js or ECharts

## Commands
### Backend
- **Install:** `pip install fastapi uvicorn sqlalchemy requests`
- **Run:** `uvicorn app.main:app --reload`
- **Test:** `pytest`

### Frontend
- **Install:** `npm install`
- **Run:** `ng serve`
- **Build:** `ng build --prod`

## Project Structure
```
active-etf-tracking/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI entry point
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── crud.py          # Database operations
│   │   ├── api/             # API routes
│   │   └── scraper/         # Data fetching logic
│   ├── database.db          # SQLite file
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/  # Reusable UI components
│   │   │   ├── pages/       # Dashboard, Detail pages
│   │   │   ├── services/    # API communication
│   │   │   └── models/      # TypeScript interfaces
│   │   └── assets/
│   ├── angular.json
│   └── package.json
└── GEMINI.md
```

## Data Model (SQLite)
- **ETFs:** `id`, `ticker`, `name`, `provider`, `inception_date`.
- **Stocks:** `id`, `ticker`, `name`, `sector`.
- **Holdings:** `id`, `etf_id`, `stock_id`, `weight (%)`, `shares`, `date`.
- **MarketData:** `id`, `asset_id` (ETF or Stock), `price`, `nav`, `date`.

## UI/UX Design (Based on _ETF_ v2.html)
1. **Sidebar:** Navigation (Dashboard, ETF List, Comparison, Settings).
2. **Dashboard:**
   - Summary cards (Market status, Top Gainers/Losers).
   - Watchlist of active ETFs.
3. **ETF Detail Page:**
   - **Composition Chart:** Pie chart showing sector or top 10 holdings.
   - **History Chart:** Line chart for NAV/Price performance.
   - **Holdings Table:** List of all stocks with sorting (Weight, Change).
4. **Data Sync:** Manual trigger or scheduled task to fetch latest holdings.

## Success Criteria
- [ ] Backend provides RESTful API for all entities.
- [ ] Frontend displays ETF holdings with proper formatting.
- [ ] Historical changes in holdings are trackable (e.g., comparing two dates).
- [ ] Responsive UI supporting Desktop and Tablet.

## Resolved Requirements
1. **Data Source:** 統一 (Uni-President), 群益 (Capital), 安聯 (Allianz), 野村 (Nomura).
2. **Auth:** None (Personal tool).
3. **Update Frequency:** Real-time (Latest available daily/intra-day).
