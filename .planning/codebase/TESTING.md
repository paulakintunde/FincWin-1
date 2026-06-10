# Testing Patterns

**Analysis Date:** 2026-06-10

## Test Framework

**Runner:**
- Vitest `^1.6.1`
- Config: no dedicated `vitest.config.*` file — uses Vitest defaults (resolves from `package.json`)

**Assertion Library:**
- Vitest's built-in `expect` (Chai-compatible via `@vitest/expect`)

**Run Commands:**
```bash
npm test            # Run all tests once (vitest run)
npm run test:watch  # Watch mode (vitest)
# No coverage command configured
```

**Playwright:**
- `^1.60.0` installed as dev dependency
- Used exclusively by the manual audit script `audit-site.mjs` — not wired into `npm test`

---

## Test File Organisation

**Location:** `styles/tests/` (misleadingly named — contains JS logic tests, not CSS tests)

**Files:**
```
styles/tests/
├── crypto.test.js           # AES-GCM encrypt/decrypt primitives
├── generator.test.js        # Build pipeline (generate-page.js + full site build)
├── state-dispatch.test.js   # State dispatch/undo logic
└── sync-fingerprint.test.js # Sync conflict fingerprint function
```

**Naming:** `*.test.js` suffix, kebab-case filename matching the module under test.

**Import style:** ES module syntax (`import { describe, it, expect } from 'vitest'`) even though the main codebase uses CommonJS.

---

## Test Structure

**Suite Organisation:**
```javascript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';

describe('Feature or function name', () => {
  beforeEach(() => { /* reset shared mutable state */ });

  it('describes the specific behaviour', () => {
    // Arrange
    const state = makeState();
    // Act
    const result = dispatch(state, 'ACTION_TYPE', { param: value });
    // Assert
    expect(result.field).toBe(expectedValue);
  });

  it('handles edge/error case', () => {
    expect(() => dispatch(state, 'ACTION', { idx: 99 })).not.toThrow();
  });
});
```

**Patterns observed:**
- `beforeEach` resets module-level mutable state (e.g. `_snapshot = null`) before each test
- `afterAll` cleans up temp files created during integration tests
- State fixture factories (`makeState()`, `makeBaseState()`) isolate tests from real app state
- Pure logic is extracted into the test file itself when the source module has browser dependencies — avoids needing jsdom

---

## What Is Tested

### 1. Crypto Primitives — `styles/tests/crypto.test.js`

Tests the AES-GCM encryption layer from `js/crypto-core.js` by replicating the primitives in Node using `node:crypto`'s `webcrypto.subtle`. Covers:

- Encrypt/decrypt round-trip
- Random IV produces different ciphertext each call
- Wrong key / wrong salt rejects (throws)
- Tampered ciphertext rejects (throws)
- PBKDF2 key derivation determinism
- `isEncryptedPayload()` type guard (positive and negative cases)

**Pattern for async tests:**
```javascript
it('throws when decrypting with a different key', async () => {
  const key = await deriveKey('correct-pin', salt);
  const wrongKey = await deriveKey('wrong-pin', salt);
  await expect(decrypt(payload, wrongKey)).rejects.toThrow();
});
```

### 2. State Dispatch / Undo — `styles/tests/state-dispatch.test.js`

Tests the pure state reducer logic from `js/state.js`. The dispatch function and DESTRUCTIVE_ACTIONS list are replicated inline (no imports from the browser-coupled source file). Covers:

- `INVESTMENTS_RESET_ALL` — clears array, takes snapshot, undo restores
- `SAVINGS_TXN_REMOVE` — removes transaction, reverses balance, undo works
- `LOAN_GENERATE_SCHEDULE` — adds payment chips, deduplicates months, no undo snapshot
- `_DESTRUCTIVE_ACTIONS` registry completeness
- Single-snapshot undo stack semantics (second destructive action overwrites snapshot)
- Out-of-range index handling (does not throw)

### 3. Sync Conflict Fingerprint — `styles/tests/sync-fingerprint.test.js`

Documents and verifies the **known weakness** in the sync collision detection function from `js/sync.js`. Covers:

- Consistent fingerprint for identical states
- Different fingerprints for different amounts/counts
- Collision scenarios: delete-one-add-one with equal totals, swapped item names — both produce the same fingerprint

These tests intentionally **pass** on the collision case (they document the bug, not fix it). A future fix to `stateFingerprint` would break these tests in the "collision" groups — that is the signal to update the guard logic.

### 4. Generator / Build Pipeline — `styles/tests/generator.test.js`

Integration tests for the static site build. Uses `execFileSync` to run the actual Node scripts. Covers:

- `generate-page.js` injects nav, footer, and scripts partials correctly
- No unreplaced `{{TOKEN}}` or `{{> partial}}` markers survive in output
- `build-all.js` builds every page listed in `scripts/build-manifest.json` with no leftover markers, nav present, and footer present

**Pattern for build integration tests:**
```javascript
it('builds every manifest page with no leftover markers', () => {
  execFileSync('node', ['scripts/build-all.js'], { cwd: ROOT, encoding: 'utf8' });
  const manifest = JSON.parse(fs.readFileSync(...));
  for (const { out } of manifest) {
    const html = fs.readFileSync(path.join(ROOT, out), 'utf8');
    expect(html, `${out} has leftover marker`).not.toMatch(/\{\{\s*>?\s*\w+\s*\}\}/);
  }
});
```

---

## Mocking

**Framework:** None — no `vi.mock()` usage observed.

**Approach:** Pure function extraction. Browser-coupled modules (state.js, sync.js, crypto-core.js) are not imported directly. Instead, the relevant pure logic is copied into the test file and tested in isolation using Node's built-in `webcrypto` where needed.

This means tests do not require jsdom and run in the default Node environment, which is faster and simpler.

**What to mock:** Nothing currently mocked. If future tests need DOM APIs, configure `environment: 'jsdom'` in `vitest.config.js` per test file using Vitest's `// @vitest-environment jsdom` comment annotation.

---

## Fixtures and Factories

**Pattern:** Inline factory functions return fresh state objects for each test, preventing cross-test mutation:

```javascript
function makeState() {
  return {
    months: { 'Jun 2026': { weeks: [{ items: [] }, ...], revenue: [] } },
    loans:  [{ name: 'Car Loan', amount: 15000, rate: 5.5, minPayment: 300, payments: [] }],
    savings: [{ name: 'Emergency Fund', balance: 2000, contribution: 200, transactions: [...] }],
    investments: [{ name: 'RRSP', currentValue: 50000, currency: 'CAD' }],
    currency: { code: 'CAD', symbol: '$', locale: 'en-CA' }
  };
}
```

Factories are defined at the top of each test file. No shared fixture files exist.

---

## Coverage

**Requirements:** None enforced (no coverage threshold configured, no `--coverage` flag in scripts).

**View Coverage:**
```bash
npx vitest run --coverage
```

---

## Manual Audit Script

`audit-site.mjs` is a Playwright-based manual smoke test for `app.html`. It is **not part of the automated test suite** (`npm test` does not run it). It must be run manually:

```bash
# Start the dev server first
npm run dev    # starts server.js on localhost

# In a separate terminal
node audit-site.mjs
```

Covers:
- Initial load / onboarding overlay
- Dashboard KPI rendering
- Month navigation
- Health badge modal
- DTI tooltip toggle
- Dark mode toggle
- Search panel (`/` keyboard shortcut)
- All tab sections (expenses, revenue, loans, savings, calendar, analytics, archive, settings)
- Add/save modals for each data type
- Mobile viewport (390px) — bottom nav, mobile menu sheet
- PIN setup modal
- Notification panel
- Logo → dashboard navigation
- Layout/overflow checks
- Basic accessibility (buttons without labels, inputs without labels)
- Broken images
- JS console error count

Output format: `[BUG]`, `[WARN]`, or `[NOTE]` prefixed lines, with a final summary count.

---

## Build-Time Validation

The generator itself acts as a build validator. `scripts/generate-page.js` exits with code 1 if:
- A template file does not exist
- A data file does not exist
- Any `{{TOKEN}}` or `{{> partial}}` marker is unresolved in the output

`scripts/build-all.js` counts failures and exits with code 1 if any page failed. This means `npm run build:pages` is a build correctness check — run it before committing changes to templates or data files.

---

## CI/CD

**No CI pipeline is configured.** There is no `.github/workflows/` directory or equivalent. All checks are manual:

| Check | How | When |
|-------|-----|------|
| Unit + integration tests | `npm test` | Manually before push |
| Template build validity | `npm run build:pages` | After template/data changes |
| Nav/footer sync | `npm run sync-chrome` | After nav or footer copy changes |
| Full app smoke test | `node audit-site.mjs` (requires dev server) | Manual regression |

**Deployment:** Vercel (`vercel.json` present). Vercel runs `npm install --omit=dev` as the install command. There is no build command configured — all generated HTML files are committed to the repo and deployed as static assets.

---

## What Is Not Tested

- `js/mkt.js` and `js/consent.js` marketing scripts (no DOM tests)
- `js/app.html` rendering or UI interactions (only the manual Playwright audit covers this)
- API endpoints in `api/*.js`
- CSS visual correctness
- Service worker (`service-worker.js`)
- `scripts/sync-chrome.js` (no automated test)

---

*Testing analysis: 2026-06-10*
