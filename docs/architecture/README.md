# Architecture Overview

Status: Current baseline
Last updated: 2026-08-04

## System context

The repository is a small full-stack application that will host the APS Viewer technical assessment.

```text
Browser (React/Vite)
  -> /api through the Vite development proxy
Express API
  -> MongoDB through Mongoose

Future assessment boundary:
Browser -> authenticated Express APS endpoints -> Autodesk Platform Services
Browser -> APS Viewer SDK using short-lived viewer access
```

## Current boundaries

### Frontend

- React 18 single-page application built with Vite.
- React Router owns public authentication routes and the protected `/home` route.
- `AuthContext` stores the current JWT and user in `localStorage`.
- A shared Axios instance sends the JWT as a bearer token.
- `HomePage.jsx` contains the assessment placeholder and is the intended integration surface.
- Tailwind utility classes provide styling; there is no separate component library.

### Backend

- CommonJS Node.js application using Express.
- `src/app.js` composes middleware and routes independently from `server.js`, which is a useful test seam.
- Mongoose owns MongoDB persistence.
- Authentication routes register and sign in users, returning `{ token, user }`.
- The JWT middleware exists but is not currently mounted on a protected API route.

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
- There are no automated tests, linting, formatting scripts, or CI checks.
- Dependency audits reported existing development and frontend findings on 2026-08-04; remediation requires a separately approved scope.

## APS security boundary

The assessment asks users to enter an APS client ID, client secret, and model URN in the UI. The client secret must remain transient: never store it in `localStorage`, session storage, IndexedDB, URLs, logs, analytics, source code, fixtures, or committed files. The approved design must route credential exchange through the backend and expose only the minimum short-lived token material required by the viewer.

Detailed APS architecture will be decided only after the feature's discovery, specification, and technical-plan gates are approved.
