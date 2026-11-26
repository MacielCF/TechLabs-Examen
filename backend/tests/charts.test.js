const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { connect, clear, disconnect, validChart } = require('./helpers');
const app = require('../app');
const Chart = require('../models/Chart');

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars',
    'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

before(connect);
after(disconnect);
beforeEach(clear);

describe('GET /api/health', () => {
    it('returns ok', async () => {
        const res = await request(app).get('/api/health').expect(200);
        assert.equal(res.body.status, 'ok');
    });
});

describe('GET /api/charts', () => {
    it('returns an empty paginated list when there are no charts', async () => {
        const res = await request(app).get('/api/charts').expect(200);
        assert.equal(res.body.success, true);
        assert.deepEqual(res.body.data, []);
        assert.equal(res.body.total, 0);
        assert.equal(res.body.page, 1);
    });

    it('paginates results', async () => {
        await Chart.insertMany(Array.from({ length: 15 }, (_, i) => validChart({ name: 'Chart ' + i })));

        const res = await request(app).get('/api/charts?page=2&limit=10').expect(200);
        assert.equal(res.body.count, 5);
        assert.equal(res.body.total, 15);
        assert.equal(res.body.page, 2);
        assert.equal(res.body.pages, 2);
    });

    it('defaults to 10 items per page', async () => {
        await Chart.insertMany(Array.from({ length: 12 }, () => validChart()));
        const res = await request(app).get('/api/charts').expect(200);
        assert.equal(res.body.count, 10);
    });

    it('falls back to safe values for invalid page/limit', async () => {
        await Chart.create(validChart());
        const res = await request(app).get('/api/charts?page=abc&limit=-5').expect(200);
        assert.equal(res.body.page, 1);
        assert.equal(res.body.count, 1);
    });

    it('filters by sunSign and isPublic', async () => {
        await Chart.insertMany([
            validChart({ sunSign: 'Leo', isPublic: true }),
            validChart({ sunSign: 'Leo', isPublic: false }),
            validChart({ sunSign: 'Aries', isPublic: true })
        ]);

        const bySign = await request(app).get('/api/charts?sunSign=Leo').expect(200);
        assert.equal(bySign.body.total, 2);

        const publicLeo = await request(app).get('/api/charts?sunSign=Leo&isPublic=true').expect(200);
        assert.equal(publicLeo.body.total, 1);
    });

    it('sorts by the requested field and order', async () => {
        await Chart.insertMany([
            validChart({ name: 'B' }),
            validChart({ name: 'A' }),
            validChart({ name: 'C' })
        ]);
        const res = await request(app).get('/api/charts?sortBy=name&sortOrder=asc').expect(200);
        assert.deepEqual(res.body.data.map(c => c.name), ['A', 'B', 'C']);
    });

    it('exposes a string id and hides __v', async () => {
        await Chart.create(validChart());
        const res = await request(app).get('/api/charts').expect(200);
        const chart = res.body.data[0];
        assert.equal(typeof chart.id, 'string');
        assert.equal(chart.__v, undefined);
    });
});

describe('GET /api/charts/:id', () => {
    it('returns the chart', async () => {
        const created = await Chart.create(validChart({ name: 'Find me' }));
        const res = await request(app).get('/api/charts/' + created.id).expect(200);
        assert.equal(res.body.data.name, 'Find me');
    });

    it('returns 404 for an unknown id', async () => {
        await request(app).get('/api/charts/507f1f77bcf86cd799439011').expect(404);
    });

    it('returns 404 for a malformed id', async () => {
        const res = await request(app).get('/api/charts/not-an-id').expect(404);
        assert.equal(res.body.error, 'Chart not found');
    });
});

describe('POST /api/charts/calculate', () => {
    const payload = { birthDate: '2000-01-02', birthTime: '08:15', birthLocation: 'Santiago, Chile' };

    it('creates a chart with all planets', async () => {
        const res = await request(app).post('/api/charts/calculate').send(payload).expect(201);
        const chart = res.body.data;

        assert.equal(res.body.success, true);
        assert.equal(chart.birthTime, '08:15');
        assert.equal(chart.birthLocation, 'Santiago, Chile');
        assert.equal(chart.birthDate, '2000-01-02T00:00:00.000Z');
        assert.equal(chart.name, 'Chart for Santiago, Chile');
        assert.ok(SIGNS.includes(chart.sunSign));
        assert.ok(SIGNS.includes(chart.moonSign));
        assert.ok(SIGNS.includes(chart.risingSign));

        for (const p of PLANETS) {
            assert.ok(SIGNS.includes(chart.planets[p].sign), p + ' has a valid sign');
            assert.ok(chart.planets[p].degree >= 0 && chart.planets[p].degree <= 29, p + ' degree in range');
        }

        assert.equal(await Chart.countDocuments(), 1);
    });

    it('uses the provided name (trimmed)', async () => {
        const res = await request(app)
            .post('/api/charts/calculate')
            .send({ ...payload, name: '  Facundo Maciel  ' })
            .expect(201);
        assert.equal(res.body.data.name, 'Facundo Maciel');
    });

    it('rejects a blank or too long name', async () => {
        await request(app).post('/api/charts/calculate').send({ ...payload, name: '   ' }).expect(400);
        await request(app).post('/api/charts/calculate').send({ ...payload, name: 'x'.repeat(101) }).expect(400);
    });

    it('calculates the real Sun sign and degree from the birth date', async () => {
        const { body } = await request(app)
            .post('/api/charts/calculate')
            .send({ birthDate: '1992-04-10', birthTime: '10:00', birthLocation: 'Corrientes, Argentina' })
            .expect(201);

        assert.equal(body.data.sunSign, 'Aries');
        assert.deepEqual(body.data.planets.sun, { sign: 'Aries', degree: 20 });
    });

    it('returns the same Sun for the same input', async () => {
        const first = await request(app).post('/api/charts/calculate').send(payload).expect(201);
        const second = await request(app).post('/api/charts/calculate').send(payload).expect(201);
        assert.deepEqual(first.body.data.planets.sun, second.body.data.planets.sun);
    });

    it('keeps sun/moon planet signs consistent with sunSign/moonSign', async () => {
        for (let i = 0; i < 5; i++) {
            const { body } = await request(app).post('/api/charts/calculate').send(payload).expect(201);
            assert.equal(body.data.planets.sun.sign, body.data.sunSign);
            assert.equal(body.data.planets.moon.sign, body.data.moonSign);
        }
    });

    it('rejects missing fields with validation messages', async () => {
        const res = await request(app).post('/api/charts/calculate').send({}).expect(400);
        const fields = res.body.errors.map(e => e.path);
        assert.ok(fields.includes('birthDate'));
        assert.ok(fields.includes('birthTime'));
        assert.ok(fields.includes('birthLocation'));
        assert.equal(await Chart.countDocuments(), 0);
    });

    it('rejects an invalid time', async () => {
        const res = await request(app)
            .post('/api/charts/calculate')
            .send({ ...payload, birthTime: '25:00' })
            .expect(400);
        assert.match(res.body.errors[0].msg, /HH:MM/);
    });

    it('rejects an invalid date', async () => {
        await request(app)
            .post('/api/charts/calculate')
            .send({ ...payload, birthDate: 'not-a-date' })
            .expect(400);
    });

    it('rejects a location that is too short', async () => {
        await request(app)
            .post('/api/charts/calculate')
            .send({ ...payload, birthLocation: 'x' })
            .expect(400);
    });
});

describe('PUT /api/charts/:id', () => {
    it('updates allowed fields only', async () => {
        const created = await Chart.create(validChart());
        const res = await request(app)
            .put('/api/charts/' + created.id)
            .send({ name: 'Renamed', isPublic: false, sunSign: 'Aries' })
            .expect(200);

        assert.equal(res.body.data.name, 'Renamed');
        assert.equal(res.body.data.isPublic, false);
        assert.equal(res.body.data.sunSign, 'Taurus', 'sunSign is not updatable');
    });

    it('validates the payload', async () => {
        const created = await Chart.create(validChart());
        await request(app).put('/api/charts/' + created.id).send({ birthTime: '99:99' }).expect(400);
    });

    it('returns 404 for an unknown id', async () => {
        await request(app).put('/api/charts/507f1f77bcf86cd799439011').send({ name: 'x' }).expect(404);
    });
});

describe('DELETE /api/charts/:id', () => {
    it('deletes the chart', async () => {
        const created = await Chart.create(validChart());
        await request(app).delete('/api/charts/' + created.id).expect(200);
        assert.equal(await Chart.countDocuments(), 0);
    });

    it('returns 404 for an unknown id', async () => {
        await request(app).delete('/api/charts/507f1f77bcf86cd799439011').expect(404);
    });
});

describe('GET /api/charts/sign/:sign', () => {
    it('returns charts for a valid sign', async () => {
        await Chart.insertMany([validChart({ sunSign: 'Leo' }), validChart({ sunSign: 'Aries' })]);
        const res = await request(app).get('/api/charts/sign/Leo').expect(200);
        assert.equal(res.body.count, 1);
        assert.equal(res.body.data[0].sunSign, 'Leo');
    });

    it('rejects an invalid sign', async () => {
        await request(app).get('/api/charts/sign/Ophiuchus').expect(400);
    });
});

describe('GET /api/charts/stats/summary', () => {
    it('returns totals and sign distribution', async () => {
        await Chart.insertMany([
            validChart({ sunSign: 'Leo', isPublic: true }),
            validChart({ sunSign: 'Leo', isPublic: false }),
            validChart({ sunSign: 'Aries', isPublic: true })
        ]);
        const { body } = await request(app).get('/api/charts/stats/summary').expect(200);

        assert.equal(body.data.totalCharts, 3);
        assert.equal(body.data.publicCharts, 2);
        assert.equal(body.data.privateCharts, 1);
        assert.equal(body.data.recentCharts, 3);
        assert.deepEqual(body.data.signDistribution[0], { _id: 'Leo', count: 2 });
    });
});

describe('Unknown routes', () => {
    it('return a JSON 404', async () => {
        const res = await request(app).get('/api/does-not-exist').expect(404);
        assert.deepEqual(res.body, { success: false, error: 'Route not found' });
    });
});
