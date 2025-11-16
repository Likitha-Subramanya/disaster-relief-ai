# Relief.AI Web MVP – Roadmap & Architecture

## 1. Project overview

This Vite + React app is an **offline‑friendly web MVP** of the larger AI Disaster Relief platform you specified. It focuses on:

- **Victim request intake** (text + OCR + voice + location).
- **Local AI-ish triage** (simple NLP scoring) and **automatic matching** to nearby resources.
- **Responder / operator dashboard** for monitoring, manual status updates, and route preview.
- **Offline‑friendly storage** using IndexedDB via `idb` (acts like a small local backend).

It is designed as a **browser demo and teaching prototype** that could later be connected to a real backend (FastAPI/Go, Postgres/PostGIS, Kafka, SMS gateway, on-device ML, etc.).

---

## 2. What is implemented in this repo

### 2.1 Core flows

- **Victim intake**
  - Page: `src/pages/VictimIntake.tsx`.
  - Features:
    - Name + phone + free‑text description.
    - Optional **photo upload** → OCR via `tesseract.js` wrapper in `src/services/ocr.ts`.
    - Optional **voice input** (browser speech recognition where available).
    - **Location selection** via `LocationInput` and map.
    - Local **category classification** and **urgency estimation** via `src/services/nlp.ts`.
    - Request saved into IndexedDB (`requests` store) with status `new`.
    - Status events logged into `statusEvents` store.
    - Immediate **auto‑matching** to nearby resources and a basic status timeline.

- **Resource / responder registration**
  - Page: `src/pages/RegisterResources.tsx`.
  - Features:
    - Register a resource/volunteer with type (medical/rescue/shelter/supplies), capability tags, quantity, and geolocation.
    - Data stored locally in `resources` store.

- **Operations dashboard**
  - Page: `src/pages/Dashboard.tsx`.
  - Features:
    - Lists all requests with category, urgency, timestamp, and description.
    - Shows **matches** per request (resource, distance, score).
    - Inline **status update** buttons (`assigned`, `in_progress`, `delivered`, `closed`) which update requests and append `StatusEvent`s.
    - Side panel listing all resources.
    - Route preview using `DirectionsPreview` and map/directions services.

- **Supporting pages & UX**
  - `HomeMinimal` homepage with quick access to victim flow, registering aid, and dashboard.
  - `Map`, `Alerts`, `FirstAid`, `Contact`, `News`, `Auth`, `NotFound` for extra UX and navigation.
  - `LanguageSwitcher` with i18n support (`src/i18n.ts`).

### 2.2 Data model & storage

- Defined in `src/models.ts`:
  - `User`, `Resource`, `Request`, `Match`, `StatusEvent`, `GeoPoint`.
  - Request lifecycle statuses: `new → triaged → assigned → in_progress → delivered → closed` (UI mainly uses subset).

- Local storage via IndexedDB in `src/store/db.ts`:
  - Object stores: `requests`, `resources`, `statusEvents`, `matches`.
  - Helper functions:
    - `putRequest`, `getRequests`, `updateRequestStatus`.
    - `putResource`, `getResources`, `setResourceAvailability`.
    - `putMatch`, `getMatchesByRequest`, `getAllMatches`.
    - `addStatus`, `getStatus`.

This IndexedDB layer acts as a **local operational database** and can be replaced by remote APIs later.

### 2.3 Matching engine (greedy)

- Implemented in `src/services/matching.ts`.
- Uses **haversine distance** to compute `distanceKm` between request and resource.
- Computes a **score** per resource using:
  - **Distance** (penalized).
  - **Capability matches** between request text and resource `capabilityTags`.
  - **Type match** between request category and resource type.
  - **Urgency** (higher urgency increases score).
- `matchResources(req, resources, topK)` returns the best candidates (currently top‑1 is used by `VictimIntake` for automatic assignment proposal).

### 2.4 Offline & PWA aspects

- Service worker registration in `src/main.tsx` (registers `/sw.js` if present).
- IndexedDB for data persistence across refreshes.

---

## 3. What is **not** implemented (yet), compared to the full spec

The following big pieces from your full AI Disaster Relief specification are intentionally **not yet implemented** in this web MVP:

- **Real backend** (FastAPI/Go microservices, Postgres/PostGIS, Kafka, object storage).
- **Real SMS/USSD gateway** integration (Twilio/SMPP/GSM modem).
- **On-device ML runtimes** (TFLite, PyTorch Mobile) and fully trained models.
- **Advanced matching/optimization** (ILP/OR-Tools, batch routing, RL-based dispatch).
- **Responder mobile apps** (native Android/iOS with offline SQLite/Room/CoreData).
- **Production‑grade security** (OAuth2, JWT, RBAC, encryption at rest, audit log in immutable store).
- **Observability stack** (Prometheus, Grafana, OpenTelemetry, ELK).

This MVP simulates **core logic and UX** in the browser so you can:

- Demonstrate the concept.
- Collect feedback from NGOs/partners.
- Use it as a reference implementation for future backend and mobile work.

---

## 4. How to run this web MVP

From the project root:

```bash
npm install
npm run dev
```

Then open the printed URL (typically `http://localhost:5173`).

Suggested manual demo flow:

1. Go to **Register** (`/register`) and create a few resources/volunteers at different locations.
2. Go to **Victim** (`/victim`) and submit one or more requests with location + description.
3. Observe automatic **category/urgency** estimation and **matching** to nearby resources.
4. Go to **Dashboard** (`/dashboard`) to:
   - See all requests, matches, and timelines.
   - Manually progress statuses.
   - Preview routes.

---

## 5. 8–12 week roadmap to a production‑oriented system

This roadmap assumes you use this Vite React app as the **dispatcher/admin & demo frontend**, and you gradually add:

- A real backend (e.g., Python FastAPI + Postgres + PostGIS).
- SMS gateway + basic mobile clients.
- Initial ML models deployed as services or on-device.

### Phase 1 (Weeks 1–4): Solidify web MVP + design backend

**Goals**

- Clean, stable web demo.
- Finalize API contracts between frontend and backend.

**Tasks**

- **Frontend**
  - Harden validation, error handling, and loading states on `VictimIntake`, `RegisterResources`, `Dashboard`.
  - Add a small **"Demo mode" banner** explaining that data is local‑only.
  - Add basic **role switching** in UI (victim / operator) for easier demos.

- **Backend design**
  - Define REST/JSON APIs aligned with the spec:
    - `POST /api/v1/requests`, `GET /api/v1/requests/{id}`.
    - `POST /api/v1/resources`, `GET /api/v1/resources`.
    - `POST /api/v1/assignments`, `PATCH /api/v1/assignments/{id}`.
    - `GET /api/v1/analytics/summary`.
  - Design DB schema in Postgres/PostGIS matching `src/models.ts`.
  - Write OpenAPI/Swagger spec.

- **Deliverables**
  - Updated frontend with robust UX.
  - API/DB spec document.
  - Diagrams: high‑level architecture & request lifecycle.

### Phase 2 (Weeks 5–8): Implement backend + integrate frontend

**Goals**

- Move from local IndexedDB to **real backend** for core entities.

**Tasks**

- **Backend implementation** (FastAPI or similar)
  - Implement endpoints for requests, resources, assignments, and status events.
  - Store data in Postgres/PostGIS; use simple PostGIS queries for distance/ETA approximations.
  - Implement a **matching service** in the backend using logic inspired by `src/services/matching.ts`.

- **Frontend integration**
  - Abstract data layer so that the app can run in:
    - **Local demo mode** (current IndexedDB).
    - **Remote API mode** (call backend instead).
  - Add configuration (env variable) to choose backend mode.

- **DevOps**
  - Dockerize backend.
  - Add basic CI (lint + tests) and a dev deployment (e.g., Render/Heroku/Railway or small K8s).

- **Deliverables**
  - Running backend with at least requests/resources/matching endpoints.
  - Web app switched to use backend in staging.

### Phase 3 (Weeks 9–12): SMS, basic ML, and resilience

**Goals**

- Add minimal **SMS gateway** and one **real ML model**.

**Tasks**

- **SMS/USSD gateway**
  - Integrate Twilio or local SMS provider:
    - Map incoming SMS → `/api/v1/requests` ingestion.
    - Send confirmation + status updates via SMS.
  - Define compact SMS payload encoding (lat/lng, urgency, category) where possible.

- **ML integration (server‑side)**
  - Train/plug a simple **NLP classifier** for category + urgency.
  - Expose an internal `/internal/ml/classify` endpoint used by the ingestion service.
  - Log predictions and outcomes for future retraining.

- **Resilience & monitoring**
  - Add basic metrics: total requests, mean time to assignment, error rates.
  - Add logging and a simple dashboard (Grafana or similar) if using a real stack.

- **Deliverables**
  - End‑to‑end flow: SMS → ingestion → classification → matching → notification.
  - One deployed ML model in production (even if simple).

### Beyond 12 weeks: Mobile apps, on-device ML, optimization

After the above, you can move toward the **full vision**:

- Native Android/iOS apps with offline queue + local TFLite models.
- OR-Tools‑based batch optimization and vehicle routing.
- Advanced security (OAuth2, RBAC) and compliance workflows.
- Rich analytics & training/simulation mode.

---

## 6. How to extend this repo next

If you want to keep everything in this repo while evolving toward the full system, a practical next step is:

1. Add a `backend/` folder with a small FastAPI or Node backend.
2. Mirror `src/models.ts` types into backend schemas.
3. Gradually replace IndexedDB calls with HTTP calls behind a data‑access abstraction layer.

This way, your **current UI and matching logic remain useful**, while the project grows into the full AI Disaster Relief platform described in your specification.
