from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
from fastapi.middleware.cors import CORSMiddleware

from . import models, schemas, crud, database
from .database import engine, get_db
from .scraper.moneydj import scrape_moneydj_holdings

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Active ETF Tracking API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def seed_etfs(db: Session):
    initial_etfs = [
        {"ticker": "00981A", "name": "統一台股增長主動式ETF", "provider": "統一投信"},
        {"ticker": "00988A", "name": "統一全球創新主動式ETF", "provider": "統一投信"},
        {"ticker": "00982A", "name": "群益台灣精選強棒主動式ETF", "provider": "群益投信"},
        {"ticker": "00992A", "name": "群益台灣科技創新主動式ETF", "provider": "群益投信"},
        {"ticker": "00993A", "name": "安聯台灣主動式ETF", "provider": "安聯投信"},
        {"ticker": "00985A", "name": "野村臺灣增強50主動式ETF", "provider": "野村投信"},
    ]
    for etf_data in initial_etfs:
        if not crud.get_etf_by_ticker(db, etf_data["ticker"]):
            crud.create_etf(db, schemas.ETFCreate(**etf_data))

@app.on_event("startup")
def startup_populate():
    db = next(get_db())
    seed_etfs(db)

@app.get("/")
def read_root():
    return {"message": "Active ETF Tracking API is running"}

@app.get("/etfs", response_model=List[schemas.ETF])
def get_etfs(db: Session = Depends(get_db)):
    return db.query(models.ETF).all()

@app.get("/dates", response_model=List[str])
def get_all_dates(db: Session = Depends(get_db)):
    dates = (
        db.query(models.Holding.date)
        .distinct()
        .order_by(models.Holding.date.desc())
        .all()
    )
    return [d[0].isoformat() for d in dates]

@app.get("/stocks/sync-increase", response_model=List[schemas.SyncIncreaseStock])
def get_sync_increase(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    all_dates = [
        d[0] for d in db.query(models.Holding.date).distinct().order_by(models.Holding.date.desc()).all()
    ]
    if not all_dates:
        return []
    d_to = datetime.datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else all_dates[0]
    if date_from:
        d_from = datetime.datetime.strptime(date_from, "%Y-%m-%d").date()
    else:
        candidates = [d for d in all_dates if d < d_to]
        if not candidates:
            return []
        d_from = candidates[0]
    return crud.get_synchronized_increase(db, d_from, d_to)

@app.get("/stocks/search", response_model=List[schemas.StockSummary])
def search_stocks(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    return crud.search_stocks(db, q)

@app.get("/stocks/trend", response_model=schemas.StockTrendResponse)
def get_stock_trend(ticker: str = Query(...), db: Session = Depends(get_db)):
    result = crud.get_stock_trend(db, ticker)
    if not result:
        raise HTTPException(status_code=404, detail="Stock not found")
    return result


@app.get("/radar", response_model=List[schemas.OverlapStock])
def get_radar(
    mode: str = Query("buy", pattern="^(buy|sell)$"),
    date_str: Optional[str] = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    if date_str:
        target_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    else:
        latest = (
            db.query(models.Holding.date)
            .order_by(models.Holding.date.desc())
            .first()
        )
        if not latest:
            return []
        target_date = latest[0]
    return crud.get_radar(db, target_date, mode)


# NOTE: /etfs/overlap must be declared before /etfs/{ticker} to avoid route conflict
@app.get("/etfs/overlap", response_model=List[schemas.OverlapStock])
def get_holdings_overlap(
    date_str: Optional[str] = Query(None, alias="date"),
    min_count: int = Query(2, ge=2, le=10),
    db: Session = Depends(get_db),
):
    if date_str:
        target_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    else:
        # Use the most recent date that has data for any ETF
        latest = (
            db.query(models.Holding.date)
            .order_by(models.Holding.date.desc())
            .first()
        )
        if not latest:
            return []
        target_date = latest[0]

    return crud.get_overlap(db, target_date, min_count)

@app.get("/etfs/{ticker}/chart", response_model=schemas.ETFChartData)
def get_etf_chart(ticker: str, days: int = Query(90, ge=30, le=180), db: Session = Depends(get_db)):
    db_etf = db.query(models.ETF).filter(models.ETF.ticker == ticker).first()
    if not db_etf:
        raise HTTPException(status_code=404, detail="ETF not found")
    return crud.generate_mock_chart(ticker, days)

@app.get("/etfs/{ticker}", response_model=schemas.ETFDetail)
def get_etf_detail(ticker: str, db: Session = Depends(get_db)):
    db_etf = db.query(models.ETF).filter(models.ETF.ticker == ticker).first()
    if db_etf is None:
        raise HTTPException(status_code=404, detail="ETF not found")
    # Return ETF metadata only; holdings are fetched via /etfs/{ticker}/holdings/{date}
    db_etf.holdings = []
    return db_etf

@app.get("/etfs/{ticker}/dates", response_model=List[str])
def get_etf_available_dates(ticker: str, db: Session = Depends(get_db)):
    db_etf = db.query(models.ETF).filter(models.ETF.ticker == ticker).first()
    if not db_etf:
        raise HTTPException(status_code=404, detail="ETF not found")

    dates = (
        db.query(models.Holding.date)
        .filter(models.Holding.etf_id == db_etf.id)
        .distinct()
        .order_by(models.Holding.date.desc())
        .all()
    )
    return [d[0].isoformat() for d in dates]

@app.get("/etfs/{ticker}/holdings/{date_str}", response_model=List[schemas.Holding])
def get_etf_holdings_by_date(ticker: str, date_str: str, db: Session = Depends(get_db)):
    db_etf = db.query(models.ETF).filter(models.ETF.ticker == ticker).first()
    if not db_etf:
        raise HTTPException(status_code=404, detail="ETF not found")

    target_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    return crud.get_holdings_for_date(db, db_etf.id, target_date)

@app.get("/etfs/{ticker}/compare", response_model=schemas.HoldingsDiff)
def compare_etf_holdings(
    ticker: str,
    date1: Optional[str] = Query(None),
    date2: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    db_etf = db.query(models.ETF).filter(models.ETF.ticker == ticker).first()
    if not db_etf:
        raise HTTPException(status_code=404, detail="ETF not found")

    available = (
        db.query(models.Holding.date)
        .filter(models.Holding.etf_id == db_etf.id)
        .distinct()
        .order_by(models.Holding.date.desc())
        .all()
    )
    date_list = [d[0] for d in available]

    if len(date_list) < 1:
        raise HTTPException(status_code=404, detail="No holdings data available")

    if date2:
        d2 = datetime.datetime.strptime(date2, "%Y-%m-%d").date()
    else:
        d2 = date_list[0]

    if date1:
        d1 = datetime.datetime.strptime(date1, "%Y-%m-%d").date()
    else:
        # Use the date immediately before d2
        candidates = [d for d in date_list if d < d2]
        d1 = candidates[0] if candidates else None

    if d1 is None:
        # Only one date available — return current holdings as all "added"
        holdings = crud.get_holdings_for_date(db, db_etf.id, d2)
        added = [
            {"stock": {"ticker": h.stock.ticker, "name": h.stock.name, "sector": h.stock.sector},
             "weight": h.weight, "shares": h.shares}
            for h in holdings
        ]
        return schemas.HoldingsDiff(date1=None, date2=d2.isoformat(), added=added)

    diff = crud.compute_diff(db, db_etf.id, d1, d2)
    return schemas.HoldingsDiff(date1=d1.isoformat(), date2=d2.isoformat(), **diff)

@app.post("/sync")
def sync_data(db: Session = Depends(get_db)):
    etfs = db.query(models.ETF).all()
    results = []
    for etf in etfs:
        try:
            holdings = scrape_moneydj_holdings(etf.ticker)
            if holdings:
                crud.update_etf_holdings(db, etf.id, holdings)
                results.append({"ticker": etf.ticker, "status": "success", "count": len(holdings)})
            else:
                results.append({"ticker": etf.ticker, "status": "failed", "reason": "No data found"})
        except Exception as e:
            results.append({"ticker": etf.ticker, "status": "error", "reason": str(e)})

    return {"status": "Sync completed", "results": results}
