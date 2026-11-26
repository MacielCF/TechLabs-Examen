const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { connect, clear, disconnect, validChart } = require('./helpers');
const app = require('../app');
const Chart = require('../models/Chart');
const { SIGNS } = require('../utils/astro');
const { MIN_CHARTS_PER_SIGN } = require('../utils/sampleCharts');

before(connect);
after(disconnect);
beforeEach(clear);

async function countsBySign() {
    const counts = await Chart.aggregate([{ $group: { _id: '$sunSign', count: { $sum: 1 } } }]);
    return Object.fromEntries(counts.map(c => [c._id, c.count]));
}

describe('GET /api/init', () => {
    it('seeds an empty database so every sign has at least 3 charts', async () => {
        const res = await request(app).get('/api/init').expect(200);

        assert.equal(res.body.success, true);
        assert.equal(res.body.data.database.connected, true);
        assert.equal(res.body.data.charts.seeded, true);

        const counts = await countsBySign();
        for (const sign of SIGNS) {
            assert.ok(counts[sign] >= MIN_CHARTS_PER_SIGN, sign + ' has ' + counts[sign] + ' charts');
        }
        // 10 hand-written charts + generated ones to reach 3 per sign
        assert.equal(await Chart.countDocuments(), SIGNS.length * MIN_CHARTS_PER_SIGN);
        assert.equal(res.body.data.charts.count, SIGNS.length * MIN_CHARTS_PER_SIGN);
    });

    it('does not seed a database that already has charts (deleted charts stay deleted)', async () => {
        await Chart.create(validChart({ name: 'Mine', sunSign: 'Taurus' }));

        const res = await request(app).get('/api/init').expect(200);

        assert.equal(res.body.data.charts.seeded, false);
        assert.equal(res.body.data.charts.added, 0);
        assert.equal(await Chart.countDocuments(), 1);
    });

    it('re-seeds after every chart has been deleted', async () => {
        await request(app).get('/api/init').expect(200);
        await Chart.deleteMany({});

        const res = await request(app).get('/api/init').expect(200);

        assert.equal(res.body.data.charts.seeded, true);
        assert.equal(await Chart.countDocuments(), SIGNS.length * MIN_CHARTS_PER_SIGN);
    });

    it('is idempotent: a second call adds nothing', async () => {
        await request(app).get('/api/init').expect(200);
        const total = await Chart.countDocuments();

        const res = await request(app).get('/api/init').expect(200);

        assert.equal(res.body.data.charts.added, 0);
        assert.equal(res.body.data.charts.seeded, false);
        assert.equal(await Chart.countDocuments(), total);
    });

    it('generated charts have a Sun sign that matches their birth date', async () => {
        await request(app).get('/api/init').expect(200);
        const generated = await Chart.find({ notes: 'Generated sample chart' }).lean();
        const { sunPosition } = require('../utils/astro');

        assert.ok(generated.length > 0);
        for (const chart of generated) {
            const date = chart.birthDate.toISOString().slice(0, 10);
            assert.equal(sunPosition(date, chart.birthTime).sign, chart.sunSign, chart.name);
            assert.equal(chart.planets.sun.sign, chart.sunSign);
        }
    });

    // Regression test: this endpoint used to download and eval() remote code
    it('does not make any outbound network request', async () => {
        const originalFetch = global.fetch;
        let called = false;
        global.fetch = async () => {
            called = true;
            throw new Error('Network access is not allowed');
        };
        try {
            await request(app).get('/api/init').expect(200);
        } finally {
            global.fetch = originalFetch;
        }
        assert.equal(called, false);
    });
});
