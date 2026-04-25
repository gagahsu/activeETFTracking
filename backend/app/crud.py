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
    # Clear today's holdings for this ETF and re-insert
    today = datetime.date.today()
    db.query(models.Holding).filter(
        models.Holding.etf_id == etf_id,
        models.Holding.date == today
    ).delete()
    
    for h in holdings_data:
        # Check if stock exists
        db_stock = get_stock_by_ticker(db, h['stock_ticker'])
        if not db_stock:
            db_stock = create_stock(db, schemas.StockBase(
                ticker=h['stock_ticker'],
                name=h['stock_name']
            ))
        else:
            # Update name if it was garbled or changed
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
