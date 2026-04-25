import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Stock, StockTrendResponse, ETFTrendSeries } from '../../services/api';
import { NgxEchartsDirective } from 'ngx-echarts';
import { EChartsOption } from 'echarts';

const PROVIDER_COLORS: Record<string, string> = {
  '統一投信': '#2563eb',
  '群益投信': '#7c3aed',
  '安聯投信': '#ea580c',
  '野村投信': '#16a34a',
};
const PALETTE = ['#2563eb', '#7c3aed', '#ea580c', '#16a34a', '#db2777', '#f59e0b', '#06b6d4'];

@Component({
  selector: 'app-stock-trend',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  template: `
    <div class="page">
      <header>
        <div class="header-text">
          <h1>持股趨勢</h1>
          <p class="subtitle">查看個股在各 ETF 的歷史持倉比重變化</p>
        </div>
      </header>

      <!-- Search -->
      <div class="search-section">
        <div class="search-wrap" [class.open]="showDropdown && suggestions().length > 0">
          <span class="search-icon">🔍</span>
          <input
            class="search-input"
            placeholder="輸入股票代號或名稱，例如：2330 或 台積電"
            [(ngModel)]="searchText"
            (input)="onSearch()"
            (focus)="onFocus()"
            (blur)="onBlur()"
            autocomplete="off"
          />
          <span class="clear-btn" *ngIf="searchText" (mousedown)="clearSearch()">✕</span>
        </div>
        <div class="dropdown" *ngIf="showDropdown && suggestions().length > 0">
          <div class="dropdown-item"
            *ngFor="let s of suggestions()"
            (mousedown)="selectStock(s)">
            <span class="d-ticker">{{ s.ticker }}</span>
            <span class="d-name">{{ s.name }}</span>
            <span class="d-sector" *ngIf="s.sector">{{ s.sector }}</span>
          </div>
        </div>
        <div class="dropdown no-result" *ngIf="showDropdown && searchText.length >= 1 && suggestions().length === 0 && !searching">
          查無符合的個股
        </div>
      </div>

      <!-- Empty state -->
      <div class="empty-state" *ngIf="!trend() && !loading">
        <div class="empty-icon">📊</div>
        <p>請搜尋並選擇一檔個股</p>
        <p class="empty-sub">可查看其在各主動式ETF的持倉比重走勢</p>
      </div>

      <!-- Loading -->
      <div class="loading-state" *ngIf="loading">
        <div class="spinner"></div>
        <p>載入趨勢資料…</p>
      </div>

      <!-- Trend view -->
      <ng-container *ngIf="trend() && !loading">
        <!-- Stock header -->
        <div class="stock-header">
          <div class="stock-badges">
            <span class="badge-ticker">{{ trend()!.stock.ticker }}</span>
            <span class="badge-sector" *ngIf="trend()!.stock.sector">{{ trend()!.stock.sector }}</span>
          </div>
          <h2>{{ trend()!.stock.name }}</h2>
          <p class="held-by">被 <strong>{{ trend()!.series.length }}</strong> 檔 ETF 持有</p>
        </div>

        <!-- Chart card -->
        <div class="card chart-card">
          <div class="card-title">持倉比重走勢</div>
          <div echarts [options]="chartOption" class="chart"></div>
        </div>

        <!-- ETF breakdown table -->
        <div class="card table-card">
          <div class="card-title">各 ETF 持倉明細</div>
          <div class="etf-rows">
            <div class="etf-row" *ngFor="let s of trend()!.series; let i = index">
              <div class="etf-meta">
                <span class="etf-dot" [style.background]="seriesColor(s, i)"></span>
                <div>
                  <div class="etf-ticker">{{ s.etf.ticker }}</div>
                  <div class="etf-provider">{{ s.etf.provider }}</div>
                </div>
              </div>
              <div class="etf-points">
                <div class="point-chip" *ngFor="let p of s.points">
                  <div class="point-date">{{ p.date | slice:5 }}</div>
                  <div class="point-weight" [style.color]="seriesColor(s, i)">{{ p.weight | number:'1.2-2' }}%</div>
                </div>
              </div>
              <div class="etf-latest">
                <div class="latest-weight" [style.color]="seriesColor(s, i)">
                  {{ latestWeight(s) | number:'1.2-2' }}%
                </div>
                <div class="latest-label">最新</div>
              </div>
              <div class="etf-delta" *ngIf="s.points.length >= 2">
                <span class="delta-badge"
                  [class.pos]="delta(s) > 0"
                  [class.neg]="delta(s) < 0"
                  [class.neu]="delta(s) === 0">
                  {{ delta(s) > 0 ? '▲' : delta(s) < 0 ? '▼' : '─' }}
                  {{ delta(s) | number:'1.2-2' }}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .page { max-width: 960px; margin: 0 auto; }
    header { margin-bottom: 24px; }
    h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .subtitle { color: #64748b; font-size: 14px; }

    .search-section { position: relative; margin-bottom: 32px; }
    .search-wrap {
      display: flex; align-items: center; gap: 10px;
      background: white; border: 1.5px solid #e2e8f0; border-radius: 14px;
      padding: 12px 16px; transition: border-color 0.15s;
    }
    .search-wrap:focus-within, .search-wrap.open { border-color: #2563eb; box-shadow: 0 0 0 3px #eff6ff; }
    .search-wrap.open { border-radius: 14px 14px 0 0; }
    .search-icon { font-size: 15px; flex-shrink: 0; }
    .search-input {
      flex: 1; border: none; outline: none; font-size: 15px;
      background: transparent; color: #1e293b;
    }
    .clear-btn {
      font-size: 12px; color: #94a3b8; cursor: pointer; padding: 2px 4px;
      border-radius: 4px; transition: 0.15s;
    }
    .clear-btn:hover { color: #475569; background: #f1f5f9; }

    .dropdown {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 100;
      background: white; border: 1.5px solid #2563eb; border-top: none;
      border-radius: 0 0 14px 14px; overflow: hidden;
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    }
    .dropdown.no-result { padding: 14px 16px; font-size: 13px; color: #94a3b8; border-color: #e2e8f0; }
    .dropdown-item {
      display: flex; align-items: center; gap: 12px; padding: 11px 16px;
      cursor: pointer; transition: background 0.1s; font-size: 13px;
    }
    .dropdown-item:hover { background: #f8fafc; }
    .d-ticker { font-family: ui-monospace, monospace; font-weight: 700; color: #2563eb; min-width: 50px; }
    .d-name { font-weight: 600; color: #1e293b; flex: 1; }
    .d-sector { font-size: 11px; color: #94a3b8; background: #f1f5f9; padding: 2px 7px; border-radius: 20px; }

    .empty-state { text-align: center; padding: 100px 0; color: #94a3b8; }
    .empty-icon { font-size: 48px; margin-bottom: 16px; }
    .empty-state p { font-size: 15px; font-weight: 600; }
    .empty-sub { font-size: 13px !important; font-weight: 400 !important; margin-top: 6px; }

    .loading-state { display: flex; align-items: center; gap: 12px; padding: 60px 0; color: #94a3b8; }
    .spinner {
      width: 24px; height: 24px; border: 2px solid #f1f5f9; border-top-color: #2563eb;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }

    .stock-header { margin-bottom: 24px; }
    .stock-badges { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
    .badge-ticker {
      font-size: 13px; font-weight: 700; padding: 3px 10px; border-radius: 6px;
      background: #eff6ff; color: #2563eb; font-family: ui-monospace, monospace;
    }
    .badge-sector {
      font-size: 11px; padding: 3px 8px; border-radius: 6px;
      background: #f1f5f9; color: #64748b;
    }
    h2 { font-size: 26px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .held-by { font-size: 13px; color: #64748b; }
    .held-by strong { color: #2563eb; }

    .card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.04); margin-bottom: 20px; }
    .card-title { padding: 18px 22px; font-size: 15px; font-weight: 700; color: #1e293b; border-bottom: 1px solid #f1f5f9; }
    .chart { height: 360px; padding: 12px; }

    .etf-rows { display: flex; flex-direction: column; }
    .etf-row {
      display: flex; align-items: center; gap: 20px; padding: 16px 22px;
      border-top: 1px solid #f8fafc; flex-wrap: wrap;
    }
    .etf-row:first-child { border-top: none; }
    .etf-meta { display: flex; align-items: center; gap: 10px; min-width: 140px; }
    .etf-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .etf-ticker { font-family: ui-monospace, monospace; font-size: 12px; font-weight: 700; color: #334155; }
    .etf-provider { font-size: 11px; color: #94a3b8; margin-top: 2px; }

    .etf-points { display: flex; gap: 8px; flex: 1; flex-wrap: wrap; }
    .point-chip {
      background: #f8fafc; border-radius: 8px; padding: 6px 10px; text-align: center; min-width: 60px;
    }
    .point-date { font-size: 10px; color: #94a3b8; margin-bottom: 3px; }
    .point-weight { font-size: 12px; font-weight: 700; font-family: ui-monospace, monospace; }

    .etf-latest { text-align: right; min-width: 70px; }
    .latest-weight { font-size: 22px; font-weight: 800; line-height: 1; }
    .latest-label { font-size: 10px; color: #94a3b8; margin-top: 3px; }

    .etf-delta { min-width: 80px; text-align: right; }
    .delta-badge {
      display: inline-block; font-size: 12px; font-weight: 700;
      padding: 4px 10px; border-radius: 20px; font-family: ui-monospace, monospace;
    }
    .delta-badge.pos { color: #16a34a; background: #f0fdf4; }
    .delta-badge.neg { color: #dc2626; background: #fef2f2; }
    .delta-badge.neu { color: #94a3b8; background: #f1f5f9; }

    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class StockTrendComponent implements OnDestroy {
  searchText = '';
  showDropdown = false;
  searching = false;
  loading = false;
  suggestions = signal<Stock[]>([]);
  trend = signal<StockTrendResponse | null>(null);
  chartOption: EChartsOption = {};

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private api: ApiService) {}

  ngOnDestroy() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  onSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const q = this.searchText.trim();
    if (!q) {
      this.suggestions.set([]);
      this.showDropdown = false;
      return;
    }
    this.showDropdown = true;
    this.searching = true;
    this.searchTimer = setTimeout(() => {
      this.api.searchStocks(q).subscribe({
        next: (data) => {
          this.suggestions.set(data);
          this.searching = false;
        },
        error: () => {
          this.suggestions.set([]);
          this.searching = false;
        },
      });
    }, 300);
  }

  onFocus() {
    if (this.suggestions().length > 0) this.showDropdown = true;
  }

  onBlur() {
    setTimeout(() => (this.showDropdown = false), 150);
  }

  clearSearch() {
    this.searchText = '';
    this.suggestions.set([]);
    this.showDropdown = false;
    this.trend.set(null);
  }

  selectStock(stock: Stock) {
    this.searchText = `${stock.ticker} ${stock.name}`;
    this.showDropdown = false;
    this.suggestions.set([]);
    this.loading = true;
    this.trend.set(null);
    this.api.getStockTrend(stock.ticker).subscribe({
      next: (data) => {
        this.trend.set(data);
        this.buildChart(data);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private buildChart(data: StockTrendResponse) {
    const allDates = [
      ...new Set(data.series.flatMap((s) => s.points.map((p) => p.date))),
    ].sort();

    const series = data.series.map((s, i) => {
      const pointMap = new Map(s.points.map((p) => [p.date, p.weight]));
      return {
        name: s.etf.ticker,
        type: 'line' as const,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 2.5 },
        data: allDates.map((d) => pointMap.get(d) ?? null),
        connectNulls: false,
        color: this.seriesColor(s, i),
      };
    });

    this.chartOption = {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const date = params[0]?.axisValue ?? '';
          const lines = params
            .filter((p: any) => p.value !== null)
            .map((p: any) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></span>${p.seriesName}: <b>${Number(p.value).toFixed(2)}%</b>`)
            .join('<br/>');
          return `<div style="font-size:12px"><b>${date}</b><br/>${lines}</div>`;
        },
      },
      legend: {
        data: data.series.map((s) => s.etf.ticker),
        bottom: 0,
        textStyle: { fontSize: 12, color: '#64748b' },
      },
      grid: { top: 20, left: 50, right: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: allDates,
        axisLabel: { fontSize: 11, color: '#94a3b8' },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: '{value}%', fontSize: 11, color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series,
    };
  }

  seriesColor(s: ETFTrendSeries, idx: number): string {
    if (PROVIDER_COLORS[s.etf.provider]) return PROVIDER_COLORS[s.etf.provider];
    return PALETTE[idx % PALETTE.length];
  }

  latestWeight(s: ETFTrendSeries): number {
    return s.points[s.points.length - 1]?.weight ?? 0;
  }

  delta(s: ETFTrendSeries): number {
    if (s.points.length < 2) return 0;
    const diff = s.points[s.points.length - 1].weight - s.points[s.points.length - 2].weight;
    return Math.round(diff * 100) / 100;
  }
}
