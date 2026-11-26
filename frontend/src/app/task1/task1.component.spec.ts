import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { Task1Component, groupBySunSign } from './task1.component';
import { Chart, ChartService } from '../services/chart.service';
import { mockChart } from '../../testing/mock-chart';

describe('Task1Component', () => {
  let fixture: ComponentFixture<Task1Component>;
  let component: Task1Component;
  let chartService: jasmine.SpyObj<ChartService>;
  let el: HTMLElement;

  beforeEach(async () => {
    spyOn(console, 'error'); // expected logs from error-path tests
    chartService = jasmine.createSpyObj<ChartService>('ChartService', ['initializeProject', 'getAllCharts', 'deleteChart']);
    chartService.initializeProject.and.returnValue(of({ success: true, data: {} }));

    await TestBed.configureTestingModule({
      imports: [Task1Component],
      providers: [{ provide: ChartService, useValue: chartService }]
    }).compileComponents();

    fixture = TestBed.createComponent(Task1Component);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('shows a loading state while fetching', () => {
    const pending = new Subject<Chart[]>();
    chartService.getAllCharts.and.returnValue(pending);

    fixture.detectChanges();

    expect(component.isLoading).toBeTrue();
    expect(el.querySelector('.loading-state')).not.toBeNull();
    expect(el.querySelector('.chart-card')).toBeNull();
  });

  it('waits for project initialization before fetching charts', () => {
    const init = new Subject<null>();
    chartService.initializeProject.and.returnValue(init);
    chartService.getAllCharts.and.returnValue(of([]));

    fixture.detectChanges();
    expect(chartService.getAllCharts).not.toHaveBeenCalled();

    init.next(null);
    init.complete();
    expect(chartService.getAllCharts).toHaveBeenCalled();
  });

  it('renders one card per chart with its details', () => {
    chartService.getAllCharts.and.returnValue(of([
      mockChart({ id: '1', name: 'First' }),
      mockChart({ id: '2', name: 'Second', isPublic: false })
    ]));

    fixture.detectChanges();

    const cards = el.querySelectorAll('.chart-card');
    expect(cards.length).toBe(2);

    const first = cards[0];
    expect(first.querySelector('h3')?.textContent).toContain('First');
    expect(first.textContent).toContain('May 15, 1990');
    expect(first.textContent).toContain('10:30');
    expect(first.textContent).toContain('New York, NY');
    expect(first.textContent).toContain('Taurus');
    expect(first.textContent).toContain('Scorpio');
    expect(first.textContent).toContain('Leo');
    expect(first.querySelectorAll('.planet-item').length).toBe(5);
    expect(first.querySelector('.badge')).toBeNull();

    expect(cards[1].querySelector('.badge')?.textContent).toContain('Private');
  });

  it('renders one carousel row per Sun sign, in zodiac order', () => {
    chartService.getAllCharts.and.returnValue(of([
      mockChart({ id: '1', sunSign: 'Pisces' }),
      mockChart({ id: '2', sunSign: 'Aries' }),
      mockChart({ id: '3', sunSign: 'Pisces' }),
      mockChart({ id: '4', sunSign: 'Leo' })
    ]));

    fixture.detectChanges();

    const rows = Array.from(el.querySelectorAll('.sign-row'));
    expect(rows.map(r => r.querySelector('.row-header h3')?.textContent?.trim()))
      .toEqual(['Aries', 'Leo', 'Pisces']);

    const pisces = rows[2];
    expect(pisces.querySelector('.row-symbol')?.textContent).toContain('♓');
    expect(pisces.querySelector('.row-count')?.textContent).toContain('2 charts');
    expect(pisces.querySelectorAll('.carousel-track .chart-card').length).toBe(2);
    expect(rows[0].querySelector('.row-count')?.textContent).toContain('1 chart');
  });

  it('only shows arrows for rows that can scroll', () => {
    chartService.getAllCharts.and.returnValue(of([
      mockChart({ id: '1', sunSign: 'Aries' }),
      mockChart({ id: '2', sunSign: 'Leo' })
    ]));
    fixture.detectChanges();

    component.scrollState = {
      Aries: { prev: false, next: true, index: 0 },
      Leo: { prev: false, next: false, index: 0 }
    };
    fixture.detectChanges();

    const rows = el.querySelectorAll('.sign-row');
    const ariesArrows = rows[0].querySelectorAll<HTMLButtonElement>('.arrow-btn');
    expect(ariesArrows.length).toBe(2);
    expect(ariesArrows[0].disabled).toBeTrue();
    expect(ariesArrows[1].disabled).toBeFalse();
    expect(rows[1].querySelector('.row-arrows')).toBeNull();
  });

  it('renders one swipe dot per chart and highlights the visible one', () => {
    chartService.getAllCharts.and.returnValue(of([
      mockChart({ id: '1', sunSign: 'Aries' }),
      mockChart({ id: '2', sunSign: 'Aries' }),
      mockChart({ id: '3', sunSign: 'Aries' }),
      mockChart({ id: '4', sunSign: 'Leo' })
    ]));
    fixture.detectChanges();

    component.scrollState = { Aries: { prev: true, next: true, index: 1 } };
    fixture.detectChanges();

    const [aries, leo] = Array.from(el.querySelectorAll('.sign-row'));
    const dots = Array.from(aries.querySelectorAll('.dot'));
    expect(dots.length).toBe(3);
    expect(dots.map(d => d.classList.contains('active'))).toEqual([false, true, false]);
    // A single card needs no indicator
    expect(leo.querySelector('.carousel-dots')).toBeNull();
  });

  it('scrolls the carousel when an arrow is clicked', () => {
    chartService.getAllCharts.and.returnValue(of([mockChart()]));
    fixture.detectChanges();

    const track = el.querySelector('.carousel-track') as HTMLElement;
    const scrollBy = spyOn(track, 'scrollBy') as jasmine.Spy;

    component.scroll(track, 1);
    expect(scrollBy.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ behavior: 'smooth' }));
  });

  it('shows an empty state when there are no charts', () => {
    chartService.getAllCharts.and.returnValue(of([]));
    fixture.detectChanges();

    expect(el.querySelector('.empty-state')?.textContent).toContain('No astrological charts found');
  });

  it('shows an error and retries successfully', () => {
    chartService.getAllCharts.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0 }))
    );
    fixture.detectChanges();

    expect(component.isLoading).toBeFalse();
    expect(el.querySelector('.error-state')?.textContent).toContain('Cannot reach the server');

    chartService.getAllCharts.and.returnValue(of([mockChart()]));
    (el.querySelector('.retry-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.error-state')).toBeNull();
    expect(el.querySelectorAll('.chart-card').length).toBe(1);
  });

  describe('deleting a chart', () => {
    const click = (selector: string, root: ParentNode = el) => {
      (root.querySelector(selector) as HTMLButtonElement).click();
      fixture.detectChanges();
    };

    beforeEach(() => {
      chartService.getAllCharts.and.returnValue(of([
        mockChart({ id: 'a1', name: 'Alpha', sunSign: 'Aries' }),
        mockChart({ id: 'a2', name: 'Beta', sunSign: 'Aries' }),
        mockChart({ id: 'l1', name: 'Gamma', sunSign: 'Leo' })
      ]));
      fixture.detectChanges();
    });

    it('asks for confirmation before deleting', () => {
      click('.delete-btn');

      const overlay = el.querySelector('.confirm-overlay');
      expect(overlay?.textContent).toContain('Delete this chart?');
      expect(overlay?.textContent).toContain('Alpha');
      expect(el.querySelectorAll('.confirm-overlay').length).toBe(1);
      expect(chartService.deleteChart).not.toHaveBeenCalled();
    });

    it('cancel closes the confirmation without deleting', () => {
      click('.delete-btn');
      click('.confirm-overlay .btn-ghost');

      expect(el.querySelector('.confirm-overlay')).toBeNull();
      expect(chartService.deleteChart).not.toHaveBeenCalled();
    });

    it('deletes the chart, shows progress and removes the card', () => {
      const pending = new Subject<void>();
      chartService.deleteChart.and.returnValue(pending);

      click('.delete-btn');
      click('.confirm-overlay .btn-danger');

      expect(chartService.deleteChart).toHaveBeenCalledWith('a1');
      const deleteBtn = el.querySelector('.confirm-overlay .btn-danger') as HTMLButtonElement;
      expect(deleteBtn.disabled).toBeTrue();
      expect(deleteBtn.textContent).toContain('Deleting...');

      pending.next();
      pending.complete();
      fixture.detectChanges();

      const names = Array.from(el.querySelectorAll('.chart-card h3')).map(h => h.textContent?.trim());
      expect(names).toEqual(['Beta', 'Gamma']);
      expect(el.querySelector('.confirm-overlay')).toBeNull();
      expect(el.querySelector('.sign-row .row-count')?.textContent).toContain('1 chart');
    });

    it('removes the whole row when its last chart is deleted', () => {
      chartService.deleteChart.and.returnValue(of(undefined));
      const leoCard = el.querySelectorAll('.chart-card')[2];

      click('.delete-btn', leoCard);
      click('.confirm-overlay .btn-danger');

      const rows = Array.from(el.querySelectorAll('.sign-row .row-header h3')).map(h => h.textContent?.trim());
      expect(rows).toEqual(['Aries']);
    });

    it('shows an error and keeps the card when deletion fails', () => {
      chartService.deleteChart.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 404, error: { success: false, error: 'Chart not found' } }))
      );

      click('.delete-btn');
      click('.confirm-overlay .btn-danger');

      expect(el.querySelector('.confirm-error')?.textContent).toContain('Chart not found');
      expect(el.querySelectorAll('.chart-card').length).toBe(3);
      expect((el.querySelector('.confirm-overlay .btn-danger') as HTMLButtonElement).disabled).toBeFalse();
    });
  });

  describe('groupBySunSign', () => {
    it('groups in zodiac order, keeps API order inside a group and skips empty signs', () => {
      const groups = groupBySunSign([
        mockChart({ id: 'a', sunSign: 'Capricorn' }),
        mockChart({ id: 'b', sunSign: 'Aries' }),
        mockChart({ id: 'c', sunSign: 'Capricorn' })
      ]);

      expect(groups.map(g => g.sign)).toEqual(['Aries', 'Capricorn']);
      expect(groups[1].charts.map(c => c.id)).toEqual(['a', 'c']);
      expect(groups[1].element).toBe('Earth');
    });

    it('returns no groups for no charts', () => {
      expect(groupBySunSign([])).toEqual([]);
    });
  });

  describe('formatDate', () => {
    it('formats in UTC so the day does not shift', () => {
      expect(component.formatDate('1990-05-15T00:00:00.000Z')).toBe('May 15, 1990');
    });

    it('handles empty and invalid values', () => {
      expect(component.formatDate('')).toBe('Date not available');
      expect(component.formatDate('nope')).toBe('nope');
    });
  });

  describe('getPlanetsArray', () => {
    it('returns planets in astrological order with symbols, skipping missing ones', () => {
      const rows = component.getPlanetsArray(mockChart({
        planets: {
          mars: { sign: 'Aries', degree: 1 },
          sun: { sign: 'Leo', degree: 2 },
          pluto: { sign: 'Scorpio', degree: 3 }
        }
      }));

      expect(rows.map(r => r.name)).toEqual(['sun', 'mars', 'pluto']);
      expect(rows[0]).toEqual({ name: 'sun', symbol: '☉', sign: 'Leo', degree: 2 });
    });
  });
});
