from sqlalchemy.orm import Session
from . import models, schemas
import datetime

def get_etf_by_ticker(db: Session, ticker: str):
    return db.query(models.ETF).filter(models.ETF.ticker == ticker).first()

def create_etf(db: Session, etf: schemas.ETFCreate):
    db_etf = models.ETF(**etf.dict())
    db.add(db_etf)
    db.commit()
    db.refresh(db_etf)
    return db_etf

def get_stock_by_ticker(db: Session, ticker: str):
    return db.query(models.Stock).filter(models.Stock.ticker == ticker).first()

def create_stock(db: Session, stock: schemas.StockBase):
    db_stock = models.Stock(**stock.dict())
    db.add(db_stock)
    db.commit()
    db.refresh(db_stock)
    return db_stock

def update_etf_holdings(db: Session, etf_id: int, holdings_data: list):
    today = datetime.date.today()
    db.query(models.Holding).filter(
        models.Holding.etf_id == etf_id,
        models.Holding.date == today
    ).delete()

    for h in holdings_data:
        db_stock = get_stock_by_ticker(db, h['stock_ticker'])
        if not db_stock:
            db_stock = create_stock(db, schemas.StockBase(
                ticker=h['stock_ticker'],
                name=h['stock_name']
            ))
        else:
            db_stock.name = h['stock_name']
            db.add(db_stock)

        db_holding = models.Holding(
            etf_id=etf_id,
            stock_id=db_stock.id,
            weight=h['weight'],
            shares=h['shares'],
            date=today
        )
        db.add(db_holding)

    db.commit()

def get_holdings_for_date(db: Session, etf_id: int, target_date: datetime.date) -> list:
    return (
        db.query(models.Holding)
        .filter(models.Holding.etf_id == etf_id, models.Holding.date == target_date)
        .all()
    )

def compute_diff(db: Session, etf_id: int, date1: datetime.date, date2: datetime.date) -> dict:
    h1 = {h.stock.ticker: h for h in get_holdings_for_date(db, etf_id, date1)}
    h2 = {h.stock.ticker: h for h in get_holdings_for_date(db, etf_id, date2)}

    added, removed, increased, decreased, unchanged = [], [], [], [], []

    def stock_summary(holding):
        return {
            "ticker": holding.stock.ticker,
            "name": holding.stock.name,
            "sector": holding.stock.sector,
        }

    for ticker in set(h1.keys()) | set(h2.keys()):
        if ticker in h2 and ticker not in h1:
            h = h2[ticker]
            added.append({"stock": stock_summary(h), "weight": h.weight, "shares": h.shares})
        elif ticker in h1 and ticker not in h2:
            h = h1[ticker]
            removed.append({"stock": stock_summary(h), "weight": h.weight, "prev_weight": h.weight, "shares": h.shares})
        else:
            curr, prev = h2[ticker], h1[ticker]
            delta = round(curr.weight - prev.weight, 2)
            entry = {
                "stock": stock_summary(curr),
                "weight": curr.weight,
                "prev_weight": prev.weight,
                "delta": delta,
                "shares": curr.shares,
            }
            if delta > 0.01:
                increased.append(entry)
            elif delta < -0.01:
                decreased.append(entry)
            else:
                unchanged.append(entry)

    return {
        "added": sorted(added, key=lambda x: x["weight"], reverse=True),
        "increased": sorted(increased, key=lambda x: x["delta"], reverse=True),
        "decreased": sorted(decreased, key=lambda x: x["delta"]),
        "removed": sorted(removed, key=lambda x: x["weight"], reverse=True),
        "unchanged": sorted(unchanged, key=lambda x: x["weight"], reverse=True),
    }

def get_overlap(db: Session, target_date: datetime.date, min_count: int = 2) -> list:
    etfs = db.query(models.ETF).all()
    stock_map: dict = {}

    for etf in etfs:
        holdings = get_holdings_for_date(db, etf.id, target_date)
        for h in holdings:
            ticker = h.stock.ticker
            if ticker not in stock_map:
                stock_map[ticker] = {
                    "stock": {"ticker": h.stock.ticker, "name": h.stock.name, "sector": h.stock.sector},
                    "etfs": [],
                }
            stock_map[ticker]["etfs"].append({"ticker": etf.ticker, "weight": h.weight})

    result = [
        {**v, "count": len(v["etfs"])}
        for v in stock_map.values()
        if len(v["etfs"]) >= min_count
    ]
    return sorted(result, key=lambda x: (-x["count"], -sum(e["weight"] for e in x["etfs"])))
