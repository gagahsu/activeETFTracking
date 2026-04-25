from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime

class HoldingBase(BaseModel):
    weight: float
    shares: Optional[float] = None
    date: date

class HoldingCreate(HoldingBase):
    etf_id: int
    stock_id: int

class StockBase(BaseModel):
    ticker: str
    name: str
    sector: Optional[str] = None

class Stock(StockBase):
    id: int

    class Config:
        from_attributes = True

class Holding(HoldingBase):
    id: int
    stock: Stock

    class Config:
        from_attributes = True

class ETFBase(BaseModel):
    ticker: str
    name: str
    provider: str
    inception_date: Optional[date] = None

class ETFCreate(ETFBase):
    pass

class ETF(ETFBase):
    id: int

    class Config:
        from_attributes = True

class ETFDetail(ETF):
    holdings: List[Holding] = []

class MarketDataBase(BaseModel):
    asset_ticker: str
    price: float
    nav: Optional[float] = None

class MarketData(MarketDataBase):
    id: int
    date: datetime

    class Config:
        from_attributes = True

# --- Diff / Compare schemas ---

class StockSummary(BaseModel):
    ticker: str
    name: str
    sector: Optional[str] = None

class HoldingChange(BaseModel):
    stock: StockSummary
    weight: float
    prev_weight: Optional[float] = None
    delta: Optional[float] = None
    shares: Optional[float] = None

class HoldingsDiff(BaseModel):
    date1: Optional[str] = None
    date2: str
    added: List[HoldingChange] = []
    increased: List[HoldingChange] = []
    decreased: List[HoldingChange] = []
    removed: List[HoldingChange] = []
    unchanged: List[HoldingChange] = []

# --- Overlap schemas ---

class ETFWeightEntry(BaseModel):
    ticker: str
    weight: float

class OverlapStock(BaseModel):
    stock: StockSummary
    etfs: List[ETFWeightEntry] = []
    count: int

class UniqueHoldingEntry(BaseModel):
    stock: StockSummary
    weight: float

class ETFUniqueHoldings(BaseModel):
    etf_ticker: str
    stocks: List[UniqueHoldingEntry]

# --- Sync increase schemas ---

class ETFIncreaseEntry(BaseModel):
    ticker: str
    weight: float
    prev_weight: float
    delta: float

class SyncIncreaseStock(BaseModel):
    stock: StockSummary
    etfs: List[ETFIncreaseEntry]
    count: int
    total_delta: float

# --- ETF technical chart schemas ---

class CandlePoint(BaseModel):
    date: str
    open: float
    high: float
    close: float
    low: float
    volume: float

class MAPoint(BaseModel):
    date: str
    value: float

class BollingerPoint(BaseModel):
    date: str
    upper: float
    middle: float
    lower: float

class RSIPoint(BaseModel):
    date: str
    value: float

class MACDPoint(BaseModel):
    date: str
    macd: float
    signal: Optional[float] = None
    histogram: Optional[float] = None

class ETFChartData(BaseModel):
    ticker: str
    signal: str
    signal_reason: str
    candles: List[CandlePoint]
    ma5: List[MAPoint]
    ma20: List[MAPoint]
    bollinger: List[BollingerPoint]
    rsi: List[RSIPoint]
    macd: List[MACDPoint]

# --- Stock trend schemas ---

class TrendPoint(BaseModel):
    date: str
    weight: float
    shares: Optional[float] = None

class ETFSummary(BaseModel):
    ticker: str
    name: str
    provider: str

class ETFTrendSeries(BaseModel):
    etf: ETFSummary
    points: List[TrendPoint]

class StockTrendResponse(BaseModel):
    stock: StockSummary
    series: List[ETFTrendSeries]
