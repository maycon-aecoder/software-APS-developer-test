# Technical Plan: APS Viewer assessment

Status: Approved
Owner: Project owner
Created: 2026-08-05
Last updated: 2026-08-05
Specification: `spec.md`

## Design summary

Extend only the authenticated home content area. Preserve the existing React shell, authentication context, routes, Axios authorization interceptor, Express application boundary, JWT middleware, and MongoDB/Mongoose lifecycle.

The backend adds one authenticated APS router for configuration read, atomic save, and token acquisition. One per-user Mongoose document stores the canonical Model URN and an AES-256-GCM Client Secret envelope. Validation and encryption complete before one atomic document update. The token operation decrypts the current user's secret only for a bounded APS OAuth v2 client-credentials request with `viewables:read`; no APS token cache or persistence is added.

The frontend adds a feature-local reducer, a serialized runtime lifecycle coordinator, and one component-owned `GuiViewer3D`. One module-level asset promise loads matching APS Viewer `7.118.2` assets once; an initialization promise is scoped to the current runtime generation. The runtime and Viewer are reused for ordinary token renewal, unchanged-credential retry, and URN-only replacement. A durably persisted changed Client ID or any non-empty submitted Client Secret replaces the authentication context through public `viewer.finish()`, `Autodesk.Viewing.shutdown()`, and a new `Autodesk.Viewing.Initializer` call. At most one runtime and Viewer are active.

Every active successful configuration save is an authoritative frontend commit point. The backend safely classifies it as `urn-only` when normalized Client ID is unchanged and Client Secret was blank, or `credential-replacement` when Client ID changed or any non-empty secret was submitted. URN-only advances configuration, model, and analysis generations while retaining the encrypted secret and current runtime/Viewer. Credential replacement advances configuration, authentication, runtime, model, and analysis generations and performs the controlled reset after persistence. A failed save advances no committed generation and changes neither the runtime nor previous committed model state.

Model loading constructs `urn:${canonicalPayload}` without re-encoding. It chooses a supported default 3D geometry node or performs public `BubbleNode` depth-first pre-order traversal over returned child order and chooses the first supported 3D geometry node. It never falls back to 2D. Supported instance-tree and bulk-property APIs feed a conservative, model-local analysis adapter; pure functions own exact category, count, Area, unit, duplicate, and report-state rules.

The plan adds no production framework, token cache, migration platform, transaction, precision library, localization system, general observability layer, exhaustive Viewer mock, or unrelated refactor.

## Requirement traceability

| Requirements | Planned response | Evidence path |
| --- | --- | --- |
| `FR-001`, `NFR-001`-`NFR-003` | Feature-local authenticated-home workspace; existing shell, routing, navigation, authentication, and logout remain intact. | React behavior, build, keyboard/layout review; `AC-024`-`AC-026`, `AC-041` |
| `FR-002`, `FR-004`, `FR-015`, `TC-003` | Backend-authoritative canonical Base64URL validation, prefix-free persistence, exactly one Viewer prefix, and server-derived per-user filters. | Domain/API/controlled-load tests; `AC-001`-`AC-007`, `AC-031`-`AC-035`, `AC-039` |
| `FR-003`, `FR-017`, `TC-002`, `TC-007` | Backend 2LO with only `viewables:read`; supported Initializer callback obtains token/lifetime from current persisted configuration; normal renewal reuses runtime; credential replacement creates a new callback only after public shutdown/reinitialization; no refresh token or token persistence. | Token/API/provider tests and live renewal/reset evidence; `AC-008`, `AC-009`, `AC-021`, `AC-033`, `AC-038`, `AC-045`, `AC-051`-`AC-054` |
| `FR-004`, `FR-013`, `FR-019`, `TC-001`, `TC-006` | Exact `7.118.2` assets, at most one runtime/Viewer/model, serialized lifecycle coordinator, URN-only reuse, credential-context `finish()`/`shutdown()`/reinitialize, public deterministic 3D traversal, stale guards, and idempotent cleanup. | Runtime/lifecycle/selector doubles and live branch/tree/load evidence; `AC-004`, `AC-010`, `AC-021`-`AC-023`, `AC-036`-`AC-041`, `AC-045`, `AC-046`, `AC-050`-`AC-056` |
| `FR-005`-`FR-007`, `TC-005` | Active-model tree and public property results identify unique instance-level `dbId` values without assuming leaves; explicit evidence excludes types, categories, containers, organizational nodes, and nested geometry parts. | Controlled parent/child/type/container/instance fixtures and mandatory Revit evidence; `AC-011`-`AC-013`, `AC-029` |
| `FR-008`, `FR-009` | One native toolbar group owns three controls with independent readiness, activation, feature-owned theming, no-match feedback, and isolated failure. | Toolbar/controller doubles, accessibility tests, live review; `AC-014`-`AC-016`, `AC-022`-`AC-024`, `AC-042` |
| `FR-010`-`FR-012` | Unique instance counts; exact Area parsing; implementable duplicate predicate; exact unit compatibility; explicit complete, partial, unavailable, and failed states. | Table-driven domain tests, property orchestration doubles, real sanitized property shapes; `AC-017`-`AC-020`, `AC-034`, `AC-043`, `AC-044`, `AC-048`, `AC-049` |
| `FR-015`, `FR-016`, `FR-021`, `TC-004`, `NFR-004` | Unique per-user record, strict environment-key parsing, AES-256-GCM with user-bound AAD, safe projections, validation/encryption before one complete atomic update, and sanitized failures. | Crypto/service/router/index-startup/failure-injection tests; `AC-001`, `AC-003`-`AC-009`, `AC-033`, `AC-035`, `AC-036` |
| `FR-018` | Stable failure codes become accessible, activity-specific English guidance; server diagnostics retain safe operation and cause context without sensitive data. | API and UI state tests plus manual review; `AC-016`, `AC-024`, `AC-035`-`AC-042`, `AC-046` |
| `FR-020` | Gate 5 creates exactly one concise local `aps-viewer-assessment` skill that references repository guidance and approved artifacts. | Preparation verification; `AC-028`, `AC-030` |
| `FR-014`, `FR-022`, `NFR-008` | Final delivery verifies root README against bytes from the approved Git baseline, appends one English section only after explicit authorization, and performs Git actions only when separately authorized. | Byte-prefix check, sanitized evidence, diff/status and branch review; `AC-027`, `AC-030`, `AC-047` |
| `NFR-005`-`NFR-007` | Separate feature security, persistence, token, Viewer lifecycle, model analysis, pure domain, and presentation responsibilities; use focused doubles only. | Architecture/diff review and focused suites; `AC-026`, `AC-029` |

All `FR-001`-`FR-022`, `TC-001`-`TC-007`, `NFR-001`-`NFR-008`, and `AC-001`-`AC-056` are covered by the grouped rows above and the task evidence map. No design gap blocks Gate 3 review.

## Boundaries and data flow

1. The protected home route keeps the existing shell and renders the APS workspace inside its current content boundary.
2. The workspace registers one token/error sink bound to the authenticated user and a monotonically increasing workspace registration. Logout, authenticated-user change, replacement, retry, and unmount invalidate the prior registration and all associated operation identifiers.
3. `GET /api/aps/configuration` captures user and workspace generations. Only an explicit successful no-record response creates first-time state. A stale response is ignored; a current failure shows retry and starts no token or model work.
4. Save temporarily prevents a second UI submission and assigns a save-operation identifier. The backend authenticates, validates, reads only the current user's document with an explicit safe/secret projection appropriate to the service, enforces secret retention rules, encrypts when required, and executes one complete atomic upsert.
5. Every successful response is a durable server commit. Only a response matching the current user, workspace registration, and latest save operation may become the frontend commit. This guards programmatic, remount, logout, and test-induced races even while ordinary double submission is disabled. An obsolete response never clears the current form or replaces a newer committed result.
6. The response contains only the safe configuration plus `changeType: "urn-only" | "credential-replacement"`; it never returns the secret or its value. The backend derives `changeType` from the submitted secret presence and prior/new normalized Client ID, so the frontend does not infer a secret replacement from visible fields.
7. Each active success clears only that operation's secret input and commits the safe response. For `urn-only`, advance configuration/model/analysis generations, invalidate old model-derived state, and replace the model through the current Viewer. Do not finish or globally shut down for token renewal, ordinary retry, or this branch.
8. For `credential-replacement`, advance configuration/authentication/runtime/model/analysis generations, invalidate the prior callback and all prior work, serialize behind any lifecycle operation, call `finish()` on the owned Viewer, call public `Autodesk.Viewing.shutdown()`, clear Viewer/runtime references and the prior initialization promise, initialize a new runtime with `getAccessToken`, create one Viewer, and load the persisted URN only after initialization succeeds. An initial first save follows this branch but skips finish/shutdown for resources that do not exist.
9. The backend token operation reads and decrypts only the current authenticated user's persisted configuration. Each Initializer callback and token request captures user, workspace registration, authentication generation, and runtime generation. A mismatch discards success/failure without delivery or obsolete notification. With no active context, the provider stops safely without a loop or invalid callback.
10. The model controller loads exactly `urn:${modelUrn}` and chooses one supported 3D geometry node through deterministic public traversal. One model is active at most.
11. After geometry is usable, the analysis adapter discovers candidate nodes from the active model's public instance-tree and property APIs without leaf assumptions. Pure resolvers publish categories independently, counts from unique instance `dbId` sets, then Area results.
12. Every asynchronous boundary validates its captured user, workspace, save, authentication, runtime, model, and analysis context. Obsolete callbacks, promises, successes, failures, and models publish nothing; an obsolete loaded model is disposed by the owning current lifecycle when safe.
13. If reset/reinitialization partially succeeds then fails, the coordinator finishes any created Viewer, shuts down only the partially initialized current generation when required, clears its references/promise, leaves Viewer empty/load-failed, and permits one serialized retry against the persisted current credentials. The old model is never restored.
14. The feature-local `validation.md` begins with the first executable Gate 5 increment and receives append-only evidence for every increment rather than reconstructed final claims.

## Responsibility boundaries

Backend:

- Mongoose model: document shape, explicit secret exclusion, and unique `userId` index.
- Startup integration: after the existing database connection, explicitly await `ApsConfiguration.init()` before the server accepts APS feature traffic. Do not rely on production `autoIndex` behavior.
- Configuration domain/service: canonical validation, first/update rules, complete replacement document, safe response projection, and atomic persistence.
- Crypto service: strict key parsing, AES-256-GCM envelope creation, and authenticated decryption.
- Token service: bounded APS OAuth exchange and sanitized failure classification.
- APS router: existing JWT middleware, request/response contracts, status mapping, and safe operational diagnostics.

Frontend:

- APS API module: authenticated configuration/token requests and structured error normalization.
- Workspace reducer/orchestrator: attempted and committed configuration, backend `changeType`, user/workspace/save/authentication/runtime/model/analysis generations, progressive states, retry, and feedback.
- Viewer runtime lifecycle coordinator: exact asset loading, serialized initialization/reset/teardown, generation-scoped initialization promise and callback, at-most-one runtime/Viewer ownership, partial-failure cleanup, and idempotent StrictMode/logout/unmount behavior.
- Viewer controller: one instance, deterministic 3D selector, model lifecycle, toolbar ownership, theming, listeners, and cleanup.
- Model analysis adapter: public Viewer tree/property adaptation, bounded reads, instance candidate classification, and staleness guards.
- Pure domain: canonical URN, Category aliases, count identity, Area parsing, duplicate proof, unit compatibility, and report states.
- Presentation: settings, Viewer host/status, report, accessible messages, and display-only numeric formatting.

## API and persistence contracts

All routes use the existing authentication middleware under `/api/aps`.

### `GET /api/aps/configuration`

- No record: `200 { "configured": false, "configuration": null }`.
- Record: `200 { "configured": true, "configuration": { "clientId": "...", "modelUrn": "...", "hasClientSecret": true } }`.
- User id, timestamps, secret envelope, token, and internal fields are excluded through an explicit safe projection/mapper.

### `PUT /api/aps/configuration`

- Request: `{ "clientId": "...", "clientSecret": "...", "modelUrn": "..." }`. Blank secret is valid only when normalized Client ID is unchanged and an existing envelope exists.
- Success: `200 { "configured": true, "configuration": { "clientId": "...", "modelUrn": "...", "hasClientSecret": true }, "changeType": "urn-only" | "credential-replacement" }`. It is the durable commit point. `changeType` is `credential-replacement` for a first save, changed normalized Client ID, or any non-empty submitted Client Secret; otherwise it is `urn-only`. No secret value or secret-derived detail is returned.
- Validate all input and strictly parse the encryption key before persistence. Build the complete intended current document, including either the retained existing envelope or a newly encrypted envelope.
- Execute `findOneAndUpdate({ userId }, { $set: completeCurrentState }, { upsert: true, new: true, runValidators: true })`. Do not update individual fields in separate writes and do not add a transaction.
- Classify duplicate-key and persistence failures safely. They return no success body and therefore cannot create a partial frontend commit.

### `POST /api/aps/token`

- Accept no browser Client ID, Client Secret, scope, or Model URN.
- Return only `200 { "accessToken": "...", "expiresIn": 3599 }` with a positive lifetime in seconds.
- POST form-encoded `grant_type=client_credentials&scope=viewables:read` to `https://developer.api.autodesk.com/authentication/v2/token` with HTTP Basic client authentication.
- Use native `fetch` and `AbortController` with a ten-second timeout, no automatic retry, and no cache.

### Error boundary

Feature errors use `{ "code": "...", "message": "...", "fieldErrors": { ... } }`. The UI maps stable codes to activity-specific English guidance and never renders raw APS/OAuth bodies. Status classes remain `400` validation, existing `401` authentication, `409` configuration conflict, `422` rejected APS credentials, `502` invalid upstream response, `503` temporary upstream or unavailable encryption configuration, and sanitized `500` read/encryption/persistence/internal failure.

Server diagnostics record operation, safe code/status, request-independent cause classification, and stack/cause where safe. They exclude authorization headers, Client Secret, encryption key, token, ciphertext, IV, tag, raw upstream body, and complete credential-bearing requests.

### MongoDB document and key validation

One `ApsConfiguration` document per server-derived application user contains `userId`, trimmed case-preserved `clientId`, canonical prefix-free `modelUrn`, timestamps, and envelope `{ version: 1, ciphertext, iv, authTag }`. Secret envelope fields are excluded by default and selected only inside the configuration/token services. The collection stores no token, report, category, toolbar, or Viewer state.

`APS_CONFIG_ENCRYPTION_KEY` is canonical standard Base64 for exactly 32 bytes. Validation first checks presence, allowed alphabet, correct padding placement/length, and canonical form, then decodes, checks 32 bytes, and round-trips to the identical canonical string. Permissive `Buffer.from` decoding alone is insufficient. Missing, malformed, incorrectly padded, noncanonical, wrong-length, or authentication-failing key material fails closed with sanitized output.

The schema is additive and requires no backfill. Startup awaits the unique `userId` index after the existing MongoDB connection and before `listen`; index failure prevents APS traffic rather than silently accepting a non-unique configuration store.

## Viewer `7.118.2` contract

- Use matching `viewer3D.min.js` and `style.min.css` assets at exact version `7.118.2`, with `env: 'AutodeskProduction2'` and `api: 'streamingV2'` as required for current Viewer v7 SVF/SVF2 initialization. Region-specific expansion is out of scope unless the approved specification changes.
- Each runtime generation initializes through public `Autodesk.Viewing.Initializer({ getAccessToken })`. The generation-bound provider gives Viewer only a current short-lived token and lifetime seconds and stores neither. Ordinary Viewer-requested renewal uses this callback without shutdown or reinitialization.
- URN-only replacement reuses the runtime and Viewer; it never assumes or forces a fresh token before `Document.load`. Viewer-managed callback renewal remains authoritative for that unchanged credential context.
- Credential replacement never mutates an already delivered token. After durable save, invalidate the old generation, finish the owned Viewer, call public `Autodesk.Viewing.shutdown()`, clear coordinator references/promises, then initialize a new runtime whose callback reads the newly persisted credentials.
- Do not use a token setter, retained-callback invocation, endpoint/header mutation, `NOP_VIEWER`, private refresh/implementation field, or derivative proxy.
- The coordinator serializes initialize, credential reset, retry-after-reset, logout, and final teardown. Its active initialization promise is `{ runtimeGeneration, promise }`; only a matching generation may publish or install a Viewer reference. A failed/obsolete promise clears itself only if it is still the active promise.
- A current callback may notify only its matching registered workspace. An obsolete callback/token/error stops without delivery, notification, invalid callback invocation, or refetch loop.

Official Autodesk evidence supports the selected public calls: the [Viewer tutorial callback example](https://get-started.aps.autodesk.com/tutorials/simple-viewer/viewer), [Viewer3D `finish()` reference](https://aps.autodesk.com/en/docs/viewer/v6/reference/Viewing/Viewer3D/), [Viewer v7.0 global `shutdown()` release note](https://aps.autodesk.com/blog/viewer-release-notes-v-70), [Viewer v7.95+ initializer guidance](https://aps.autodesk.com/blog/getting-404-resource-not-found-error-viewer), and [exact Viewer `7.118.2` distribution](https://developer.api.autodesk.com/modelderivative/v2/viewers/7.118.2/viewer3D.js). Distributed private behavior is not an implementation contract.

### Deterministic 3D selection and lifecycle

- Call `Document.load` with exactly one `urn:` prefix.
- Accept `root.getDefaultGeometry()` only when public node predicates prove supported 3D geometry.
- Otherwise traverse from the public document root with `BubbleNode.getChildren()` in depth-first pre-order, preserving each returned child order, and choose the first node whose public predicates prove supported 3D geometry. Do not use broad-search result ordering or private manifest structures. Never select 2D.
- For URN-only replacement, clear feature-owned model state/theming, unload the current model through supported Viewer APIs, keep the same Viewer, and load the selected node with one-model behavior. A failed replacement leaves Viewer empty/load-failed and never restores the old model.
- For credential replacement, lifecycle cleanup precedes the new Initializer: clear feature controls/listeners/theming and model references, call `viewer.finish()` once, null the Viewer, call `Autodesk.Viewing.shutdown()` once for the old runtime generation, clear its promise, then initialize/create/load the new generation.
- Ordinary model retry with unchanged credentials reuses the current runtime/Viewer. Retry after reset failure initializes the current persisted credential generation from an empty coordinator state; it does not shut down the already-cleared prior generation again.
- Logout invalidates user/workspace/authentication/runtime generations and performs one serialized final global teardown. Unmount performs idempotent ownership release; if it is the final global owner, it may finish/shut down once. StrictMode cleanup/remount is serialized so any remount waits for prior teardown and never overlaps runtimes/Viewers. Normal token expiration, callback renewal, ordinary retry, and URN-only replacement never call global shutdown.

## Model analysis contracts

### Instance and Category adapter

The approved unit is a unique instance-level `dbId` in the active model, not a terminal tree leaf. The adapter uses supported instance-tree traversal and `model.getBulkProperties2` in bounded batches to collect model-local structure and properties. The exact candidate-node algorithm remains an implementation decision inside the adapter because Revit derivatives vary, but its observable contract is fixed:

- include an instance with an approved exact Category even when it has children;
- do not promote a leaf to an instance merely because it is terminal;
- exclude records proven to be types, category nodes, containers, or purely organizational nodes by their supported tree/property evidence;
- exclude nested geometry/part children that do not independently represent the building instance;
- return each qualifying active-model `dbId` once and never carry a `dbId` across models;
- resolve only the eight approved trimmed, case-insensitive exact Category aliases, with no fuzzy, substring, translated, or inferred match;
- surface insufficient classification evidence conservatively as analysis failure/unavailable rather than guessed counts.

Controlled fixtures cover relevant parent, child, type, category, container, organizational, nested-part, leaf-instance, and non-leaf-instance records. Mandatory live evidence records sanitized tree/property facts for representative Revit instances before the adapter is accepted.

### Native toolbar and theming

One feature-owned native toolbar group contains labeled Furniture, Walls, and Doors controls. Readiness and failure are independent per category. The controller maintains an active-category map and the union of feature-owned themed `dbId` values for the active model.

Apply color with supported public Viewer/model APIs and the active model argument. To turn one category off, set feature-owned affected element colors to `null` through supported per-`dbId` behavior, then deterministically rebuild and reapply all remaining active feature categories from the map. This defensive rebuild preserves overlaps. Never clear unrelated Viewer theming, inspect private fragment maps, call `NOP_VIEWER`, or invoke undocumented invalidation internals. Replacement and teardown clear every feature-owned themed `dbId` and discard the map.

### Property and Area adapter

Use public `model.getBulkProperties2` results. Viewer `7.118.2` property records expose the selected fields `displayName`, `displayValue`, `displayCategory`, `attributeName`, `type`, `units`, `hidden`, and `precision`; the containing result supplies `dbId`. The adapter requests visible properties and passes only these fields into pure analysis.

An exact Area candidate has trimmed, case-insensitive `displayName === 'Area'`. `displayValue` supplies the numeric/string input, `units` supplies the trim-only unit, and `type` participates in duplicate identity. For more than one exact Area record, duplicate identity is proven only when every record:

- is independently valid under the approved parser;
- has the same numeric value and normalized unit;
- has a non-empty stable `attributeName`, and all `attributeName` values are exactly identical;
- has an identical exposed `type`.

`displayCategory` is retained as evidence but equality within one display category is not duplicate proof. Cross-category records may contribute once only when the stable-identifier, value, unit, and type predicate above succeeds. `hidden` is excluded by the supported query option. `precision` is presentation metadata, not duplicate identity. Missing required metadata means identity is not proven. If real results do not expose stable sufficient metadata, multiple Area records are ambiguous and contribute nothing; no first/largest/smallest record is selected and records are never summed together.

Counts derive from deduplicated Door/Window instance sets before Area. Operational property failure after a safe count retains count, publishes no subtotal, and marks only Area failed. Expected missing, invalid, ambiguous, or incompatible data produces the approved partial/unavailable states, not operational failure.

### Presentation precision

Domain parsing and aggregation retain the safe JavaScript numeric result and approved Area state. Formatting stays in presentation and cannot alter state, unit compatibility, or the calculated value. When all contributing properties expose consistent, trustworthy nonnegative precision metadata, the UI may use it for display. Otherwise it uses a documented simple assessment display, initially the shortest round-trippable JavaScript numeric string, subject to UI/live review. No 15-significant-digit rule, unit conversion, or arbitrary-precision dependency is planned.

## Credential and lifecycle threat analysis

| Threat | Control | Residual limitation |
| --- | --- | --- |
| Old credential token authorizes a replacement load | Changed Client ID or any non-empty submitted secret is backend-classified as credential replacement; after durable save the old callback/generation is invalidated, the old Viewer is finished, global runtime is publicly shut down, and only a new Initializer callback reads new persisted credentials. | Browser/Viewer memory may retain inaccessible garbage until collection; no secure JavaScript memory erasure is claimed. |
| Old callback, promise, model, error, or analysis publishes after reset | Every callback/promise captures user, workspace, authentication, runtime, model, and analysis generations; mismatches publish nothing. | Obsolete work may consume resources before completion/cancellation. |
| Overlapping init/shutdown creates two runtimes or Viewers | One lifecycle queue serializes initialization, reset, retry, logout, and final teardown; only the current generation can install references. | Autodesk global lifecycle remains process-page global, so unrelated Viewer ownership is outside this feature's supported scope. |
| Failed persistence destroys a working Viewer | Lifecycle branching occurs only after the active successful response; validation/encryption/write failure invokes no finish, shutdown, or model invalidation. | A process/browser failure outside the operation cannot be made atomic with MongoDB. |
| Partial reset leaves corrupt ownership | Current-generation cleanup finishes any created Viewer, shuts down a partially initialized runtime when applicable, clears references/promise, and leaves an explicit empty/load-failed retry state. | Retry may still fail due browser/WebGL/network conditions and then requires reload guidance. |
| StrictMode, logout, or unmount performs duplicate teardown | Generation ownership and idempotent disposal ensure finish/shutdown run at most once for a runtime generation; a remount waits for the lifecycle queue. | Development StrictMode may intentionally initialize again after a completed teardown, but never concurrently. |

Existing controls for per-user ownership, AES-256-GCM/AAD, safe projections, least-scope 2LO, strict key validation, and no token persistence remain unchanged.

## State, concurrency, errors, and recovery

- State keys: authenticated user identity, workspace registration, read/save operation id, configuration generation, authentication generation, runtime generation, token request id, model generation, and analysis operation id. Counters are monotonic for the page process and are never reset in a way that could make obsolete work current.
- Ordinary concurrent saves are prevented while one is pending. Operation and context guards still reject an older response after a newer operation/context, including logout or user change during read/save.
- An active URN-only success advances configuration/model/analysis generations and reuses runtime/Viewer. An active credential-replacement success advances configuration/authentication/runtime/model/analysis generations and resets lifecycle even if Client ID and URN are visibly unchanged. Only the active operation's secret input clears.
- Validation, encryption, duplicate-key, or persistence failure preserves exact previous committed configuration/runtime/Viewer/model/report/controls/matches/theming, retains attempted fields/secret, and invokes neither finish nor shutdown.
- After a durable commit, credential, token, document, inaccessible/untranslated URN, or 3D-selection failure leaves the new safe settings editable and the Viewer empty/load-failed; old model state never returns.
- Asset/WebGL initialization or reinitialization failure keeps shell/settings usable, leaves Viewer empty/load-failed, cleans partial current-generation resources, and offers serialized retry/reload guidance without restoring the old model. Category failure is isolated; count failure skips Area; Area operational failure retains count and discards subtotal.
- User-visible messages identify the activity and corrective action without internal terms or raw upstream text. Current safe server diagnostics preserve enough classified context for debugging. No failure is swallowed; only expected obsolete cancellation is intentionally silent.

## Dependencies and test strategy

Gate 5 may add development-only `supertest` for backend HTTP contracts and `vitest`, `jsdom`, `@testing-library/react`, and `@testing-library/user-event` for Vite/React tests. Backend domain/service tests use built-in `node:test`, `node:assert`, `crypto`, `fetch`, and `AbortController`. Versions must be compatible with the current Node 18+, React 18, and Vite 6 baselines, and lockfile changes receive review and an available audit. No production dependency is required.

Preparation is not TDD Red. Skill creation, test script/tool installation, fixtures, and doubles use inventories, smoke checks, and verification lists. Behavioral TDD starts with canonical URN behavior. Each Red command must execute with a working runner and fail because the required observable behavior is absent, never because of missing setup, imports, dependencies, or environment. User review/approval of the useful Red precedes production Green.

Focused automation covers:

- canonical URN acceptance/rejection and one-prefix construction;
- strict key parsing, AES-256-GCM randomness/round-trip/AAD/tamper/wrong-user/wrong-key behavior, safe projections, atomic upsert, deliberate index startup, duplicate-key/write failure, and cross-user API isolation;
- current persisted-credential token exchange, exact scope/endpoint/lifetime/timeout, supported Initializer callback, normal renewal without shutdown, stale token suppression, and no persistence/logging;
- backend save classification, URN-only reuse, non-empty-secret reset, changed-Client-ID reset, failed-save non-reset, older save after a newer context, logout/user change during read/save, and prior-runtime token/callback suppression;
- serialized at-most-one runtime/Viewer ownership, exact `finish()` then public `shutdown()` order, generation-scoped initialization promises, partial-failure cleanup, retry-after-reset failure, StrictMode/repeated mount, mixed nested 2D/3D/default/no-default/no-3D selection, stale model disposal, and idempotent teardown;
- non-leaf and leaf instance outcomes, types/containers/categories/nested parts, exact aliases, independent/overlapping theming, counts, Area parsing, duplicate predicate, units, and report states;
- accessible settings/workspace status, password semantics, keyboard/retry behavior, action-specific messages, and shell preservation.

Viewer doubles model only consumed public methods and returned shapes. They do not claim WebGL, Autodesk rendering, real toolbar integration, real derivative access, or real Revit property behavior.

## Continuous validation and live evidence

At the first executable increment after Gate 4 approval, create feature-local `validation.md`. For each increment append or update a clearly dated entry with task id, Red reason where behavioral, Green result, focused regressions, evidence type (`automated`, `controlled`, `manual`, or `live`), commands/results, unresolved limitations, and rollback point. Preserve historical results; convergence adds a current matrix without rewriting earlier failures as passes. Never record secrets, full tokens, keys, raw APS bodies, complete credential requests, or unsanitized real-model data.

Manual/live validation must include:

- actual `7.118.2` assets, ordinary callback renewal without reinitialization, URN-only replacement without reinitialization, credential replacement through public `finish()`/`shutdown()`/new Initializer, new credentials loading the persisted model, and no obsolete prior-runtime publication;
- real document bubble tree showing default/fallback selection under the public DFS rule and proving no 2D fallback;
- sanitized representative Revit parent, child, type, category/container, organizational, nested-part, leaf-instance, and non-leaf-instance structures/properties;
- sanitized real Area property shapes containing only the selected public fields before duplicate proof is claimed; ambiguous metadata stays explicitly unsupported;
- native toolbar ownership, keyboard operation, independent/overlapping theming rebuild, replacement/teardown cleanup, and report outcomes;
- current Chrome/Edge layout, WebGL, shell/navigation/logout regression, network/browser storage, MongoDB encrypted envelope, canonical URN, and absence of token persistence.

Unavailable real credentials/model evidence remains `pending live`; controlled evidence is never relabeled as live. Final documentation consumes only sanitized current evidence and known limitations.

## Rollout and rollback

Implementation follows the twelve increments in `tasks.md`: preparation; URN; crypto/persistence; configuration HTTP; token bridge; settings state; Viewer lifecycle; instance/category/toolbar; quantity/property analysis; integration/convergence; live/docs; authorized Git delivery. Every completed increment is a rollback point and records evidence immediately.

Lifecycle rollout enables no server-side migration or feature flag. The frontend coordinator is wired only after save classification and token callback contracts exist. Its rollback boundary removes credential-reset orchestration and Viewer integration together; it must never downgrade credential replacement to same-runtime loading. If lifecycle rollback is required after configuration persistence remains deployed, disable Viewer loading and leave safe settings editable rather than reuse an uncertain authentication context.

The MongoDB collection is additive and has no backfill. Rollback removes APS route/UI wiring and stops using the collection; encrypted documents remain inert and are not deleted without separate authorization. Changing/removing the key while data remains intentionally makes decryption fail closed. Dependencies can be removed with only their reviewed development lockfile entries.

The README baseline is the exact byte sequence from the current approved Git object, obtained read-only with a command such as `git show HEAD:README.md`, not a later working-tree snapshot. Baseline identity is recorded during preparation. Before any authorized final append, compare working README bytes to that baseline and abort if any byte differs. Append to the verified baseline while preserving its line endings and final-byte behavior; verify the resulting file begins with the exact baseline bytes. These checks authorize no Git mutation.

No feature flag, migration framework, transaction, background job, production deployment platform, or automatic rollback infrastructure is warranted.

## ADR decision

No ADR is required. The lifecycle amendment is feature-local, explicitly owned by amended Gate 2 requirements, and does not establish a repository-wide Viewer platform or shared credential-reset policy. Public shutdown/reinitialization is isolated behind one coordinator and remains reversible with the feature.

## Gap Ledger

| ID | State | Question or conflict | Impact | Resolution or required action |
| --- | --- | --- | --- | --- |
| `PLAN-GAP-001` | Resolved | Which model replacement owns old geometry? | Old geometry could impersonate a new configuration. | Both branches clear feature state/theming and never restore old geometry. URN-only unloads/reloads through the current Viewer; credential replacement finishes the old Viewer and publicly shuts down its runtime before one new Viewer loads. |
| `PLAN-GAP-002` | Resolved | How is canonical Base64URL proven without changing it? | Permissive decoding can accept equivalent invalid text. | Structural checks plus canonical decode/re-encode equality validate; persist the submitted canonical prefix-free payload. |
| `PLAN-GAP-003` | Resolved | What proves duplicate Area properties? | Similar records could inflate totals. | Public fields only: exact `displayName`, valid `displayValue`, identical normalized `units`, identical non-empty `attributeName`, and identical `type`; category equality alone is insufficient; missing identity metadata is ambiguous. |
| `PLAN-GAP-004` | Resolved | How is a newly persisted credential context guaranteed without an undocumented token setter? | Same-runtime model loading could reuse an old delivered token. | Classify saves by credential intent. URN-only reuses unchanged authentication context. Changed Client ID or any non-empty secret persists first, invalidates prior generations, serially calls public `viewer.finish()` and `Autodesk.Viewing.shutdown()`, clears references/promises, and creates a new Initializer callback/runtime/Viewer that reads only new persisted credentials. No proxy or private/undocumented API is used. |
| `PLAN-GAP-005` | Resolved | Is a transaction or migration framework required? | Partial records are unacceptable; extra infrastructure is disproportionate. | One complete per-user atomic update, deliberate awaited unique index, safe failure mapping, and no backfill satisfy the requirement. |
| `PLAN-GAP-006` | Resolved | Is an ADR required? | Either missing rationale or excess documentation is a risk. | No; decisions remain assessment-local. A product-contract change returns to Gate 2. |
| `PLAN-GAP-007` | Resolved with mandatory live proof | How are instance records distinguished without a leaf assumption? | Real non-leaf instances may be lost or nested parts overcounted. | Conservative public tree/property adapter with fixed observable outcomes, controlled mixed-node fixtures, and mandatory sanitized Revit evidence. Exact internal candidate algorithm is settled during adapter implementation without changing outcomes. |

No material architectural, APS, security, lifecycle, migration, rollback, or test-design gap remains open. Real APS credentials and a representative translated Revit model are evidence dependencies, not design gaps, and unavailable checks remain explicitly open.

## Senior review

- Architecture: Feature boundaries follow the existing CommonJS/Express/Mongoose and React/Axios application. The reducer, serialized lifecycle coordinator, Viewer controller, analysis adapter, and pure domain modules exist only where security, lifecycle, or deterministic testing requires them.
- APS correctness: Viewer assets are pinned to `7.118.2`; SVF/SVF2 initializer values, public callback, `finish()`, global `shutdown()`, one-prefix URN, public DFS 3D selection, no 2D fallback, at-most-one runtime/Viewer/model, public property APIs, and live proof are explicit. No setter, retained callback, endpoint mutation, `NOP_VIEWER`, private refresh, or proxy is planned.
- Security: Server-derived ownership, strict canonical 32-byte key parsing, AES-256-GCM with user AAD, explicit projections, complete atomic replacement, awaited unique index, least scope, timeout, no token persistence, and safe diagnostics remain covered. Credential replacement cannot reuse the old authentication generation.
- Concurrency and lifecycle: Save intent determines generations: URN-only reuses runtime/Viewer; changed Client ID or any non-empty secret resets authentication/runtime after persistence; failure resets nothing. The lifecycle queue and generation-scoped promises cover stale callbacks, partial init, retry, logout, StrictMode, and unmount with no overlap or duplicate shutdown.
- Model correctness: Instance identity is property/structure evidenced, model-local, and never leaf-derived by default. Public deterministic viewable traversal, per-`dbId` theming rebuild, and executable Area duplicate identity remove prior ambiguity.
- Complexity: No production dependency, general framework, migration system, transaction, precision package, token cache, or exhaustive SDK simulator is planned. Twelve reversible increments are proportionate to the assessment.
- Testability: Preparation uses smoke checks, behavior uses real Red tests, controlled Viewer boundaries remain narrow, and real rendering/property claims remain live. Continuous `validation.md` preserves honest evidence and rollback history.
- Rollback and delivery: Schema and wiring are additive; README uses the approved Git bytes; Git stays separately authorized. No destructive rollback or secret-bearing artifact is planned.

## Gate decision

- [x] Every approved requirement has a design and evidence path.
- [x] Security, concurrency, recovery, rollback, and validation lifecycle are explicit.
- [x] No private Autodesk API is planned.
- [x] `PLAN-GAP-004` is resolved by the amended public lifecycle and introduces no derivative proxy or undocumented token mechanism.
- [x] Project owner approved the Technical Plan and implementation/test sequence on 2026-08-05. Tasks already exist; Git actions still require separate authorization.

Technical Plan is `Approved`.
