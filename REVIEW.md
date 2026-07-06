# Review

Date: 2026-07-06
Scope: full-codebase reliability + feature pass (distinguished-engineer review), toward "a reliable service"
Reviewer stance: refute, not rubber-stamp. Every finding cites file:line.

> Context: the 2026-07-02 spec-vs-code review (BLOCK §V10 public-read + HARDEN
> GET-allowlist) landed via phase `D`/`T5` — `§V10` is now an explicit tested
> allowlist. This review supersedes that one. Two of its lower-severity items
> were never actioned and are re-raised below (H6, N7).

## Verdict up front

Functionally the app is sound and unusually well-governed (SDD spec, 2-way
drift tests, atomic CAD fs invariant `§V25`, route-auth sweep `§V27`). Nothing
here is a data-exposure BLOCK. The gap between "works" and "reliable service"
is operational: the process crashes on the wrong signals, stays "healthy" on
the wrong ones, and cannot drain on deploy. Fix the HARDEN set and this is a
dependable single-site service.

Gate: **GO** for continued operation; **hardening backlog required** before
calling it a "reliable service." No NO-GO blockers.

## Findings

### HARDEN 1 — Health check reports OK while the database is down (orchestrator blind)

Evidence:
- server/src/index.js:74 (`/api/health` handler)
- server/src/index.js:82 (catch still returns `status: 'OK'`)
- server/src/services/initializationService.js:588 (`getAuthenticationStatus` swallows its own error, returns object)
- Dockerfile:76 (`HEALTHCHECK ... wget --spider http://localhost/health`)
- docker/nginx.conf:94 (`/health` -> `http://localhost:3500/api/health`)

Claim:
The container HEALTHCHECK only checks for HTTP 200. `/api/health` returns 200
unconditionally — the error branch still emits `status: 'OK'`, and
`getAuthenticationStatus` never throws. Result: with the database fully
unreachable, Docker/Compose/K8s still see the container as **healthy** and keep
routing traffic to an app that can only 500. There is no readiness signal that
reflects DB reachability. This is the single largest reliability defect.

Severity: HARDEN (top priority)

Draft invariant:
Liveness (`process up`) and readiness (`can serve — DB reachable + schema
verified`) are distinct. The orchestrator health probe consumes readiness; when
the DB is unreachable readiness returns non-2xx (503), never 200.

### HARDEN 2 — A transient idle-client error hard-kills the process

Evidence:
- server/src/config/database.js:22 (`pool.on('error', ...)`)
- server/src/config/database.js:24 (`process.exit(-1)`)

Claim:
`pg` emits `error` on *idle* pooled clients for recoverable conditions (network
blip, DB failover, idle-timeout reset). The pool is designed to evict the bad
client and continue. Calling `process.exit(-1)` there converts every transient
backend hiccup into a full-process crash. Combined with `restart: unless-stopped`
this is a crash-loop waiting for a DB failover event.

Severity: HARDEN

Draft invariant:
A pool idle-client `error` is logged and the client evicted; it does not by
itself terminate the process. Process termination is reserved for
unrecoverable startup failure and graceful-shutdown signals.

### HARDEN 3 — `uncaughtException` logs but keeps running (failure policy inverted)

Evidence:
- server/src/index.js:131 (`process.on('uncaughtException', ...)` — logs only)
- server/src/index.js:126 (`unhandledRejection` — logs only)
- (contrast) server/src/config/database.js:24 (idle error -> hard exit)

Claim:
After an uncaught exception the process is in undefined state; Node guidance is
to log and exit so the orchestrator restarts a clean process. Here it logs and
continues — potentially serving corrupted state. This is exactly backwards from
HARDEN 2, where a *recoverable* event hard-exits while an *unrecoverable* one is
swallowed.

Severity: HARDEN

Draft invariant:
`uncaughtException`/`unhandledRejection` log FATAL, then trigger graceful
shutdown and exit non-zero. Recoverable pool errors do not.

### HARDEN 4 — No graceful shutdown; deploys cut in-flight requests

Evidence:
- server/src/index.js:157 (`app.listen(...)` — return value discarded, no server handle)
- absence: no `SIGTERM`/`SIGINT` handler, no `server.close()`, no `pool.end()` outside repair.js:87

Claim:
On `docker stop` / rolling deploy the runtime sends SIGTERM. With no handler the
process is SIGKILLed after the grace period: in-flight requests are severed
mid-response, transactions may be abandoned, and the pool never drains. A
reliable service traps SIGTERM/SIGINT, stops accepting connections, lets
in-flight requests finish within a timeout, then closes the pool.

Severity: HARDEN

Draft invariant:
SIGTERM/SIGINT -> stop accepting new connections (`server.close`), await
in-flight completion up to a bounded timeout, `pool.end()`, exit 0.

### HARDEN 5 — No rate limiting on authentication (or anywhere)

Evidence:
- server/package.json (no `express-rate-limit` dependency)
- server/src/index.js:50 (middleware stack — helmet/cors/compression/json only)
- `POST /api/auth/login` (server/src/routes/auth.js) — unthrottled
- `§V10` — a broad unauthenticated public-read surface also unthrottled

Claim:
`POST /api/auth/login` has no brute-force / credential-stuffing protection, and
the public read surface (`§V10`) has no abuse ceiling. For a service reachable
by more than a trusted LAN, an IP-scoped limiter on auth plus a sane global cap
is table stakes.

Severity: HARDEN

Draft invariant:
`POST /api/auth/login` (and password-change) are rate-limited per client;
exceeding the limit returns 429. A global request ceiling protects the public
read surface.

### HARDEN 6 — `project.status` domain still unenforced (carried from 2026-07-02 HARDEN 3, not actioned)

Evidence:
- SPEC.md §U.proj (`status active|completed|archived`)
- database/init-schema.sql:554 (`status VARCHAR(50) DEFAULT 'active'` — no CHECK; contrast components:91 `check_approval_status`, eco:646 `check_eco_status`)
- server/src/controllers/projectController.js:150 (create accepts raw `status`)
- server/src/controllers/projectController.js:185 (update `COALESCE($3, status)`, no validation)

Claim:
Spec and UI model a closed set, but the column is free-form varchar and the API
writes caller-supplied values verbatim. Every other lifecycle column in this
schema (`components.approval_status`, `eco_orders.status`,
`eco_file_rename_parts.original_approval_status`) has a CHECK constraint;
`projects.status` is the lone exception. This is the direct cause of N7.

Severity: HARDEN

Draft invariant:
`project.status ∈ {active, completed, archived}`, rejected at the API boundary
(400) and blocked by a DB CHECK constraint — parity with `components`/`eco`.

### NOTE 7 — Dashboard counts an undocumented `planning` status (carried from 2026-07-02 NOTE 4, not actioned)

Evidence:
- server/src/controllers/dashboardController.js:221 (`status IN ('active', 'planning')`)
- no `planning` in §U.proj, project UI, or schema comment (init-schema.sql:554)

Claim:
`planning` is a phantom status: counted as active by the dashboard but never
writable through the UI/API and absent from the spec. Stale logic that will
undercount/inconsistently count once H6 constrains the domain.

Severity: NOTE (resolve together with H6)

### NOTE 8 — Outbound vendor HTTP has no timeout (can stall bulk refresh)

Evidence:
- server/src/services/digikeyService.js:67,113,234 (`axios.post/get` — no `timeout`)
- (contrast) server/src/services/mouserService.js:78 (retry+backoff, still no timeout)

Claim:
axios defaults to no timeout. A hung DigiKey/Mouser endpoint holds the request
open indefinitely; inside admin bulk stock/spec refresh (`§V24`) one stuck
upstream stalls the whole batch. Bound every outbound call and treat a timeout
as a skippable item, not a batch-killer.

Severity: NOTE

### NOTE 9 — `express-validator` is a dependency but effectively unused

Evidence:
- server/package.json:29 (`express-validator` declared)
- no `validationResult(` usage in controllers (grep clean)

Claim:
Input validation is ad-hoc and per-controller; the declared validation library
is dead weight. Either adopt it at the boundary (bodies/params) or drop the dep.
Low priority, but it signals the broader gap: no consistent request-shape
validation layer.

Severity: NOTE

## Summary

| # | Severity | Finding | Fix locus |
|---|---|---|---|
| H1 | HARDEN | Health check 200 while DB down | index.js health + readiness split |
| H2 | HARDEN | Idle pool error -> `process.exit` | config/database.js |
| H3 | HARDEN | `uncaughtException` doesn't exit | index.js signal policy |
| H4 | HARDEN | No graceful shutdown | index.js SIGTERM/SIGINT |
| H5 | HARDEN | No auth rate limiting | index.js + routes/auth.js |
| H6 | HARDEN | `project.status` unenforced | init-schema + migration + projectController |
| N7 | NOTE | Dashboard `planning` phantom status | dashboardController |
| N8 | NOTE | Vendor HTTP no timeout | digikey/mouser services |
| N9 | NOTE | `express-validator` unused dep | boundary validation or remove |

## Spec deltas proposed (route through `spec` skill / already appended)

- §V30 (H1) health/readiness split; §V31 (H2/H3/H4) process resilience;
  §V32 (H5) auth rate limit; §V33 (H6/N7) project.status domain;
  §V34 (N8) bounded outbound HTTP.
- §T13–T18 backlog rows citing the above.
- §B15–B18 backprop rows for the confirmed defects (H1, H2, H6, N7).

Ordering recommendation: H1 -> H4 -> H2/H3 (one shutdown/resilience change set)
-> H5 -> H6/N7 -> N8 -> N9. Each ships via the SDD build loop with a test that
locks the new invariant (readiness returns 503 on DB down; SIGTERM drains;
login 429 after N attempts; `project.status` rejects out-of-domain 400).
