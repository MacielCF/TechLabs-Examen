# Terri Quintel Astrology

Full-stack app to browse and calculate astrological birth charts.

- **Backend:** Node.js, Express, MongoDB (Mongoose)
- **Frontend:** Angular 17 (standalone components, reactive forms)

| Task | Route | Description |
| --- | --- | --- |
| Task 1 | `/task1` | Card grid of all saved charts |
| Task 2 | `/task2` | Form that calculates and saves a new chart |

## Prerequisites

- Node.js 18 or newer
- MongoDB running locally (or a MongoDB Atlas connection string)
- Google Chrome (only needed for the frontend tests)

## Getting started

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # set MONGODB_URI if you are not using the default
npm run dev               # http://localhost:3000
```

#### Using MongoDB Atlas

1. Set these variables in `backend/.env` instead of `MONGODB_URI`:

   ```env
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_HOST=cluster0.xxxxx.mongodb.net   # from Atlas > Connect > Drivers, the part after "@"
   DB_NAME=terri-quintel-astrology     # optional
   ```

2. In Atlas, go to **Network Access** and add your current IP address.

If Node's DNS resolver cannot resolve the cluster's SRV record (`querySrv ECONNREFUSED`, common on some Windows setups), the backend retries once with public DNS servers. You can also set them explicitly with `DNS_SERVERS=8.8.8.8,1.1.1.1`.

### 2. Frontend

```bash
cd frontend
npm install
npm start                 # http://localhost:4200
```

The Angular dev server proxies every `/api` request to `http://localhost:3000` (see `frontend/proxy.conf.json`).

On first load, the app calls `GET /api/init`:

- If the database is empty, it seeds 10 hand-written sample charts, then generates more so every Sun sign has at least 3 (`backend/utils/sampleCharts.js`). Their birth dates really fall in that sign.
- If the database already has charts, it adds nothing, so deleted charts stay deleted.

## Running the tests

### Backend: 52 tests

```bash
cd backend
npm test
```

There are two kinds of tests, both written with Node's built-in test runner:

- **Unit tests** for the solar calculation (`tests/astro.test.js`), checked against known equinox, solstice and J2000 values.
- **Integration tests** for every endpoint, using [supertest](https://github.com/ladjs/supertest).

The integration tests cover:

- Pagination, filtering and sorting
- Validation errors
- 404s
- Create, update and delete
- Statistics
- Seeding

By default the tests start an in-memory MongoDB ([mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server)), so they never touch your real data. The first run downloads a MongoDB binary.

To run against your own instance instead, set `MONGODB_TEST_URI`:

```bash
MONGODB_TEST_URI=mongodb://localhost:27017/astrology-test npm test
```

> The test database is dropped when the run finishes.

### Frontend: 41 tests

```bash
cd frontend
npm run test:ci           # single run in headless Chrome
npm test                  # watch mode
```

The tests use Karma and Jasmine. They cover:

- **`ChartService`:** HTTP calls, response unwrapping, error messages, and the shared `/api/init` call
- **`Task1Component`:** loading, empty and error states; retry; grouping into one carousel per sign; card rendering; date formatting
- **`Task2Component`:** validation messages, submission, loading state, form reset, and API errors

## Features

### Task 1: Display astrological charts

- Loads charts from `GET /api/charts` after project initialization, so the first visit is not empty
- Each card shows:
  - Name
  - Birth date, time and location
  - Sun, Moon and Rising signs
  - All 10 planets with sign and degree
- Loading spinner, error message with a retry button, and an empty state
- Birth dates are formatted in UTC, so the day does not shift in negative-offset time zones
- Charts are grouped into one horizontal carousel per Sun sign, in zodiac order:
  - Each row shows the sign's symbol, date range, element and number of charts
  - Arrow buttons appear only when a row can scroll, and are disabled at its start and end
  - Supports scroll-snap and touch swipe
  - On mobile (≤ 768px) it becomes a swipe-only slider: no arrows, one card per swipe with the next one peeking in, and dots showing the current position
- Delete a chart from its card:
  - Asks for confirmation in an overlay on the card before deleting
  - Shows progress while deleting, and an error if the request fails
  - Removes the card, and its row when it was the last chart of that sign
- Dark theme

### Task 2: Birth chart calculator

- Name, date picker, time input and location field, with these validations:
  - All fields are required
  - The name must be at most 100 characters and not only whitespace
  - The date cannot be in the future
  - The location must be 2 to 200 characters and not only whitespace
- Inline validation messages, plus the backend's own validation errors when it rejects a request
- `POST /api/charts/calculate`, with a loading state on the button; the form is disabled during the request
- Shows the result (the main signs and the planetary positions), then resets the form
- If the request fails, the loading state is cleared and the entered values are kept so the user can correct them

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/init` | Checks the DB connection and seeds sample data if the DB is empty |
| GET | `/api/charts` | List charts. Query: `page`, `limit` (max 100), `sunSign`, `isPublic`, `sortBy`, `sortOrder` |
| GET | `/api/charts/:id` | Get one chart |
| POST | `/api/charts/calculate` | Calculate and save a chart. Body: `birthDate` (YYYY-MM-DD), `birthTime` (HH:MM), `birthLocation`, optional `name` (defaults to "Chart for {location}") |
| PUT | `/api/charts/:id` | Update `name`, `notes`, `isPublic`, `birthDate`, `birthTime`, `birthLocation` |
| DELETE | `/api/charts/:id` | Delete a chart |
| GET | `/api/charts/sign/:sign` | Charts with a given sun sign |
| GET | `/api/charts/stats/summary` | Totals and sun-sign distribution |

All responses follow the shape `{ success, data }`. Errors use `{ success: false, error }`, or `{ success: false, errors: [...] }` for validation errors.

> **How charts are calculated**
>
> - **Sun (real):** the sign and degree are calculated astronomically from the birth date and time (`backend/utils/astro.js`), using the U.S. Naval Observatory low-precision solar formula (accurate to about 0.01° between 1950 and 2050).
> - **Time zone:** the birth location's time zone is not known, so the time is treated as UTC. This shifts the Sun by at most ~0.5°, which only matters on the day the Sun changes sign.
> - **Moon, Rising sign and other planets (mocked):** these are still random. Real values would need a full ephemeris and the location's coordinates.

## Project structure

```
backend/
├── app.js               # Express app (exported for tests)
├── server.js            # Entry point: connects to MongoDB and starts listening
├── config/database.js
├── controllers/         # chartController, initController
├── utils/astro.js       # Sun position calculation
├── utils/sampleCharts.js # Generated sample charts (min 3 per sign)
├── middleware/          # validators, errorHandler
├── models/Chart.js
├── routes/
└── tests/               # node:test + supertest integration tests

frontend/src/
├── app/
│   ├── services/chart.service.ts   # Typed API client
│   ├── task1/                      # Chart list
│   └── task2/                      # Calculator form
├── testing/mock-chart.ts           # Shared test fixture
└── styles.css                      # Theme tokens (CSS variables)
```

## Security note

The original code of `GET /api/init` decoded a hidden (base64) URL, downloaded a payload from it and ran it with `eval()`. That is remote code execution on any machine that runs the backend.

- That code has been removed.
- A regression test in `backend/tests/init.test.js` asserts that the endpoint makes no outbound network requests.
