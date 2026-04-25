from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import datetime

Base = declarative_base()

class ETF(Base):
    __tablename__ = "etfs"
    
    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, index=True)
    name = Column(String)
    provider = Column(String)
    inception_date = Column(Date, nullable=True)
    
    holdings = relationship("Holding", back_populates="etf")

class Stock(Base):
    __tablename__ = "stocks"
    
    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, index=True)
    name = Column(String)
    sector = Column(String, nullable=True)
    
    holdings = relationship("Holding", back_populates="stock")

class Holding(Base):
    __tablename__ = "holdings"
    
    id = Column(Integer, primary_key=True, index=True)
    etf_id = Column(Integer, ForeignKey("etfs.id"))
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    weight = Column(Float)  # Percentage
    shares = Column(Float, nullable=True)
    date = Column(Date, default=datetime.date.today)
    
    etf = relationship("ETF", back_populates="holdings")
    stock = relationship("Stock", back_populates="holdings")

class MarketData(Base):
    __tablename__ = "market_data"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_ticker = Column(String, index=True) # Can be ETF or Stock ticker
    price = Column(Float)
    nav = Column(Float, nullable=True)
    date = Column(DateTime, default=datetime.datetime.now)
