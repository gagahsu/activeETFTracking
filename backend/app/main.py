from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import datetime
from fastapi.middleware.cors import CORSMiddleware

from . import models, schemas, crud, database
from .database import engine, get_db
from .scraper.moneydj import scrape_moneydj_holdings

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Active ETF Tracking API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For personal tool, allowing all. Restrict in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seed initial ETFs if they don't exist
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

@app.get("/etfs/{ticker}", response_model=schemas.ETFDetail)
def get_etf_detail(ticker: str, db: Session = Depends(get_db)):
    db_etf = db.query(models.ETF).filter(models.ETF.ticker == ticker).first()
    if db_etf is None:
        raise HTTPException(status_code=404, detail="ETF not found")
    return db_etf

@app.get("/etfs/{ticker}/dates", response_model=List[str])
def get_etf_available_dates(ticker: str, db: Session = Depends(get_db)):
    db_etf = db.query(models.ETF).filter(models.ETF.ticker == ticker).first()
    if not db_etf:
        raise HTTPException(status_code=404, detail="ETF not found")
    
    # Get distinct dates from holdings table for this ETF
    dates = db.query(models.Holding.date).filter(
        models.Holding.etf_id == db_etf.id
    ).distinct().order_by(models.Holding.date.desc()).all()
    
    return [d[0].isoformat() for d in dates]

@app.get("/etfs/{ticker}/holdings/{date_str}", response_model=List[schemas.Holding])
def get_etf_holdings_by_date(ticker: str, date_str: str, db: Session = Depends(get_db)):
    db_etf = db.query(models.ETF).filter(models.ETF.ticker == ticker).first()
    if not db_etf:
        raise HTTPException(status_code=404, detail="ETF not found")
    
    target_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    
    holdings = db.query(models.Holding).filter(
        models.Holding.etf_id == db_etf.id,
        models.Holding.date == target_date
    ).all()
    
    return holdings

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
