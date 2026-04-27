from sqlalchemy.orm import Session
from . import models, schemas
import datetime
import math
import random as _random

def _biz_days(n: int) -> list:
    dates, d = [], datetime.date.today()
    while len(dates) < n:
        if d.weekday() < 5:
            dates.append(d)
        d -= datetime.timedelta(days=1)
    return list(reversed(dates))

def _ema(data: list, period: int) -> list:
    if len(data) < period:
        return [None] * len(data)
    result = [None] * (period - 1)
    result.append(sum(data[:period]) / period)
    k = 2 / (period + 1)
    for i in range(period, len(data)):
        result.append(result[-1] * (1 - k) + data[i] * k)
    return result

def generate_mock_chart(ticker: str, days: int = 90) -> dict:
    seed = sum(ord(c) * (i + 1) for i, c in enumerate(ticker))
    rng = _random.Random(seed)

    base = 14 + rng.random() * 12
    closes = [base]
    for _ in range(days - 1):
        closes.append(max(5.0, closes[-1] * (1 + rng.gauss(0.0005, 0.012))))

    dates = _biz_days(days)

    candles = []
    for i, (dt, close) in enumerate(zip(dates, closes)):
        prev = closes[i - 1] if i > 0 else close
        open_ = round(prev * (1 + rng.gauss(0, 0.004)), 2)
        high = round(max(open_, close) * (1 + abs(rng.gauss(0, 0.006))), 2)
        low  = round(min(open_, close) * (1 - abs(rng.gauss(0, 0.006))), 2)
        candles.append({"date": dt.isoformat(), "open": open_, "high": high,
                        "close": round(close, 2), "low": low,
                        "volume": float(int(rng.uniform(300_000, 3_000_000)))})

    def ma(period):
        return [{"date": dates[i].isoformat(),
                 "value": round(sum(closes[i - period + 1:i + 1]) / period, 2)}
                for i in range(period - 1, len(closes))]

    ma5, ma20 = ma(5), ma(20)

    bollinger = []
    for i in range(19, len(closes)):
        w = closes[i - 19:i + 1]
        mid = sum(w) / 20
        std = math.sqrt(sum((x - mid) ** 2 for x in w) / 20)
        bollinger.append({"date": dates[i].isoformat(),
                          "upper": round(mid + 2 * std, 2),
                          "middle": round(mid, 2),
                          "lower": round(mid - 2 * std, 2)})

    rsi_out = []
    gains = [max(0, closes[i] - closes[i - 1]) for i in range(1, len(closes))]
    losses = [max(0, closes[i - 1] - closes[i]) for i in range(1, len(closes))]
    if len(gains) >= 14:
        ag = sum(gains[:14]) / 14
        al = sum(losses[:14]) / 14
        for i in range(13, len(closes)):
            if i > 13:
                ag = (ag * 13 + gains[i - 1]) / 14
                al = (al * 13 + losses[i - 1]) / 14
            val = 100.0 if al == 0 else round(100 - 100 / (1 + ag / al), 2)
            rsi_out.append({"date": dates[i].isoformat(), "value": val})

    ema12, ema26 = _ema(closes, 12), _ema(closes, 26)
    macd_line = [None if (a is None or b is None) else round(a - b, 4)
                 for a, b in zip(ema12, ema26)]
    valid_macd = [v for v in macd_line if v is not None]
    offset = next(i for i, v in enumerate(macd_line) if v is not None)
    sig_ema = _ema(valid_macd, 9)
    sig_line = [None] * offset + [None if v is None else round(v, 4) for v in sig_ema]

    macd_out = []
    for i, m in enumerate(macd_line):
        if m is None:
            continue
        s = sig_line[i] if i < len(sig_line) else None
        h = round(m - s, 4) if s is not None else None
        macd_out.append({"date": dates[i].isoformat(), "macd": m, "signal": s, "histogram": h})

    last_rsi  = rsi_out[-1]["value"] if rsi_out else 50
    last_close = closes[-1]
    last_ma20  = ma20[-1]["value"] if ma20 else last_close
    last_hist  = next((d["histogram"] for d in reversed(macd_out) if d.get("histogram") is not None), 0)

    if last_rsi < 35 and last_hist > 0:
        sig, reason = "進場布局", f"RSI {last_rsi:.0f} 超賣 + MACD 柱狀翻正，動能轉強"
    elif last_rsi > 68 and last_hist < 0:
        sig, reason = "謹慎退場", f"RSI {last_rsi:.0f} 超買 + MACD 柱狀翻負，留意高檔壓力"
    elif last_close > last_ma20 and last_hist > 0:
        sig, reason = "多頭偏多", f"股價站上 MA20 ({last_ma20:.2f})，MACD 動能持續向上"
    elif last_close < last_ma20 and last_hist < 0:
        sig, reason = "空頭偏弱", f"股價跌破 MA20 ({last_ma20:.2f})，MACD 動能轉弱"
    else:
        sig, reason = "中性觀望", "技術面無明顯方向，建議等待訊號確認"

    return {"ticker": ticker, "signal": sig, "signal_reason": reason,
            "candles": candles, "ma5": ma5, "ma20": ma20,
            "bollinger": bollinger, "rsi": rsi_out, "macd": macd_out}


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
            added.append({
                "stock": stock_summary(h), 
                "weight": h.weight, 
                "shares": h.shares,
                "delta_shares": h.shares
            })
        elif ticker in h1 and ticker not in h2:
            h = h1[ticker]
            removed.append({
                "stock": stock_summary(h), 
                "weight": h.weight, 
                "prev_weight": h.weight, 
                "shares": 0,
                "prev_shares": h.shares,
                "delta_shares": -(h.shares or 0)
            })
        else:
            curr, prev = h2[ticker], h1[ticker]
            delta_weight = round(curr.weight - prev.weight, 2)
            
            curr_s = curr.shares or 0
            prev_s = prev.shares or 0
            delta_s = curr_s - prev_s

            entry = {
                "stock": stock_summary(curr),
                "weight": curr.weight,
                "prev_weight": prev.weight,
                "delta": delta_weight,
                "shares": curr.shares,
                "prev_shares": prev.shares,
                "delta_shares": delta_s,
            }
            
            # Use shares delta for categorization instead of weight delta
            if delta_s > 0:
                increased.append(entry)
            elif delta_s < 0:
                decreased.append(entry)
            else:
                unchanged.append(entry)

    return {
        "added": sorted(added, key=lambda x: x["weight"], reverse=True),
        "increased": sorted(increased, key=lambda x: x["delta_shares"], reverse=True),
        "decreased": sorted(decreased, key=lambda x: x["delta_shares"]),
        "removed": sorted(removed, key=lambda x: x["weight"], reverse=True),
        "unchanged": sorted(unchanged, key=lambda x: x["weight"], reverse=True),
    }

def search_stocks(db: Session, query: str, limit: int = 15) -> list:
    q = f"%{query}%"
    return (
        db.query(models.Stock)
        .join(models.Holding)
        .filter((models.Stock.ticker.ilike(q)) | (models.Stock.name.ilike(q)))
        .distinct()
        .limit(limit)
        .all()
    )

def get_stock_trend(db: Session, stock_ticker: str):
    stock = db.query(models.Stock).filter(models.Stock.ticker == stock_ticker).first()
    if not stock:
        return None
    etfs = db.query(models.ETF).all()
    series = []
    for etf in etfs:
        holdings = (
            db.query(models.Holding)
            .filter(models.Holding.etf_id == etf.id, models.Holding.stock_id == stock.id)
            .order_by(models.Holding.date)
            .all()
        )
        if holdings:
            series.append({
                "etf": {"ticker": etf.ticker, "name": etf.name, "provider": etf.provider},
                "points": [{"date": h.date.isoformat(), "weight": h.weight, "shares": h.shares} for h in holdings],
            })
    return {
        "stock": {"ticker": stock.ticker, "name": stock.name, "sector": stock.sector},
        "series": series,
    }


def get_synchronized_increase(db: Session, date_from: datetime.date, date_to: datetime.date) -> list:
    etfs = db.query(models.ETF).all()
    stock_map: dict = {}

    for etf in etfs:
        has_from = db.query(models.Holding).filter(
            models.Holding.etf_id == etf.id, models.Holding.date == date_from
        ).first()
        has_to = db.query(models.Holding).filter(
            models.Holding.etf_id == etf.id, models.Holding.date == date_to
        ).first()
        if not has_from or not has_to:
            continue

        diff = compute_diff(db, etf.id, date_from, date_to)
        for item in diff["increased"]:
            ticker = item["stock"]["ticker"]
            if ticker not in stock_map:
                stock_map[ticker] = {"stock": item["stock"], "etfs": []}
            stock_map[ticker]["etfs"].append({
                "ticker": etf.ticker,
                "weight": item["weight"],
                "prev_weight": item["prev_weight"],
                "delta": item["delta"],
                "shares": item["shares"],
                "prev_shares": item["prev_shares"],
                "delta_shares": item["delta_shares"],
            })

    result = [
        {
            **v, 
            "count": len(v["etfs"]), 
            "total_delta": round(sum(e["delta"] for e in v["etfs"]), 2),
            "total_delta_shares": sum(e["delta_shares"] for e in v["etfs"])
        }
        for v in stock_map.values()
    ]
    return sorted(result, key=lambda x: (-x["count"], -(x["total_delta_shares"] or 0)))


def get_radar(db: Session, target_date: datetime.date, mode: str) -> list:
    etfs = db.query(models.ETF).all()
    stock_map: dict = {}

    for etf in etfs:
        prev = (
            db.query(models.Holding.date)
            .filter(models.Holding.etf_id == etf.id, models.Holding.date < target_date)
            .distinct()
            .order_by(models.Holding.date.desc())
            .first()
        )
        if not prev:
            continue
        diff = compute_diff(db, etf.id, prev[0], target_date)
        items = diff["added"] if mode == "buy" else diff["removed"]
        for item in items:
            ticker = item["stock"]["ticker"]
            if ticker not in stock_map:
                stock_map[ticker] = {"stock": item["stock"], "etfs": []}
            stock_map[ticker]["etfs"].append({"ticker": etf.ticker, "weight": item["weight"]})

    result = [{**v, "count": len(v["etfs"])} for v in stock_map.values()]
    return sorted(result, key=lambda x: (-x["count"], -sum(e["weight"] for e in x["etfs"])))


def get_unique_holdings(db: Session, target_date: datetime.date) -> list:
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

    etf_groups: dict = {}
    for item in stock_map.values():
        if len(item["etfs"]) == 1:
            etf_ticker = item["etfs"][0]["ticker"]
            if etf_ticker not in etf_groups:
                etf_groups[etf_ticker] = []
            etf_groups[etf_ticker].append({
                "stock": item["stock"],
                "weight": item["etfs"][0]["weight"],
            })

    result = [
        {"etf_ticker": t, "stocks": sorted(s, key=lambda x: -x["weight"])}
        for t, s in etf_groups.items()
    ]
    return sorted(result, key=lambda x: -len(x["stocks"]))


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
