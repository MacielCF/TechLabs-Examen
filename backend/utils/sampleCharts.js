const { SIGNS, sunPosition } = require('./astro');

/** Minimum number of charts each Sun sign should have after seeding. */
const MIN_CHARTS_PER_SIGN = 3;

/** Month (1-12) and day on which the Sun enters each sign (approximate). */
const SIGN_START = {
    Aries: [3, 21], Taurus: [4, 20], Gemini: [5, 21], Cancer: [6, 21],
    Leo: [7, 23], Virgo: [8, 23], Libra: [9, 23], Scorpio: [10, 23],
    Sagittarius: [11, 22], Capricorn: [12, 22], Aquarius: [1, 20], Pisces: [2, 19]
};

const LOCATIONS = [
    { name: 'Buenos Aires, Argentina', latitude: -34.6037, longitude: -58.3816 },
    { name: 'Santiago, Chile', latitude: -33.4489, longitude: -70.6693 },
    { name: 'Mexico City, Mexico', latitude: 19.4326, longitude: -99.1332 },
    { name: 'Madrid, Spain', latitude: 40.4168, longitude: -3.7038 },
    { name: 'Lima, Peru', latitude: -12.0464, longitude: -77.0428 },
    { name: 'Bogotá, Colombia', latitude: 4.711, longitude: -74.0721 },
    { name: 'Montevideo, Uruguay', latitude: -34.9011, longitude: -56.1645 },
    { name: 'London, UK', latitude: 51.5072, longitude: -0.1276 },
    { name: 'Toronto, Canada', latitude: 43.6532, longitude: -79.3832 },
    { name: 'Rome, Italy', latitude: 41.9028, longitude: 12.4964 },
    { name: 'Tokyo, Japan', latitude: 35.6762, longitude: 139.6503 },
    { name: 'Sydney, Australia', latitude: -33.8688, longitude: 151.2093 }
];

const FIRST_NAMES = [
    'Sofía', 'Mateo', 'Valentina', 'Lucas', 'Camila', 'Martín', 'Isabella', 'Diego',
    'Emma', 'Tomás', 'Mía', 'Joaquín', 'Lucía', 'Benjamín', 'Julieta', 'Nicolás',
    'Renata', 'Santiago', 'Catalina', 'Gabriel', 'Olivia', 'Andrés', 'Elena', 'Bruno'
];

/** Small deterministic PRNG (mulberry32) so seeded data is stable between runs. */
function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const pad = n => String(n).padStart(2, '0');

/**
 * Builds `count` sample charts whose real Sun sign is `sign`.
 * `offset` lets callers continue numbering when a sign already has some charts.
 */
function buildSampleCharts(sign, count, offset = 0) {
    const signIndex = SIGNS.indexOf(sign);
    if (signIndex === -1) throw new Error('Unknown sign: ' + sign);

    const [month, day] = SIGN_START[sign];
    const charts = [];

    for (let i = 0; i < count; i++) {
        const n = offset + i;
        const rand = seededRandom(signIndex * 1000 + n + 1);
        const pick = list => list[Math.floor(rand() * list.length)];
        const randomSign = () => SIGNS[Math.floor(rand() * SIGNS.length)];
        const randomDegree = () => Math.floor(rand() * 30);

        // A date safely inside the sign (4-24 days after it starts), in a year between 1975 and 2004
        const year = 1975 + Math.floor(rand() * 30);
        const date = new Date(Date.UTC(year, month - 1, day + 4 + Math.floor(rand() * 21)));
        const birthDate = date.toISOString().slice(0, 10);
        const birthTime = pad(Math.floor(rand() * 24)) + ':' + pad(Math.floor(rand() * 60));
        const location = pick(LOCATIONS);
        const sun = sunPosition(birthDate, birthTime);
        const moonSign = randomSign();

        charts.push({
            // Rotate through names so charts of the same sign never share one
            name: FIRST_NAMES[(signIndex * 5 + n) % FIRST_NAMES.length] + "'s " + sign + ' Chart',
            birthDate: new Date(birthDate),
            birthTime,
            birthLocation: location.name,
            latitude: location.latitude,
            longitude: location.longitude,
            sunSign: sun.sign,
            moonSign,
            risingSign: randomSign(),
            planets: {
                sun,
                moon: { sign: moonSign, degree: randomDegree() },
                mercury: { sign: randomSign(), degree: randomDegree() },
                venus: { sign: randomSign(), degree: randomDegree() },
                mars: { sign: randomSign(), degree: randomDegree() },
                jupiter: { sign: randomSign(), degree: randomDegree() },
                saturn: { sign: randomSign(), degree: randomDegree() },
                uranus: { sign: randomSign(), degree: randomDegree() },
                neptune: { sign: randomSign(), degree: randomDegree() },
                pluto: { sign: randomSign(), degree: randomDegree() }
            },
            isPublic: rand() > 0.15,
            notes: 'Generated sample chart'
        });
    }

    return charts;
}

/**
 * Returns the sample charts needed so every sign reaches MIN_CHARTS_PER_SIGN,
 * given the current number of charts per sign.
 */
function buildTopUpCharts(countsBySign, minPerSign = MIN_CHARTS_PER_SIGN) {
    return SIGNS.flatMap(sign => {
        const current = countsBySign[sign] || 0;
        const missing = Math.max(minPerSign - current, 0);
        return missing ? buildSampleCharts(sign, missing, current) : [];
    });
}

module.exports = { MIN_CHARTS_PER_SIGN, buildSampleCharts, buildTopUpCharts };
