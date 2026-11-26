import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Chart, ChartService } from './chart.service';
import { mockChart } from '../../testing/mock-chart';

describe('ChartService', () => {
  let service: ChartService;
  let http: HttpTestingController;

  beforeEach(() => {
    spyOn(console, 'error'); // expected logs from error-path tests
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ChartService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getAllCharts', () => {
    it('unwraps the data array from the paginated response', () => {
      let result: Chart[] | undefined;
      service.getAllCharts().subscribe(charts => (result = charts));

      const req = http.expectOne('/api/charts');
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, count: 1, total: 1, page: 1, pages: 1, data: [mockChart()] });

      expect(result?.length).toBe(1);
      expect(result?.[0].name).toBe('Sample Chart');
    });

    it('sends only defined query params', () => {
      service.getAllCharts({ limit: 50, sunSign: 'Leo', page: undefined }).subscribe();

      const req = http.expectOne(r => r.url === '/api/charts');
      expect(req.request.params.get('limit')).toBe('50');
      expect(req.request.params.get('sunSign')).toBe('Leo');
      expect(req.request.params.has('page')).toBeFalse();
      req.flush({ success: true, data: [] });
    });

    it('returns an empty array when data is missing', () => {
      let result: Chart[] | undefined;
      service.getAllCharts().subscribe(charts => (result = charts));
      http.expectOne('/api/charts').flush({ success: true });
      expect(result).toEqual([]);
    });
  });

  describe('getChartById', () => {
    it('requests the chart and unwraps data', () => {
      let result: Chart | undefined;
      service.getChartById('abc123').subscribe(chart => (result = chart));

      http.expectOne('/api/charts/abc123').flush({ success: true, data: mockChart() });
      expect(result?.id).toBe('abc123');
    });
  });

  describe('calculateChart', () => {
    it('POSTs the request body and unwraps the created chart', () => {
      const body = { birthDate: '2000-01-02', birthTime: '08:15', birthLocation: 'Santiago' };
      let result: Chart | undefined;
      service.calculateChart(body).subscribe(chart => (result = chart));

      const req = http.expectOne('/api/charts/calculate');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ success: true, data: mockChart({ birthLocation: 'Santiago' }) }, { status: 201, statusText: 'Created' });

      expect(result?.birthLocation).toBe('Santiago');
    });
  });

  describe('deleteChart', () => {
    it('sends a DELETE request for the chart id', () => {
      let completed = false;
      service.deleteChart('abc123').subscribe({ complete: () => (completed = true) });

      const req = http.expectOne('/api/charts/abc123');
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, data: {} });

      expect(completed).toBeTrue();
    });
  });

  describe('initializeProject', () => {
    it('calls /api/init only once and shares the response', () => {
      const responses: unknown[] = [];
      service.initializeProject().subscribe(r => responses.push(r));
      service.initializeProject().subscribe(r => responses.push(r));

      http.expectOne('/api/init').flush({ success: true, data: {} });

      expect(responses.length).toBe(2);
      expect(responses[0]).toEqual(responses[1]);
    });

    it('emits null instead of erroring when the request fails', () => {
      let result: unknown = 'not-called';
      service.initializeProject().subscribe(r => (result = r));

      http.expectOne('/api/init').flush('boom', { status: 500, statusText: 'Server Error' });
      expect(result).toBeNull();
    });
  });

  describe('getErrorMessage', () => {
    const httpError = (status: number, error: unknown) =>
      new HttpErrorResponse({ status, error, statusText: 'x' });

    it('reports an unreachable backend', () => {
      expect(ChartService.getErrorMessage(httpError(0, null), 'fallback')).toContain('Cannot reach the server');
    });

    it('joins express-validator messages', () => {
      const err = httpError(400, { errors: [{ msg: 'Birth date is required' }, { msg: 'Birth time is required' }] });
      expect(ChartService.getErrorMessage(err, 'fallback')).toBe('Birth date is required. Birth time is required');
    });

    it('uses the error string from the API', () => {
      expect(ChartService.getErrorMessage(httpError(404, { error: 'Chart not found' }), 'fallback')).toBe('Chart not found');
    });

    it('uses a generic message for 5xx without body', () => {
      expect(ChartService.getErrorMessage(httpError(503, null), 'fallback')).toContain('server encountered an error');
    });

    it('falls back for non-HTTP errors', () => {
      expect(ChartService.getErrorMessage(new Error('x'), 'fallback')).toBe('fallback');
    });
  });
});
