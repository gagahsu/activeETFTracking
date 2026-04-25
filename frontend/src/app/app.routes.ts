import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { EtfDetailComponent } from './components/etf-detail/etf-detail';
import { HoldingsChangesComponent } from './components/holdings-changes/holdings-changes';
import { HoldingsOverlapComponent } from './components/holdings-overlap/holdings-overlap';
import { RadarComponent } from './components/radar/radar';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'etf/:ticker', component: EtfDetailComponent },
  { path: 'changes/:ticker', component: HoldingsChangesComponent },
  { path: 'overlap', component: HoldingsOverlapComponent },
  { path: 'radar/buy', component: RadarComponent },
  { path: 'radar/sell', component: RadarComponent },
  { path: 'radar', redirectTo: 'radar/buy', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
