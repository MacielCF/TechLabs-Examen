import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ChartService } from './services/chart.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
    template: `
    <div class="app-container">
      <header class="app-header">
        <h1>Terri Quintel Astrology</h1>
        <nav>
          <a routerLink="/task1" routerLinkActive="active">Task 1</a>
          <a routerLink="/task2" routerLinkActive="active">Task 2</a>
        </nav>
      </header>
      <main class="app-main">
        <div *ngIf="isInitializing" class="init-status">
          <p>Initializing project...</p>
        </div>
        <div *ngIf="initError" class="init-error">
          <p>⚠️ Initialization warning: {{ initError }}</p>
        </div>
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
    styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .app-header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      padding: 1rem 2rem;
      background: rgba(11, 12, 22, 0.8);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      box-shadow: 0 10px 30px -15px rgba(0, 0, 0, 0.8);
    }
    .app-header h1 {
      margin: 0;
      font-size: 1.75rem;
      background: linear-gradient(90deg, var(--gold-strong), var(--gold) 50%, #b89a5a);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .app-header h1::before {
      content: '✦ ';
      color: var(--gold);
      -webkit-text-fill-color: var(--gold);
      font-size: 0.8em;
    }
    nav {
      display: flex;
      gap: 0.25rem;
      padding: 0.25rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 999px;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
    }
    nav a {
      color: var(--text-muted);
      text-decoration: none;
      padding: 0.45rem 1.1rem;
      border-radius: 999px;
      font-size: 0.9rem;
      font-weight: 500;
      transition: color 0.2s, background 0.2s;
    }
    nav a:hover {
      color: var(--text);
    }
    nav a.active {
      color: var(--bg);
      background: var(--gold);
      box-shadow: 0 4px 16px -4px rgba(212, 178, 106, 0.6);
    }
    .app-main {
      flex: 1;
      padding: 2rem;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
    }
    .init-status {
      background: var(--info-soft);
      color: var(--text-muted);
      border: 1px solid var(--border);
      padding: 0.75rem 1rem;
      border-radius: var(--radius-sm);
      margin-bottom: 1rem;
      text-align: center;
      font-size: 0.9rem;
    }
    .init-error {
      background: var(--warning-soft);
      color: var(--warning);
      padding: 0.75rem 1rem;
      border-radius: var(--radius-sm);
      margin-bottom: 1rem;
      border-left: 3px solid var(--warning);
      font-size: 0.9rem;
    }
    @media (max-width: 600px) {
      .app-header { padding: 1rem; }
      .app-header h1 { font-size: 1.4rem; }
      .app-main { padding: 1rem; }
    }
  `]
})
export class AppComponent implements OnInit {
    title = 'Terri Quintel Astrology Assessment';
    isInitializing = true;
    initError: string | null = null;

    constructor(private chartService: ChartService) { }

    ngOnInit() {
        this.chartService.initializeProject().subscribe(response => {
            this.isInitializing = false;
            if (!response) {
                this.initError = 'Failed to initialize project. Please check backend connection.';
            } else if (!response.success) {
                this.initError = response.message || response.error || 'Initialization completed with warnings';
            }
        });
    }
}
