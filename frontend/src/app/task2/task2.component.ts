import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormGroupDirective,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { finalize } from 'rxjs';
import { ChartService, Chart, CalculateChartRequest, PLANET_KEYS, PlanetKey } from '../services/chart.service';

/** Rejects values that are only whitespace. */
function notBlank(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  return typeof value === 'string' && value.length > 0 && value.trim().length === 0
    ? { blank: true }
    : null;
}

/** Rejects dates after today. */
function notInFuture(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return control.value > todayIso() ? { future: true } : null;
}

function todayIso(): string {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().split('T')[0];
}

const EMPTY_FORM = { name: '', birthDate: '', birthTime: '', birthLocation: '' };

@Component({
  selector: 'app-task2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './task2.component.html',
  styleUrls: ['./task2.component.css']
})
export class Task2Component {
  chartForm: FormGroup;
  isLoading = false;
  error: string | null = null;
  result: Chart | null = null;
  readonly maxDate = todayIso();
  readonly planetKeys = PLANET_KEYS;

  private readonly planetEmojis: Record<string, string> = {
    sun: '☀️',
    moon: '🌙',
    mercury: '☿',
    venus: '♀',
    mars: '♂',
    jupiter: '♃',
    saturn: '♄',
    uranus: '♅',
    neptune: '♆',
    pluto: '♇',
    ascendant: '↑'
  };

  constructor(
    private formBuilder: FormBuilder,
    private chartService: ChartService
  ) {
    this.chartForm = this.formBuilder.group({
      name: ['', [Validators.required, notBlank, Validators.maxLength(100)]],
      birthDate: ['', [Validators.required, notInFuture]],
      birthTime: ['', [Validators.required, Validators.pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)]],
      birthLocation: ['', [Validators.required, notBlank, Validators.minLength(2), Validators.maxLength(200)]]
    });
  }

  isInvalid(field: string): boolean {
    const control = this.chartForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  hasError(field: string, error: string): boolean {
    return !!this.chartForm.get(field)?.hasError(error);
  }

  onSubmit(formDirective: FormGroupDirective): void {
    if (this.chartForm.invalid) {
      this.chartForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.result = null;

    const { name, birthDate, birthTime, birthLocation } = this.chartForm.value;
    const request: CalculateChartRequest = {
      name: String(name).trim(),
      birthDate,
      // <input type="time"> may include seconds on some browsers (HH:MM:SS)
      birthTime: String(birthTime).slice(0, 5),
      birthLocation: String(birthLocation).trim()
    };

    this.chartForm.disable();

    this.chartService.calculateChart(request)
      .pipe(
        // Runs on success AND error, so the form never stays stuck in loading state
        finalize(() => {
          this.isLoading = false;
          this.chartForm.enable();
        })
      )
      .subscribe({
        next: chart => {
          if (!chart) {
            this.error = 'Invalid response from server';
            return;
          }
          this.result = chart;
          formDirective.resetForm(EMPTY_FORM);
        },
        error: err => {
          console.error('Error calculating chart:', err);
          this.error = ChartService.getErrorMessage(err, 'Failed to calculate chart. Please try again.');
        }
      });
  }

  onReset(formDirective: FormGroupDirective): void {
    formDirective.resetForm(EMPTY_FORM);
    this.result = null;
    this.error = null;
  }

  getPlanetEmoji(planet: string): string {
    return this.planetEmojis[planet.toLowerCase()] || '★';
  }

  getPlanetName(planet: string): string {
    return planet.charAt(0).toUpperCase() + planet.slice(1);
  }

  getPlanetSign(chart: Chart, planet: PlanetKey): string {
    return chart.planets?.[planet]?.sign ?? '--';
  }

  getPlanetDegree(chart: Chart, planet: PlanetKey): string {
    const degree = chart.planets?.[planet]?.degree;
    return degree !== undefined ? `${degree}°` : '--';
  }

  hasPlanet(chart: Chart, planet: PlanetKey): boolean {
    return !!chart.planets?.[planet];
  }
}
