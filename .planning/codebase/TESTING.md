# Testing

**Analysis Date:** 2026-06-10

## Test Coverage

**What is tested:**
- AES-GCM encrypt/decrypt round-trips and wrong-key rejection (`styles/tests/crypto.test.js`)
- PBKDF2 key derivation determinism and cross-passphrase isolation (`styles/tests/crypto.test.js`)
- `isEncryptedPayload()` detector for various input shapes (`styles/tests/crypto.test.js`)
- State dispatch logic: `INVESTMENTS_RESET_ALL`, `SAVINGS_TXN_REMOVE`, `LOAN_GENERATE_SCHEDULE`, `SAVINGS_RESET_ALL` (`styles/tests/state-dispatch.test.js`)
- Undo snapshot/restore semantics and single-snapshot stack behaviour (`styles/tests/state-dispatch.test.js`)
- `_DESTRUCTIVE_ACTIONS` registry completeness (`styles/tests/state-dispatch.test.js`)
- Sync fingerprint basic correctness and known collision scenarios (`styles/tests/sync-fingerprint.test.js`)
- Template generator: partial injection, `{{TOKEN}}` replacement, no leftover markers (`styles/tests/generator.test.js`)
- Full site build: every manifest page has nav, footer, no leftover markers (`styles/tests/generator.test.js`)

**What is NOT tested:**
- The full `js/state.js` module (IndexedDB, persistence, encryption integration)
- Any rendering functions: `renderDash()`, `renderExpenses()`, `renderEnvelopes()`, etc.
- Firebase auth flows (`js/signin.js`) — no mocked Firebase tests
- PWA service worker (`service-worker.js`)
- `js/sync.js` cloud sync logic beyond the fingerprint function
- `js/health.js` score calculation (`calcHealth()`)
- `js/loans.js`, `js/savings.js`, `js/analytics.js`, `js/gamification.js`
- Event delegation system in `js/events.js`
- Import/export: `js/import-bank.js`, CSV export
- All UI interactions, modal open/close, tab switching

## Test Types

**Unit Tests (pure logic, no DOM):**
- `styles/tests/crypto.test.js` — crypto primitives copied from `js/crypto-core.js`, tested in isolation using Node's `webcrypto`
- `styles/tests/state-dispatch.test.js` — dispatch/undo logic extracted as pure functions, no browser APIs
- `styles/tests/sync-fingerprint.test.js` — `stateFingerprint()` function replicated from `js/sync.js` and tested in isolation

**Integration Tests (file system, process execution):**
- `styles/tests/generator.test.js` — spawns `node scripts/generate-page.js` as a child process and reads output files; also runs the full `scripts/build-all.js` pipeline

**E2E Tests:**
- `playwright` is listed as a dev dependency in `package.json` but no Playwright test files are present in the repository. No E2E test suite is currently implemented.

**Manual Testing:**
- Implied by the absence of UI/DOM tests — rendering, auth, PWA install, sync, and all interactive features are tested manually

## Test Tooling

**Runner:** Vitest `^1.6.1`
- Config: no `vitest.config.*` file found; Vitest uses defaults
- Test environment: Node (default) — browser APIs polyfilled manually in test files (e.g. `webcrypto` from `node:crypto`)

**Assertion Library:** Vitest's built-in `expect` (Chai-compatible)

**Child Process:** Node's `node:child_process` (`execFileSync`) used in `generator.test.js` to test the build pipeline as a black box

**No additional testing libraries** (no Testing Library, no Jest, no Sinon, no mock frameworks)

**Run Commands:**
```bash
npm test           # vitest run  — single pass, exits with code
npm run test:watch # vitest      — watch mode, re-runs on file change
```

No coverage script is defined in `package.json`. To get coverage, run:
```bash
npx vitest run --coverage
```

## Test Organization

**Location:**
- All tests live in `styles/tests/` — note this is inside the CSS styles directory, which is an unconventional location
- No co-located test files next to source modules
- No `__tests__/` directories
- No `test/` directory at project root

**Naming:**
- Files: `{subject}.test.js` — e.g. `crypto.test.js`, `state-dispatch.test.js`
- `describe` blocks name the function or behaviour under test: `'AES-GCM encrypt / decrypt round-trip'`, `'INVESTMENTS_RESET_ALL'`
- `it` descriptions state expected behaviour: `'decrypts back to the original plaintext'`, `'takes a snapshot before clearing (enabling undo)'`

**Test File Structure:**
Each test file follows this pattern:
1. Block comment explaining what is tested and any constraints
2. Replication of the pure logic under test (copy of the function from source, or extracted version)
3. Helper functions / fixtures (e.g. `makeState()`, `makeBaseState()`)
4. `describe` / `it` blocks

The pattern of replicating source logic rather than importing it directly means tests do not have a live dependency on the production module files. This insulates tests from module loading issues (no DOM, no IDB) but means tests can drift from the actual implementation.

## Gaps & Risks

**Critical untested areas:**

**`js/state.js` — persistence and encryption integration:**
- IndexedDB read/write/migrate paths have no tests
- PIN lock/unlock flow and `_sessionKey` lifecycle are untested
- `persist()` and `initState()` — the two most critical functions in the app — have no test coverage
- BroadcastChannel cross-tab sync notification is untested

**`js/sync.js` — cloud sync beyond fingerprint:**
- The fingerprint collision documented in `sync-fingerprint.test.js` is a known data-loss risk with no fix yet
- Merge/conflict resolution logic has no test coverage
- OAuth token refresh paths are untested

**`js/signin.js` — Firebase auth flows:**
- Sign in, register, password reset, licence activation all touch Firebase with no mock layer
- The licence revalidation background job (`_revalidateLicence`) is untested

**Rendering functions:**
- All `render*()` functions (`renderDash`, `renderExpenses`, `renderEnvelopes`, etc.) rely on DOM globals and are completely untested
- Any regression in rendering logic will only surface in manual testing

**Playwright — installed but unused:**
- `playwright ^1.60.0` is in `devDependencies` but there are no `.spec.js` files and no Playwright config
- No E2E tests cover the critical flows: sign in → app boot → add expense → sync

**Test file location:**
- `styles/tests/` is a confusing home for JavaScript tests unrelated to CSS. A future refactor should move tests to `tests/` or `__tests__/` at the project root.

**No linting on tests:**
- No ESLint config means no enforcement of test quality rules (e.g. no `test.only` leaking into CI)
