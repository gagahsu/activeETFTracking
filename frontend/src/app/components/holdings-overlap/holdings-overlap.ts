import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, OverlapStock, ETFUniqueHoldings } from '../../services/api';
import { forkJoin } from 'rxjs';

const ETF_COLORS: Record<string, string> = {
  '統一投信': '#2563eb',
  '群益投信': '#7c3aed',
  '安聯投信': '#ea580c',
  '野村投信': '#16a34a',
};
const PALETTE = ['#2563eb', '#7c3aed', '#ea580c', '#16a34a', '#db2777', '#f59e0b', '#06b6d4'];

@Component({
  selector: 'app-holdings-overlap',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page">
      <header>
        <div class="header-text">
          <h1>持股重疊</h1>
          <p class="subtitle">比對多檔 ETF 之間的共同持股，以及各 ETF 的獨有持股</p>
        </div>
      </header>

      <!-- Controls -->
      <div class="controls">
        <div class="filter-label">至少被</div>
        <select [(ngModel)]="minCount" (change)="load()" class="select">
          <option *ngFor="let n of [2,3,4,5,6]" [value]="n">{{ n }} 檔</option>
        </select>
        <div class="filter-label">ETF 共同持有</div>
        <div class="count-badge">共同 {{ overlaps().length }} 檔</div>
        <div class="count-badge unique-badge">獨有 {{ totalUniqueCount() }} 檔</div>
      </div>

      <!-- Loading -->
      <div class="loading-state" *ngIf="loading">
        <div class="spinner"></div>
        <p>計算持股重疊中…</p>
      </div>

      <ng-container *ngIf="!loading">

        <!-- ── 共同持股區塊 ── -->
        <div class="matrix-card" *ngIf="pairMatrix.length > 0">
          <div class="card-title">ETF 兩兩重疊矩陣</div>
          <div class="matrix-grid">
            <div class="matrix-item" *ngFor="let pair of pairMatrix"
              [style.background]="pair.count > 5 ? etfColor(pair.a) + '14' : '#f8fafc'"
              [style.border-color]="pair.count > 5 ? etfColor(pair.a) + '40' : '#e2e8f0'">
              <div class="pair-labels">
                <span class="pair-tag" [style.color]="etfColor(pair.a)">{{ pair.a }}</span>
                <span class="pair-x">×</span>
                <span class="pair-tag" [style.color]="etfColor(pair.b)">{{ pair.b }}</span>
              </div>
              <div class="pair-count"
                [style.color]="pair.count > 5 ? etfColor(pair.a) : '#94a3b8'">{{ pair.count }}</div>
              <div class="pair-sub">共同持股</div>
            </div>
          </div>
        </div>

        <div class="section-header">
          <span class="section-title">共同持股清單</span>
          <span class="section-count">{{ overlaps().length }}</span>
        </div>

        <div class="overlap-list">
          <div class="overlap-item" *ngFor="let stock of overlaps()">
            <div class="stock-info">
              <div class="stock-name-row">
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
            <div class="hold-count">
              <div class="hold-num" [style.color]="stock.count >= 4 ? '#2563eb' : '#94a3b8'">{{ stock.count }}</div>
              <div class="hold-label">ETF 持有</div>
            </div>
          </div>
          <div class="empty-msg" *ngIf="overlaps().length === 0">無符合條件的共同持股</div>
        </div>

        <!-- ── 獨有持股區塊 ── -->
        <div class="divider"></div>

        <div class="section-header">
          <span class="section-title">獨有持股</span>
          <span class="section-sub">各 ETF 獨家持有、其他 ETF 均未持有的個股</span>
        </div>

        <div class="unique-grid">
          <div class="unique-card" *ngFor="let group of uniqueHoldings()"
            [style.border-color]="etfColor(group.etf_ticker) + '50'"
            [style.background]="'white'">
            <!-- Card header -->
            <div class="unique-header" [style.border-bottom-color]="etfColor(group.etf_ticker) + '30'">
              <span class="unique-badge-ticker"
                [style.color]="etfColor(group.etf_ticker)"
                [style.background]="etfColor(group.etf_ticker) + '16'">
                {{ group.etf_ticker }}
              </span>
              <span class="unique-etf-name">{{ etfName(group.etf_ticker) }}</span>
              <span class="unique-stock-count" [style.color]="etfColor(group.etf_ticker)">
                {{ group.stocks.length }} 檔獨有
              </span>
            </div>
            <!-- Stock list -->
            <div class="unique-stock-list">
              <div class="unique-stock" *ngFor="let s of group.stocks">
                <div class="us-left">
                  <span class="us-name">{{ s.stock.name }}</span>
                  <span class="us-ticker">{{ s.stock.ticker }}</span>
                  <span class="us-sector" *ngIf="s.stock.sector">{{ s.stock.sector }}</span>
                </div>
                <span class="us-weight" [style.color]="etfColor(group.etf_ticker)">
                  {{ s.weight | number:'1.2-2' }}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="empty-msg" *ngIf="uniqueHoldings().length === 0">
          無獨有持股（所有個股均被多檔 ETF 共同持有）
        </div>

      </ng-container>
    </div>
  `,
  styles: [`
    .page { max-width: 1000px; margin: 0 auto; }

    header { margin-bottom: 24px; }
    h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .subtitle { color: #64748b; font-size: 14px; }

    .controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 28px; }
    .filter-label { font-size: 13px; color: #64748b; }
    .select {
      background: white; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 7px 10px; font-size: 13px; outline: none; cursor: pointer;
    }
    .count-badge {
      font-size: 13px; font-weight: 700; color: #2563eb;
      background: #eff6ff; padding: 6px 14px; border-radius: 20px;
    }
    .count-badge:first-of-type { margin-left: auto; }
    .unique-badge { color: #7c3aed; background: #f5f3ff; }

    .loading-state { display: flex; align-items: center; gap: 12px; padding: 60px 0; color: #94a3b8; }
    .spinner {
      width: 24px; height: 24px; border: 2px solid #f1f5f9; border-top-color: #2563eb;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }

    /* Matrix */
    .matrix-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 16px;
      padding: 20px; margin-bottom: 28px; box-shadow: 0 1px 6px rgba(0,0,0,0.04);
    }
    .card-title { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 16px; }
    .matrix-grid { display: flex; flex-wrap: wrap; gap: 10px; }
    .matrix-item { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; min-width: 150px; }
    .pair-labels { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
    .pair-tag { font-size: 12px; font-weight: 700; }
    .pair-x { font-size: 11px; color: #94a3b8; }
    .pair-count { font-size: 28px; font-weight: 800; line-height: 1; }
    .pair-sub { font-size: 10px; color: #94a3b8; margin-top: 3px; }

    /* Section headers */
    .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
    .section-title { font-size: 15px; font-weight: 700; color: #1e293b; }
    .section-count {
      font-size: 13px; font-weight: 700; color: #2563eb;
      background: #eff6ff; padding: 2px 10px; border-radius: 20px;
    }
    .section-sub { font-size: 12px; color: #94a3b8; margin-left: 4px; }

    /* Common overlap list */
    .overlap-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 0; }
    .overlap-item {
      background: white; border: 1px solid #e2e8f0; border-radius: 14px;
      padding: 16px 20px; display: flex; align-items: flex-start; gap: 20px; flex-wrap: wrap;
      box-shadow: 0 1px 4px rgba(0,0,0,0.03);
    }
    .stock-info { min-width: 180px; }
    .stock-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
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
    .hold-count { text-align: right; flex-shrink: 0; }
    .hold-num { font-size: 28px; font-weight: 800; line-height: 1; }
    .hold-label { font-size: 10px; color: #94a3b8; margin-top: 3px; }

    /* Divider */
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 28px; }

    /* Unique holdings grid */
    .unique-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .unique-card {
      border: 1px solid; border-radius: 16px; overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    .unique-header {
      display: flex; align-items: center; gap: 10px; padding: 14px 16px;
      border-bottom: 1px solid; background: #fafafa; flex-wrap: wrap;
    }
    .unique-badge-ticker {
      font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 6px;
      font-family: ui-monospace, monospace; flex-shrink: 0;
    }
    .unique-etf-name { font-size: 12px; color: #64748b; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .unique-stock-count { font-size: 12px; font-weight: 700; flex-shrink: 0; }
    .unique-stock-list { padding: 8px 0; max-height: 280px; overflow-y: auto; }
    .unique-stock-list::-webkit-scrollbar { width: 3px; }
    .unique-stock-list::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }
    .unique-stock {
      display: flex; align-items: center; padding: 8px 16px; gap: 8px;
      border-bottom: 1px solid #f8fafc; transition: background 0.1s;
    }
    .unique-stock:last-child { border-bottom: none; }
    .unique-stock:hover { background: #f8fafc; }
    .us-left { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; flex-wrap: wrap; }
    .us-name { font-size: 13px; font-weight: 600; color: #1e293b; }
    .us-ticker {
      font-family: ui-monospace, monospace; font-size: 10px; color: #94a3b8;
      background: #f1f5f9; padding: 1px 5px; border-radius: 3px;
    }
    .us-sector { font-size: 10px; color: #cbd5e1; }
    .us-weight {
      font-size: 12px; font-weight: 700; font-family: ui-monospace, monospace;
      flex-shrink: 0;
    }

    .empty-msg { text-align: center; padding: 40px 0; color: #94a3b8; font-size: 14px; }

    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class HoldingsOverlapComponent implements OnInit {
  minCount = 2;
  loading = false;
  overlaps = signal<OverlapStock[]>([]);
  uniqueHoldings = signal<ETFUniqueHoldings[]>([]);
  pairMatrix: { a: string; b: string; count: number }[] = [];

  constructor(public api: ApiService) {}

  ngOnInit() {
    if (this.api.etfs().length === 0) {
      this.api.getETFs().subscribe(() => this.load());
    } else {
      this.load();
    }
  }

  load() {
    this.loading = true;
    forkJoin({
      overlap: this.api.getOverlap(undefined, this.minCount),
      unique: this.api.getUniqueHoldings(),
    }).subscribe({
      next: ({ overlap, unique }) => {
        this.overlaps.set(overlap);
        this.buildMatrix(overlap);
        this.uniqueHoldings.set(unique);
        this.loading = false;
      },
      error: () => {
        this.overlaps.set([]);
        this.uniqueHoldings.set([]);
        this.loading = false;
      },
    });
  }

  totalUniqueCount(): number {
    return this.uniqueHoldings().reduce((s, g) => s + g.stocks.length, 0);
  }

  private buildMatrix(overlaps: OverlapStock[]) {
    const tickers = [...new Set(overlaps.flatMap((o) => o.etfs.map((e) => e.ticker)))];
    const matrix: { a: string; b: string; count: number }[] = [];
    for (let i = 0; i < tickers.length; i++) {
      for (let j = i + 1; j < tickers.length; j++) {
        const a = tickers[i], b = tickers[j];
        const count = overlaps.filter(
          (o) => o.etfs.some((e) => e.ticker === a) && o.etfs.some((e) => e.ticker === b),
        ).length;
        matrix.push({ a, b, count });
      }
    }
    this.pairMatrix = matrix.sort((x, y) => y.count - x.count);
  }

  etfColor(ticker: string): string {
    const etf = this.api.etfs().find((e) => e.ticker === ticker);
    if (etf && ETF_COLORS[etf.provider]) return ETF_COLORS[etf.provider];
    const idx = this.api.etfs().findIndex((e) => e.ticker === ticker);
    return PALETTE[Math.max(idx, 0) % PALETTE.length];
  }

  etfName(ticker: string): string {
    return this.api.etfs().find((e) => e.ticker === ticker)?.name ?? ticker;
  }
}
