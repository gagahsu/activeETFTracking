import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, OverlapStock, ETF } from '../../services/api';
import { Subscription } from 'rxjs';

const ETF_COLORS: Record<string, string> = {
  '統一投信': '#2563eb',
  '群益投信': '#7c3aed',
  '安聯投信': '#ea580c',
  '野村投信': '#16a34a',
};
const PALETTE = ['#2563eb', '#7c3aed', '#ea580c', '#16a34a', '#db2777', '#f59e0b', '#06b6d4'];

@Component({
  selector: 'app-radar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page">
      <header>
        <div class="mode-tabs">
          <button class="mode-tab" [class.active]="mode === 'buy'" (click)="switchMode('buy')">
            <span class="tab-icon">📈</span>
            <span>新增雷達</span>
          </button>
          <button class="mode-tab sell" [class.active]="mode === 'sell'" (click)="switchMode('sell')">
            <span class="tab-icon">📉</span>
            <span>賣出雷達</span>
          </button>
        </div>
        <div class="header-meta">
          <h1>{{ mode === 'buy' ? '新增雷達' : '賣出雷達' }}</h1>
          <p class="subtitle">{{ mode === 'buy' ? '多檔 ETF 同步新買入個股' : '多檔 ETF 同步賣出個股' }}</p>
        </div>
      </header>

      <!-- Controls -->
      <div class="controls">
        <div class="date-group">
          <label class="ctrl-label">資料日期</label>
          <select [(ngModel)]="selectedDate" (change)="load()" class="select">
            <option *ngFor="let d of availableDates" [value]="d">{{ d }}</option>
          </select>
        </div>
        <div class="count-badge" [class.sell-badge]="mode === 'sell'">
          找到 {{ items().length }} 檔個股
        </div>
      </div>

      <!-- Loading -->
      <div class="loading-state" *ngIf="loading">
        <div class="spinner" [class.sell-spin]="mode === 'sell'"></div>
        <p>{{ mode === 'buy' ? '分析買入訊號…' : '分析賣出訊號…' }}</p>
      </div>

      <ng-container *ngIf="!loading">
        <!-- No data -->
        <div class="empty-full" *ngIf="items().length === 0">
          <div class="empty-icon">{{ mode === 'buy' ? '📭' : '🔍' }}</div>
          <p>{{ mode === 'buy' ? '此日期無多 ETF 同步新增持股' : '此日期無多 ETF 同步賣出持股' }}</p>
          <p class="empty-sub">嘗試選擇其他日期</p>
        </div>

        <!-- All stocks (including single-ETF) -->
        <div class="section-header" *ngIf="items().length > 0">
          <span class="section-title">{{ mode === 'buy' ? '新增個股清單' : '賣出個股清單' }}</span>
          <span class="section-count" [class.sell-count]="mode === 'sell'">{{ items().length }}</span>
        </div>

        <div class="item-list">
          <div class="radar-item" *ngFor="let stock of items()"
            [class.highlight]="stock.count >= 2"
            [class.sell-highlight]="stock.count >= 2 && mode === 'sell'">
            <div class="stock-info">
              <div class="stock-name-row">
                <span class="multi-badge" *ngIf="stock.count >= 2"
                  [class.sell-multi]="mode === 'sell'">
                  {{ stock.count }} ETF
                </span>
                <span class="stock-name">{{ stock.stock.name }}</span>
                <span class="stock-ticker">{{ stock.stock.ticker }}</span>
              </div>
              <span class="sector-tag" *ngIf="stock.stock.sector">{{ stock.stock.sector }}</span>
            </div>
            <div class="etf-tags">
              <div class="etf-tag" *ngFor="let e of stock.etfs"
                [style.color]="etfColor(e.ticker)"
                [style.background]="etfColor(e.ticker) + '14'"
                [style.border-color]="etfColor(e.ticker) + '30'">
                <span class="etf-code">{{ e.ticker }}</span>
                <span class="etf-weight">{{ e.weight | number:'1.2-2' }}%</span>
              </div>
            </div>
            <div class="total-weight">
              <div class="weight-num" [style.color]="mode === 'buy' ? '#2563eb' : '#dc2626'">
                {{ totalWeight(stock) | number:'1.2-2' }}%
              </div>
              <div class="weight-label">合計權重</div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .page { max-width: 1000px; margin: 0 auto; }

    header { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
    .mode-tabs { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
    .mode-tab {
      display: flex; align-items: center; gap: 8px; padding: 10px 18px;
      border: 2px solid #e2e8f0; border-radius: 12px; background: white;
      font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; transition: 0.15s;
    }
    .mode-tab:hover { border-color: #bfdbfe; color: #2563eb; background: #eff6ff; }
    .mode-tab.active { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
    .mode-tab.sell.active { border-color: #dc2626; color: #dc2626; background: #fef2f2; }
    .mode-tab.sell:hover { border-color: #fca5a5; color: #dc2626; background: #fef2f2; }
    .tab-icon { font-size: 16px; }

    .header-meta { flex: 1; }
    h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .subtitle { color: #64748b; font-size: 14px; }

    .controls {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 28px;
    }
    .date-group { display: flex; align-items: center; gap: 10px; }
    .ctrl-label { font-size: 13px; color: #64748b; white-space: nowrap; }
    .select {
      background: white; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 7px 12px; font-size: 13px; outline: none; cursor: pointer;
    }
    .count-badge {
      margin-left: auto; font-size: 13px; font-weight: 700; color: #2563eb;
      background: #eff6ff; padding: 6px 14px; border-radius: 20px;
    }
    .count-badge.sell-badge { color: #dc2626; background: #fef2f2; }

    .loading-state { display: flex; align-items: center; gap: 12px; padding: 60px 0; color: #94a3b8; }
    .spinner {
      width: 24px; height: 24px; border: 2px solid #f1f5f9; border-top-color: #2563eb;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    .spinner.sell-spin { border-top-color: #dc2626; }

    .empty-full { text-align: center; padding: 80px 0; color: #94a3b8; }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }
    .empty-sub { font-size: 12px; margin-top: 4px; }

    .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .section-title { font-size: 15px; font-weight: 700; color: #1e293b; }
    .section-count {
      font-size: 13px; font-weight: 700; color: #2563eb;
      background: #eff6ff; padding: 2px 10px; border-radius: 20px;
    }
    .section-count.sell-count { color: #dc2626; background: #fef2f2; }

    .item-list { display: flex; flex-direction: column; gap: 10px; }
    .radar-item {
      background: white; border: 1px solid #e2e8f0; border-radius: 14px;
      padding: 16px 20px; display: flex; align-items: flex-start; gap: 20px; flex-wrap: wrap;
      box-shadow: 0 1px 4px rgba(0,0,0,0.03); transition: border-color 0.15s;
    }
    .radar-item.highlight { border-color: #bfdbfe; background: #fafcff; }
    .radar-item.sell-highlight { border-color: #fca5a5; background: #fff8f8; }

    .stock-info { min-width: 180px; }
    .stock-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
    .multi-badge {
      font-size: 11px; font-weight: 700; color: #2563eb;
      background: #eff6ff; padding: 2px 7px; border-radius: 20px;
    }
    .multi-badge.sell-multi { color: #dc2626; background: #fef2f2; }
    .stock-name { font-size: 16px; font-weight: 700; color: #1e293b; }
    .stock-ticker {
      font-family: ui-monospace, monospace; font-size: 11px; color: #64748b;
      background: #f1f5f9; padding: 2px 6px; border-radius: 4px;
    }
    .sector-tag { font-size: 11px; color: #94a3b8; }

    .etf-tags { display: flex; flex-wrap: wrap; gap: 8px; flex: 1; align-items: center; }
    .etf-tag {
      display: flex; align-items: center; gap: 6px;
      border: 1px solid; border-radius: 8px; padding: 5px 10px;
    }
    .etf-code { font-size: 11px; font-weight: 700; }
    .etf-weight { font-family: ui-monospace, monospace; font-size: 12px; font-weight: 600; color: #334155; }

    .total-weight { text-align: right; flex-shrink: 0; min-width: 80px; }
    .weight-num { font-size: 22px; font-weight: 800; line-height: 1; }
    .weight-label { font-size: 10px; color: #94a3b8; margin-top: 3px; }

    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class RadarComponent implements OnInit, OnDestroy {
  mode: 'buy' | 'sell' = 'buy';
  loading = false;
  items = signal<OverlapStock[]>([]);
  availableDates: string[] = [];
  selectedDate = '';
  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public api: ApiService,
  ) {}

  ngOnInit() {
    this.sub = this.route.url.subscribe((segments) => {
      this.mode = segments[1]?.path === 'sell' ? 'sell' : 'buy';
      this.loadDates();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  private loadDates() {
    this.api.getRadar(this.mode).subscribe({
      next: () => {},
      error: () => {},
    });
    // Fetch available dates from any ETF that has data
    const etfs = this.api.etfs();
    if (etfs.length > 0) {
      this.api.getAvailableDates(etfs[0].ticker).subscribe((dates) => {
        this.availableDates = dates;
        this.selectedDate = dates[0] ?? '';
        if (this.selectedDate) this.load();
      });
    } else {
      this.api.getETFs().subscribe((etfs) => {
        if (etfs.length > 0) {
          this.api.getAvailableDates(etfs[0].ticker).subscribe((dates) => {
            this.availableDates = dates;
            this.selectedDate = dates[0] ?? '';
            if (this.selectedDate) this.load();
          });
        }
      });
    }
  }

  load() {
    if (!this.selectedDate) return;
    this.loading = true;
    this.api.getRadar(this.mode, this.selectedDate).subscribe({
      next: (data) => {
        this.items.set(data);
        this.loading = false;
      },
      error: () => {
        this.items.set([]);
        this.loading = false;
      },
    });
  }

  switchMode(mode: 'buy' | 'sell') {
    if (this.mode === mode) return;
    this.router.navigateByUrl(`/radar/${mode}`);
  }

  totalWeight(stock: OverlapStock): number {
    return stock.etfs.reduce((s, e) => s + e.weight, 0);
  }

  etfColor(ticker: string): string {
    const etf = this.api.etfs().find((e) => e.ticker === ticker);
    if (etf && ETF_COLORS[etf.provider]) return ETF_COLORS[etf.provider];
    const idx = this.api.etfs().findIndex((e) => e.ticker === ticker);
    return PALETTE[idx % PALETTE.length];
  }
}
