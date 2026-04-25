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

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'http://localhost:8000';
  
  // Use a signal to cache ETF list
  etfs = signal<ETF[]>([]);

  constructor(private http: HttpClient) { }

  getETFs(): Observable<ETF[]> {
    return this.http.get<ETF[]>(`${this.apiUrl}/etfs`).pipe(
      tap(data => this.etfs.set(data))
    );
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

  syncData(): Observable<any> {
    return this.http.post(`${this.apiUrl}/sync`, {});
  }
}
