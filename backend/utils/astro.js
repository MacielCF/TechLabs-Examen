const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

const toRad = deg => (deg * Math.PI) / 180;
const normalize = deg => ((deg % 360) + 360) % 360;

/**
 * Apparent ecliptic longitude of the Sun (tropical zodiac), in degrees [0, 360).
 * Low-precision formula from the U.S. Naval Observatory, accurate to about
 * 0.01° between 1950 and 2050 — more than enough to get sign and degree right.
 */
function sunLongitude(date) {
    const julianDay = date.getTime() / 86400000 + 2440587.5;
    const d = julianDay - 2451545.0; // days since J2000.0

    const meanAnomaly = toRad(normalize(357.529 + 0.98560028 * d));
    const meanLongitude = normalize(280.459 + 0.98564736 * d);

    return normalize(
        meanLongitude
        + 1.915 * Math.sin(meanAnomaly)
        + 0.020 * Math.sin(2 * meanAnomaly)
    );
}

/** Converts an ecliptic longitude into a zodiac sign and a whole degree (0-29). */
function longitudeToPosition(longitude) {
    const lon = normalize(longitude);
    return {
        sign: SIGNS[Math.floor(lon / 30)],
        degree: Math.floor(lon % 30)
    };
}

/**
 * Builds a UTC Date from a birth date ("YYYY-MM-DD" or ISO string) and time ("HH:MM").
 * The birth location's time zone is unknown, so the time is treated as UTC;
 * this can shift the Sun by at most ~0.5°.
 */
function toBirthInstant(birthDate, birthTime) {
    const date = new Date(String(birthDate).slice(0, 10) + 'T00:00:00.000Z');
    const [hours, minutes] = String(birthTime || '12:00').split(':').map(Number);
    date.setUTCHours(hours || 0, minutes || 0, 0, 0);
    return date;
}

/** Real Sun sign and degree for a birth date and time. */
function sunPosition(birthDate, birthTime) {
    return longitudeToPosition(sunLongitude(toBirthInstant(birthDate, birthTime)));
}

module.exports = { SIGNS, sunLongitude, longitudeToPosition, toBirthInstant, sunPosition };
