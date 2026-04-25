import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard">
      <header>
        <h1>主動式 ETF 追蹤</h1>
        <p class="subtitle">即時監控持股變動與資產配置</p>
      </header>
      
      <div class="etf-grid">
        <div *ngFor="let etf of api.etfs()" class="etf-card" [routerLink]="['/etf', etf.ticker]">
          <div class="card-content">
            <div class="card-header">
              <span class="provider">{{etf.provider}}</span>
              <span class="ticker">{{etf.ticker}}</span>
            </div>
            <h3>{{etf.name}}</h3>
            <div class="card-footer">
              <span class="action-text">分析持股明細</span>
              <div class="arrow-icon">→</div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="api.etfs().length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>正在加載 ETF 數據...</p>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1200px; margin: 0 auto; }
    header { margin-bottom: 40px; }
    h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
    .subtitle { color: #64748b; font-size: 15px; }

    .etf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px; }
    
    .etf-card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; }
    .etf-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -4px rgba(0,0,0,0.05); border-color: #cbd5e1; }
    
    .card-content { padding: 24px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .provider { font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .ticker { background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px; }
    
    h3 { font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 24px; line-height: 1.5; min-height: 54px; }
    
    .card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; border-top: 1px solid #f1f5f9; }
    .action-text { font-size: 13px; font-weight: 600; color: #2563eb; }
    .arrow-icon { width: 24px; height: 24px; background: #f0f7ff; color: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: 0.2s; }
    .etf-card:hover .arrow-icon { background: #2563eb; color: white; transform: translateX(4px); }

    .loading-state { text-align: center; padding: 100px 0; color: #94a3b8; }
    .spinner { width: 30px; height: 30px; border: 3px solid #f3f3f3; border-top: 3px solid #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  `]
})
export class DashboardComponent implements OnInit {
  constructor(public api: ApiService) {}
  ngOnInit() { if (this.api.etfs().length === 0) this.api.getETFs().subscribe(); }
}
