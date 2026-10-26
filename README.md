# Pet Mirror

A webcam-powered virtual pet called **Mochi**. Mochi reacts to your smile, surprise, closed eyes, and hand movement, while a global leaderboard tracks the happiest pets. All computer vision runs locally in your browser — no video is ever uploaded.

> **Live demo:** _coming soon_

## Features

- **Face & hand tracking** with MediaPipe Tasks (Face Landmarker blendshapes + Hand Landmarker)
- **Six moods** — happy, excited, surprised, sleepy, sad, and lonely — with smooth canvas animation
- **Particles and interactions** that respond to your expressions and hand position
- **Accounts** with scrypt password hashing and HMAC-signed session tokens
- **Global leaderboard** ranked by happiness streak and XP
- **Pet evolution** with unlockable accessories (bow, sunglasses, crown) and color themes
- **Photo export** so you can save a picture of you and Mochi
- **Anti-cheat** score validation capped by elapsed time between saves
- **Responsive UI** with reduced-motion support
- **Privacy-first** — camera frames never leave the device

## Tech stack

| Layer | Technology |
| --- | --- |
| Computer vision | [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) (client-side) |
| Frontend | Vanilla JavaScript, Canvas 2D, CSS |
| Backend | Node.js, Express |
| Database | SQLite via Node's built-in `node:sqlite` |
| Auth | `scrypt` password hashing, HMAC-SHA256 session tokens |
| Hosting | Vercel (also works on Render or any Node host) |

## Project structure

```
pet-mirror/
├── public/
│   └── index.html    # UI, canvas rendering, MediaPipe vision, client logic
├── server.js         # Express app, auth, leaderboard, progress API
├── .env.example      # Example environment variables
├── package.json
└── README.md
```

## Run locally

**Requirements:** Node.js 22.13 or newer (for the built-in `node:sqlite` module).

```bash
git clone https://github.com/Aesha-singh/pet-mirror.git
cd pet-mirror
npm install
npm start
```

Open <http://localhost:3000> and allow camera access when prompted. The camera requires `localhost` or HTTPS.

For a production-like local run with Vercel's routing:

```bash
npx vercel dev
```

## Environment variables

Copy `.env.example` to `.env` for local use, or set these in your hosting provider:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port for local development |
| `DB_PATH` | `pets.db` (local) / `/tmp/pets.db` (Vercel) | SQLite database file |
| `SECRET` | random per process | HMAC key for session tokens. Set this in production so logins survive restarts. |

Generate a strong secret:

```bash
openssl rand -hex 32
```

## API

All endpoints are JSON. Authenticated routes expect an `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/register` | Create an account. Body: `{ "name", "password" }` |
| `POST` | `/api/login` | Log in. Body: `{ "name", "password" }` |
| `GET` | `/api/me` | Get the current user's progress |
| `POST` | `/api/progress` | Save smiles, streak, XP, and color |
| `GET` | `/api/leaderboard` | Top 10 pets by streak and XP |

Requests to `/api` are rate limited to 60 per minute per IP.

## Deploy on Vercel

This repository is ready for Vercel's zero-configuration Express support.

1. Push the repo to GitHub.
2. Import it at <https://vercel.com/new> (or run `vercel --prod` from the project root).
3. Add environment variables in **Project Settings → Environment Variables**:
   - `SECRET` — a long random string (`openssl rand -hex 32`)
   - `DB_PATH` — `/tmp/pets.db`
4. Redeploy.

**Note on persistence:** Vercel Functions have an ephemeral filesystem. The SQLite database in `/tmp` is per-instance, so the leaderboard may reset when functions cold-start or scale. For a leaderboard that persists indefinitely, either:

- deploy the same repo to **Render** with a persistent disk (see below), or
- swap SQLite for a hosted database such as Vercel Postgres, Neon, or Turso.

## Deploy on Render

1. Push to GitHub, then create a **New → Web Service** and select the repo.
2. Build command: `npm install`; start command: `npm start`.
3. Set `NODE_VERSION=22` (or newer) and `SECRET` to a long random string.
4. Add a persistent disk mounted at `/var/data` and set `DB_PATH=/var/data/pets.db`.

## How it works

1. MediaPipe loads two models in the browser: a face landmarker (blendshape scores for smile, surprise, eye closure) and a hand landmarker.
2. Those signals drive Mochi's mood, position, and animation each frame on a canvas.
3. Happiness streak and XP accumulate locally and sync to the Express API for logged-in users.
4. The server clamps score gains using the time elapsed since the last save, so scores cannot be inflated instantly.

## Roadmap

- Treat-catching mini-game using hand tracking
- Sound effects and additional accessories
- Email-based password reset
- Persistent hosted database adapter

## Author

**Aesha Singh** — [@Aesha-singh](https://github.com/Aesha-singh)

## License

[MIT](LICENSE) © 2026 Aesha Singh
