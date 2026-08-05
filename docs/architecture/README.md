# Architecture Overview

Status: Current implementation
Last updated: 2026-08-05

## System context

The repository is a small full-stack application that will host the APS Viewer technical assessment.

```text
Browser (React/Vite)
  -> /api through the Vite development proxy
Express API
  -> MongoDB through Mongoose

Approved assessment boundary under incremental implementation:
Browser -> authenticated Express APS endpoints -> Autodesk Platform Services
Browser -> APS Viewer SDK using short-lived viewer access
```

## Current boundaries

### Frontend

- React 18 single-page application built with Vite.
- React Router owns public authentication routes and the protected `/home` route.
- `AuthContext` stores the current JWT and user in `localStorage`.
- A shared Axios instance sends the JWT as a bearer token.
- `HomePage.jsx` preserves the existing shell and hosts the feature-local APS settings panel.
- The settings API uses the shared authenticated Axios client; a reducer and controller keep attempted values separate from durable committed configuration, guard user/workspace operations, and advance monotonic lifecycle generations only after an authoritative successful save.
- The browser retains a Client Secret only in the password input state until its active save succeeds. Safe configuration reads and saves are explicitly whitelisted before entering committed state or lifecycle commands.
- Tailwind utility classes provide styling; there is no separate component library.

### Backend

- CommonJS Node.js application using Express.
- `src/app.js` composes middleware and routes independently from `server.js`, which is a useful test seam.
- Mongoose owns MongoDB persistence.
- Authentication routes register and sign in users, returning `{ token, user }`.
- The existing JWT middleware protects the APS configuration API under `/api/aps` without changing authentication response contracts.
- `ApsConfiguration` is an additive one-record-per-user persistence boundary with a deliberately initialized unique user index.
- The APS configuration service canonicalizes Model URNs, enforces Client Secret replacement/retention rules, and performs one complete atomic upsert.
- `GET /api/aps/configuration` distinguishes no saved record from read failure; `PUT /api/aps/configuration` returns only safe settings and an authoritative save classification.
- `POST /api/aps/token` reads and decrypts only the authenticated user's stored credentials, performs one no-store APS OAuth v2 client-credentials request with `viewables:read`, and returns only a validated short-lived token and positive lifetime.
- Client Secrets are protected with native AES-256-GCM, a dedicated canonical Base64 environment key, and user-bound additional authenticated data. Safe projections and JSON serialization exclude the encrypted envelope.
- Server startup awaits both the existing MongoDB connection and `ApsConfiguration.init()` before listening.

### APS Viewer frontend boundary

- The feature-local token API posts no browser credentials or scope and relies on the existing authenticated Axios instance.
- A registration-scoped token provider exposes the supported `getAccessToken(onTokenReady)` callback shape for later Viewer initialization.
- The provider keeps no token, supports ordinary callback renewal, and suppresses work/results after user, workspace, authentication-generation, runtime-generation, release, or clear invalidation.
- Successful settings reads emit initial-load context. Durable URN-only saves emit same-runtime model replacement context; durable credential replacement emits controlled-reset context. Empty/read-error/failed/stale operations emit none.
- One feature-local asset loader pins matching Viewer JavaScript and CSS to `7.118.2`, shares in-flight work, reports either asset failure, and permits clean retry.
- One serialized lifecycle coordinator owns the public Initializer callback, Viewer, active model, and teardown sequence. URN-only changes reuse the healthy runtime; credential changes release the Viewer and global runtime before reinitialization; failed shutdown ownership is retained until teardown succeeds.
- Model loading uses the canonical persisted URN and selects a supported default 3D geometry or the first supported public-child depth-first result. It never falls back to a 2D viewable.
- Operation and runtime generations suppress stale document, model, and token-error publication. The React host owns mount/unmount disposal and exposes visible, screen-reader-announced retry feedback.
- Category analysis, toolbar controls, theming, and quantity reporting remain unimplemented until their ordered tasks.

### Infrastructure

- Docker Compose runs MongoDB 7 for local development.
- MongoDB state is stored in the Docker-managed named volume `infrastructure_mongo-data`.
- Local database files, environment files, dependencies, logs, build output, and coverage output are not repository artifacts.

## Base-application preservation boundary

Until an approved feature specification says otherwise, preserve:

- registration and login behavior;
- existing authentication response shapes;
- `/login`, `/register`, and `/home` routing behavior;
- top bar, user menu, logout, and sidebar behavior;
- `/api/health` behavior;
- the existing local MongoDB credential contract documented in the root README.

Assessment work should replace or extend only the home-page placeholder and add focused backend boundaries required by the approved APS design.

## Known baseline risks

These are existing conditions, not authorization to fix them opportunistically:

- CORS is unrestricted.
- Backend request validation is limited and raw exception messages can reach clients.
- JWTs are stored in `localStorage`, and token expiry is not proactively checked.
- There is no response interceptor for centralized `401` handling.
- Environment variables are not schema-validated at startup.
- Focused backend and frontend automated tests now exist; linting, formatting scripts, and CI checks do not.
- Dependency audits reported existing development and frontend findings on 2026-08-04; remediation requires a separately approved scope.

## APS security boundary

The assessment asks users to enter an APS client ID, client secret, and model URN in the UI. The client secret must remain transient in the browser: never store it in `localStorage`, session storage, IndexedDB, URLs, logs, analytics, source code, fixtures, or committed files. The backend persists only an authenticated encrypted envelope and never exposes it through the safe configuration boundary. Credential exchange must remain on the backend and expose only the minimum short-lived token material required by the Viewer.

The approved feature contract and technical architecture are maintained under `docs/sdd/2026-08-04-aps-viewer/`. This overview records only boundaries that have reached implementation.
