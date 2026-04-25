import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, ETF, HoldingChange, HoldingsDiff } from '../../services/api';
import { Subscription, switchMap, forkJoin } from 'rxjs';

interface Section {
  title: string;
  icon: string;
  color: string;
  items: HoldingChange[];
  emptyMsg: string;
}

@Component({
  selector: 'app-holdings-changes',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page">
      <header>
        <a class="back-btn" (click)="goBack()">←</a>
        <div class="header-text">
          <h1>持股異動</h1>
          <p class="subtitle">與前一交易日相比的持股變化</p>
        </div>
      </header>

      <!-- Controls -->
      <div class="controls">
        <select [(ngModel)]="selectedTicker" (change)="onTickerChange()" class="select">
          <option *ngFor="let e of api.etfs()" [value]="e.ticker">{{ e.ticker }} {{ e.name }}</option>
        </select>
        <select [(ngModel)]="selectedDate" (change)="onDateChange()" class="select">
          <option *ngFor="let d of availableDates" [value]="d">{{ d }}</option>
        </select>
      </div>

      <!-- Loading -->
      <div class="loading-state" *ngIf="loading">
        <div class="spinner"></div>
        <p>載入中…</p>
      </div>

      <ng-container *ngIf="!loading && diff">
        <!-- Date comparison banner -->
        <div class="compare-banner" *ngIf="diff.date1">
          <span class="banner-label">比對區間：</span>
          <span class="date-chip prev">{{ diff.date1 }}</span>
          <span class="arrow">→</span>
          <span class="date-chip curr">{{ diff.date2 }}</span>
          <span class="etf-name">{{ currentEtf?.name }}</span>
        </div>
        <div class="compare-banner single" *ngIf="!diff.date1">
          <span class="banner-label">初始快照：</span>
          <span class="date-chip curr">{{ diff.date2 }}</span>
          <span class="etf-name">{{ currentEtf?.name }}（無前期資料）</span>
        </div>

        <!-- Summary pills -->
        <div class="summary-pills">
          <div class="pill" *ngFor="let s of summaryPills">
            <div class="pill-count" [style.color]="s.count > 0 ? s.color : '#cbd5e1'">{{ s.count }}</div>
            <div class="pill-label">{{ s.label }}</div>
          </div>
        </div>

        <!-- Sections -->
        <div *ngFor="let sec of sections">
          <div class="section-header">
            <span class="section-icon">{{ sec.icon }}</span>
            <span class="section-title">{{ sec.title }}</span>
            <span class="section-count" [style.color]="sec.color"
              [style.background]="sec.color + '18'">{{ sec.items.length }}</span>
          </div>
          <div class="cards-grid" *ngIf="sec.items.length > 0">
            <div class="change-card" *ngFor="let h of sec.items"
              [style.border-left-color]="sec.color"
              [style.border-color]="sec.color + '28'">
              <div class="change-info">
                <div class="change-name-row">
                  <span class="stock-name">{{ h.stock.name }}</span>
                  <span class="stock-ticker">{{ h.stock.ticker }}</span>
                </div>
                <span class="stock-sector" *ngIf="h.stock.sector">{{ h.stock.sector }}</span>
              </div>
              <div class="change-numbers">
                <div class="current-weight" [style.color]="sec.color">{{ h.weight | number:'1.2-2' }}%</div>
                <div class="delta" *ngIf="h.delta !== undefined && h.delta !== null" [style.color]="sec.color">
                  {{ h.delta > 0 ? '▲' : '▼' }} {{ (h.delta | number:'1.2-2') | slice:1 }}%
                </div>
                <div class="prev-weight" *ngIf="h.prev_weight !== undefined && h.prev_weight !== null && h.delta !== 0">
                  前：{{ h.prev_weight | number:'1.2-2' }}%
                </div>
              </div>
            </div>
          </div>
          <div class="empty-section" *ngIf="sec.items.length === 0">{{ sec.emptyMsg }}</div>
        </div>
      </ng-container>

      <div class="no-data" *ngIf="!loading && !diff">
        <p>尚無持股資料，請先點擊「同步最新持股」</p>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 960px; margin: 0 auto; }

    header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 28px; }
    .back-btn {
      width: 38px; height: 38px; background: white; border: 1px solid #e2e8f0;
      border-radius: 10px; display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #64748b; font-weight: bold; transition: 0.15s; flex-shrink: 0;
    }
    .back-btn:hover { background: #f8fafc; color: #2563eb; border-color: #cbd5e1; }
    h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .subtitle { color: #64748b; font-size: 14px; }

    .controls { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
    .select {
      background: white; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 9px 12px; font-size: 13px; color: #1e293b; cursor: pointer;
      outline: none; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }

    .loading-state { display: flex; align-items: center; gap: 12px; padding: 60px 0; color: #94a3b8; }
    .spinner {
      width: 24px; height: 24px; border: 2px solid #f1f5f9; border-top-color: #2563eb;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }

    .compare-banner {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px;
      padding: 12px 18px; margin-bottom: 24px;
    }
    .compare-banner.single { background: #f8fafc; border-color: #e2e8f0; }
    .banner-label { font-size: 13px; color: #475569; }
    .date-chip {
      font-family: ui-monospace, monospace; font-size: 13px; font-weight: 600;
      padding: 4px 12px; border-radius: 8px;
    }
    .date-chip.prev { background: white; border: 1px solid #e2e8f0; color: #64748b; }
    .date-chip.curr { background: #2563eb; color: white; }
    .arrow { color: #94a3b8; font-size: 16px; }
    .etf-name { font-size: 13px; color: #64748b; margin-left: auto; }

    .summary-pills { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 32px; }
    .pill {
      background: white; border: 1px solid #e2e8f0; border-radius: 14px;
      padding: 14px 22px; text-align: center; min-width: 90px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    .pill-count { font-size: 32px; font-weight: 800; line-height: 1; margin-bottom: 6px; }
    .pill-label { font-size: 11px; color: #94a3b8; font-weight: 600; }

    .section-header {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 14px; margin-top: 8px;
    }
    .section-icon { font-size: 18px; }
    .section-title { font-size: 16px; font-weight: 700; color: #1e293b; }
    .section-count {
      font-size: 13px; font-weight: 700; padding: 2px 10px; border-radius: 20px;
    }

    .cards-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 10px; margin-bottom: 28px;
    }
    .change-card {
      background: white; border: 1.5px solid #e2e8f0; border-left-width: 4px;
      border-radius: 12px; padding: 14px 16px;
      display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    }
    .change-info { flex: 1; min-width: 0; }
    .change-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
    .stock-name { font-size: 15px; font-weight: 700; color: #1e293b; }
    .stock-ticker {
      font-family: ui-monospace, monospace; font-size: 11px; color: #64748b;
      background: #f1f5f9; padding: 1px 6px; border-radius: 4px;
    }
    .stock-sector { font-size: 11px; color: #94a3b8; }

    .change-numbers { text-align: right; flex-shrink: 0; }
    .current-weight { font-family: ui-monospace, monospace; font-size: 17px; font-weight: 700; line-height: 1; }
    .delta { font-family: ui-monospace, monospace; font-size: 12px; font-weight: 600; margin-top: 3px; }
    .prev-weight { font-size: 11px; color: #94a3b8; margin-top: 2px; }

    .empty-section { font-size: 13px; color: #94a3b8; padding: 8px 0 24px; }

    .no-data { text-align: center; padding: 80px 0; color: #94a3b8; }

    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class HoldingsChangesComponent implements OnInit, OnDestroy {
  selectedTicker = '';
  selectedDate = '';
  availableDates: string[] = [];
  diff: HoldingsDiff | null = null;
  loading = false;
  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    public api: ApiService,
  ) {}

  ngOnInit() {
    if (this.api.etfs().length === 0) {
      this.api.getETFs().subscribe();
    }
    this.sub = this.route.params.subscribe((params) => {
      this.selectedTicker = params['ticker'];
      this.loadDates();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  get currentEtf(): ETF | undefined {
    return this.api.etfs().find((e) => e.ticker === this.selectedTicker);
  }

  get sections(): Section[] {
    if (!this.diff) return [];
    return [
      { title: '新增持股', icon: '↗', color: '#059669', items: this.diff.added, emptyMsg: '本日無新增持股' },
      { title: '加碼持股', icon: '⚡', color: '#2563eb', items: this.diff.increased, emptyMsg: '本日無加碼持股' },
      { title: '減碼持股', icon: '↘', color: '#f59e0b', items: this.diff.decreased, emptyMsg: '本日無減碼持股' },
      { title: '完全出清', icon: '✕', color: '#ef4444', items: this.diff.removed, emptyMsg: '本日無完全出清' },
    ];
  }

  get summaryPills() {
    if (!this.diff) return [];
    return [
      { label: '新增持股', count: this.diff.added.length, color: '#059669' },
      { label: '加碼持股', count: this.diff.increased.length, color: '#2563eb' },
      { label: '減碼持股', count: this.diff.decreased.length, color: '#f59e0b' },
      { label: '完全出清', count: this.diff.removed.length, color: '#ef4444' },
    ];
  }

  loadDates() {
    if (!this.selectedTicker) return;
    this.api.getAvailableDates(this.selectedTicker).subscribe((dates) => {
      this.availableDates = dates;
      if (dates.length > 0) {
        this.selectedDate = dates[0];
        this.loadDiff();
      }
    });
  }

  onTickerChange() {
    this.diff = null;
    this.loadDates();
  }

  onDateChange() {
    this.loadDiff();
  }

  loadDiff() {
    if (!this.selectedTicker || !this.selectedDate) return;
    this.loading = true;
    this.diff = null;
    // Pass date2 as selectedDate; backend auto-finds the previous date
    this.api.compareHoldings(this.selectedTicker, undefined, this.selectedDate).subscribe({
      next: (diff) => {
        this.diff = diff;
        this.loading = false;
      },
      error: () => {
        this.diff = null;
        this.loading = false;
      },
    });
  }

  goBack() {
    history.back();
  }
}
