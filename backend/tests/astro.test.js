const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sunLongitude, longitudeToPosition, toBirthInstant, sunPosition } = require('../utils/astro');

describe('sunLongitude', () => {
    it('matches the J2000.0 reference value (280.37°)', () => {
        const lon = sunLongitude(new Date('2000-01-01T12:00:00Z'));
        assert.ok(Math.abs(lon - 280.37) < 0.05, 'got ' + lon);
    });

    it('is ~0° at the March 2024 equinox (2024-03-20 03:06 UTC)', () => {
        const lon = sunLongitude(new Date('2024-03-20T03:06:00Z'));
        const distanceFromZero = Math.min(lon, 360 - lon);
        assert.ok(distanceFromZero < 0.05, 'got ' + lon);
    });

    it('is ~90° at the June 2024 solstice (2024-06-20 20:51 UTC)', () => {
        const lon = sunLongitude(new Date('2024-06-20T20:51:00Z'));
        assert.ok(Math.abs(lon - 90) < 0.05, 'got ' + lon);
    });
});

describe('longitudeToPosition', () => {
    it('maps longitudes to signs and whole degrees', () => {
        assert.deepEqual(longitudeToPosition(0), { sign: 'Aries', degree: 0 });
        assert.deepEqual(longitudeToPosition(29.99), { sign: 'Aries', degree: 29 });
        assert.deepEqual(longitudeToPosition(30), { sign: 'Taurus', degree: 0 });
        assert.deepEqual(longitudeToPosition(359.5), { sign: 'Pisces', degree: 29 });
        assert.deepEqual(longitudeToPosition(-1), { sign: 'Pisces', degree: 29 });
    });
});

describe('toBirthInstant', () => {
    it('combines date and time as UTC', () => {
        assert.equal(toBirthInstant('1992-04-10', '10:00').toISOString(), '1992-04-10T10:00:00.000Z');
        assert.equal(toBirthInstant('1992-04-10T00:00:00.000Z', '23:45').toISOString(), '1992-04-10T23:45:00.000Z');
    });
});

describe('sunPosition', () => {
    const cases = [
        ['1992-04-10', '10:00', 'Aries'],
        ['1990-05-15', '10:30', 'Taurus'],
        ['1988-07-10', '20:15', 'Cancer'],
        // Cusp day: the Sun entered Leo on 1988-07-22 around 15:51 UTC
        ['1988-07-22', '10:00', 'Cancer'],
        ['1988-07-22', '20:15', 'Leo'],
        ['1995-09-30', '12:30', 'Libra'],
        ['1993-11-08', '03:20', 'Scorpio'],
        ['1985-12-20', '14:45', 'Sagittarius'],
        ['1991-01-18', '16:45', 'Capricorn'],
        ['1989-03-14', '22:00', 'Pisces']
    ];

    for (const [date, time, sign] of cases) {
        it(date + ' ' + time + ' is ' + sign, () => {
            assert.equal(sunPosition(date, time).sign, sign);
        });
    }

    it('returns degrees within the schema range', () => {
        for (let day = 1; day <= 365; day += 7) {
            const date = new Date(Date.UTC(2001, 0, day)).toISOString().slice(0, 10);
            const { degree } = sunPosition(date, '00:00');
            assert.ok(Number.isInteger(degree) && degree >= 0 && degree <= 29);
        }
    });
});
