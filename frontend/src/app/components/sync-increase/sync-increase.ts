import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, SyncIncreaseStock, ETFIncreaseEntry } from '../../services/api';

const PROVIDER_COLORS: Record<string, string> = {
  '統一投信': '#2563eb',
  '群益投信': '#7c3aed',
  '安聯投信': '#ea580c',
  '野村投信': '#16a34a',
};
const PALETTE = ['#2563eb', '#7c3aed', '#ea580c', '#16a34a', '#db2777', '#f59e0b', '#06b6d4'];

@Component({
  selector: 'app-sync-increase',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <header>
        <div class="header-text">
          <h1>同步加碼</h1>
          <p class="subtitle">指定時間區間，找出各 ETF 同步提高比重的個股</p>
        </div>
      </header>

      <!-- Controls -->
      <div class="controls">
        <div class="date-group">
          <label class="ctrl-label">起始日期</label>
          <select [(ngModel)]="dateFrom" (change)="load()" class="select">
            <option *ngFor="let d of availableDates" [value]="d">{{ d }}</option>
          </select>
        </div>
        <div class="arrow">→</div>
        <div class="date-group">
          <label class="ctrl-label">結束日期</label>
          <select [(ngModel)]="dateTo" (change)="load()" class="select">
            <option *ngFor="let d of availableDates" [value]="d">{{ d }}</option>
          </select>
        </div>
        <div class="count-badge">找到 {{ items().length }} 檔個股</div>
      </div>

      <!-- Date error -->
      <div class="date-error" *ngIf="dateFrom >= dateTo && dateFrom && dateTo">
        起始日期必須早於結束日期
      </div>

      <!-- Loading -->
      <div class="loading-state" *ngIf="loading">
        <div class="spinner"></div>
        <p>比對加碼資料中…</p>
      </div>

      <ng-container *ngIf="!loading">
        <!-- Summary -->
        <div class="summary-bar" *ngIf="items().length > 0">
          <div class="stat-card">
            <div class="stat-value">{{ items().length }}</div>
            <div class="stat-label">同步加碼個股</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ multiEtfCount() }}</div>
            <div class="stat-label">被 ≥2 ETF 加碼</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ topDelta() | number:'1.2-2' }}%</div>
            <div class="stat-label">最大合計加碼幅度</div>
          </div>
        </div>

        <!-- Empty state -->
        <div class="empty-full" *ngIf="items().length === 0 && dateFrom && dateTo && dateFrom < dateTo">
          <div class="empty-icon">📭</div>
          <p>此區間無同步加碼個股</p>
          <p class="empty-sub">嘗試選擇更長的時間區間</p>
        </div>

        <!-- Section header -->
        <div class="section-header" *ngIf="items().length > 0">
          <span class="section-title">加碼個股清單</span>
          <span class="section-hint">依加碼 ETF 數排序，同數量者依合計加碼幅度排序</span>
        </div>

        <!-- Stock list -->
        <div class="item-list">
          <div class="stock-card" *ngFor="let item of items()"
            [class.multi]="item.count >= 2">

            <div class="stock-info">
              <div class="name-row">
                <span class="multi-badge" *ngIf="item.count >= 2">{{ item.count }} ETF</span>
                <span class="stock-name">{{ item.stock.name }}</span>
                <span class="stock-ticker">{{ item.stock.ticker }}</span>
              </div>
              <span class="sector-tag" *ngIf="item.stock.sector">{{ item.stock.sector }}</span>
            </div>

            <div class="etf-list">
              <div class="etf-entry" *ngFor="let e of item.etfs"
                [style.border-color]="etfColor(e.ticker) + '40'"
                [style.background]="etfColor(e.ticker) + '0d'">
                <span class="etf-code" [style.color]="etfColor(e.ticker)">{{ e.ticker }}</span>
                <div class="weight-change">
                  <span class="prev-w">{{ e.prev_weight | number:'1.2-2' }}%</span>
                  <span class="arrow-right">→</span>
                  <span class="curr-w" [style.color]="etfColor(e.ticker)">{{ e.weight | number:'1.2-2' }}%</span>
                </div>
                <span class="delta-pill">▲ {{ e.delta | number:'1.2-2' }}%</span>
              </div>
            </div>

            <div class="total-col">
              <div class="total-delta">▲ {{ item.total_delta | number:'1.2-2' }}%</div>
              <div class="total-label">合計加碼</div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .page { max-width: 1020px; margin: 0 auto; }
    header { margin-bottom: 24px; }
    h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .subtitle { color: #64748b; font-size: 14px; }

    .controls {
      display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;
    }
    .date-group { display: flex; flex-direction: column; gap: 5px; }
    .ctrl-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
    .select {
      background: white; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 8px 12px; font-size: 13px; outline: none; cursor: pointer;
      font-weight: 600; color: #1e293b;
    }
    .arrow { font-size: 16px; color: #94a3b8; padding-bottom: 8px; }
    .count-badge {
      margin-left: auto; font-size: 13px; font-weight: 700; color: #16a34a;
      background: #f0fdf4; padding: 8px 16px; border-radius: 20px; border: 1px solid #bbf7d0;
    }

    .date-error {
      background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;
      border-radius: 10px; padding: 10px 16px; font-size: 13px; margin-bottom: 20px;
    }

    .loading-state { display: flex; align-items: center; gap: 12px; padding: 60px 0; color: #94a3b8; }
    .spinner {
      width: 24px; height: 24px; border: 2px solid #f1f5f9; border-top-color: #16a34a;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }

    .summary-bar { display: flex; gap: 14px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 14px;
      padding: 16px 20px; min-width: 130px; flex: 1;
    }
    .stat-value {
      font-size: 26px; font-weight: 800; color: #16a34a; line-height: 1; margin-bottom: 6px;
      font-family: ui-monospace, monospace;
    }
    .stat-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }

    .empty-full { text-align: center; padding: 80px 0; color: #94a3b8; }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }
    .empty-full p { font-size: 14px; font-weight: 600; }
    .empty-sub { font-size: 12px !important; font-weight: 400 !important; margin-top: 4px; }

    .section-header {
      display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap;
    }
    .section-title { font-size: 15px; font-weight: 700; color: #1e293b; }
    .section-hint { font-size: 11px; color: #94a3b8; margin-left: auto; }

    .item-list { display: flex; flex-direction: column; gap: 10px; }

    .stock-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 14px;
      padding: 16px 20px; display: flex; align-items: flex-start; gap: 20px; flex-wrap: wrap;
      box-shadow: 0 1px 4px rgba(0,0,0,0.03);
    }
    .stock-card.multi { border-color: #bbf7d0; background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%); }

    .stock-info { min-width: 180px; }
    .name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
    .multi-badge {
      font-size: 11px; font-weight: 700; color: #16a34a;
      background: #dcfce7; padding: 2px 7px; border-radius: 20px;
    }
    .stock-name { font-size: 16px; font-weight: 700; color: #1e293b; }
    .stock-ticker {
      font-family: ui-monospace, monospace; font-size: 11px; color: #64748b;
      background: #f1f5f9; padding: 2px 6px; border-radius: 4px;
    }
    .sector-tag { font-size: 11px; color: #94a3b8; }

    .etf-list { display: flex; flex-wrap: wrap; gap: 8px; flex: 1; align-items: center; }
    .etf-entry {
      display: flex; align-items: center; gap: 8px;
      border: 1px solid; border-radius: 10px; padding: 7px 12px;
    }
    .etf-code { font-size: 11px; font-weight: 700; }
    .weight-change {
      display: flex; align-items: center; gap: 4px; font-size: 11px;
      font-family: ui-monospace, monospace;
    }
    .prev-w { color: #94a3b8; }
    .arrow-right { color: #cbd5e1; font-size: 10px; }
    .curr-w { font-weight: 700; }
    .delta-pill {
      font-size: 11px; font-weight: 700; color: #16a34a;
      background: #dcfce7; padding: 2px 7px; border-radius: 20px;
      font-family: ui-monospace, monospace;
    }

    .total-col { text-align: right; flex-shrink: 0; min-width: 90px; }
    .total-delta {
      font-size: 22px; font-weight: 800; color: #16a34a; line-height: 1;
      font-family: ui-monospace, monospace;
    }
    .total-label { font-size: 10px; color: #94a3b8; margin-top: 3px; }

    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class SyncIncreaseComponent implements OnInit {
  availableDates: string[] = [];
  dateFrom = '';
  dateTo = '';
  loading = false;
  items = signal<SyncIncreaseStock[]>([]);

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getAllDates().subscribe((dates) => {
      this.availableDates = dates;
      if (dates.length >= 2) {
        this.dateTo = dates[0];
        this.dateFrom = dates[1];
        this.load();
      } else if (dates.length === 1) {
        this.dateTo = dates[0];
        this.dateFrom = dates[0];
      }
    });
  }

  load() {
    if (!this.dateFrom || !this.dateTo || this.dateFrom >= this.dateTo) return;
    this.loading = true;
    this.api.getSyncIncrease(this.dateFrom, this.dateTo).subscribe({
      next: (data) => { this.items.set(data); this.loading = false; },
      error: () => { this.items.set([]); this.loading = false; },
    });
  }

  multiEtfCount(): number {
    return this.items().filter((i) => i.count >= 2).length;
  }

  topDelta(): number {
    return this.items()[0]?.total_delta ?? 0;
  }

  etfColor(ticker: string): string {
    const etf = this.api.etfs().find((e) => e.ticker === ticker);
    if (etf && PROVIDER_COLORS[etf.provider]) return PROVIDER_COLORS[etf.provider];
    const idx = this.api.etfs().findIndex((e) => e.ticker === ticker);
    return PALETTE[Math.max(idx, 0) % PALETTE.length];
  }
}
