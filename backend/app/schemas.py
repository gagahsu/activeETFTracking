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
