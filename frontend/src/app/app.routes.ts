import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { EtfDetailComponent } from './components/etf-detail/etf-detail';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'etf/:ticker', component: EtfDetailComponent },
  { path: '**', redirectTo: '' }
];
