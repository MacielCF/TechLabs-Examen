import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { Task2Component } from './task2.component';
import { Chart, ChartService } from '../services/chart.service';
import { mockChart } from '../../testing/mock-chart';

describe('Task2Component', () => {
  let fixture: ComponentFixture<Task2Component>;
  let component: Task2Component;
  let chartService: jasmine.SpyObj<ChartService>;
  let el: HTMLElement;

  const setInput = (id: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>('#' + id)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  };

  const fillValidForm = () => {
    setInput('name', '  Facundo Maciel  ');
    setInput('birthDate', '2000-01-02');
    setInput('birthTime', '08:15');
    setInput('birthLocation', '  Santiago, Chile  ');
    fixture.detectChanges();
  };

  const submit = () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    spyOn(console, 'error'); // expected logs from error-path tests
    chartService = jasmine.createSpyObj<ChartService>('ChartService', ['calculateChart']);

    await TestBed.configureTestingModule({
      imports: [Task2Component],
      providers: [{ provide: ChartService, useValue: chartService }]
    }).compileComponents();

    fixture = TestBed.createComponent(Task2Component);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('renders name, date, time and location inputs', () => {
    expect(el.querySelector('input#name[type="text"]')).not.toBeNull();
    expect(el.querySelector('input#birthDate[type="date"]')).not.toBeNull();
    expect(el.querySelector('input#birthTime[type="time"]')).not.toBeNull();
    expect(el.querySelector('input#birthLocation[type="text"]')).not.toBeNull();
  });

  describe('validation', () => {
    it('requires all fields and shows messages on submit without calling the API', () => {
      submit();

      expect(chartService.calculateChart).not.toHaveBeenCalled();
      const text = el.textContent ?? '';
      expect(text).toContain('Name is required');
      expect(text).toContain('Birth date is required');
      expect(text).toContain('Birth time is required');
      expect(text).toContain('Birth location is required');
      expect(el.querySelectorAll('input.error').length).toBe(4);
    });

    it('rejects a whitespace-only or too long name', () => {
      setInput('name', '   ');
      fixture.detectChanges();
      expect(el.textContent).toContain('Name is required');

      setInput('name', 'x'.repeat(101));
      fixture.detectChanges();
      expect(el.textContent).toContain('Name must be at most 100 characters');
    });

    it('rejects future dates', () => {
      const nextYear = new Date().getFullYear() + 1;
      setInput('birthDate', nextYear + '-01-01');
      fixture.detectChanges();

      expect(el.textContent).toContain('Birth date cannot be in the future');
    });

    it('rejects whitespace-only and too-short locations', () => {
      setInput('birthLocation', '   ');
      fixture.detectChanges();
      expect(el.textContent).toContain('Birth location is required');

      setInput('birthLocation', 'x');
      fixture.detectChanges();
      expect(el.textContent).toContain('at least 2 characters');
    });

    it('rejects an invalid time format', () => {
      component.chartForm.get('birthTime')!.setValue('25:99');
      component.chartForm.get('birthTime')!.markAsTouched();
      fixture.detectChanges();
      expect(el.textContent).toContain('Please enter a valid time');
    });
  });

  describe('submission', () => {
    it('sends trimmed values, shows a loading state and then the result', () => {
      const response = new Subject<Chart>();
      chartService.calculateChart.and.returnValue(response);

      fillValidForm();
      submit();

      expect(chartService.calculateChart).toHaveBeenCalledWith({
        name: 'Facundo Maciel',
        birthDate: '2000-01-02',
        birthTime: '08:15',
        birthLocation: 'Santiago, Chile'
      });
      expect(component.isLoading).toBeTrue();
      expect(el.querySelector('.spinner')).not.toBeNull();
      expect(component.chartForm.disabled).toBeTrue();

      response.next(mockChart({ name: 'Chart for Santiago, Chile', sunSign: 'Capricorn' }));
      response.complete();
      fixture.detectChanges();

      expect(component.isLoading).toBeFalse();
      const result = el.querySelector('.result-card');
      expect(result?.textContent).toContain('Chart for Santiago, Chile');
      expect(result?.textContent).toContain('Capricorn');
      expect(result?.querySelectorAll('.planet-card').length).toBe(5);
    });

    it('resets the form after a successful submission', () => {
      chartService.calculateChart.and.returnValue(of(mockChart()));

      fillValidForm();
      submit();

      expect(component.chartForm.enabled).toBeTrue();
      expect(component.chartForm.value).toEqual({ name: '', birthDate: '', birthTime: '', birthLocation: '' });
      expect(component.chartForm.pristine).toBeTrue();
      expect(el.querySelectorAll('input.error').length).toBe(0);
    });

    it('shows API errors and recovers from the loading state', () => {
      chartService.calculateChart.and.returnValue(throwError(() => new HttpErrorResponse({
        status: 400,
        error: { success: false, errors: [{ msg: 'Birth time must be in HH:MM format (24-hour)' }] }
      })));

      fillValidForm();
      submit();

      expect(component.isLoading).toBeFalse();
      expect(component.chartForm.enabled).toBeTrue();
      expect(el.querySelector('.alert-error')?.textContent).toContain('Birth time must be in HH:MM format');
      expect(el.querySelector('.result-card')).toBeNull();
      // Values are kept so the user can fix them
      expect(component.chartForm.value.birthLocation).toBe('  Santiago, Chile  ');
    });
  });

  it('reset button clears the form, result and error', () => {
    component.result = mockChart();
    component.error = 'Something failed';
    fillValidForm();

    (el.querySelector('button.btn-secondary') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.result).toBeNull();
    expect(component.error).toBeNull();
    expect(component.chartForm.value).toEqual({ name: '', birthDate: '', birthTime: '', birthLocation: '' });
  });
});
