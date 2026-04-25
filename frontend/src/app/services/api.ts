import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface ETF {
  id: number;
  ticker: string;
  name: string;
  provider: string;
}

export interface Stock {
  ticker: string;
  name: string;
  sector?: string;
}

export interface Holding {
  id: number;
  stock: Stock;
  weight: number;
  shares: number;
  date: string;
}

export interface ETFDetail extends ETF {
  holdings: Holding[];
}

export interface HoldingChange {
  stock: Stock;
  weight: number;
  prev_weight?: number;
  delta?: number;
  shares?: number;
}

export interface HoldingsDiff {
  date1: string | null;
  date2: string;
  added: HoldingChange[];
  increased: HoldingChange[];
  decreased: HoldingChange[];
  removed: HoldingChange[];
  unchanged: HoldingChange[];
}

export interface ETFWeightEntry {
  ticker: string;
  weight: number;
}

export interface ETFIncreaseEntry {
  ticker: string;
  weight: number;
  prev_weight: number;
  delta: number;
}

export interface SyncIncreaseStock {
  stock: Stock;
  etfs: ETFIncreaseEntry[];
  count: number;
  total_delta: number;
}

export interface OverlapStock {
  stock: Stock;
  etfs: ETFWeightEntry[];
  count: number;
}

export interface TrendPoint {
  date: string;
  weight: number;
  shares?: number;
}

export interface ETFSummary {
  ticker: string;
  name: string;
  provider: string;
}

export interface ETFTrendSeries {
  etf: ETFSummary;
  points: TrendPoint[];
}

export interface StockTrendResponse {
  stock: Stock;
  series: ETFTrendSeries[];
}

export interface CandlePoint {
  date: string; open: number; high: number; close: number; low: number; volume: number;
}
export interface MAPoint { date: string; value: number; }
export interface BollingerPoint { date: string; upper: number; middle: number; lower: number; }
export interface RSIPoint { date: string; value: number; }
export interface MACDPoint { date: string; macd: number; signal?: number; histogram?: number; }
export interface ETFChartData {
  ticker: string;
  signal: string;
  signal_reason: string;
  candles: CandlePoint[];
  ma5: MAPoint[];
  ma20: MAPoint[];
  bollinger: BollingerPoint[];
  rsi: RSIPoint[];
  macd: MACDPoint[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private apiUrl = 'http://localhost:8000';

  etfs = signal<ETF[]>([]);

  constructor(private http: HttpClient) {}

  getETFs(): Observable<ETF[]> {
    return this.http.get<ETF[]>(`${this.apiUrl}/etfs`).pipe(tap((data) => this.etfs.set(data)));
  }

  getETFDetail(ticker: string): Observable<ETFDetail> {
    return this.http.get<ETFDetail>(`${this.apiUrl}/etfs/${ticker}`);
  }

  getAvailableDates(ticker: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/etfs/${ticker}/dates`);
  }

  getHoldingsByDate(ticker: string, date: string): Observable<Holding[]> {
    return this.http.get<Holding[]>(`${this.apiUrl}/etfs/${ticker}/holdings/${date}`);
  }

  compareHoldings(ticker: string, date1?: string, date2?: string): Observable<HoldingsDiff> {
    let url = `${this.apiUrl}/etfs/${ticker}/compare`;
    const params: string[] = [];
    if (date1) params.push(`date1=${date1}`);
    if (date2) params.push(`date2=${date2}`);
    if (params.length) url += '?' + params.join('&');
    return this.http.get<HoldingsDiff>(url);
  }

  getETFChart(ticker: string, days = 90): Observable<ETFChartData> {
    return this.http.get<ETFChartData>(`${this.apiUrl}/etfs/${ticker}/chart?days=${days}`);
  }

  getAllDates(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/dates`);
  }

  getSyncIncrease(dateFrom?: string, dateTo?: string): Observable<SyncIncreaseStock[]> {
    const params: string[] = [];
    if (dateFrom) params.push(`date_from=${dateFrom}`);
    if (dateTo) params.push(`date_to=${dateTo}`);
    const qs = params.length ? '?' + params.join('&') : '';
    return this.http.get<SyncIncreaseStock[]>(`${this.apiUrl}/stocks/sync-increase${qs}`);
  }

  searchStocks(q: string): Observable<Stock[]> {
    return this.http.get<Stock[]>(`${this.apiUrl}/stocks/search?q=${encodeURIComponent(q)}`);
  }

  getStockTrend(ticker: string): Observable<StockTrendResponse> {
    return this.http.get<StockTrendResponse>(`${this.apiUrl}/stocks/trend?ticker=${encodeURIComponent(ticker)}`);
  }

  getRadar(mode: 'buy' | 'sell', date?: string): Observable<OverlapStock[]> {
    let url = `${this.apiUrl}/radar?mode=${mode}`;
    if (date) url += `&date=${date}`;
    return this.http.get<OverlapStock[]>(url);
  }

  getOverlap(date?: string, minCount = 2): Observable<OverlapStock[]> {
    let url = `${this.apiUrl}/etfs/overlap?min_count=${minCount}`;
    if (date) url += `&date=${date}`;
    return this.http.get<OverlapStock[]>(url);
  }

  syncData(): Observable<any> {
    return this.http.post(`${this.apiUrl}/sync`, {});
  }
}
