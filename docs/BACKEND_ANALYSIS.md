# Backend Analysis (Diploma Project)

Date: 2026-04-04

## Current status

The backend is already substantial and includes:
- layered architecture (routes/controllers/services/models),
- auth + roles,
- clubs, tournaments, applications,
- bracket generation,
- live/socket modules,
- audit and notification services,
- automated tests.

## Critical issue found

Automated tests were trying to use an external MongoDB Atlas URI from `server/.env.test` by default, which fails in isolated CI/local environments and blocks progress.

### What was changed

1. Test setup now uses **in-memory MongoDB by default**.
2. External DB is used only when explicitly enabled via:
   - `USE_EXTERNAL_TEST_DB=true`
   - and `MONGO_URI` provided.
3. `server/.env.test` was cleaned up (removed accidental duplicated env block and shell commands).

This makes test runs reproducible and independent.

## Architecture assessment (short)

### Strengths
- Good service decomposition for complex domains (match, bracket, tatami).
- Constants/enums extracted into dedicated files.
- Validation and middleware layers are separated.
- Socket concerns are not mixed directly into controllers.

### Risks / technical debt
- Documentation files in `docs/` are partially draft-like and inconsistent.
- No lint/format scripts in backend package scripts.
- Environment management is fragile (secrets and runtime config strategy unclear).
- Missing explicit migration/versioning strategy for Mongo schema changes.

## Recommended finish plan for diploma

1. Stabilize quality gates
   - Add `lint`, `format:check`, and CI pipeline jobs.
   - Keep tests green with in-memory DB in CI.

2. Harden backend
   - Add request rate limiting and stricter security headers policy.
   - Add centralized config validation for env variables.

3. Improve observability
   - Structured logs with correlation/request IDs.
   - Health/readiness endpoints for deployment.

4. Complete documentation
   - Rewrite API docs (auth flows, role matrix, error format).
   - Add sequence diagrams for application + bracket lifecycle.

5. Diploma-ready evidence
   - Provide load test snapshot for key endpoints.
   - Add architecture decisions (ADR) for critical choices.
   - Prepare demo script with clear success scenarios.

## Quick commands

```bash
npm test --prefix server
```

Optional external DB mode:

```bash
USE_EXTERNAL_TEST_DB=true MONGO_URI='mongodb://...' npm test --prefix server
```
