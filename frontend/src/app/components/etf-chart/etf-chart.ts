import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ETFChartData, ETF } from '../../services/api';
import { NgxEchartsDirective } from 'ngx-echarts';
import { EChartsOption } from 'echarts';

const SIGNAL_META: Record<string, { bg: string; color: string; icon: string }> = {
  '進場布局': { bg: '#f0fdf4', color: '#16a34a', icon: '📈' },
  '多頭偏多': { bg: '#f0fdf4', color: '#16a34a', icon: '↗' },
  '謹慎退場': { bg: '#fef2f2', color: '#dc2626', icon: '📉' },
  '空頭偏弱': { bg: '#fef2f2', color: '#dc2626', icon: '↘' },
  '中性觀望': { bg: '#f8fafc', color: '#64748b', icon: '─' },
};

@Component({
  selector: 'app-etf-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  template: `
    <div class="page">
      <header>
        <div class="header-text">
          <h1>技術線型</h1>
          <p class="subtitle">均線・布林軌道・RSI・MACD 指標狀態分析</p>
        </div>
        <div class="etf-picker">
          <label class="ctrl-label">選擇 ETF</label>
          <select [(ngModel)]="selectedTicker" (change)="load()" class="select">
            <option *ngFor="let e of etfs()" [value]="e.ticker">{{ e.ticker }} {{ e.name }}</option>
          </select>
        </div>
        <div class="days-picker">
          <label class="ctrl-label">天數</label>
          <select [(ngModel)]="days" (change)="load()" class="select">
            <option [value]="60">60 天</option>
            <option [value]="90">90 天</option>
            <option [value]="120">120 天</option>
          </select>
        </div>
      </header>

      <div class="loading-state" *ngIf="loading">
        <div class="spinner"></div><p>載入線型資料…</p>
      </div>

      <ng-container *ngIf="chart() && !loading">
        <!-- Signal banner -->
        <div class="signal-banner"
          [style.background]="signalMeta.bg"
          [style.border-color]="signalMeta.color + '40'">
          <span class="signal-icon">{{ signalMeta.icon }}</span>
          <div class="signal-body">
            <span class="signal-label" [style.color]="signalMeta.color">{{ chart()!.signal }}</span>
            <span class="signal-reason">{{ chart()!.signal_reason }}</span>
          </div>
          <div class="signal-indicators">
            <span class="ind-chip" *ngFor="let ind of indicatorChips()">
              <span class="ind-name">{{ ind.name }}</span>
              <span class="ind-value" [style.color]="ind.color">{{ ind.value }}</span>
            </span>
          </div>
        </div>

        <!-- Chart -->
        <div class="chart-card">
          <div echarts [options]="chartOption" class="chart" [style.height.px]="640"></div>
        </div>

        <!-- Legend row -->
        <div class="legend-row">
          <span class="leg-item"><span class="leg-dot" style="background:#f59e0b"></span>MA5</span>
          <span class="leg-item"><span class="leg-dot" style="background:#2563eb"></span>MA20</span>
          <span class="leg-item"><span class="leg-line" style="border-color:#94a3b8"></span>布林軌道</span>
          <span class="leg-item"><span class="leg-dot" style="background:#7c3aed"></span>RSI(14)</span>
          <span class="leg-item"><span class="leg-dot" style="background:#2563eb"></span>MACD(12,26)</span>
          <span class="leg-item"><span class="leg-dot" style="background:#ea580c"></span>Signal(9)</span>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .page { max-width: 1100px; margin: 0 auto; }
    header { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .header-text { flex: 1; }
    h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .subtitle { color: #64748b; font-size: 14px; }
    .etf-picker, .days-picker { display: flex; flex-direction: column; gap: 5px; }
    .ctrl-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
    .select {
      background: white; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 8px 12px; font-size: 13px; outline: none; cursor: pointer; font-weight: 600; color: #1e293b;
    }

    .loading-state { display: flex; align-items: center; gap: 12px; padding: 60px 0; color: #94a3b8; }
    .spinner {
      width: 24px; height: 24px; border: 2px solid #f1f5f9; border-top-color: #2563eb;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }

    .signal-banner {
      display: flex; align-items: center; gap: 16px; padding: 16px 22px;
      border: 1px solid; border-radius: 14px; margin-bottom: 20px; flex-wrap: wrap;
    }
    .signal-icon { font-size: 24px; flex-shrink: 0; }
    .signal-body { display: flex; flex-direction: column; gap: 3px; min-width: 120px; }
    .signal-label { font-size: 18px; font-weight: 800; }
    .signal-reason { font-size: 12px; color: #64748b; }
    .signal-indicators { display: flex; gap: 10px; flex-wrap: wrap; margin-left: auto; }
    .ind-chip {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 14px;
    }
    .ind-name { font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
    .ind-value { font-size: 15px; font-weight: 800; font-family: ui-monospace, monospace; }

    .chart-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 16px;
      overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.04); margin-bottom: 14px; padding: 12px;
    }
    .chart { width: 100%; }

    .legend-row {
      display: flex; gap: 16px; flex-wrap: wrap; padding: 0 4px; margin-bottom: 8px;
    }
    .leg-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; }
    .leg-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .leg-line {
      width: 18px; height: 0; border-top: 2px dashed; flex-shrink: 0;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class EtfChartComponent implements OnInit {
  selectedTicker = '';
  days = 90;
  loading = false;
  chart = signal<ETFChartData | null>(null);
  chartOption: EChartsOption = {};

  constructor(private api: ApiService) {}

  get etfs() { return this.api.etfs; }

  ngOnInit() {
    const load = () => {
      const list = this.api.etfs();
      if (list.length > 0) {
        this.selectedTicker = list[0].ticker;
        this.load();
      }
    };
    if (this.api.etfs().length > 0) {
      load();
    } else {
      this.api.getETFs().subscribe(() => load());
    }
  }

  load() {
    if (!this.selectedTicker) return;
    this.loading = true;
    this.chart.set(null);
    this.api.getETFChart(this.selectedTicker, this.days).subscribe({
      next: (data) => { this.chart.set(data); this.buildChart(data); this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get signalMeta() {
    return SIGNAL_META[this.chart()?.signal ?? ''] ?? SIGNAL_META['中性觀望'];
  }

  indicatorChips() {
    const c = this.chart();
    if (!c) return [];
    const lastRsi = c.rsi.at(-1)?.value ?? 0;
    const lastMacd = c.macd.at(-1);
    const lastClose = c.candles.at(-1)?.close ?? 0;
    const lastMa20 = c.ma20.at(-1)?.value ?? 0;
    const rsiColor = lastRsi > 70 ? '#dc2626' : lastRsi < 30 ? '#16a34a' : '#64748b';
    const macdColor = (lastMacd?.histogram ?? 0) > 0 ? '#16a34a' : '#dc2626';
    const priceColor = lastClose > lastMa20 ? '#16a34a' : '#dc2626';
    return [
      { name: 'RSI', value: lastRsi.toFixed(1), color: rsiColor },
      { name: 'MACD', value: (lastMacd?.macd ?? 0).toFixed(3), color: macdColor },
      { name: '收盤', value: lastClose.toFixed(2), color: priceColor },
      { name: 'MA20', value: lastMa20.toFixed(2), color: '#64748b' },
    ];
  }

  private buildChart(d: ETFChartData) {
    const dates = d.candles.map((c) => c.date);
    const ma5Map  = new Map(d.ma5.map((p) => [p.date, p.value]));
    const ma20Map = new Map(d.ma20.map((p) => [p.date, p.value]));
    const bolMap  = new Map(d.bollinger.map((p) => [p.date, p]));
    const rsiMap  = new Map(d.rsi.map((p) => [p.date, p.value]));
    const macdMap = new Map(d.macd.map((p) => [p.date, p]));

    const candleData  = d.candles.map((c) => [c.open, c.close, c.low, c.high]);
    const volumeData  = d.candles.map((c) => ({
      value: c.volume,
      itemStyle: { color: c.close >= c.open ? '#16a34a88' : '#dc262688' },
    }));
    const rsiData  = dates.map((dt) => rsiMap.get(dt) ?? null);
    const histData = dates.map((dt) => {
      const p = macdMap.get(dt);
      if (!p?.histogram) return null;
      return { value: p.histogram, itemStyle: { color: p.histogram >= 0 ? '#16a34a' : '#dc2626' } };
    });

    this.chartOption = {
      animation: false,
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross', lineStyle: { color: '#cbd5e1' } } },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1, 2, 3], start: 20, end: 100 },
        { type: 'slider', xAxisIndex: [0, 1, 2, 3], start: 20, end: 100, bottom: 4, height: 18,
          borderColor: '#e2e8f0', fillerColor: '#eff6ff', handleStyle: { color: '#2563eb' } },
      ],
      grid: [
        { left: 58, right: 12, top: 8,    height: '44%' },
        { left: 58, right: 12, top: '56%', height: '9%'  },
        { left: 58, right: 12, top: '68%', height: '10%' },
        { left: 58, right: 12, top: '81%', height: '11%' },
      ],
      xAxis: [0, 1, 2, 3].map((gi) => ({
        type: 'category' as const,
        gridIndex: gi,
        data: dates,
        scale: true,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: gi === 3 ? { fontSize: 10, color: '#94a3b8' } : { show: false },
      })),
      yAxis: [
        { gridIndex: 0, scale: true, splitLine: { lineStyle: { color: '#f1f5f9' } }, axisLabel: { fontSize: 10, color: '#94a3b8', formatter: '{value}' } },
        { gridIndex: 1, axisLabel: { show: false }, splitLine: { show: false } },
        { gridIndex: 2, min: 0, max: 100, splitNumber: 2, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' as const } }, axisLabel: { fontSize: 9, color: '#94a3b8' } },
        { gridIndex: 3, splitLine: { lineStyle: { color: '#f1f5f9' } }, axisLabel: { fontSize: 9, color: '#94a3b8' } },
      ],
      series: [
        {
          name: 'K線', type: 'candlestick' as const, xAxisIndex: 0, yAxisIndex: 0,
          data: candleData,
          itemStyle: { color: '#16a34a', color0: '#dc2626', borderColor: '#16a34a', borderColor0: '#dc2626' },
        },
        {
          name: 'MA5', type: 'line' as const, xAxisIndex: 0, yAxisIndex: 0,
          data: dates.map((dt) => ma5Map.get(dt) ?? null),
          smooth: true, symbol: 'none', lineStyle: { color: '#f59e0b', width: 1.5 },
        },
        {
          name: 'MA20', type: 'line' as const, xAxisIndex: 0, yAxisIndex: 0,
          data: dates.map((dt) => ma20Map.get(dt) ?? null),
          smooth: true, symbol: 'none', lineStyle: { color: '#2563eb', width: 1.5 },
        },
        {
          name: '布林上軌', type: 'line' as const, xAxisIndex: 0, yAxisIndex: 0,
          data: dates.map((dt) => bolMap.get(dt)?.upper ?? null),
          smooth: true, symbol: 'none',
          lineStyle: { color: '#94a3b8', width: 1, type: 'dashed' as const },
          areaStyle: { color: 'rgba(148,163,184,0.06)' },
        },
        {
          name: '布林下軌', type: 'line' as const, xAxisIndex: 0, yAxisIndex: 0,
          data: dates.map((dt) => bolMap.get(dt)?.lower ?? null),
          smooth: true, symbol: 'none',
          lineStyle: { color: '#94a3b8', width: 1, type: 'dashed' as const },
        },
        {
          name: '成交量', type: 'bar' as const, xAxisIndex: 1, yAxisIndex: 1,
          data: volumeData, barMaxWidth: 6,
        },
        {
          name: 'RSI', type: 'line' as const, xAxisIndex: 2, yAxisIndex: 2,
          data: rsiData, smooth: true, symbol: 'none',
          lineStyle: { color: '#7c3aed', width: 1.5 },
          markLine: {
            silent: true, symbol: 'none',
            lineStyle: { type: 'dashed' as const, color: '#94a3b8', width: 1 },
            data: [{ yAxis: 70 }, { yAxis: 30 }],
            label: { formatter: '{c}', fontSize: 9, color: '#94a3b8' },
          },
        },
        {
          name: 'MACD柱', type: 'bar' as const, xAxisIndex: 3, yAxisIndex: 3,
          data: histData, barMaxWidth: 6,
        },
        {
          name: 'MACD', type: 'line' as const, xAxisIndex: 3, yAxisIndex: 3,
          data: dates.map((dt) => macdMap.get(dt)?.macd ?? null),
          symbol: 'none', lineStyle: { color: '#2563eb', width: 1.5 },
        },
        {
          name: 'Signal', type: 'line' as const, xAxisIndex: 3, yAxisIndex: 3,
          data: dates.map((dt) => macdMap.get(dt)?.signal ?? null),
          symbol: 'none', lineStyle: { color: '#ea580c', width: 1.5 },
        },
      ],
    };
  }
}
