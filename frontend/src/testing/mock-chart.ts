import { Chart } from '../app/services/chart.service';

/** Builds a chart shaped like the API response, for use in specs. */
export const mockChart = (overrides: Partial<Chart> = {}): Chart => ({
  id: 'abc123',
  name: 'Sample Chart',
  birthDate: '1990-05-15T00:00:00.000Z',
  birthTime: '10:30',
  birthLocation: 'New York, NY',
  sunSign: 'Taurus',
  moonSign: 'Scorpio',
  risingSign: 'Leo',
  planets: {
    sun: { sign: 'Taurus', degree: 24 },
    moon: { sign: 'Scorpio', degree: 12 },
    mercury: { sign: 'Gemini', degree: 8 },
    venus: { sign: 'Aries', degree: 18 },
    mars: { sign: 'Pisces', degree: 6 }
  },
  isPublic: true,
  createdAt: '2026-01-01T12:00:00.000Z',
  ...overrides
});
