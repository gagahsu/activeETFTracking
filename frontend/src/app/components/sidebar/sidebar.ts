import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="sidebar">
      <div class="logo">
        <div class="logo-icon"></div>
        ETF Tracker
      </div>
      <nav>
        <a (click)="goTo('/')" [class.active]="router.url === '/'" class="nav-item">儀表板</a>
        <div class="nav-section">主動式 ETF</div>
        <a *ngFor="let etf of api.etfs()" 
           (click)="goTo('/etf/' + etf.ticker)"
           [class.active]="router.url === '/etf/' + etf.ticker"
           class="nav-item">
           <span class="ticker-dot"></span>
           {{etf.ticker}} {{etf.name}}
        </a>
      </nav>
      <div class="sync-container">
        <button (click)="sync()" [disabled]="syncing">
          {{syncing ? 'Unpacking...' : '同步最新持股'}}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .sidebar { width: 240px; height: 100vh; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; position: fixed; left: 0; top: 0; z-index: 1000; }
    .logo { padding: 30px 20px; font-size: 18px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 10px; }
    .logo-icon { width: 24px; height: 24px; background: #2563eb; border-radius: 6px; }
    
    nav { flex: 1; padding: 10px 12px; overflow-y: auto; }
    .nav-item { display: flex; align-items: center; padding: 12px 15px; color: #64748b; text-decoration: none; font-size: 14px; font-weight: 500; transition: 0.2s; cursor: pointer; border-radius: 8px; margin-bottom: 4px; }
    .nav-item:hover { background: #f8fafc; color: #1e293b; }
    .nav-item.active { background: #f0f7ff; color: #2563eb; }
    
    .ticker-dot { width: 6px; height: 6px; background: #e2e8f0; border-radius: 50%; margin-right: 12px; }
    .active .ticker-dot { background: #2563eb; box-shadow: 0 0 8px rgba(37,99,235,0.4); }

    .nav-section { padding: 25px 15px 10px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; }
    
    .sync-container { padding: 20px; }
    button { width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 10px; cursor: pointer; transition: 0.2s; font-weight: 600; font-size: 13px; }
    button:hover:not(:disabled) { background: #1d4ed8; box-shadow: 0 4px 12px rgba(37,99,235,0.2); }
    button:disabled { opacity: 0.5; }
  `]
})
export class SidebarComponent implements OnInit {
  syncing = false;
  constructor(public api: ApiService, public router: Router) {}
  ngOnInit() { if (this.api.etfs().length === 0) this.api.getETFs().subscribe(); }
  goTo(path: string) { this.router.navigateByUrl(path); }
  sync() {
    if (this.syncing) return;
    this.syncing = true;
    this.api.syncData().subscribe({
      next: () => { this.syncing = false; this.api.getETFs().subscribe(); alert('同步完成！'); },
      error: (err) => { this.syncing = false; alert('失敗：' + err.message); }
    });
  }
}
