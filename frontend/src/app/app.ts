import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="app-container">
      <app-sidebar></app-sidebar>
      <main class="content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container { display: flex; min-height: 100vh; }
    .content { flex: 1; margin-left: 240px; padding: 32px 36px; background: #f8fafc; transition: margin-left 0.2s; }
  `],
})
export class App {
}
