# AI Disaster Relief Coordination

A React + Vite + TypeScript + Tailwind application that triages victim requests (text / voice / OCR) with GPT-4o-mini, assigns the nearest suited NGO, and keeps everything synced offline-first. The UI is fully pastel/light with creative gradients and hero sections.

## Quick start

1. Install Node.js 18+.
2. Install deps:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill the values (see below).
4. Run both backend and frontend (two terminals):
   ```bash
   npm run server
   npm run dev
   ```
5. Open the printed local URL. You should see the pastel landing with AI hero, NGO/victim/admin portals, and dashboards.

## Environment & AI configuration

| Variable | Where | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | backend `.env` | Required for GPT-4o-mini triage and routing (`backend/aiRouter.js`). |
| `OPENAI_BASE_URL` (optional) | backend `.env` | Override host if using Azure/OpenAI-compatible endpoint. |
| `VITE_API_BASE_URL` | frontend `.env` | Base URL for fetches; set to the backend origin (e.g. `http://localhost:4000`). |
| `PORT` | backend `.env` | Express server port (defaults to 4000). |

Frontend reads `VITE_API_BASE_URL` for Victim Emergency/Intake pages and sync service. Backend uses `OPENAI_API_KEY` to call GPT-4o-mini; if missing, heuristic fallbacks still classify requests.

## Offline + sync flow

1. Victim Intake saves every submission to IndexedDB via `src/store/db.ts`.
2. If offline, requests are marked `synced: false`; UI shows the new request immediately.
3. `src/services/sync.ts` periodically posts unsynced records to `POST /api/requests` once the device regains connectivity, then marks them as synced.
4. Victim Emergency also uses the same service so emergency submissions are not lost.

## AI endpoints

- `POST /api/ai/route-request` – classifies an emergency text block, predicts disaster type, and suggests best NGO.
- `POST /api/ai/intake` – multi-modal triage: text body + optional OCR transcript + voice transcript. Returns summary, needs, urgency, and NGO match.

Both endpoints run GPT-4o-mini when `OPENAI_API_KEY` is configured, and gracefully degrade to heuristics otherwise, so QA can test without the key.

## Tech stack

- React 18 + TypeScript + Vite 5
- TailwindCSS 3 with custom pastel palette
- Lucide icons
- IndexedDB (`idb`) for offline storage
- Express + better-sqlite3 backend

## UI overview

- `RescueHome`: pastel hero with animated gradients, metrics, and role portals.
- Victim, NGO, Admin dashboards: light cards, AI debug panels, and creative chips.
- Modals and forms match the baby blue/pink palette for consistent readability.

## Testing the flows

- Victim path: `/victim/emergency` (instant SOS) and `/victim/intake` (rich form with voice + OCR).
- NGO dashboard: `/ngo/dashboard` after registering/signing in.
- Admin dashboard: `/admin/dashboard` after entering the predefined admin ID.
- Toggle network offline in devtools to verify IndexedDB storage and background sync.

## Roadmap ideas

- Plug in real geocoding & routing (Mapbox/Google) for NGO assignments.
- Add Web Push for NGO alerts when new AI-triaged cases arrive.
- Expand AI reasoning logs into a dedicated “AI Command Center”.
