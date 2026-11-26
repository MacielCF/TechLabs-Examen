import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, finalize, switchMap } from 'rxjs';
import { ChartService, Chart, PLANET_KEYS } from '../services/chart.service';

export interface PlanetRow {
  name: string;
  symbol: string;
  sign: string;
  degree: number;
}

export interface SignGroup {
  sign: string;
  symbol: string;
  range: string;
  element: string;
  charts: Chart[];
}

export interface ScrollState {
  prev: boolean;
  next: boolean;
  /** Index of the card currently aligned at the start of the track (for the mobile dots). */
  index: number;
}

const PLANET_SYMBOLS: Record<string, string> = {
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂',
  jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇'
};

/** Zodiac signs in order, with their symbol, approximate date range and element. */
export const ZODIAC = [
  { sign: 'Aries', symbol: '♈', range: 'Mar 21 – Apr 19', element: 'Fire' },
  { sign: 'Taurus', symbol: '♉', range: 'Apr 20 – May 20', element: 'Earth' },
  { sign: 'Gemini', symbol: '♊', range: 'May 21 – Jun 20', element: 'Air' },
  { sign: 'Cancer', symbol: '♋', range: 'Jun 21 – Jul 22', element: 'Water' },
  { sign: 'Leo', symbol: '♌', range: 'Jul 23 – Aug 22', element: 'Fire' },
  { sign: 'Virgo', symbol: '♍', range: 'Aug 23 – Sep 22', element: 'Earth' },
  { sign: 'Libra', symbol: '♎', range: 'Sep 23 – Oct 22', element: 'Air' },
  { sign: 'Scorpio', symbol: '♏', range: 'Oct 23 – Nov 21', element: 'Water' },
  { sign: 'Sagittarius', symbol: '♐', range: 'Nov 22 – Dec 21', element: 'Fire' },
  { sign: 'Capricorn', symbol: '♑', range: 'Dec 22 – Jan 19', element: 'Earth' },
  { sign: 'Aquarius', symbol: '♒', range: 'Jan 20 – Feb 18', element: 'Air' },
  { sign: 'Pisces', symbol: '♓', range: 'Feb 19 – Mar 20', element: 'Water' }
] as const;

const SIGN_SYMBOLS: Record<string, string> = Object.fromEntries(ZODIAC.map(z => [z.sign, z.symbol]));

/** Groups charts by Sun sign, in zodiac order, skipping signs without charts. */
export function groupBySunSign(charts: Chart[]): SignGroup[] {
  return ZODIAC
    .map(z => ({ ...z, charts: charts.filter(c => c.sunSign === z.sign) }))
    .filter(group => group.charts.length > 0);
}

@Component({
  selector: 'app-task1',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task1.component.html',
  styleUrls: ['./task1.component.css']
})
export class Task1Component implements OnInit, AfterViewInit, OnDestroy {
  charts: Chart[] = [];
  groups: SignGroup[] = [];
  isLoading = true;
  error: string | null = null;
  scrollState: Record<string, ScrollState | undefined> = {};

  /** Id of the chart whose delete confirmation is open. */
  confirmingId: string | null = null;
  /** Ids of charts currently being deleted. */
  deletingIds = new Set<string>();
  /** Delete error message per chart id. */
  deleteErrors: Record<string, string | undefined> = {};

  @ViewChildren('track') private tracks!: QueryList<ElementRef<HTMLElement>>;
  private tracksSub?: Subscription;

  constructor(private chartService: ChartService) {}

  ngOnInit(): void {
    this.fetchCharts();
  }

  ngAfterViewInit(): void {
    // Recalculate arrow state whenever the carousels are (re)rendered
    this.tracksSub = this.tracks.changes.subscribe(() => this.scheduleScrollUpdate());
  }

  ngOnDestroy(): void {
    this.tracksSub?.unsubscribe();
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
        next: charts => {
          this.charts = charts;
          this.groups = groupBySunSign(charts);
        },
        error: err => {
          console.error('Error fetching charts:', err);
          this.charts = [];
          this.groups = [];
          this.error = ChartService.getErrorMessage(err, 'Failed to load astrological charts. Please try again.');
        }
      });
  }

  chartId(chart: Chart): string {
    return chart.id ?? chart._id ?? '';
  }

  askDelete(chart: Chart): void {
    const id = this.chartId(chart);
    this.confirmingId = id;
    this.deleteErrors[id] = undefined;
  }

  cancelDelete(): void {
    this.confirmingId = null;
  }

  confirmDelete(chart: Chart): void {
    const id = this.chartId(chart);
    if (!id || this.deletingIds.has(id)) return;

    this.deletingIds.add(id);
    this.deleteErrors[id] = undefined;

    this.chartService.deleteChart(id)
      .pipe(finalize(() => this.deletingIds.delete(id)))
      .subscribe({
        next: () => {
          this.charts = this.charts.filter(c => this.chartId(c) !== id);
          this.groups = groupBySunSign(this.charts);
          this.confirmingId = null;
          this.scheduleScrollUpdate();
        },
        error: err => {
          console.error('Error deleting chart:', err);
          this.deleteErrors[id] = ChartService.getErrorMessage(err, 'Could not delete the chart. Please try again.');
        }
      });
  }

  /** Scrolls a carousel by roughly one viewport of cards. */
  scroll(track: HTMLElement, direction: 1 | -1): void {
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: 'smooth' });
  }

  onTrackScroll(sign: string, track: HTMLElement): void {
    this.scrollState[sign] = this.computeScrollState(track);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.scheduleScrollUpdate();
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

  trackBySign(_: number, group: SignGroup): string {
    return group.sign;
  }

  private scheduleScrollUpdate(): void {
    // Defer to the next tick so layout is ready and we don't change state mid change-detection
    setTimeout(() => {
      const state: Record<string, ScrollState> = {};
      this.tracks?.forEach(ref => {
        const sign = ref.nativeElement.dataset['sign'];
        if (sign) state[sign] = this.computeScrollState(ref.nativeElement);
      });
      this.scrollState = state;
    });
  }

  private computeScrollState(track: HTMLElement): ScrollState {
    const max = track.scrollWidth - track.clientWidth;
    return {
      prev: track.scrollLeft > 4,
      next: track.scrollLeft < max - 4,
      index: this.visibleCardIndex(track, max)
    };
  }

  /** Index of the card closest to the start of the track (the last one when scrolled to the end). */
  private visibleCardIndex(track: HTMLElement, max: number): number {
    const cards = Array.from(track.children) as HTMLElement[];
    if (!cards.length) return 0;
    if (max > 0 && track.scrollLeft >= max - 4) return cards.length - 1;

    const trackLeft = track.getBoundingClientRect().left;
    let closest = 0;
    let bestDistance = Infinity;
    cards.forEach((card, i) => {
      const distance = Math.abs(card.getBoundingClientRect().left - trackLeft);
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = i;
      }
    });
    return closest;
  }
}
