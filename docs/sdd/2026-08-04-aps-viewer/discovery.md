# Discovery: APS Viewer assessment

Status: Approved
Owner: Project owner
Created: 2026-08-04
Last updated: 2026-08-04

## Objective

Discover the smallest secure and testable change that satisfies the APS Viewer assessment without changing unrelated base-application behavior. The feature must load an already translated Revit model, add native Viewer toolbar category-color toggles, and regenerate a doors/windows quantity report from Viewer model properties.

This artifact records evidence and recommendations only. It does not authorize a specification, technical design, test installation, or implementation.

## Owner decisions recorded

- Pin APS Viewer JS and CSS to exact version `7.118.2`. This is an intentional compatibility and performance decision, not a claim that `7.118.2` is the newest published v7 build.
- Persist one application-level APS Client ID, encrypted Client Secret, and Model URN in MongoDB so an authenticated application user can replace the URN later without re-entering the secret.
- Support one already translated derivative accessible to the saved two-legged APS application credentials.
- Use OAuth v2 two-legged client credentials with `viewables:read`; do not add Autodesk login, consent, callback, refresh-token, Hubs, or ACC browsing flows.
- Enable Viewer 7.118.2 `DS_ENDPOINTS` automatic routing and do not add a manual region field.
- Use English-only Revit category/property matching because the base application has no localization framework or translated UI.
- Allow the Viewer-managed OPFS cache.
- Support current desktop Chrome and Edge, one active model at a time, progressive report analysis, and no hard latency target without a representative model.
- When a replacement URN cannot be loaded, clear the previous model-derived state and ask the user in plain language to verify the saved URN and its accessibility.
- Every failure must produce actionable user feedback and sufficient sanitized diagnostic context for debugging; no failure may be silent, swallowed, or represented only by a generic error.

## Approved scope

### In scope

- Replace the intentional `/home` placeholder with the assessment experience.
- Accept APS Client ID, APS Client Secret, and translated Model URN through the UI.
- Exchange the supplied credentials for a minimum-scope, short-lived Viewer token through the Express backend.
- Load the default viewable from the supplied translated Revit URN in APS Viewer.
- Add Furniture, Walls, and Doors toggle buttons to the Viewer's native toolbar.
- Count Windows and Doors and total their area when the translated properties provide safely aggregatable area values.
- Reset toolbar and report state when another model is loaded.
- Handle invalid input, APS authentication failure, inaccessible or untranslated URNs, Viewer load failure, missing categories, missing property data, and cleanup.
- Add useful behavior and contract tests through later approved TDD gates.
- Document setup and limitations in a separate assessment guide during implementation or convergence.

### Out of scope

- Uploading source models, creating APS buckets, starting or polling translation jobs, or managing manifests.
- Autodesk three-legged OAuth, ACC/Docs browsing, or provisioning an APS application against an Autodesk account.
- Persisting APS access tokens, reports, plaintext Client Secrets, or feature-owned Viewer state in browser storage. The approved encrypted APS settings and Viewer-managed OPFS model cache are explicit exceptions.
- Multi-model aggregation, model version comparison, model editing, quantity exports, dashboards, or generic BIM query tooling.
- Fixing existing authentication, CORS, dependency-audit, formatting, linting, CI, or application-wide error-handling weaknesses unless the feature would otherwise introduce the same weakness.
- Supporting arbitrary CAD formats, translated UI, arbitrary localized category dictionaries, explicit linked-model aggregation, or multi-model scenes.
- Changing the protected root `README.md`.

### Protected baseline behavior

- Registration and login request/response contracts.
- JWT generation and the existing browser authentication state.
- `/login`, `/register`, `/home`, root, and catch-all routing behavior.
- Topbar, user menu, logout, and sidebar behavior.
- `/api/health` response behavior.
- User and MongoDB persistence behavior.
- Vite's existing `/api` development proxy.

## Current behavior and change surface

| Area | Evidence | Implication |
| --- | --- | --- |
| Home integration surface | `frontend/src/pages/HomePage.jsx:9-46` mounts the fixed shell and renders the placeholder at lines 21-43. | Compose the feature inside the home main area; preserve Topbar and Sidebar. The current `max-w-4xl` constraint may need a scoped home-layout adjustment for a useful Viewer canvas. |
| React lifecycle | `frontend/src/main.jsx:8-15` mounts the application under `React.StrictMode`. | Viewer setup and cleanup must be idempotent; development remounts must not create duplicate viewers, toolbar controls, or listeners. |
| Protected route | `frontend/src/App.jsx:14-21` and `frontend/src/routes/ProtectedRoute.jsx:5-7` protect `/home` in the browser. | The APS token endpoint must also enforce the existing JWT middleware; browser routing alone does not protect an API. |
| API client | `frontend/src/api/axiosInstance.js:3-17` targets `/api` and adds the current JWT. | A focused APS client can reuse this seam without changing auth behavior. It must not log or persist request bodies. |
| Browser persistence | `frontend/src/context/AuthContext.jsx:5-24` persists only the base application's JWT and user. | Do not extend this context or reuse its `localStorage` pattern for APS settings. Persistent APS settings belong to an authenticated backend/MongoDB boundary. |
| Settings persistence | `backend/src/models/User.js:4-27` stores identity and password fields only; no APS settings model exists. | Add one application-level APS settings boundary later. Authenticated users share it by explicit assessment decision; plaintext secrets and unauthenticated access are prohibited. |
| Language support | Package manifests and source contain no i18n dependency, locale catalog, translation provider, or language selector. All visible base copy is English. | Match only the English Revit category names required by the assessment and document localization as unsupported. |
| Backend composition | `backend/src/app.js:5-16` mounts auth routes and health; no APS route or central error middleware exists. | Add a focused router/service boundary later. Sanitize upstream failures instead of copying raw-error behavior from the existing auth routes. |
| Backend authentication seam | `backend/src/middleware/auth.js:3-18` verifies bearer JWTs but is not mounted on a route. | Reuse it for the new token broker without changing existing routes. |
| HTTP test seam | `backend/server.js:1-10` connects Mongo before listening, while `backend/src/app.js` exports Express independently. | Backend contract tests can exercise the app without starting the listener; the technical plan must isolate APS HTTP calls. |
| Existing tooling | Neither package manifest defines a test, lint, format, or type-check script. | Select only the minimum compatible test tooling during the Technical Plan gate. Do not claim automated coverage before it exists. |
| Runtime delivery | `frontend/index.html` has no Viewer SDK or Viewer stylesheet. | Viewer SDK acquisition, exact version pinning, load failure, and cleanup are explicit technical-plan concerns. |

### Minimal likely touchpoints

The exact structure belongs to the Technical Plan, but Discovery found no reason to modify the User model, auth routes, AuthContext, App routes, Topbar, Sidebar, Mongo configuration, or Vite proxy.

Likely existing-file touchpoints are limited to:

- `backend/src/app.js` to mount one focused APS route;
- `frontend/src/pages/HomePage.jsx` to compose the assessment UI;
- `frontend/index.html` or a scoped Viewer loader for Autodesk-hosted SDK assets;
- package manifests and lockfiles only if the approved test or APS client strategy requires dependencies.

Likely new responsibilities are:

- a backend APS OAuth adapter and thin authenticated route;
- a persistent settings form and focused APS API client;
- an encrypted APS settings persistence boundary with owner-approved access scope;
- a Viewer lifecycle adapter/component;
- a native-toolbar extension;
- pure category/property normalization and quantity aggregation;
- report and status presentation.

## Constraints

- The assessment is expected to take approximately four to six hours; avoid production-platform scope and speculative abstractions.
- All repository content must be English.
- Root `README.md` is protected. The assessment explicitly permits a separate guide.
- No Git action is authorized in this gate.
- APS Client Secret is user-entered by assessment requirement and will be persisted only as authenticated ciphertext. It must never be stored as plaintext, echoed, logged, included in URLs, placed in fixtures, or returned by the backend.
- The encryption key must remain outside MongoDB and Git. Losing or changing it makes existing ciphertext unreadable; recovery is re-entering the Client Secret, not returning or guessing the old value.
- A deployed credential exchange requires HTTPS. Local HTTP is development evidence only.
- The input is an already translated Revit URN. Translation and upload are preconditions, not feature behavior.
- The assessment includes links to example Revit models but no ready-to-load translated URN. No live APS credentials or translated acceptance model were available during Discovery, so model-specific and live acceptance evidence remains for later gates.

## Current APS contracts and versions

Access date for every external source in this artifact: 2026-08-04.

| Surface | Current version or contract | Evidence | Discovery consequence |
| --- | --- | --- | --- |
| Viewer SDK | Public documentation remains Viewer v7. The owner selected exact build `7.118.2` for its relevant SVF2/cache, loader-race, endpoint-switching, BVH/cache, and out-of-core fixes. The Autodesk CDN build was reachable and identified itself as `LMV v7.118.2` with 2026 copyright. | [Viewer v7 guide](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/overview/), [Viewer 7.118.2 bundle](https://developer.api.autodesk.com/modelderivative/v2/viewers/7.118.2/viewer3D.js), owner-supplied read-only Viewer performance research and ADR | Pin matching JS and CSS to `7.118.2`; do not use `7.*` and do not silently upgrade to a newer build. Record the loaded runtime version during validation. |
| Viewer initialization | Since Viewer 7.95, APS documents `env: 'AutodeskProduction2'` with streaming v2. Viewer 7.118.2 exposes public `DS_ENDPOINTS` endpoint routing. | [APS 404/init guidance](https://aps.autodesk.com/blog/getting-404-resource-not-found-error-viewer), [Viewer 7.118.2 bundle](https://developer.api.autodesk.com/modelderivative/v2/viewers/7.118.2/viewer3D.js) | Enable `DS_ENDPOINTS` before Initializer and omit a manual region field. The current Simple Viewer tutorial's older `AutodeskProduction` snippet is not sufficient for the pinned build. |
| Authentication API | OAuth v2; `POST /authentication/v2/token`, client credentials grant, Basic client authentication, form-encoded body, space-delimited scopes. OAuth v1 is retired. | [OAuth v2 token reference](https://aps.autodesk.com/en/docs/oauth/v2/reference/http/gettoken-POST/), [OAuth v2 migration guide](https://aps.autodesk.com/blog/migration-guide-oauth2-v1-v2), [Authentication OpenAPI](https://raw.githubusercontent.com/autodesk-platform-services/aps-sdk-openapi/main/authentication/authentication.yaml) | The backend requests only `viewables:read` and returns only `access_token` and `expires_in`. Do not use OAuth v1 or send the secret to Viewer. |
| Model Derivative API | v2; translated IDs are URL-safe Base64 URNs. Manifest, metadata, object tree, properties, and property query routes remain under `/modelderivative/v2`. | [Model Derivative v2 guide](https://aps.autodesk.com/en/docs/model-derivative/v2/developers_guide/overview/), [Model Derivative OpenAPI](https://raw.githubusercontent.com/autodesk-platform-services/aps-sdk-openapi/main/modelderivative/modelderivative.yaml), [current Data & Derivatives tutorial](https://get-started.aps.autodesk.com/tutorials/simple-viewer/data) | Do not call upload/translation/property REST APIs for this feature. Normalize the supplied encoded URN and load its existing derivative through Viewer. |
| Viewer document loading | Current tutorial flow obtains a public token from the backend, initializes Viewer, calls `Document.load('urn:' + urn)`, selects the default geometry, and calls `loadDocumentNode`. | [current Viewer & UI tutorial](https://get-started.aps.autodesk.com/tutorials/simple-viewer/viewer) | Keep Viewer loading behind one lifecycle boundary and expose explicit token, document, and model-load failures. |
| Toolbar API | Viewer v7 extensions use `onToolbarCreated`, `Autodesk.Viewing.UI.Button`, `ControlGroup`, and active/inactive button states. `viewer.getToolbar(true)` was removed in v7. | [Viewer v7 release notes](https://aps.autodesk.com/blog/viewer-release-notes-v-70), [toolbar extension pattern](https://aps.autodesk.com/blog/extension-skeleton-toolbar-docking-panel), [custom tool toggle pattern](https://aps.autodesk.com/blog/custom-tools-forge-viewer) | Implement one unloadable extension; remove controls and listeners on unload to prevent duplicate UI. |
| Theming API | `setThemingColor` accepts an RGBA/intensity vector and optional recursion. An individual object can be reset with a null theming color; `clearThemingColors` clears the entire model. | [theming behavior and reset guidance](https://aps.autodesk.com/blog/revisiting-viewers-theming-coloring-selective-cancelling-deferred-rendering-and-recursive) | Maintain independent category states and clear only the selected category's IDs so one toggle cannot erase another. |
| Property API | In Viewer 7.118.2, `getBulkProperties` is marked deprecated in favor of `getBulkProperties2`; property-database work is asynchronous. | [Viewer 7.118.2 bundle](https://developer.api.autodesk.com/modelderivative/v2/viewers/7.118.2/viewer3D.js), [property query guidance](https://aps.autodesk.com/blog/getbulkproperties-method), [object-tree readiness](https://aps.autodesk.com/blog/working-2d-and-3d-scenes-and-geometry-forge-viewer) | Wait for the model/object tree, enumerate and deduplicate candidate IDs, and fetch only the category/area properties needed by the feature. Avoid private Viewer internals. |
| Performance flags | Viewer 7.118.2 exposes public `DS_ENDPOINTS` and `LargeModelExperience` feature flags, and OPFS is available and enabled by default in v7.98+. These switches must be configured before `Autodesk.Viewing.Initializer`. | [Viewer 7.118.2 bundle](https://developer.api.autodesk.com/modelderivative/v2/viewers/7.118.2/viewer3D.js), [OPFS guidance](https://aps.autodesk.com/blog/viewer-performance-update-part-2-3-opfs-caching), [Smooth Navigation guidance](https://aps.autodesk.com/blog/viewer-performance-update-part-3-3-smooth-navigation) | Preserve the reusable initialization order: exact assets, explicit OPFS intent, supported public performance flags, then one global Initializer and one active Viewer. Do not add selective loading or `skipPropertyDb`, because this feature needs properties for its report. |

### Versioning conflict review

The current Autodesk tutorial still shows wildcard Viewer URLs and an older initializer. Autodesk separately warns that wildcard builds can introduce unexpected changes and recommends pinning the exact JS and matching CSS version. The most recent version-specific initialization guidance also supersedes the tutorial snippet. For this repository, the owner-selected `7.118.2` compatibility baseline and dated initialization guidance take precedence over both wildcard examples and later untested v7 builds.

Sources:

- [Always use versioning with the Viewer](https://aps.autodesk.com/blog/always-use-versioning-viewer)
- [Getting a 404 resource-not-found error in Viewer](https://aps.autodesk.com/blog/getting-404-resource-not-found-error-viewer)
- [Current Simple Viewer tutorial](https://get-started.aps.autodesk.com/tutorials/simple-viewer/viewer)

### OAuth decision: two-legged, not three-legged

The official Simple Viewer tutorial obtains a two-legged token from Client ID and Client Secret and gives Viewer a public token scoped only to `viewables:read`. Autodesk describes that token as access to Model Derivative translation outputs. The same tutorial produces Base64 URNs from application-owned OSS objects and uses them with Model Derivative and Viewer.

The official Hubs Browser tutorial uses three-legged OAuth for a different problem: redirecting a person to Autodesk login, receiving a callback, keeping refresh tokens, reading the Autodesk user profile, and browsing user-authorized hub/project data.

The assessment supplies Client ID, Client Secret, and the Base64 URN of an already translated model. It does not request Autodesk login, callback URL, consent, user profile, Hubs, or Data Management browsing. Therefore:

- use OAuth v2 client credentials (two-legged) with `viewables:read`;
- require the URN to identify a translated derivative accessible to the saved APS application credentials;
- do not add three-legged OAuth or silently fall back to it;
- treat ACC/Docs user-content access as unsupported unless a future specification explicitly adds that product flow.

Sources:

- [Simple Viewer two-legged authentication](https://get-started.aps.autodesk.com/tutorials/simple-viewer/auth)
- [Simple Viewer data and Base64 Model Derivative URNs](https://get-started.aps.autodesk.com/tutorials/simple-viewer/data)
- [Viewer public-token loading flow](https://get-started.aps.autodesk.com/tutorials/simple-viewer/viewer)
- [Hubs Browser three-legged authentication](https://get-started.aps.autodesk.com/tutorials/hubs-browser/auth)

### Reusable findings from the owner-supplied read-only references

- Load one exact matching JS/CSS version and configure public flags before the single global `Autodesk.Viewing.Initializer` call.
- Keep one active `GuiViewer3D` instance. A normal URN change reuses that runtime with `keepCurrentModels: false`; it must not mount a second operational Viewer.
- Do not call `Autodesk.Viewing.shutdown()` for a normal model change. Remove feature listeners, controls, panels, theming, and model references; call `viewer.finish()` when the owning component is actually torn down.
- Keep the property database enabled because category coloring and the quantity report depend on the object tree and model properties.
- Use `getBulkProperties2` with the narrowest useful property filter and bounded batches. Do not copy the other application's IndexedDB property index, full-model generic ingestion, telemetry, or multi-model coordination.
- Set explicit OPFS intent and enable the public `LargeModelExperience` flag when available before Initializer. Do not add classic consolidation, selective loading, or private Viewer flags without model-specific evidence.

## Security and privacy risks

| Risk | Impact | Discovery recommendation |
| --- | --- | --- |
| Secret persistence or exposure | Compromises the APS application and translated assets. | Render the secret as a password field, send it only in an authenticated same-origin request body, encrypt it before MongoDB persistence, and never return it. A settings read exposes only a boolean such as `hasClientSecret`. |
| Browser-to-APS OAuth | Exposes the client secret directly to a third-party request path and bypasses the application's control boundary. | Reject direct browser token exchange. Use the Express backend as a fixed-host token broker. |
| Unprotected token broker | Any caller could consume supplied credentials or use the route as an unauthenticated proxy. | Require the existing application JWT and allow only the fixed APS OAuth host, fixed grant type, and fixed `viewables:read` scope. |
| Upstream error leakage | APS or HTTP-client errors may contain sensitive request context. | Map upstream failures to stable, actionable application errors without raw bodies, headers, credentials, or stack traces. |
| Logging and observability | Default body logging, debug output, or analytics could capture the secret or token. | Do not log request bodies, Authorization headers, tokens, URNs, or raw APS failures in this assessment feature. |
| Access-token persistence or leakage | A reusable token or leaked token expands access beyond the current Viewer request. | Do not persist APS access tokens or expose them outside the Viewer token callback. The authenticated backend decrypts the global saved secret, requests a short-lived token, and returns only `access_token` and `expires_in`. |
| Encryption key co-location or reuse | Ciphertext provides little protection if the decryption key is stored in the same database/source tree or reused as the JWT signing secret. | Use authenticated application-layer encryption with a dedicated, versioned server key supplied through the environment. The exact algorithm and envelope belong to Technical Plan; plaintext, deterministic encryption, a database-stored key, and reuse of `JWT_SECRET` are rejected. |
| Shared settings mutation | Any authenticated application user can replace the shared Client ID, Client Secret, or URN. | Accept this as an explicit single-configuration assessment limitation. Require the existing application JWT, record the authenticated actor in sanitized server diagnostics, and document that role-based settings administration is not implemented. |
| Secret readback | Returning a decrypted or encrypted secret creates an unnecessary exfiltration path. | A settings response never contains the secret or ciphertext. An empty secret on update preserves the existing credential; a supplied secret replaces it after successful encryption. |
| Model authorization mismatch | A two-legged token does not grant access to arbitrary ACC or BIM 360 content. | Limit the feature contract to an already translated derivative accessible to the supplied APS application credentials. Three-legged ACC/Docs authorization remains out of scope. |
| Viewer-managed OPFS caching | Current Viewer v7 builds may retain derivative data in browser-local OPFS after the feature discards its own state. | Make the privacy posture explicit. The recommended assessment default is to allow the Viewer cache and document it; confidential-model deployments require a separately validated cache-disable policy. |
| XSS/property rendering | Model property text is external data. | Render property strings through React text nodes; do not inject Viewer/model data as HTML. |
| Third-party runtime drift | A wildcard CDN URL can silently change runtime behavior. | Pin Viewer JS and CSS to the same verified exact version and handle asset-load failure. |
| Non-HTTPS deployment | Credentials are observable in transit. | Document HTTPS as mandatory outside local development. Do not report local HTTP as secure deployment evidence. |

## Regression risks

- React StrictMode may initialize and dispose the Viewer twice during development.
- A remount or model reload may duplicate toolbar groups, buttons, events, canvases, or WebGL resources.
- Slow token, document, property, or model callbacks from an older load may overwrite the current model's report.
- A failed replacement load may leave old themed state or old counts visible.
- Clearing all theming colors for one button may deactivate other visual toggles without updating their button states.
- Category searches can return container nodes, parent nodes, partial string matches, or linked-model results rather than unique instances.
- Area values can be missing, type-based, duplicated, localized, rounded, formatted as strings, or expressed in incompatible units.
- A model may contain no target category or no object tree/property database.
- Viewer layout changes may cover the fixed Topbar/Sidebar or make auth/logout inaccessible.
- Raw Viewer or APS errors may accidentally expose sensitive data.
- Large Revit models can make per-object property calls or repeated rendering expensive.

## Community-observed pitfalls

These reports are non-normative evidence. They identify cases the specification and tests should cover; official documentation and the pinned runtime remain authoritative.

| Observation | Community evidence | Relevance |
| --- | --- | --- |
| `categoryFilter` in `getBulkProperties2` filters property groups such as `Identity Data`, not Revit element categories such as `Revit Rooms`. | [Autodesk Viewer categoryFilter question and APS expert answer](https://stackoverflow.com/questions/72366608/autodesk-forge-viewer-categoryfilter-for-getbulkproperties2-not-working-at-all) | Do not treat `categoryFilter` as the Furniture/Walls/Doors/Windows selector. Inspect the element's `Category` property or validated category nodes. |
| Viewer `search` is a partial-string search and can return false positives. | [APS exact-property-query guidance](https://aps.autodesk.com/blog/look-exact-property-value-and-more) | Use exact normalized category values after bulk retrieval; do not count or color raw fuzzy-search results. |
| Search results can identify a parent/component while UI selection identifies leaf geometry. | [APS search/dbId hierarchy explanation](https://aps.autodesk.com/blog/search-returns-different-dbid-selection-ui) | Enumerate descendants, select leaf instances, and deduplicate IDs before counting or theming. |
| Properties from linked Revit content may be visible through bulk properties while Viewer search misses them. | [linked Revit search report](https://stackoverflow.com/questions/66648926/autodesk-forge-viewer-search-function-doesnt-work) | Prefer object-tree enumeration plus bulk property filtering over Viewer search as the primary algorithm. |
| Property display units and parameter types may not match naive assumptions. | [Viewer property-unit discussion](https://stackoverflow.com/questions/75144229/getting-the-model-object-properties-in-the-right-display-units) | Aggregate numeric area only when its unit metadata is recognized and consistent; never parse a localized label alone as proof of units. |
| Extensions that do not remove controls/listeners on unload leave stale toolbar UI and behavior. | [Viewer v7 toolbar cleanup discussion](https://stackoverflow.com/questions/57218779/how-to-remove-toolbar-buttons-in-autodesk-forge-viewer-version-7) | Treat extension unload and Viewer disposal as tested behavior, especially under React StrictMode. |
| APS applications normally keep the Client Secret on the server, while this assessment explicitly asks the user to enter it in the UI. | [APS accounts, apps, keys, and IDs guidance](https://aps.autodesk.com/blog/accounts-apps-keys-and-ids), [current Viewer authentication tutorial](https://get-started.aps.autodesk.com/tutorials/simple-viewer/auth) | Document the assessment-only entry flow. After save, only the encrypted server-side copy remains; do not return or browser-persist it. |
| Two-legged credentials do not establish access to arbitrary user-owned ACC/Docs content. | [APS Authentication overview](https://aps.autodesk.com/developer/overview/authentication-api) | Define the input as a derivative already accessible to the supplied APS application, rather than promising arbitrary Autodesk document access. |
| Revit category/property labels can be localized or model-specific, and property display names are not guaranteed unique. | [localized Viewer properties report](https://stackoverflow.com/questions/69974657/getproperties-result-in-english), [property-based selection guidance](https://aps.autodesk.com/blog/property-based-selection-isolation) | Validate the exact acceptance model schema. English aliases are a bounded fallback, not a universal Revit category engine. |
| Viewer-managed OPFS caching can retain derivative data between sessions. | [Viewer OPFS performance update](https://aps.autodesk.com/blog/viewer-performance-update-part-2-3-opfs-caching) | Distinguish credential non-persistence from Viewer-internal model caching and document the accepted privacy posture. |
| Large property databases can make model analysis noticeably slower than geometry loading. | [Viewer workload guidance](https://aps.autodesk.com/blog/minimizing-viewer-workloads-loading-models-partially-selected-components-and-features-only), [Viewer event readiness guidance](https://aps.autodesk.com/blog/wait-events-viewer) | Show model loading and report analysis as separate states, bulk-query only required fields, and reject a hard latency claim until a representative model is available. |

## Recommended behavior semantics for later specification

These are Discovery recommendations, not approved requirements.

### Settings and token flow

1. The authenticated user enters Client ID, Client Secret, and translated Model URN.
2. Saving settings creates or replaces the single application-level APS configuration in MongoDB. The Client Secret is encrypted before persistence.
3. The settings response returns Client ID, Model URN, and `hasClientSecret`; it never returns plaintext or ciphertext for the secret.
4. When the user changes only the URN, an empty secret field preserves the already encrypted secret. A non-empty field replaces it.
5. Viewer obtains tokens through an authenticated same-origin callback endpoint. The backend loads the global settings, decrypts the secret only for the OAuth v2 two-legged exchange, requests fixed `viewables:read`, and returns only `access_token` and `expires_in`.
6. APS access tokens remain transient and are never written to MongoDB or browser storage.
7. Encryption or decryption failure produces a sanitized reconfiguration error and requires the user to enter the secret again.

### URN normalization and replacement

- Trim whitespace.
- Accept the assessment's URL-safe Base64 value with or without one leading `urn:` prefix.
- Remove only that prefix; do not decode and re-encode an already encoded value.
- Reject empty values, embedded whitespace, unsupported characters, or repeated prefixes before calling Viewer.
- Enable Viewer 7.118.2 `DS_ENDPOINTS` before Initializer instead of asking the user for a region.
- When a saved replacement URN starts loading, clear the previous model, report, category states, and theming.
- If Viewer cannot use the replacement URN, keep the Viewer empty and tell the user to verify that the URN is complete, translated, and accessible to the saved APS application credentials.

### Category selection and counts

- Wait until the active model's object tree and property database are available.
- Enumerate candidate nodes once per model and deduplicate model-local `dbId`s.
- Prefer unique leaf instances whose exact normalized `Category` property matches a small explicit alias set for Furniture, Walls, Doors, or Windows.
- Allow validated Revit prefixes such as `Revit Doors`, but do not use fuzzy substring matching.
- Treat absent or unrecognized category data as an explicit unavailable/zero-data state, not as an exception or fabricated result.
- Never persist `dbId` across model loads; APS documents it as derivative-local and unstable between translations.

### Toolbar toggles

- Each category owns its active state, color, and themed ID set.
- First click colors the category and marks the native button active.
- Second click removes only that category's theming and marks its button inactive.
- Changing or unloading the model clears all category state and removes stale controls/listeners.
- A category with no matching instances must produce actionable user feedback rather than silently appearing active.

### Quantity report

- Count unique leaf instances separately for Windows and Doors.
- Search only those instances for an exact normalized `Area` property.
- Sum area only when numeric values and compatible unit metadata are present.
- Show the count even if area is missing.
- Show “Area unavailable” when no safe total exists; show partial coverage when only some instances provide area.
- Do not derive area from width and height: the assessment asks for area “if available,” and derivation would introduce unsupported domain assumptions.
- Clear the previous report when a new load starts, ignore stale async results, and publish only the active model's result.

### User feedback, error handling, and diagnostics

This boundary applies to every feature-owned operation: settings read/save, encryption/decryption, APS authentication, Viewer asset loading and initialization, URN validation, document/model loading, property analysis, toolbar actions, report generation, retries, cancellation, and cleanup.

- No failure may be silent, swallowed, or converted only to `Server error`, `Something went wrong`, an empty panel, or a console message.
- Every user-impacting failure must state in plain English what could not be completed, what the user can verify or do next, and whether retrying is appropriate. Do not expose APS status codes, stack traces, internal identifiers, or implementation jargon as the primary message.
- Preserve partial success honestly. For example, if geometry loads but quantity analysis fails, keep the model usable and explain that only the report is unavailable.
- Keep previous success out of a new failed context. When a new URN load starts, clear the previous model-derived UI; when it fails, show the corrective URN guidance rather than stale geometry or counts.
- Use inline field errors for invalid settings, a visible status region for asynchronous work, focus management for blocking errors, and accessible `aria-live` or `role="alert"` semantics. Do not use blocking browser `alert()` dialogs.
- Offer a focused retry action only when the operation is safe to repeat. Do not create automatic retry loops for rejected credentials, invalid URNs, inaccessible derivatives, or deterministic property-schema failures.
- Assign each backend request a correlation ID. Return it with stable sanitized error metadata so the UI can show a support reference without exposing raw upstream details.
- Browser diagnostics must include the operation, stable application error code, correlation ID, safe HTTP/upstream status, and retryability. Expected user-correctable failures may use `console.warn`; unexpected failures use `console.error` with a stack only in development.
- Server diagnostics must include timestamp, correlation ID, operation, route, authenticated application actor ID, safe upstream status/error code, duration, and stack/cause for unexpected failures. Use a safe URN fingerprint instead of the full URN when model correlation is needed.
- Never log or return Client Secrets, decrypted values, encryption keys, ciphertext, APS access tokens, Authorization headers, complete request bodies, or raw upstream responses that may contain sensitive data.
- Error mapping must preserve the original cause through internal layers. Catch only to add context, map a known failure, or perform cleanup; otherwise rethrow to the feature's centralized error boundary.

| Failure class | Required user feedback | Diagnostic requirement |
| --- | --- | --- |
| Invalid settings | Identify the exact field and correction, for example `Enter the Base64 model URN provided by APS.` | Validation code and field name; no secret value. |
| Credentials rejected | Explain that APS could not verify the saved Client ID and Client Secret and ask the user to review both. | Correlation ID, OAuth operation, sanitized upstream status/error code. |
| URN invalid, inaccessible, or untranslated | Explain that the model could not be opened and ask the user to verify the saved URN, translation completion, and access by the configured APS application. | Correlation ID, normalized failure class, Viewer/document error code, safe URN fingerprint. |
| Viewer assets or initialization failed | Explain that the 3D viewer could not start, retain settings, and offer a retry. | Asset/runtime version, failing stage, browser capability, correlation ID when a backend request exists. |
| Category has no matches | State which category was not found in the loaded model and leave its toggle inactive. | Category key, model-load identity, zero-match result. |
| Report partially or fully unavailable | Keep the model usable; distinguish missing area values from a failed property analysis and state what data remains available. | Analysis stage, affected category, safe property/unit metadata, cause and correlation ID where applicable. |
| Unexpected internal failure | Name the failed operation, recommend retry or settings review as appropriate, and show a support reference. | Full sanitized server-side cause/stack plus stable code and correlation ID; sanitized browser entry. |

### Lifecycle and supported acceptance envelope

- Support one active model at a time in a current desktop Chrome or Edge browser with WebGL available.
- Initialize the APS runtime once, reuse one active Viewer for URN changes, and load with `keepCurrentModels: false`.
- On component teardown, remove every feature-owned event/control/panel, clear feature theming, release model references, and call `viewer.finish()`. Do not call global Viewer shutdown during a normal URN change.
- Clear the previous model, theming, toolbar state, and report when a replacement load begins; if the replacement fails, remain in an explicit empty/error state rather than silently showing stale data.
- Render geometry independently from an `Analyzing model...` report state and wait for the property database before aggregation.
- Use the English `Category` property values `Furniture`, `Walls`, `Doors`, and `Windows`, plus only exact verified Viewer/Revit prefixes such as `Revit Doors`; do not add a generic localization dictionary.
- Treat one already translated Revit derivative as the acceptance boundary. Explicit linked/federated aggregation and hard performance targets remain unsupported.
- Allow Viewer-managed OPFS model caching while persisting no access tokens, reports, or feature-owned Viewer state. Document this limitation in the later assessment guide.

## Options

| Option | Benefits | Costs and risks | Fit |
| --- | --- | --- | --- |
| Browser exchanges Client ID/Secret directly with APS and queries Viewer properties | Few backend lines. | Exposes credential exchange to browser-to-third-party flow, weakens control and error sanitization, and conflicts with the official public-token/server boundary. | Rejected. |
| Shared authenticated encrypted settings plus two-legged backend token broker; Viewer loads and queries its local property database | Meets the approved saved-settings behavior, keeps the reusable secret server-side after entry, exposes only a minimum-scope token, and uses the Viewer property API requested by the assessment. | Adds a sensitive-data schema, authenticated encryption key, shared-settings limitation, diagnostic/error mapping, token callback, Viewer cleanup, and property normalization. | Approved direction. |
| Autodesk three-legged login and per-Autodesk-user tokens | Supports user consent and user-owned Hubs/ACC data. | Requires Autodesk redirect/callback, consent, token refresh/session handling, Data Management context, and a different product journey not requested by the assessment. | Rejected. |
| Backend calls Model Derivative metadata/properties APIs and returns the report | Avoids client-side property traversal and can query without a rendered model. | Requires broader `data:read`, metadata GUID selection, 202 retry/pagination/large-payload handling, duplicates logic already available in Viewer, and no longer demonstrates the requested Viewer property extraction as directly. | Rejected for this assessment. |
| AEC Data Model API for category/report queries | Rich BIM query model and stable semantic API. | Requires different provisioning/model availability and expands beyond the translated-URN assessment. | Rejected. |

## Gap Ledger

| ID | State | Question or conflict | Impact | Resolution |
| --- | --- | --- | --- | --- |
| GAP-001 | Resolved | Does “saved” require persistent settings? | The feature needs to reuse credentials and let the user replace the URN without re-entering the secret. | Persist one global Client ID, authenticated-encrypted Client Secret, and Model URN in MongoDB. Never persist plaintext or APS access tokens. |
| GAP-002 | Resolved | Where is the Client Secret exchanged? | Direct browser exchange leaks control over a confidential credential. | Use an authenticated, fixed-host backend OAuth v2 broker and return only the Viewer token response. |
| GAP-003 | Resolved | Which OAuth scope is correct? | A broad or misspelled scope increases exposure or fails authentication. | Use only the current documented plural `viewables:read`. |
| GAP-004 | Resolved | Which Viewer/API versions apply? | Wildcards and unreviewed upgrades can introduce breakage. | Owner-selected Viewer `7.118.2`, OAuth v2, Model Derivative v2, and `AutodeskProduction2` with streaming v2. Pin matching JS/CSS and do not silently upgrade. |
| GAP-005 | Resolved | Does the feature upload or translate the Revit model? | Adds storage, cost, scopes, APIs, and significant UI. | No. An accessible, successfully translated URN is an input precondition. |
| GAP-006 | Resolved | What URN input shapes are accepted? | Double prefixes or re-encoding produce load failures. | Accept URL-safe Base64 with an optional single `urn:` prefix; normalize without re-encoding. |
| GAP-007 | Resolved | Should routing use a manual US/EMEA setting or Viewer 7.118.2 `DS_ENDPOINTS` automatic routing? | A manual field adds UI not required by the assessment. | Enable the public `DS_ENDPOINTS` feature flag before Initializer and do not add a region field. If live validation exposes a routing failure, return to Discovery rather than silently adding an override. |
| GAP-008 | Resolved | How are Revit categories identified? | `categoryFilter`, fuzzy search, parent nodes, and localization can miscount or miscolor. | The application is English-only. Use exact normalized English `Category` values for Furniture, Walls, Doors, and Windows over deduplicated leaf IDs, with only verified exact `Revit <Category>` aliases; no fuzzy primary search or localization dictionary. |
| GAP-009 | Resolved | What is one counted opening? | Tree containers/type nodes can inflate counts. | Count unique matching leaf instances in the active model. |
| GAP-010 | Resolved | What does “area if available” mean? | Naive parsing can sum incompatible or nonnumeric values. | Sum only recognized numeric `Area` values with compatible units; otherwise show count plus unavailable/partial area status. |
| GAP-011 | Resolved | Can toolbar toggles coexist? | Clearing all theming for one category breaks other active toggles. | Track IDs per category and reset individual IDs; clear all only during model disposal/reset. |
| GAP-012 | Resolved | How is a new load isolated from an old load? | Stale callbacks can publish the wrong model/report. | Reset state at load start and use an active-load identity/cancellation guard for token, model, and property work. |
| GAP-013 | Resolved | Where will setup and limitations be documented? | Root README is protected but the assessment requires documentation. | Create a focused `ASSESSMENT.md` only during an approved later gate; the assessment explicitly permits a separate guide. |
| GAP-014 | Resolved | Are baseline dependency findings part of this feature? | Upgrades add unrelated risk and time. | Keep existing findings out of scope; review only newly introduced dependencies in the approved plan. |
| GAP-015 | Resolved | How long may the browser retain the user-entered Client Secret? | A reusable token callback needs server-side access to the secret. | Persist only authenticated ciphertext in MongoDB. After save, do not retain or return the secret in browser state; the backend decrypts it only for an authenticated OAuth exchange. |
| GAP-016 | Resolved | Which translated models are supported by the two-legged flow? | Supplied credentials cannot access arbitrary ACC/Docs content. | Support one already translated derivative accessible to the supplied APS application credentials. Three-legged and arbitrary ACC/Docs access remain out of scope; replacing the saved URN selects another accessible derivative. |
| GAP-017 | Resolved | Must the feature support arbitrary Revit locales and linked/federated models? | Display-name matching can miss content outside the supported schema. | No. The base application is English-only and the assessment names the English Revit categories. Explicit localization and multi-model/linked aggregation are out of scope. |
| GAP-018 | Resolved | May Viewer retain model derivatives in browser OPFS? | Model data can outlive the feature session even when credentials do not. | Yes. Allow the Viewer-managed OPFS cache and document it separately from encrypted credential persistence. |
| GAP-019 | Resolved | What happens when a user saves URN B while URN A is already loaded and loading B fails? | Keeping A visible can make its report appear to belong to the saved URN B. | Clear A's model-derived UI when loading B starts. If B fails, keep the Viewer empty and ask the user in plain English to verify that the URN is complete, translated, and accessible to the saved APS application. |
| GAP-020 | Resolved | What browser, model size, and latency envelope defines acceptance? | No representative model is available, so hard performance claims would be invented. | Current desktop Chrome/Edge, one Revit derivative at a time, progressive geometry/report states, and no hard SLA until a model is supplied. |
| GAP-021 | Resolved | Does the assessment need APS three-legged user authentication or per-user APS settings? | Conflating application users with Autodesk authorization would add an unnecessary OAuth flow; shared settings allow authenticated users to overwrite one configuration. | Use OAuth v2 two-legged client credentials and one global application settings record. Existing application JWT authentication protects settings/token routes. Accept and document that any authenticated application user can replace the shared assessment configuration; role-based administration and 3LO are out of scope. |
| GAP-022 | Resolved | What error and diagnostic quality applies to the feature? | Silent, generic, raw, or untraceable failures create poor UX and slow debugging; excessive detail can leak credentials. | Apply the user-feedback and diagnostics contract to every feature-owned operation: actionable plain-English UI, accessible states, stable error codes, correlation IDs, sanitized browser diagnostics, structured server diagnostics, no swallowed causes, and no sensitive values. |

## Validation evidence and proof gaps

### Evidence collected

- Read all application source files, package manifests, repository governance, architecture, engineering guidance, and the assessment requirements.
- Confirmed the base backend and frontend were reachable locally during read-only discovery checks.
- Confirmed with browser-equivalent GET requests that the official CDN exact Viewer `7.118.2` JS and matching CSS URLs respond. Inspected the JS version banner plus the public `DS_ENDPOINTS`, `LargeModelExperience`, regional streaming, OPFS, and `getBulkProperties2` surfaces used by this Discovery.
- Read the owner-supplied AECO Manager Viewer research and ADR from their original repository in read-only mode. Reused only version-pin rationale, initialization ordering, single-runtime cleanup, OPFS, SVF2, and property-query findings; rejected that application's routing, provider, multi-module, cache, telemetry, and multi-model decisions as non-transferable.
- Queried the current npm registry without installing packages: `@aps_sdk/authentication` 1.0.1, `@aps_sdk/model-derivative` 1.2.1, and `@types/forge-viewer` 7.99.1. No APS SDK is required by the recommended direct OAuth adapter, and the type package lags the pinned Viewer build.
- Separated official APS facts from community reports and repository synthesis.
- Confirmed from the current official Simple Viewer tutorial that its Model Derivative Viewer token is two-legged and scoped to `viewables:read`; contrasted it with the official Hubs Browser three-legged redirect/callback/refresh flow.

### Proof gaps for later gates

- No live APS OAuth request was made because user credentials were not provided to this gate.
- No model was loaded, so exact category aliases, object-tree shape, area property names, units, and partial-data behavior remain model-specific acceptance evidence.
- No EMEA model was tested.
- No automated tests exist yet; test tooling is a Technical Plan decision.
- No browser/WebGL lifecycle or accessibility behavior was exercised because implementation has not begun.
- No live APS result may be reported as passed until these checks run with an approved translated Revit model.

## Senior review

- Missing evidence or boundaries: no translated URN is bundled with the assessment, so the exact Revit property schema and live performance cannot be claimed as validated. This is a later live proof gap, not a reason to invent localization or multi-model scope.
- Assumptions challenged: `7.118.2` is an intentional tested baseline rather than the newest observed build; the other application's ADR is evidence rather than authority for this repository; `categoryFilter` is not a Revit-category filter; Viewer search is not exact; all `Area` strings are not assumed compatible; `dbId` is not treated as stable identity.
- Security review: persistent Client Secret storage materially increases impact and requires authenticated encryption, a server-side key outside MongoDB/Git, authenticated shared-settings access, no secret readback, and recovery by re-entry. APS access tokens remain transient, the OAuth host and scope are fixed, and diagnostic detail is correlated without logging sensitive values. Existing application-wide auth/CORS weaknesses are not opportunistically refactored.
- Regression review: the recommendation preserves the shell, routes, auth contracts, health endpoint, and Mongo behavior. React StrictMode, asynchronous stale results, Viewer disposal, toolbar cleanup, and independent theming reset are explicit future test targets.
- Complexity review: upload/translation, Model Derivative property REST calls, AEC Data Model, generic localization engines, multi-model support, persistent property indexes, selective loading, `skipPropertyDb`, and baseline dependency upgrades are rejected. Encrypted settings persistence is included only because the owner explicitly requires it.
- UX/error review: every user-impacting path now has a plain-language outcome and corrective action, while browser/server diagnostics retain safe operation, cause, and correlation context. Raw APS payloads and internal jargon are not used as user feedback. Partial report failure does not unnecessarily discard usable geometry.
- TDD review: the strongest future seams are pure category/quantity behavior, backend OAuth/error contracts and secret-leak tests, accessible settings/status/error interactions, stale-load cancellation, correlation propagation, and a narrow Viewer adapter/extension fake. Real WebGL and live APS checks belong in a small manual acceptance layer, not broad unit mocks.
- Recommendation: approve the shared encrypted-settings, two-legged token broker, automatic endpoint routing, strict feedback/diagnostics, and Viewer-side property strategy. Preserve the exact scope and convert only approved observable semantics into stable requirements during Specification.

## Gate decision

- [x] Evidence is sufficient for Discovery review.
- [x] Official facts and community observations are distinguished.
- [x] Current API versions and deprecated guidance are recorded.
- [x] Owner resolved GAP-007, GAP-015 through GAP-022.
- [x] No material Gap Ledger item remains open.
- [x] Project owner approved Discovery and authorized Specification on 2026-08-04.
