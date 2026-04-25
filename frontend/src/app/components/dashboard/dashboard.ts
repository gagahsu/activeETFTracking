import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, ETF, HoldingsDiff } from '../../services/api';

interface ETFCard {
  etf: ETF;
  diff: HoldingsDiff | null;
  loading: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="dashboard">
      <header>
        <div class="header-text">
          <h1>ETF 總覽</h1>
          <p class="subtitle">主動式ETF清單，點選查看持股異動</p>
        </div>
        <div class="header-search">
          <span class="search-icon">🔍</span>
          <input placeholder="搜尋 ETF 名稱或代號…" [(ngModel)]="searchText" class="search-input" />
        </div>
      </header>

      <div class="etf-grid">
        <div *ngFor="let card of filteredCards()" class="etf-card"
          (click)="goToChanges(card.etf.ticker)"
          [style.--accent]="providerColor(card.etf.ticker)">
          <!-- Card header -->
          <div class="card-header">
            <div class="card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="14" width="3.5" height="7" rx="1.5" [attr.fill]="providerColor(card.etf.ticker)" opacity="0.6"/>
                <rect x="10.25" y="9" width="3.5" height="12" rx="1.5" [attr.fill]="providerColor(card.etf.ticker)"/>
                <rect x="17.5" y="4" width="3.5" height="17" rx="1.5" [attr.fill]="providerColor(card.etf.ticker)" opacity="0.8"/>
              </svg>
            </div>
            <div class="card-meta">
              <div class="card-badges">
                <span class="badge ticker" [style.color]="providerColor(card.etf.ticker)"
                  [style.background]="providerColor(card.etf.ticker) + '18'">{{ card.etf.ticker }}</span>
                <span class="badge provider">{{ card.etf.provider }}</span>
              </div>
              <div class="card-name">{{ card.etf.name }}</div>
            </div>
          </div>

          <!-- Diff stats -->
          <div class="card-stats" *ngIf="!card.loading && card.diff">
            <div class="stat" *ngFor="let s of diffStats(card.diff)">
              <div class="stat-value" [style.color]="s.count > 0 ? s.color : '#cbd5e1'">{{ s.count }}</div>
              <div class="stat-label">{{ s.label }}</div>
            </div>
          </div>
          <div class="card-loading" *ngIf="card.loading">
            <div class="mini-spinner"></div>
            <span>載入中…</span>
          </div>
          <div class="card-no-data" *ngIf="!card.loading && !card.diff">
            <span>尚無歷史資料</span>
          </div>

          <!-- Footer -->
          <div class="card-footer">
            <span class="footer-action">查看持股異動</span>
            <span class="footer-arrow" [style.color]="providerColor(card.etf.ticker)">→</span>
          </div>
        </div>
      </div>

      <div *ngIf="api.etfs().length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>正在加載 ETF 資料…</p>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1200px; margin: 0 auto; }

    header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 32px; gap: 20px; flex-wrap: wrap; }
    h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .subtitle { color: #64748b; font-size: 14px; }

    .header-search {
      display: flex; align-items: center; gap: 8px;
      background: white; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 9px 14px; min-width: 260px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    .search-icon { font-size: 13px; color: #94a3b8; }
    .search-input { border: none; outline: none; background: transparent; font-size: 13px; width: 100%; }

    .etf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }

    .etf-card {
      background: white; border-radius: 16px; border: 1.5px solid #e2e8f0;
      cursor: pointer; transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .etf-card:hover {
      transform: translateY(-3px);
      border-color: color-mix(in srgb, var(--accent) 40%, transparent);
      box-shadow: 0 8px 24px -4px color-mix(in srgb, var(--accent) 15%, transparent);
    }

    .card-header { display: flex; align-items: flex-start; gap: 12px; padding: 20px 20px 16px; }
    .card-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--accent) 12%, transparent);
    }
    .card-meta { flex: 1; min-width: 0; }
    .card-badges { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .badge {
      font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 5px;
    }
    .badge.ticker { }
    .badge.provider { background: #f1f5f9; color: #64748b; }
    .card-name { font-size: 14px; font-weight: 700; color: #1e293b; line-height: 1.4; }

    .card-stats {
      display: flex; justify-content: space-around; padding: 14px 16px;
      border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;
    }
    .stat { text-align: center; }
    .stat-value { font-size: 22px; font-weight: 800; line-height: 1; margin-bottom: 4px; }
    .stat-label { font-size: 10px; color: #94a3b8; font-weight: 600; }

    .card-loading, .card-no-data {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 16px; font-size: 12px; color: #94a3b8;
      border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;
    }
    .mini-spinner {
      width: 14px; height: 14px; border: 2px solid #e2e8f0; border-top-color: #2563eb;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }

    .card-footer {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 20px; margin-top: auto;
    }
    .footer-action { font-size: 12px; font-weight: 600; color: #2563eb; }
    .footer-arrow { font-size: 16px; transition: transform 0.15s; }
    .etf-card:hover .footer-arrow { transform: translateX(4px); }

    .loading-state { text-align: center; padding: 100px 0; color: #94a3b8; }
    .spinner {
      width: 32px; height: 32px; border: 3px solid #f3f3f3; border-top-color: #2563eb;
      border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class DashboardComponent implements OnInit {
  cards = signal<ETFCard[]>([]);
  searchText = '';

  private readonly COLORS: Record<string, string> = {
    '統一投信': '#2563eb',
    '群益投信': '#7c3aed',
    '安聯投信': '#ea580c',
    '野村投信': '#16a34a',
  };

  constructor(public api: ApiService, private router: Router) {}

  ngOnInit() {
    if (this.api.etfs().length === 0) {
      this.api.getETFs().subscribe((etfs) => this.loadDiffs(etfs));
    } else {
      this.loadDiffs(this.api.etfs());
    }
  }

  private loadDiffs(etfs: ETF[]) {
    const initial: ETFCard[] = etfs.map((etf) => ({ etf, diff: null, loading: true }));
    this.cards.set(initial);

    etfs.forEach((etf, i) => {
      this.api.compareHoldings(etf.ticker).subscribe({
        next: (diff) => {
          this.cards.update((cards) => {
            const updated = [...cards];
            updated[i] = { ...updated[i], diff, loading: false };
            return updated;
          });
        },
        error: () => {
          this.cards.update((cards) => {
            const updated = [...cards];
            updated[i] = { ...updated[i], diff: null, loading: false };
            return updated;
          });
        },
      });
    });
  }

  filteredCards() {
    const q = this.searchText.toLowerCase().trim();
    if (!q) return this.cards();
    return this.cards().filter(
      (c) =>
        c.etf.ticker.toLowerCase().includes(q) ||
        c.etf.name.includes(q) ||
        c.etf.provider.includes(q),
    );
  }

  providerColor(ticker: string): string {
    const etf = this.api.etfs().find((e) => e.ticker === ticker);
    return this.COLORS[etf?.provider ?? ''] ?? '#2563eb';
  }

  diffStats(diff: HoldingsDiff) {
    return [
      { label: '新增', count: diff.added.length, color: '#059669' },
      { label: '加碼', count: diff.increased.length, color: '#2563eb' },
      { label: '減碼', count: diff.decreased.length, color: '#f59e0b' },
      { label: '出清', count: diff.removed.length, color: '#ef4444' },
      { label: '不變', count: diff.unchanged.length, color: '#94a3b8' },
    ];
  }

  goToChanges(ticker: string) {
    this.router.navigate(['/changes', ticker]);
  }
}
