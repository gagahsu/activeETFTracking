import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../services/api';

interface NavItem {
  id: string;
  icon: string;
  label: string;
  sub: string;
  route: string;
}

const TOP_NAV: NavItem[] = [
  { id: 'overview',         icon: '▦',  label: 'ETF 總覽',  sub: '主動式ETF清單',     route: '/' },
  { id: 'overlap',          icon: '⊙',  label: '持股重疊',  sub: '跨ETF共同持股',     route: '/overlap' },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="sidebar" [class.collapsed]="collapsed()">
      <!-- Logo -->
      <div class="logo">
        <div class="logo-icon"></div>
        <span class="logo-text">ETF Tracker</span>
      </div>

      <!-- Collapse toggle -->
      <button class="collapse-btn" (click)="collapsed.set(!collapsed())" [title]="collapsed() ? '展開側邊欄' : '收合側邊欄'">
        {{ collapsed() ? '→' : '←' }}
      </button>

      <nav>
        <!-- Top-level nav -->
        <div class="nav-section-label">功能頁面</div>
        <a *ngFor="let item of topNav"
           (click)="goTo(item.route)"
           [class.active]="isActive(item.route)"
           class="nav-item"
           [title]="item.label">
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-text">
            <span class="nav-label">{{ item.label }}</span>
            <span class="nav-sub">{{ item.sub }}</span>
          </span>
        </a>

        <!-- Per-ETF links -->
        <div class="nav-section-label etf-section">持股異動</div>
        <a *ngFor="let etf of api.etfs()"
           (click)="goTo('/changes/' + etf.ticker)"
           [class.active]="router.url === '/changes/' + etf.ticker"
           class="nav-item etf-item"
           [title]="etf.ticker + ' ' + etf.name">
          <span class="nav-icon">↕</span>
          <span class="nav-text">
            <span class="nav-label">{{ etf.ticker }}</span>
            <span class="nav-sub">{{ etf.name }}</span>
          </span>
        </a>

        <!-- Per-ETF snapshot links -->
        <div class="nav-section-label">每日快照</div>
        <a *ngFor="let etf of api.etfs()"
           (click)="goTo('/etf/' + etf.ticker)"
           [class.active]="router.url === '/etf/' + etf.ticker"
           class="nav-item etf-item"
           [title]="etf.ticker + ' ' + etf.name">
          <span class="nav-icon">📅</span>
          <span class="nav-text">
            <span class="nav-label">{{ etf.ticker }}</span>
            <span class="nav-sub">{{ etf.name }}</span>
          </span>
        </a>
      </nav>

      <!-- Sync button -->
      <div class="sync-container">
        <button class="sync-btn" (click)="sync()" [disabled]="syncing">
          <span class="sync-icon">{{ syncing ? '⟳' : '↻' }}</span>
          <span class="sync-text">{{ syncing ? '同步中…' : '同步最新持股' }}</span>
        </button>
        <div *ngIf="syncResult" class="sync-result" [class.error]="syncError">
          {{ syncResult }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .sidebar {
      width: 240px; height: 100vh; background: white; border-right: 1px solid #e2e8f0;
      display: flex; flex-direction: column; position: fixed; left: 0; top: 0; z-index: 1000;
      transition: width 0.2s ease; overflow: hidden;
    }
    .sidebar.collapsed { width: 60px; }

    .logo {
      padding: 20px 16px 14px; font-size: 16px; font-weight: 700; color: #1e293b;
      display: flex; align-items: center; gap: 10px; flex-shrink: 0;
    }
    .logo-icon { width: 28px; height: 28px; background: #2563eb; border-radius: 8px; flex-shrink: 0; }
    .logo-text { white-space: nowrap; }

    .collapse-btn {
      position: absolute; top: 20px; right: 10px;
      background: none; border: 1px solid #e2e8f0; border-radius: 6px;
      width: 24px; height: 24px; cursor: pointer; color: #94a3b8; font-size: 12px;
      display: flex; align-items: center; justify-content: center; padding: 0;
      transition: 0.15s;
    }
    .collapse-btn:hover { background: #f8fafc; color: #2563eb; border-color: #cbd5e1; }

    nav { flex: 1; padding: 4px 10px 10px; overflow-y: auto; overflow-x: hidden; }
    nav::-webkit-scrollbar { width: 3px; }
    nav::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }

    .nav-section-label {
      padding: 16px 8px 6px; font-size: 10px; color: #94a3b8;
      text-transform: uppercase; letter-spacing: 1px; font-weight: 700;
      white-space: nowrap; overflow: hidden;
    }
    .nav-section-label.etf-section { padding-top: 10px; }

    .nav-item {
      display: flex; align-items: flex-start; padding: 9px 8px; color: #64748b;
      text-decoration: none; font-size: 13px; font-weight: 500;
      transition: 0.15s; cursor: pointer; border-radius: 8px; margin-bottom: 2px;
      gap: 10px; overflow: hidden;
    }
    .nav-item:hover { background: #f8fafc; color: #1e293b; }
    .nav-item.active { background: #eff6ff; color: #2563eb; }
    .nav-item.etf-item { padding: 7px 8px; }

    .nav-icon { font-size: 14px; flex-shrink: 0; width: 18px; text-align: center; margin-top: 1px; }
    .nav-text { display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
    .nav-label { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nav-sub { font-size: 10px; color: #94a3b8; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .nav-item.active .nav-sub { color: #93c5fd; }

    .sidebar.collapsed .logo-text,
    .sidebar.collapsed .nav-text,
    .sidebar.collapsed .nav-section-label,
    .sidebar.collapsed .sync-text { display: none; }
    .sidebar.collapsed .nav-item { justify-content: center; padding: 10px 0; }
    .sidebar.collapsed .nav-icon { width: auto; margin: 0; }

    .sync-container { padding: 12px; flex-shrink: 0; border-top: 1px solid #f1f5f9; }
    .sync-btn {
      width: 100%; padding: 10px 12px; background: #2563eb; color: white; border: none;
      border-radius: 10px; cursor: pointer; transition: 0.15s; font-weight: 600; font-size: 13px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .sync-btn:hover:not(:disabled) { background: #1d4ed8; }
    .sync-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .sync-icon { font-size: 15px; }
    .sidebar.collapsed .sync-btn { padding: 10px 0; }

    .sync-result {
      margin-top: 8px; font-size: 11px; color: #059669; text-align: center;
      background: #f0fdf4; border-radius: 6px; padding: 4px 8px;
    }
    .sync-result.error { color: #dc2626; background: #fef2f2; }
  `],
})
export class SidebarComponent implements OnInit {
  collapsed = signal(false);
  syncing = false;
  syncResult = '';
  syncError = false;
  topNav = TOP_NAV;

  constructor(public api: ApiService, public router: Router) {}

  ngOnInit() {
    if (this.api.etfs().length === 0) this.api.getETFs().subscribe();
  }

  goTo(path: string) {
    this.router.navigateByUrl(path);
  }

  isActive(route: string): boolean {
    return route === '/' ? this.router.url === '/' : this.router.url.startsWith(route);
  }

  sync() {
    if (this.syncing) return;
    this.syncing = true;
    this.syncResult = '';
    this.syncError = false;
    this.api.syncData().subscribe({
      next: (res) => {
        this.syncing = false;
        const ok = res.results.filter((r: any) => r.status === 'success').length;
        const total = res.results.length;
        this.syncResult = `已同步 ${ok}/${total} 檔 ETF`;
        this.syncError = ok < total;
        this.api.getETFs().subscribe();
        setTimeout(() => (this.syncResult = ''), 5000);
      },
      error: (err) => {
        this.syncing = false;
        this.syncResult = '同步失敗：' + err.message;
        this.syncError = true;
        setTimeout(() => (this.syncResult = ''), 5000);
      },
    });
  }
}
