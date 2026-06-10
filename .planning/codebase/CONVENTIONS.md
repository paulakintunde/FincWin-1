# Code Conventions

**Analysis Date:** 2026-06-10

## Naming Conventions

**Files:**
- JS modules are lowercase, hyphen-separated: `boot.js`, `crypto-core.js`, `import-bank.js`, `dark-mode.js`
- HTML pages are lowercase hyphen-separated: `signin.html`, `app.html`, `cookie-policy.html`
- CSS files are lowercase hyphen-separated: `base.css`, `mkt.css`, `auth-tokens.css`
- Script utilities use descriptive names: `scripts/generate-page.js`, `scripts/build-all.js`
- Test files live in `styles/tests/` and use `.test.js` suffix: `crypto.test.js`, `state-dispatch.test.js`

**Variables:**
- Module-level singletons and shared state use short uppercase or camelCase: `S` (global state), `CMK` (current month key), `_bc`, `_idb`
- Private/internal identifiers are prefixed with `_`: `_sessionKey`, `_fbAuth`, `_snapshot`, `_envExpanded`
- Loop and temporary variables use single letters or short names: `p`, `k`, `r`, `m`, `w`
- Constants use uppercase: `SK`, `IDB_STORE`, `BDFT`, `MS`, `MF`
- DOM cache variables use camelCase: `_canvas`, `_ctx`, `_particles`

**Functions:**
- Public/exported functions use camelCase: `switchTab()`, `renderEnvelopes()`, `calcHealth()`, `changeMonth()`
- Private helpers use `_camelCase` prefix: `_calcBudgetVelocity()`, `_catMgrBuild()`, `_attachEnvListeners()`, `_fbMsg()`
- Event handlers are descriptive verbs: `handleSignin()`, `handleRegister()`, `activateLicence()`
- Render functions are prefixed `render`: `renderDash()`, `renderExpenses()`, `renderEnvelopes()`

**CSS Classes:**
- BEM-influenced block-element naming: `.be` (budget envelope), `.be-lbl`, `.be-amt`, `.be-spent`, `.be-cap`
- State classes are short descriptors: `.active`, `.open`, `.show`, `.visible`, `.mbn-active`
- Component prefixes group related classes: `.catmgr-row`, `.catmgr-name-inp`, `.catmgr-chip`, `.catmgr-chip-del`
- Marketing pages use semantic class names: `.hero`, `.hero-eyebrow`, `.nav-logo`, `.nav-cta`, `.mkt-footer`
- Utility/modifier suffixes: `-light`, `-mid`, `-dark` for color variants; `-wrap` for containers

**CSS Custom Properties:**
- Semantic tokens in `:root`: `--bg`, `--surface`, `--ink`, `--muted`, `--accent`, `--hairline`
- Legacy aliases preserved for JS inline styles: `--sage`, `--danger`, `--success`, `--amber`, `--blue`
- Component tokens: `--radius`, `--radius-sm`, `--shadow`, `--font-sans`, `--font-serif`

## HTML Patterns

**Static Marketing Pages:**
- Hand-authored HTML at repo root and subdirectories: `index.html`, `features.html`, `pricing.html`, `compare/`, `blog/`
- Each page is self-contained with full `<head>` block: charset, viewport, title, description, canonical, OG tags, Twitter card, JSON-LD structured data
- Google Fonts loaded via `<link rel="preconnect">` pairs followed by the font `href`
- Page-specific styles are written inline in `<style>` blocks within `<head>` rather than in separate files
- Scripts loaded at end of `<body>` with no module type: `<script src="js/mkt.js"></script>`

**Templated Pages:**
- Build system uses `scripts/templates/*.html` + `scripts/data/*.json` → generates output HTML
- Template tokens use `{{TOKEN}}` syntax: `{{META_TITLE}}`, `{{CANONICAL_URL}}`, `{{FEATURE_NAME}}`
- Partials use `{{> name}}` syntax: `{{> nav}}`, `{{> footer}}`, `{{> scripts}}`
- `{{BASE}}` resolves to a relative path prefix based on output file depth (e.g. `../` for depth-1 pages)
- Templates in `scripts/templates/`: `feature-page.html`, `competitor-alt.html`, `blog-post.html`, `niche-landing.html`, `use-case-page.html`, `blog-category.html`
- Partials in `scripts/partials/`: `nav.html`, `footer.html`, `scripts.html`

**App HTML (`app.html`):**
- Tab sections use `id="section-{name}"` pattern; tab buttons use `id="tab-{name}"`
- Mobile bottom nav items use `id="mbn-{name}"` to mirror tab state
- Modals use `.modal-overlay` class and `.open` class for visibility
- Data-attribute delegation: `data-action="functionName"`, `data-arg="value"`, `data-stop-prop` to prevent bubbling
- Aria attributes: `aria-current="page"` on active tabs, `aria-label` on icon-only buttons, `aria-hidden="true"` on decorative SVGs

## JavaScript Style

**Module Style:**
- No ES module syntax (`import`/`export`) in app JS — all files use plain browser globals
- IIFEs (`(function(){...})()`) used to create local scope without polluting globals: confetti engine, PWA setup, swipe nav, install prompt, online/offline indicator
- Firebase SDK loaded via dynamic `import()` inside async functions: `await import('./vendor/firebase/firebase-auth.js')`
- Build/test scripts (`scripts/`, `styles/tests/`) use CommonJS (`require`) or ES module imports with Vitest

**Async Patterns:**
- `async/await` used consistently for all async operations in app code
- Firebase auth wrapped in try/catch with empty catch blocks for non-fatal failures: `catch {}` or `catch(e) {}`
- Promises used for IndexedDB wrappers: `new Promise((res) => { tx.oncomplete = res; })`
- `Promise.all()` for parallel Firebase SDK imports: `await Promise.all([import(...), import(...)])`
- Timeouts for deferred UI actions: `setTimeout(() => openScorecardModal(key), 400)`

**Error Handling:**
- Auth errors mapped to human messages via lookup object in `_fbMsg(code)` in `js/signin.js`
- Non-fatal async failures use empty catch: `catch {}` (Firestore writes, SW registration)
- Fatal errors shown via `showToast('message', 'warn-t')` for user-facing failures
- Crypto API absence shows a hardcoded banner element (boot guard in `js/boot.js`)
- `try/catch/finally` used around IndexedDB operations in `js/state.js`

**Code Density:**
- App JS (especially `js/boot.js`, `js/state.js`) uses highly compressed single-line style with minimal whitespace in hot paths: `if(!_canvas){_canvas=document.getElementById('confettiCanvas');_ctx=_canvas.getContext('2d');}`
- Auth/utility files (`js/signin.js`) use expanded, readable style with consistent indentation
- Section headers use banner comments: `// ══════════════════════════════════════════════`
- Subsection headers use lighter separators: `// ── SECTION NAME ──`

**Event Delegation:**
- `js/events.js` centralises event delegation via `data-action` and `data-change` attributes
- Avoids inline `onclick` in HTML; delegates via a single listener on a parent element
- `data-stop-prop` attribute used to stop event bubbling without a handler

## CSS/Styling Approach

**Architecture:**
- Global design tokens defined in `styles/base.css` using CSS custom properties on `:root`
- App styles split across: `base.css` (tokens + reset), `components.css` (UI components), `layout.css` (page structure), `dark.css` (dark mode overrides), `themes.css` (theme variants)
- Marketing stylesheet is separate: `styles/mkt.css`
- Auth page uses: `styles/auth-tokens.css`

**Design System:**
- "The Spread · Soft Sage" theme: sage green primary, warm neutrals, no shadows, square/near-square corners (`--radius: 3px`)
- Two typefaces: `Hanken Grotesk` (sans, weights 200–600) and `Instrument Serif` (serif, italic variant)
- Dark mode via `dark.css` overrides triggered by `.dark` class on `<body>`; `applyDark()` in `js/darkmode.js`
- Theme variants in `themes.css` override token values per design

**Inline Styles in JS:**
- Dynamic/data-driven styles applied as inline `style` attributes from JS (e.g. progress bar width, color based on threshold)
- References CSS custom properties by name: `color: var(--danger)`, `background: var(--sage-light)`
- Hard-coded hex values in `index.html` hero section for marketing pages (not using tokens)

## Configuration Patterns

**Firebase Config:**
- Template at `js/config.example.js`; runtime copy at `js/config.local.js` (gitignored)
- Injected as `window.__FINCWIN_CONFIG__` — a plain object on the global scope
- Consumed by lazy `import()` calls inside async functions, never required at parse time
- CI/CD writes `config.local.js` from repo secrets at build time

**App State:**
- Global mutable state object `S` in `js/state.js`, accessed directly across all modules
- Current month key `CMK` is a separate global string
- Persisted to IndexedDB (primary) with localStorage fallback
- Encrypted at rest with AES-GCM when a PIN is set; key derived via PBKDF2

**Build Config:**
- Template build manifest at `scripts/build-manifest.json` — array of `{ template, data, out }` entries
- No bundler; all scripts concatenated by `<script>` tags in HTML load order

## Documentation Style

**Inline Comments:**
- Section banners use box-drawing characters: `// ══════════════════════════════════`
- Sub-section headers: `// ── SECTION NAME ──`
- File identity comment at top of each app JS file: `// === filename.js ===`
- Inline comments explain non-obvious behaviour: `// gravity`, `// spread upward`, `// fail-open offline`
- Multi-line rationale comments appear before complex functions with no formal JSDoc
- Test files use JSDoc-style block at top explaining purpose and scope

**Data-Attribute Conventions:**
- `data-action` — function name to call on click
- `data-change` — function name to call on change/input
- `data-arg` — argument to pass to the action function
- `data-stop-prop` — absorb click bubbling without triggering an action
- `data-tab` — tab identifier for auth page tab switching
- `data-switch-tab` — target tab for footer link navigation

**No Linting Config:**
- No `.eslintrc`, `.prettierrc`, or `biome.json` found in the repository
- Code style is enforced by convention only, not tooling
