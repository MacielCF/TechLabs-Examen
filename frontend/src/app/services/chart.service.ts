import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';

export interface Planet {
    sign: string;
    degree: number;
}

export const PLANET_KEYS = [
    'sun', 'moon', 'mercury', 'venus', 'mars',
    'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'
] as const;

export type PlanetKey = typeof PLANET_KEYS[number];

export type Planets = Partial<Record<PlanetKey, Planet>>;

export interface Chart {
    id: string;
    _id?: string;
    name: string;
    birthDate: string;
    birthTime: string;
    birthLocation: string;
    latitude?: number;
    longitude?: number;
    sunSign: string;
    moonSign: string;
    risingSign: string;
    planets: Planets;
    notes?: string;
    isPublic?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface CalculateChartRequest {
    name?: string;
    birthDate: string;
    birthTime: string;
    birthLocation: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
    error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    count: number;
    total: number;
    page: number;
    pages: number;
}

export interface ChartQuery {
    page?: number;
    limit?: number;
    sunSign?: string;
    isPublic?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

@Injectable({
    providedIn: 'root'
})
export class ChartService {
    private apiUrl = '/api';
    private init$?: Observable<ApiResponse<any> | null>;

    constructor(private http: HttpClient) { }

    getCharts(query: ChartQuery = {}): Observable<PaginatedResponse<Chart>> {
        let params = new HttpParams();
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params = params.set(key, String(value));
            }
        });
        return this.http.get<PaginatedResponse<Chart>>(`${this.apiUrl}/charts`, { params });
    }

    getAllCharts(query: ChartQuery = {}): Observable<Chart[]> {
        return this.getCharts(query).pipe(map(res => res.data ?? []));
    }

    getChartById(id: string): Observable<Chart> {
        return this.http
            .get<ApiResponse<Chart>>(`${this.apiUrl}/charts/${id}`)
            .pipe(map(res => res.data));
    }

    calculateChart(request: CalculateChartRequest): Observable<Chart> {
        return this.http
            .post<ApiResponse<Chart>>(`${this.apiUrl}/charts/calculate`, request)
            .pipe(map(res => res.data));
    }

    deleteChart(id: string): Observable<void> {
        return this.http
            .delete<ApiResponse<unknown>>(`${this.apiUrl}/charts/${id}`)
            .pipe(map(() => undefined));
    }

    /**
     * Calls /api/init once (seeds the DB on first run) and shares the result,
     * so components can wait for it before querying charts.
     */
    initializeProject(): Observable<ApiResponse<any> | null> {
        if (!this.init$) {
            this.init$ = this.http.get<ApiResponse<any>>(`${this.apiUrl}/init`).pipe(
                catchError(err => {
                    console.error('Initialization error:', err);
                    return of(null);
                }),
                shareReplay(1)
            );
        }
        return this.init$;
    }

    /** Builds a user-friendly message from any HTTP error returned by the API. */
    static getErrorMessage(err: unknown, fallback: string): string {
        if (err instanceof HttpErrorResponse) {
            if (err.status === 0) {
                return 'Cannot reach the server. Make sure the backend is running on port 3000.';
            }
            const body = err.error;
            if (body?.errors?.length) {
                return body.errors.map((e: { msg: string }) => e.msg).join('. ');
            }
            if (typeof body?.error === 'string') return body.error;
            if (typeof body?.message === 'string') return body.message;
            if (err.status >= 500) return 'The server encountered an error. Please try again later.';
        }
        return fallback;
    }
}
