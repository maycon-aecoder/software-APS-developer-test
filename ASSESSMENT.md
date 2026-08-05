# APS Viewer Assessment

This document explains how to configure, run, use, validate, and review the APS Viewer feature implemented for this technical assessment. It also records the development approach, relevant decisions, and known limitations.

## 1. Configure and run the application

### Prerequisites

- Node.js 18 or newer.
- npm 9 or newer.
- Docker 24 or newer for the provided local MongoDB service.
- An APS application with a Client ID and Client Secret.
- A translated Revit source-design URN that the APS application can access.
- Network access to the Autodesk Viewer CDN and Google Fonts.

The feature uses APS OAuth v2 two-legged authentication. It does not require an Autodesk user login, three-legged OAuth, ACC browsing, model upload, or model translation.

### Install dependencies

From the repository root:

```powershell
npm --prefix backend install
npm --prefix frontend install
```

### Create the backend environment file

Copy the example file:

```powershell
Copy-Item backend/.env.example backend/.env
```

Configure `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://aps_admin:aps_devpassword@localhost:27017/aps-dev-test?authSource=admin
JWT_SECRET=replace_with_a_strong_random_value
JWT_EXPIRES_IN=7d
APS_CONFIG_ENCRYPTION_KEY=replace_with_a_canonical_base64_encoded_32_byte_key
```

Generate the values locally with Node.js:

```powershell
# JWT signing secret
node -e "const { randomBytes } = require('node:crypto'); console.log(randomBytes(48).toString('hex'))"

# Exactly 32 random bytes encoded as canonical standard Base64
node -e "const { randomBytes } = require('node:crypto'); console.log(randomBytes(32).toString('base64'))"
```

Use the second output as `APS_CONFIG_ENCRYPTION_KEY`. This key is required to encrypt and decrypt APS Client Secrets with AES-256-GCM. It must:

- decode to exactly 32 bytes;
- use canonical standard Base64, including required padding;
- be different from `JWT_SECRET`;
- remain stable while stored APS configurations are in use;
- stay outside source control and MongoDB.

Changing or losing this key makes previously encrypted Client Secrets unreadable. Do not commit `backend/.env` or any generated secret.

### Start MongoDB, backend, and frontend

Use three terminals from the repository root:

```powershell
# Terminal 1
npm --prefix backend run db:dev
```

```powershell
# Terminal 2
npm --prefix backend run dev
```

```powershell
# Terminal 3
npm --prefix frontend run dev
```

Open [http://localhost:3000](http://localhost:3000), register an application account, and sign in.

## 2. Configure APS and load a model

On the authenticated home page:

1. Enter the APS Client ID.
2. Enter the APS Client Secret.
3. Enter the Base64URL-encoded source-design URN for an already translated model.
4. Select **Save APS settings**.
5. Wait for the settings confirmation and the configured 3D model.

The Model URN may be provided as an unpadded Base64URL payload or with one lowercase `urn:` prefix. Standard Base64 characters, padding, embedded whitespace, repeated prefixes, and malformed trailing bits are rejected.

Configuration is stored per authenticated application user. The Client Secret is encrypted before the atomic MongoDB write, is never returned by configuration reads, and is removed from the form after a successful save. On a later visit, leave the secret field blank to retain the saved secret. Changing the Client ID requires a replacement secret. Replacing only the URN keeps the current APS credential context and loads the new model.

The backend exchanges the saved credentials for short-lived APS tokens with only `viewables:read`. The browser receives the token and lifetime required by the Viewer callback, but never receives the stored Client Secret.

## 3. Test the Viewer features

### Category colors

After the model is ready, use the three custom buttons in the native Viewer toolbar:

- **Furniture** uses the chair icon.
- **Walls** uses the foundation icon.
- **Doors** uses the door icon.

The first activation applies that category's color. The second activation removes only that category's color and returns the button to its inactive state. Category states are independent; changing one does not clear another.

For Revit models, supported categories are resolved from named nodes directly below the model-tree root. All recursive leaf descendants of a matching category node are deduplicated and used for coloring and quantities. The implementation does not depend on an element property named `Category`.

### Model quantities panel

Select **Show model quantities** in its separate native toolbar group.

- The resizable Viewer panel contains initially collapsed **Doors** and **Windows** groups.
- Each group shows the leaf-element count and total Area when safely available.
- Aggregate Area is displayed with exactly two decimal places.
- Expanding a group shows every matched element with its public model name and individual Area, or `Unavailable` when Area cannot be determined.
- Selecting a category isolates all of its elements and fits them in view.
- Selecting an individual row isolates and fits that element.
- Closing the panel clears isolation applied by this panel while preserving category colors.
- The panel can be resized from its lower-right corner within the Viewer bounds.

Area aggregation accepts only exact, unambiguous numeric `Area` properties. Duplicate or incompatible contributions are handled conservatively. Known Autodesk Area unit identifiers are mapped to user-facing labels such as `m²`, `ft²`, `in²`, and `mm²`; unknown internal Autodesk unit identifiers are not displayed or guessed.

## 4. Added environment variables and dependencies

### Environment variable

| Variable | Required | Purpose |
| --- | --- | --- |
| `APS_CONFIG_ENCRYPTION_KEY` | Yes | Canonical standard Base64 for exactly 32 random bytes used by AES-256-GCM to protect stored APS Client Secrets. |

The existing `PORT`, `MONGO_URI`, `JWT_SECRET`, and `JWT_EXPIRES_IN` variables remain unchanged.

### Dependencies

No production npm dependency was added for the feature. APS Viewer `7.118.2` is intentionally loaded from Autodesk's versioned CDN, and the three Material Symbols are loaded from Google Fonts.

Development-only test tooling was added:

- Backend: `supertest`.
- Frontend: `vitest`, `jsdom`, `@testing-library/react`, and `@testing-library/user-event`.

## 5. Architecture and security decisions

- **Viewer version:** JS and CSS are pinned to APS Viewer `7.118.2` instead of a floating `7.*` URL.
- **Authentication:** Backend-mediated OAuth v2 client credentials with `viewables:read` is sufficient for an already translated derivative accessible to the APS application. Three-legged OAuth is outside this assessment.
- **Credential storage:** One configuration belongs to one authenticated application user. Client Secrets use randomized AES-256-GCM envelopes with user-bound authenticated data and safe Mongoose projections.
- **Persistence:** Validation and encryption complete before one atomic upsert. Failed validation, encryption, or persistence does not partially replace the prior configuration.
- **Viewer lifecycle:** One serialized coordinator owns the active runtime, Viewer, model, token callback, extensions, and analysis generations. Stale operations cannot publish results for a replaced model or credential context.
- **Category resolution:** Exact English direct-root Revit category nodes are the category boundary; recursive leaves are the element set.
- **Quantity analysis:** Count is published before bounded property analysis. Door and Window failures remain isolated, and a usable model is preserved when Area is unavailable.
- **UI ownership:** Category colors and model quantities use separate native Viewer controls. The quantity extension never clears theming owned by the category controls.
- **Error handling:** User messages are actionable and avoid internal codes. Server and console diagnostics use stable sanitized codes without credentials, tokens, URNs, property payloads, or upstream response bodies.

## 6. Development process

The implementation followed a deliberately lightweight AI-assisted, specification-driven workflow suitable for a single assessment feature.

1. **Repository preparation:** The codebase was first prepared for reliable AI collaboration with a repository `AGENTS.md`, focused architecture and engineering guidance, SDD lifecycle rules, documentation locations, and exactly one project-local APS Viewer implementation skill. The base application and assessment text were preserved while these working agreements were established.
2. **Discovery:** The existing frontend, backend, authentication, MongoDB, and UI patterns were inspected. Official Autodesk documentation and the pinned Viewer distribution were researched. Open questions about OAuth, URN semantics, Revit categories, Viewer lifecycle, security, and failure behavior were recorded and resolved.
3. **Specification:** An approved behavior contract defined per-user settings, encrypted Client Secret storage, token boundaries, Viewer lifecycle, category controls, quantities, accessibility, error feedback, and acceptance criteria.
4. **Technical plan and tasks:** The feature was divided into small reversible increments with requirement traceability, rollback points, controlled Viewer doubles, real APS validation boundaries, and explicit Red-Green-Refactor evidence.
5. **TDD implementation:** Deterministic and security-sensitive behavior began with reviewed failing tests. The minimum production behavior was then implemented, refactored within the approved boundary, and checked with focused and complete regression suites.
6. **Evidence-driven fixes:** Live model evidence changed some implementation details without expanding the product scope. Revit categories were corrected to use direct-root model-tree nodes and recursive leaves rather than a property called `Category`. Theming was corrected to apply to the resolved leaves. The original page quantity report was replaced by a separate native Viewer extension and resizable docking panel. Area unit codes, hierarchy, collapse indicators, isolation, fit-to-view, and close cleanup were refined through real Viewer inspection.
7. **Convergence:** Specification, plan, tasks, architecture, validation evidence, tests, and implementation were reviewed together. Security, stale-result protection, error mapping, accessibility, rollback, and assessment proportionality received separate senior reviews.

This process intentionally avoided a general Viewer platform, speculative abstractions, production infrastructure, broad refactors, and unnecessary runtime dependencies.

## 7. Validation

Automated validation completed successfully:

```powershell
npm --prefix backend test
npm --prefix frontend test -- --run
npm --prefix frontend run build
```

Latest results:

- Backend: 100 tests passed.
- Frontend: 222 tests passed across 18 files.
- Production build: passed with 111 transformed modules.
- Live representative model: 11 Doors, 17 Windows, `21.20 m²` Door total, and `63.37 m²` Window total.
- MongoDB inspection: canonical URN, unique per-user index, encrypted secret envelope, and no plaintext Client Secret field.
- Manual acceptance: the project owner validated the implemented Viewer interactions and current assessment flow.

Controlled tests protect contracts and deterministic behavior; they are not reported as automated WebGL validation. Live APS and manual evidence is recorded separately in `docs/sdd/2026-08-04-aps-viewer/validation.md`.

## 8. Known limitations and possible improvements

- The input model must already be translated and accessible to the configured APS application's two-legged credentials. Upload, translation, manifest management, ACC browsing, and Autodesk user consent are not included.
- One active 3D model is supported. The app does not aggregate multiple models or fall back to a 2D viewable.
- Category matching supports the assessment's English Revit categories. A production product should use a verified localization/identity strategy for additional authoring tools and languages.
- Area is intentionally conservative. Missing, malformed, ambiguous, incompatible, or unknown-unit values become unavailable instead of being inferred or converted.
- The unit allowlist is bounded to the documented Autodesk Area identifiers required by this feature. A broader product should centralize and test a larger official unit catalog.
- Viewer assets and Material Symbols require external CDN access.
- The application-level JWT remains stored in `localStorage` as part of the supplied base application. APS Client Secrets and APS access tokens are not persisted there.
- Full automated cross-browser WebGL coverage, observable token-expiration renewal, alternate valid-credential replacement, and failure injection against live APS remain future validation work.
- `npm audit --omit=dev` currently reports two moderate React Router advisories in the frontend dependency path. Updating the base routing dependency should be handled as a separate tested maintenance change.
- A production deployment would additionally require HTTPS, managed secret storage, encryption-key rotation/versioning, operational monitoring, rate limiting, and a formal data-retention policy.

## 9. Troubleshooting

### MongoDB reports `[::1]:27017 closed`

Start the provided database first:

```powershell
npm --prefix backend run db:dev
```

If Windows resolves `localhost` to IPv6 while Docker is reachable only through IPv4, use `127.0.0.1` instead of `localhost` in the local `MONGO_URI`. Confirm the container is healthy before restarting the backend.

### Saving APS settings returns `503 Service Unavailable`

Confirm MongoDB is available and `APS_CONFIG_ENCRYPTION_KEY` is present, canonical standard Base64, and decodes to exactly 32 bytes. Restart the backend after changing environment variables. The backend fails closed when encryption or the required unique index cannot initialize.

### APS rejects credentials or the model does not load

- Verify the Client ID and Client Secret belong to the same APS application.
- Verify the derivative is already translated and accessible to that application.
- Use the Base64URL source-design URN, not an ACC display URL or Viewer document ID.
- Remove Base64 padding and avoid repeated or uppercase `URN:` prefixes.
- Review the user-facing message and the backend's sanitized diagnostic code.

### Categories or quantities are unavailable

The translated model must expose the expected English direct-root Revit category nodes. Area also requires an exact, safely parseable `Area` property and a compatible unit for each contribution. Missing data remains `Unavailable` by design.

### Viewer controls or icons do not load

Allow HTTPS access to `developer.api.autodesk.com` and `fonts.googleapis.com`. Then reload the model using the existing retry action; do not repeatedly submit the settings form.
