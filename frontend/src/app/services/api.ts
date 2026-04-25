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

export interface OverlapStock {
  stock: Stock;
  etfs: ETFWeightEntry[];
  count: number;
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
