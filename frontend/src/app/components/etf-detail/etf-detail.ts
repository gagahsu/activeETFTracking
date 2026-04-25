import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService, ETFDetail, Holding } from '../../services/api';
import { NgxEchartsDirective } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { Subscription, switchMap, forkJoin } from 'rxjs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-etf-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, NgxEchartsDirective, FormsModule],
  template: `
    <div class="etf-detail" *ngIf="etf">
      <header>
        <a routerLink="/" class="back-button">←</a>
        <div class="title-section">
          <span class="provider-tag">{{etf.provider}}</span>
          <h1>{{etf.ticker}} {{etf.name}}</h1>
        </div>
      </header>

      <div class="summary-grid">
        <div class="summary-card">
          <label>持股數量</label>
          <div class="value">{{currentHoldings.length}} <span class="unit">檔</span></div>
        </div>
        <div class="summary-card">
          <label>資料更新日期</label>
          <div class="date-picker-wrapper">
             <select [(ngModel)]="selectedDate" (change)="onDateChange()">
                <option *ngFor="let date of availableDates" [value]="date">{{date}}</option>
             </select>
          </div>
        </div>
      </div>

      <div class="main-content">
        <div class="chart-section card">
          <div class="card-header">
            <h3>資產配置分析 ({{selectedDate}})</h3>
          </div>
          <div echarts [options]="chartOption" class="chart"></div>
        </div>

        <div class="holdings-section card">
          <div class="card-header">
            <h3>持股明細表</h3>
          </div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>代號</th>
                  <th>股票名稱</th>
                  <th class="text-right">權重</th>
                  <th class="text-right">持有股數</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let h of currentHoldings">
                  <td class="ticker-cell">{{h.stock.ticker}}</td>
                  <td class="name-cell">{{h.stock.name}}</td>
                  <td class="text-right bold">{{h.weight | number:'1.2-2'}}%</td>
                  <td class="text-right gray">{{h.shares | number}}</td>
                </tr>
                <tr *ngIf="currentHoldings.length === 0">
                  <td colspan="4" class="empty-msg">尚未取得持股數據</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .etf-detail { max-width: 1100px; margin: 0 auto; }
    header { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 35px; }
    .back-button { width: 40px; height: 40px; background: white; border: 1px solid #e2e8f0; border-radius: 10px; display: flex; align-items: center; justify-content: center; text-decoration: none; color: #64748b; font-weight: bold; transition: 0.2s; }
    .back-button:hover { background: #f8fafc; border-color: #cbd5e1; color: #2563eb; }
    
    .title-section h1 { font-size: 26px; font-weight: 800; color: #0f172a; margin-top: 5px; }
    .provider-tag { font-size: 11px; font-weight: 700; color: #2563eb; background: #f0f7ff; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }

    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .summary-card { background: white; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; }
    .summary-card label { display: block; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 10px; }
    .summary-card .value { font-size: 24px; font-weight: 800; color: #1e293b; }
    .summary-card .unit { font-size: 14px; font-weight: 500; color: #64748b; margin-left: 4px; }

    .date-picker-wrapper select { width: 100%; border: none; font-size: 20px; font-weight: 700; color: #2563eb; background: transparent; cursor: pointer; outline: none; }

    .card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 25px; overflow: hidden; }
    .card-header { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; }
    .card-header h3 { font-size: 16px; font-weight: 700; color: #1e293b; }

    .chart { height: 400px; padding: 20px; }

    .table-container { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f8fafc; text-align: left; padding: 14px 24px; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; }
    td { padding: 16px 24px; border-top: 1px solid #f1f5f9; font-size: 14px; color: #334155; }
    tr:hover { background: #fbfcfe; }
    
    .ticker-cell { font-family: ui-monospace, monospace; font-weight: 600; color: #64748b; }
    .name-cell { font-weight: 600; color: #1e293b; }
    .text-right { text-align: right; }
    .bold { font-weight: 700; color: #2563eb; }
    .gray { color: #94a3b8; font-size: 13px; }
    .empty-msg { text-align: center; padding: 60px; color: #94a3b8; font-style: italic; }
  `]
})
export class EtfDetailComponent implements OnInit, OnDestroy {
  etf?: ETFDetail;
  availableDates: string[] = [];
  selectedDate: string = '';
  currentHoldings: Holding[] = [];
  chartOption: EChartsOption = {};
  private sub?: Subscription;

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    this.sub = this.route.params.pipe(
      switchMap(params => {
        const ticker = params['ticker'];
        return forkJoin({
          detail: this.api.getETFDetail(ticker),
          dates: this.api.getAvailableDates(ticker)
        });
      })
    ).subscribe(({ detail, dates }) => {
      this.etf = detail;
      this.availableDates = dates;
      if (dates.length > 0) {
        this.selectedDate = dates[0];
        this.loadHoldings();
      }
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }
  onDateChange() { this.loadHoldings(); }

  loadHoldings() {
    if (!this.etf || !this.selectedDate) return;
    this.api.getHoldingsByDate(this.etf.ticker, this.selectedDate).subscribe(data => {
      this.currentHoldings = data.sort((a, b) => b.weight - a.weight);
      this.updateChart();
    });
  }

  updateChart() {
    if (this.currentHoldings.length === 0) return;
    const top10 = this.currentHoldings.slice(0, 10);
    const others = this.currentHoldings.slice(10).reduce((s, h) => s + h.weight, 0);
    const chartData = top10.map(h => ({ name: h.stock.name, value: h.weight }));
    if (others > 0) chartData.push({ name: '其他持股', value: others });

    this.chartOption = {
      tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
      series: [{
        name: '持股比例', type: 'pie', radius: ['45%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 12, borderColor: '#fff', borderWidth: 4 },
        label: { show: true, formatter: '{b}\n{d}%', color: '#475569', fontWeight: 600 },
        data: chartData,
        color: ['#2563eb', '#7c3aed', '#ea580c', '#16a34a', '#db2777', '#f59e0b', '#06b6d4', '#8b5cf6', '#6366f1', '#94a3b8']
      }]
    };
  }
}
