import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize, switchMap } from 'rxjs';
import { ChartService, Chart, PLANET_KEYS } from '../services/chart.service';

export interface PlanetRow {
  name: string;
  symbol: string;
  sign: string;
  degree: number;
}

const PLANET_SYMBOLS: Record<string, string> = {
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂',
  jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇'
};

const SIGN_SYMBOLS: Record<string, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍',
  Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓'
};

@Component({
  selector: 'app-task1',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task1.component.html',
  styleUrls: ['./task1.component.css']
})
export class Task1Component implements OnInit {
  charts: Chart[] = [];
  isLoading = true;
  error: string | null = null;

  constructor(private chartService: ChartService) {}

  ngOnInit(): void {
    this.fetchCharts();
  }

  fetchCharts(): void {
    this.isLoading = true;
    this.error = null;

    // Wait for /api/init (which seeds the DB on first run) before listing charts
    this.chartService.initializeProject()
      .pipe(
        switchMap(() => this.chartService.getAllCharts({ limit: 100 })),
        finalize(() => (this.isLoading = false))
      )
      .subscribe({
        next: charts => (this.charts = charts),
        error: err => {
          console.error('Error fetching charts:', err);
          this.charts = [];
          this.error = ChartService.getErrorMessage(err, 'Failed to load astrological charts. Please try again.');
        }
      });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Date not available';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    // Dates are stored as UTC midnight; format in UTC so the day doesn't shift
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

  getPlanetsArray(chart: Chart): PlanetRow[] {
    if (!chart.planets) return [];
    return PLANET_KEYS
      .filter(key => chart.planets[key])
      .map(key => ({
        name: key,
        symbol: PLANET_SYMBOLS[key],
        sign: chart.planets[key]!.sign,
        degree: chart.planets[key]!.degree
      }));
  }

  signSymbol(sign: string): string {
    return SIGN_SYMBOLS[sign] ?? '';
  }

  trackById(_: number, chart: Chart): string {
    return chart.id ?? chart._id ?? chart.name;
  }
}
