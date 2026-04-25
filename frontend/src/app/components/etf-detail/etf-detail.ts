import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, ETFDetail, Holding } from '../../services/api';
import { NgxEchartsDirective } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { Subscription, switchMap, forkJoin } from 'rxjs';

@Component({
  selector: 'app-etf-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, NgxEchartsDirective, FormsModule],
  template: `
    <div class="etf-detail" *ngIf="etf">
      <header>
        <a routerLink="/" class="back-btn">←</a>
        <div class="title-section">
          <div class="title-badges">
            <span class="badge-ticker">{{ etf.ticker }}</span>
            <span class="badge-provider">{{ etf.provider }}</span>
          </div>
          <h1>{{ etf.name }}</h1>
        </div>
        <a [routerLink]="['/changes', etf.ticker]" class="changes-link">查看持股異動 →</a>
      </header>

      <!-- Summary bar -->
      <div class="summary-bar">
        <div class="summary-item">
          <div class="summary-value">{{ currentHoldings.length }}</div>
          <div class="summary-label">持股檔數</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">{{ totalWeight | number:'1.1-1' }}%</div>
          <div class="summary-label">總持倉比重</div>
        </div>
        <div class="summary-item date-picker">
          <div class="summary-label">資料日期</div>
          <select [(ngModel)]="selectedDate" (change)="onDateChange()" class="date-select">
            <option *ngFor="let d of availableDates" [value]="d">{{ d }}</option>
          </select>
        </div>
        <div class="summary-item search-item">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input placeholder="搜尋個股…" [(ngModel)]="searchText" class="search-input" />
          </div>
        </div>
      </div>

      <!-- Main layout -->
      <div class="main-content">
        <!-- Pie chart -->
        <div class="card chart-card">
          <div class="card-title">資產配置 · {{ selectedDate }}</div>
          <div echarts [options]="chartOption" class="chart"></div>
        </div>

        <!-- Holdings table -->
        <div class="card table-card">
          <div class="card-title">持股明細表
            <span class="count-badge">{{ filteredHoldings.length }}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="col-rank">#</th>
                  <th>代號</th>
                  <th>名稱</th>
                  <th>產業</th>
                  <th class="text-right">權重</th>
                  <th class="text-right">持股張數</th>
                  <th class="text-right">佔比</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let h of filteredHoldings; let i = index">
                  <td class="col-rank">
                    <div class="rank-badge" [class.top3]="getOriginalRank(h) < 3">
                      {{ getOriginalRank(h) + 1 }}
                    </div>
                  </td>
                  <td class="ticker-cell">{{ h.stock.ticker }}</td>
                  <td class="name-cell">{{ h.stock.name }}</td>
                  <td>
                    <span class="sector-tag" *ngIf="h.stock.sector">{{ h.stock.sector }}</span>
                    <span class="sector-tag empty" *ngIf="!h.stock.sector">—</span>
                  </td>
                  <td class="text-right weight-cell">{{ h.weight | number:'1.2-2' }}%</td>
                  <td class="text-right shares-cell">{{ h.shares | number }}</td>
                  <td class="text-right bar-cell">
                    <div class="weight-bar-wrap">
                      <div class="weight-bar">
                        <div class="weight-bar-fill" [style.width]="barWidth(h.weight) + '%'"></div>
                      </div>
                      <span class="bar-pct">{{ barPct(h.weight) | number:'1.1-1' }}%</span>
                    </div>
                  </td>
                </tr>
                <tr *ngIf="filteredHoldings.length === 0">
                  <td colspan="7" class="empty-msg">
                    {{ currentHoldings.length === 0 ? '尚未取得持股數據，請先同步' : '無符合搜尋條件的個股' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="loading-full" *ngIf="!etf">
      <div class="spinner"></div>
      <p>載入中…</p>
    </div>
  `,
  styles: [`
    .etf-detail { max-width: 1160px; margin: 0 auto; }

    header {
      display: flex; align-items: flex-start; gap: 16px; margin-bottom: 28px; flex-wrap: wrap;
    }
    .back-btn {
      width: 38px; height: 38px; background: white; border: 1px solid #e2e8f0;
      border-radius: 10px; display: flex; align-items: center; justify-content: center;
      text-decoration: none; color: #64748b; font-weight: bold; transition: 0.15s; flex-shrink: 0;
    }
    .back-btn:hover { background: #f8fafc; color: #2563eb; border-color: #cbd5e1; }
    .title-section { flex: 1; }
    .title-badges { display: flex; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
    .badge-ticker {
      font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 6px;
      background: #eff6ff; color: #2563eb;
    }
    .badge-provider {
      font-size: 11px; padding: 3px 8px; border-radius: 6px;
      background: #f1f5f9; color: #64748b;
    }
    h1 { font-size: 22px; font-weight: 800; color: #0f172a; }
    .changes-link {
      align-self: center; font-size: 13px; font-weight: 600; color: #2563eb;
      text-decoration: none; padding: 8px 14px; border: 1px solid #bfdbfe;
      border-radius: 8px; background: #eff6ff; transition: 0.15s; white-space: nowrap;
    }
    .changes-link:hover { background: #dbeafe; }

    .summary-bar {
      display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; align-items: flex-end;
    }
    .summary-item {
      background: white; border: 1px solid #e2e8f0; border-radius: 14px;
      padding: 16px 20px; min-width: 130px;
    }
    .summary-value { font-size: 28px; font-weight: 800; color: #1e293b; line-height: 1; margin-bottom: 6px; }
    .summary-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
    .date-picker { flex: 1; max-width: 240px; }
    .date-select {
      width: 100%; border: none; outline: none; background: transparent; cursor: pointer;
      font-size: 18px; font-weight: 700; color: #2563eb; margin-top: 4px;
    }
    .search-item { flex: 1; min-width: 200px; padding: 12px 16px; }
    .search-box { display: flex; align-items: center; gap: 8px; }
    .search-icon { font-size: 13px; }
    .search-input { border: none; outline: none; background: transparent; font-size: 14px; width: 100%; }

    .main-content { display: flex; flex-direction: column; gap: 24px; }

    .card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.04); }
    .card-title {
      padding: 18px 22px; font-size: 15px; font-weight: 700; color: #1e293b;
      border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 8px;
    }
    .count-badge {
      font-size: 12px; font-weight: 700; background: #eff6ff; color: #2563eb;
      padding: 2px 8px; border-radius: 12px;
    }

    .chart { height: 380px; padding: 16px; }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th {
      background: #f8fafc; padding: 12px 16px; font-size: 11px; color: #64748b;
      font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; text-align: left;
      white-space: nowrap;
    }
    td { padding: 12px 16px; border-top: 1px solid #f8fafc; font-size: 13px; color: #334155; }
    tr:hover td { background: #fafcff; }

    .col-rank { width: 48px; }
    .rank-badge {
      width: 26px; height: 26px; border-radius: 50%; background: #f1f5f9; color: #64748b;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; font-family: ui-monospace, monospace;
    }
    .rank-badge.top3 { background: #eff6ff; color: #2563eb; }

    .ticker-cell { font-family: ui-monospace, monospace; font-size: 12px; font-weight: 600; color: #475569; }
    .name-cell { font-weight: 700; color: #1e293b; }
    .sector-tag {
      font-size: 10px; background: #f1f5f9; color: #64748b;
      padding: 2px 7px; border-radius: 20px; white-space: nowrap;
    }
    .sector-tag.empty { color: #cbd5e1; background: transparent; }
    .weight-cell { font-weight: 700; color: #2563eb; font-family: ui-monospace, monospace; }
    .shares-cell { color: #94a3b8; font-family: ui-monospace, monospace; font-size: 12px; }
    .text-right { text-align: right; }
    .bar-cell { min-width: 120px; }
    .weight-bar-wrap { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
    .weight-bar { width: 80px; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
    .weight-bar-fill { height: 100%; background: #2563eb; border-radius: 3px; transition: width 0.3s; }
    .bar-pct { font-size: 11px; color: #94a3b8; min-width: 36px; text-align: right; font-family: ui-monospace, monospace; }

    .empty-msg { text-align: center; padding: 60px 0; color: #94a3b8; font-size: 14px; }

    .loading-full { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 40vh; color: #94a3b8; }
    .spinner { width: 32px; height: 32px; border: 3px solid #f1f5f9; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class EtfDetailComponent implements OnInit, OnDestroy {
  etf?: ETFDetail;
  availableDates: string[] = [];
  selectedDate = '';
  currentHoldings: Holding[] = [];
  chartOption: EChartsOption = {};
  searchText = '';
  private sub?: Subscription;

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    this.sub = this.route.params
      .pipe(
        switchMap((params) => {
          const ticker = params['ticker'];
          return forkJoin({
            detail: this.api.getETFDetail(ticker),
            dates: this.api.getAvailableDates(ticker),
          });
        }),
      )
      .subscribe(({ detail, dates }) => {
        this.etf = detail;
        this.availableDates = dates;
        if (dates.length > 0) {
          this.selectedDate = dates[0];
          this.loadHoldings();
        }
      });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  onDateChange() {
    this.loadHoldings();
  }

  loadHoldings() {
    if (!this.etf || !this.selectedDate) return;
    this.api.getHoldingsByDate(this.etf.ticker, this.selectedDate).subscribe((data) => {
      this.currentHoldings = data.sort((a, b) => b.weight - a.weight);
      this.searchText = '';
      this.updateChart();
    });
  }

  get filteredHoldings(): Holding[] {
    const q = this.searchText.toLowerCase().trim();
    if (!q) return this.currentHoldings;
    return this.currentHoldings.filter(
      (h) => h.stock.ticker.toLowerCase().includes(q) || h.stock.name.includes(q),
    );
  }

  get totalWeight(): number {
    return this.currentHoldings.reduce((s, h) => s + h.weight, 0);
  }

  getOriginalRank(h: Holding): number {
    return this.currentHoldings.indexOf(h);
  }

  barWidth(weight: number): number {
    const max = this.currentHoldings[0]?.weight || 1;
    return Math.min((weight / max) * 100, 100);
  }

  barPct(weight: number): number {
    const total = this.totalWeight || 1;
    return (weight / total) * 100;
  }

  updateChart() {
    if (this.currentHoldings.length === 0) return;
    const top10 = this.currentHoldings.slice(0, 10);
    const othersWeight = this.currentHoldings.slice(10).reduce((s, h) => s + h.weight, 0);
    const data = top10.map((h) => ({ name: h.stock.name, value: h.weight }));
    if (othersWeight > 0) data.push({ name: '其他持股', value: +othersWeight.toFixed(2) });

    this.chartOption = {
      tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
      series: [
        {
          name: '持股比例',
          type: 'pie',
          radius: ['42%', '68%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 3 },
          label: { show: true, formatter: '{b}\n{d}%', color: '#475569', fontWeight: 600, fontSize: 11 },
          data,
          color: ['#2563eb', '#7c3aed', '#ea580c', '#16a34a', '#db2777', '#f59e0b', '#06b6d4', '#8b5cf6', '#6366f1', '#94a3b8', '#cbd5e1'],
        },
      ],
    };
  }
}
