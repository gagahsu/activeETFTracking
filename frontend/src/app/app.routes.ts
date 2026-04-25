import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { EtfDetailComponent } from './components/etf-detail/etf-detail';
import { HoldingsChangesComponent } from './components/holdings-changes/holdings-changes';
import { HoldingsOverlapComponent } from './components/holdings-overlap/holdings-overlap';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'etf/:ticker', component: EtfDetailComponent },
  { path: 'changes/:ticker', component: HoldingsChangesComponent },
  { path: 'overlap', component: HoldingsOverlapComponent },
  { path: '**', redirectTo: '' },
];
