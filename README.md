# FincWin — freetinz-stack

Free personal finance dashboard. Budget envelopes, loan payoff, savings goals, AI Coach, gamification. No bank login. Free to start, Pro at $39/yr, Lifetime at $149.

**Production:** https://www.fincwin.com

---

## Quick start

```bash
npm install
npm run build:pages   # regenerate templated pages from scripts/templates/
```

No build step for deployment — marketing pages are committed as plain HTML, Vercel serves them directly.

---

## Key docs

| Doc | What it covers |
|---|---|
| [DEPLOY.md](DEPLOY.md) | Vercel deployment, serverless functions, environment variables |
| [VERCEL-SETUP.md](VERCEL-SETUP.md) | First-time Vercel setup walkthrough |
| [PRODUCTION-SETUP.md](PRODUCTION-SETUP.md) | End-to-end stack wiring (Stripe, Resend, Drive, etc.) |
| [SETUP.md](SETUP.md) | Go-live checklist, phase-by-phase |
| [TEMPLATING-PLAN.md](TEMPLATING-PLAN.md) | How the page generator works (`scripts/templates/`) |
| [STRATEGY-GUIDE.md](STRATEGY-GUIDE.md) | SEO audit, content strategy, 2-year content plan |
| [CONTENT-STRATEGY.md](CONTENT-STRATEGY.md) | Homepage copy guide, freemium conversion funnel |
| [INTEGRATION.md](INTEGRATION.md) | API integration notes |
| [FLOWCHART.md](FLOWCHART.md) | App state and data flow diagram |

---

## Site structure

```
/                    Homepage
/features            All features + category browse
/pricing             Free / Pro $39 / Lifetime $149
/compare             Competitor alternatives hub
/use-cases           Use-case landing pages
/budget-categories   Hub for all 14 spending categories
/cat-{name}          Individual category pages (14 total)
/blog                Blog index
/app.html            The PWA app itself
```

### The 14 budget categories

`cat-banking` · `cat-clothing` · `cat-dining` · `cat-education` · `cat-entertainment` · `cat-groceries` · `cat-healthcare` · `cat-housing` · `cat-other` · `cat-personal` · `cat-subscriptions` · `cat-telecom` · `cat-transport` · `cat-utilities`

Each has its own indexed marketing page. Entry points: `/budget-categories` hub, `features.html` chip strip, and `blog/posts/budget-categories.html` grid.

---

## Templated pages

Run `npm run build:pages` after editing any file in `scripts/templates/` or `scripts/data/`. The generator outputs into `compare/`, `features/`, `use-cases/`, blog categories, and niche landing pages. Commit the generated output — Vercel serves static files directly.

---

## Active branch

`freemium-consent-rebrand` — rebrand from privacy-first messaging to freemium model (Free / Pro / Lifetime) with gamification (XP, streaks, health score) as the Pro differentiator.
