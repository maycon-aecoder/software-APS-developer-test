# APS Developer Test — Base Application

A fullstack base application built with **Node.js + Express + MongoDB** (backend) and **React + Tailwind CSS** (frontend), designed as the foundation for a technical assessment.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup & Running](#setup--running)
- [Application Features](#application-features)
- [Technical Assessment](#technical-assessment)
- [Infrastructure](#infrastructure)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6, Axios |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose ODM) |
| Auth | JSON Web Tokens (JWT), bcryptjs |

---

## Project Structure

```
software-APS-developer-test/
├── infrastructure/
│   ├── docker-compose.yml  # MongoDB container definition
│   └── mongo-data/         # MongoDB volume data (persisted locally)
├── backend/
│   ├── src/
│   │   ├── config/         # db.js — Mongoose connection
│   │   ├── middleware/     # auth.js — JWT verification middleware
│   │   ├── models/         # User.js — Mongoose user schema
│   │   └── routes/         # auth.js — register & login endpoints
│   ├── app.js
│   ├── server.js           # Entry point
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/            # axiosInstance.js, auth.js
    │   ├── context/        # AuthContext.jsx
    │   ├── components/     # Topbar.jsx, Sidebar.jsx
    │   ├── pages/          # LoginPage, RegisterPage, HomePage
    │   └── routes/         # ProtectedRoute.jsx
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Node.js | v18+ |
| npm | v9+ |
| Docker | v24+ (for the local MongoDB container) |

---

## Setup & Running

### 1. Database (MongoDB via Docker)

The project ships with a ready-to-use Docker Compose file under `infrastructure/`. This is the recommended way to run MongoDB locally.

```bash
# From the backend directory
npm run db:dev
```

Or directly with Docker Compose:

```bash
cd infrastructure
docker compose up -d
```

This starts a MongoDB 7 container with the following defaults:

| Setting | Value |
|---------|-------|
| Host | `localhost` |
| Port | `27017` |
| Username | `aps_admin` |
| Password | `aps_devpassword` |
| Database | `aps-dev-test` |
| Auth source | `admin` |

To stop the container:

```bash
# From the backend directory
npm run db:stop
```

> **Note:** Data is persisted in `infrastructure/mongo-data/` on your local machine, so your data survives container restarts.

---

### 2. Backend

```bash
cd backend

# Copy environment file (credentials already match the Docker Compose defaults)
cp .env.example .env
```

Edit `backend/.env` and set a strong `JWT_SECRET`:

```env
PORT=5000
MONGO_URI=mongodb://aps_admin:aps_devpassword@localhost:27017/aps-dev-test?authSource=admin
JWT_SECRET=your_strong_random_secret_here
JWT_EXPIRES_IN=7d
```

```bash
npm install
npm run db:dev  # start MongoDB container (requires Docker)
npm run dev     # starts on http://localhost:5000
```

#### API Endpoints

| Method | Endpoint | Description | Auth required |
|--------|----------|-------------|:---:|
| `POST` | `/api/auth/register` | Register new user | No |
| `POST` | `/api/auth/login` | Login, returns JWT | No |
| `GET` | `/api/health` | Server health check | No |

Both auth endpoints respond with:
```json
{
  "token": "<JWT>",
  "user": { "id": "...", "name": "...", "email": "..." }
}
```

The JWT middleware at `src/middleware/auth.js` can be attached to any route that requires authentication:
```js
const auth = require('./middleware/auth');
router.get('/protected', auth, (req, res) => { ... });
```

---

### 2. Frontend

```bash
cd frontend
npm install
npm run dev     # starts on http://localhost:3000
```

Vite automatically proxies all `/api` requests to `http://localhost:5000`, so both servers can run side by side without CORS issues.

---

### Running Everything Together

Open three terminal windows:

```bash
# Terminal 1 — MongoDB (only needed once; data persists between restarts)
cd backend
npm run db:dev

# Terminal 2 — backend
cd backend
npm run dev

# Terminal 3 — frontend
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Application Features

The base application ships with a fully working authentication system and a home shell:

| Route | Access | Description |
|-------|--------|-------------|
| `/register` | Public | Create a new account |
| `/login` | Public | Sign in with email & password |
| `/home` | Protected | Home page (redirects to login if unauthenticated) |

### Home Page Layout

- **Topbar** — fixed at the top; shows the app name on the left and a user avatar on the right. Clicking the avatar opens a dropdown with the user's name, email, and a **Logout** button.
- **Sidebar** — fixed on the left; contains navigation links. New links can be added to `frontend/src/components/Sidebar.jsx`.
- **Main area** — the placeholder content area where the assessment feature must be implemented.

---

## Technical Assessment

### Objective

Extend the base application by implementing the feature described below inside the home page placeholder area. The goal is to evaluate your ability to integrate a third-party 3D viewer SDK, add interactive UI customizations, and build a simple data report — all within an existing React + Express codebase.

---

### Feature to Implement: APS Viewer with Revit Model

#### Context

[Autodesk Platform Services (APS)](https://aps.autodesk.com/), formerly known as Forge, is Autodesk's developer platform. It provides, among other capabilities, the **Model Derivative API** (to translate CAD/BIM models) and the **Viewer** (a WebGL-based 3D viewer that runs in the browser).

You will integrate the **APS Viewer** (also known as Forge Viewer) into the application to visualize a Revit model, add toolbar customizations, and display a quantity report.

---

#### Task Breakdown

##### Task 1 — APS Viewer Integration

- Add the APS Viewer to the home page main content area.
- The viewer must load a translated Revit model (`.rvt`) using a URN obtained from APS.
- **All connection settings must be configurable via text inputs within the UI** — no hardcoded credentials. At minimum, expose the following fields:
  - APS Client ID
  - APS Client Secret
  - Model URN (the Base64-encoded URN of the translated model)
- The settings can be placed in a dedicated settings panel, modal, or sidebar section — your choice.
- Once the settings are saved, the viewer should authenticate against APS and load the specified model.

##### Task 2 — Viewer Toolbar Customizations

Extend the APS Viewer toolbar with custom buttons that change the color of specific building element categories in the loaded model:

| Button | Target category | Action |
|--------|----------------|--------|
| Furniture | Furniture elements | Toggle a custom highlight color |
| Walls | Wall elements | Toggle a custom highlight color |
| Doors | Door elements | Toggle a custom highlight color |

- Each button should act as a toggle: first click applies the color, second click resets to the original.
- Colors are up to you; they just need to be visually distinct.
- Buttons should be added to the viewer's native toolbar (not floating outside the viewer).

##### Task 3 — Quantity Report for Openings

- Add a panel or section (inside or alongside the viewer) that displays a **simple quantity report** for openings in the model.
- The report must include at least:
  - **Windows** — count and, if available, total area.
  - **Doors** — count and, if available, total area.
- Data must be extracted from the model's properties using the APS Viewer API (e.g., `model.getPropertyDb()` or the `PropertiesPanel`).
- The report should refresh or be regenerated when a new model is loaded.

---

#### Suggested Resources

| Resource | Link |
|----------|------|
| APS Developer Portal | https://aps.autodesk.com |
| APS Viewer documentation | https://aps.autodesk.com/en/docs/viewer/v7/reference |
| APS Tutorials (Hubs Browser) | https://tutorials.autodesk.io |
| Revit Sample Models (Autodesk) | Available on the APS portal under sample data / ACC Docs or at this link https://help.autodesk.com/view/RVT/2026/ENU/?guid=GUID-61EF2F22-3A1F-4317-B925-1E85F138BE88 |
| APS Free Tier | Create a free trial account at https://aps.autodesk.com — no credit card required |

---

#### Evaluation Criteria

| Area | What we look for |
|------|-----------------|
| APS Integration | Correct use of Viewer SDK initialization, authentication flow, and model loading |
| UI/UX | Clean integration of the viewer and settings panel into the existing layout |
| Code quality | Component structure, separation of concerns, readable and maintainable code |
| Toolbar customization | Correct use of Viewer toolbar API to add and manage custom buttons |
| Quantity report | Correct extraction and presentation of model property data |
| Error handling | Graceful handling of invalid credentials, failed loads, or missing model data |

---

#### Deliverables

1. A working branch or fork of this repository with the feature fully implemented.
2. An updated `README.md` (or a separate `ASSESSMENT.md`) documenting:
   - How to configure the APS credentials and model URN.
   - Any additional environment variables or dependencies you added.
   - Known limitations or things you would improve with more time.

---

#### Time Expectation

This assessment is designed to be completed in approximately **4–6 hours**. You are not expected to build a production-grade solution — focus on correctness, clarity, and good structure.

Good luck!

---

## Assessment implementation

See [ASSESSMENT.md](./ASSESSMENT.md) for feature configuration, usage, architecture and security decisions, development process, validation evidence, troubleshooting, and known limitations.
