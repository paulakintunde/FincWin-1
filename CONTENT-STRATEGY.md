# FincWin — Homepage Content Strategy (v2)

**Document purpose:** Guide the homepage copy rewrite. This version supersedes v1 and reflects the updated pricing model (Free / Pro / Lifetime), a global audience, honest data transparency messaging, and a homepage structure redesigned around the free-entry conversion funnel.

---

## 1. Positioning statement

**Internal compass — not a tagline, but the sentence every section should be consistent with:**

> FincWin is the personal finance dashboard that shows you exactly where you stand — income, spending, debt, and savings — in one view, free to start, with no guesswork and no surprises.

**The shift in one line:** From *"private, offline-first"* → to *"complete, clear, and free to try."*

Privacy is real and worth communicating — but it belongs in a dedicated section lower on the page, stated accurately (see §6), not as the hero-level hook.

---

## 2. Personas — global, not US-specific

FincWin is a global app. Personas should reflect the universal human relationship with money, not a specific country's statistics or financial system. Write so someone in Lagos, London, or Manila recognises themselves as clearly as someone in Chicago.

---

**Persona 1 — The Scattered Earner**

*Universal prevalence: The majority of working adults worldwide.*

Earns regularly. Not broke — just unable to account for where the money goes by the end of the month. Has a bank app, maybe a spreadsheet they last opened in March. Checks their balance with vague dread. Has tried budgeting apps before; none of them stuck past week two.

What they need: a view they can glance at, not a system they have to maintain.
What FincWin gives them: envelope categories that fill as they spend — clarity in one screen.

---

**Persona 2 — The Debt Carrier**

*Universal: consumer debt, student loans, car financing, and personal loans exist in every market.*

Has one or more loans. Makes payments every month. The balance barely moves. Has never modelled what an extra payment would do, or when they'd actually be free. "Someday" is the closest thing they have to a plan.

What they need: a concrete finish line and a reason to believe it's movable.
What FincWin gives them: a payoff calculator with an exact date and extra-payment modelling.

---

**Persona 3 — The Purposeful Saver**

*Universal: across cultures and income levels, people save toward goals — emergency funds, education, housing, events.*

Has financial goals — an emergency cushion, a holiday, a house deposit, a car. But they don't track progress. Transfers money to savings irregularly. When asked "how close are you?", they genuinely don't know.

What they need: visible, named goals with progress they can see growing.
What FincWin gives them: a savings goal tracker with contribution logging and a progress fill.

---

**Writing rule:** Every section on the homepage should speak directly to at least one of these three people. If a paragraph doesn't map to a persona's felt problem, cut it.

---

## 3. Statistics — global and defensible

Replace the current stats (fabricated social proof + privacy metrics) with research-backed findings that apply universally. Use them to explain *why FincWin exists*, not to claim what FincWin has achieved.

| Stat | Notes on use |
|---|---|
| Fewer than 1 in 3 people consistently track where their money goes each month | Consistently reported across multiple fintech and financial literacy surveys globally. Use without single-country attribution. |
| People who budget regularly save significantly more — often twice as much — as those who don't | National Endowment for Financial Education; consistently replicated. "Often twice as much" is defensible. |
| The average household has more than a dozen active recurring charges — and can typically recall fewer than half of them | Grounded in subscription economy research. Universally relatable. |
| People with a written debt payoff plan eliminate debt measurably faster than those paying without one | NFCC; also supported by behavioral economics research on commitment devices. |

**How to deploy:** Weave these into problem copy and the stats bar. Never footnote them — write them as observed truths, not cited evidence. "Most households have more recurring charges than they can name" reads better than a percentage with a footnote.

**What to avoid:** Single-country stats presented as universal. "60% of Americans" only speaks to Americans and immediately signals to everyone else that this product wasn't designed for them.

---

## 4. Pricing model — updated

The pricing model has changed from a one-time purchase model (Starter $49 / Pro $89 / Lifetime $149) to a freemium model. This changes the entire conversion strategy on the homepage.

### The three tiers

**Free — $0, no card required, no expiry**
- Core dashboard, expense tracking (90-day history), budget categories, income & bill tracker, local PIN lock, 1 savings goal, demo profile
- Locked (visible but greyed with lock icon): Drive sync, CSV import, loan payoff calculator, unlimited savings goals, analytics, AI Coach
- CTA: "Get started free" (outlined/secondary style)

**Pro — $39/year (hero tier)**
- Toggle on page to show $4.99/month alternative
- Displayed as "Most popular" with elevated card treatment
- Everything in Free + unlimited history, Drive backup, CSV import, loan calculator, analytics, full gamification suite, AI Coach (user's own API key)
- CTA: "Get Pro — $39/yr" (solid/primary, dark fill, white text)

**Lifetime — $149 one-time**
- Everything in Pro + all future features, priority support, early access, desktop app (Tauri) when released, custom categories, lifetime updates
- Strikethrough "Was $200" above the price
- CTA: "Get Lifetime" (outlined/secondary)
- Sub: "One payment. All future features. No renewals."

---

### Pricing section copy

**Page headline (above cards):**
```
Simple annual billing. No surprise upsells.
Or buy Lifetime and never pay again.
```

**Subheadline:**
```
FincWin is free to use. You pay to unlock more of it — 
not to access your own data.
```

*That second sentence is critical.* It signals that the free tier is genuinely functional — not a crippled demo. It also differentiates from data-monetising apps (Mint, etc.) without calling them out.

**Break-even callout (below the three cards, centred, small text):**
```
Lifetime pays for itself in under 4 years. After that, it's free forever.
```

**Footer trust line (below the break-even callout):**
```
All plans include a 14-day refund — no questions asked  ·  
Secure payment via Lemon Squeezy  ·  Your financial data never touches our servers
```

*Note on "Your financial data never touches our servers":* This is accurate. Distinguish it carefully from account data (see §6). Use "financial data" not "your data" — the account data (email, license, plan) does go to Firebase.

---

## 5. Homepage structure

The old structure was designed for a paid-entry app. With a free tier, the conversion goal changes: get people into the free app first, then upgrade. The homepage should optimise for free sign-up, not for immediate purchase.

**Revised section order and purpose:**

```
1. NAV
2. HERO                          ← "Get started free" as primary CTA
3. FREE TIER STRIP               ← Quick wins — what you get for nothing
4. PROBLEM SECTION (dark)        ← Emotional resonance before features
5. FEATURE ROWS (3 features)     ← Envelopes → Loans → Savings Goals
6. STATS BAR                     ← Industry context, not product claims
7. "BUILT FOR" SECTION           ← Persona cards (replaces testimonials)
8. PRICING                       ← Upgrade decision
9. DATA TRANSPARENCY             ← Honest privacy explainer (pre-empts concern)
10. FINAL CTA                    ← Confident close
11. FOOTER
```

**What changed from v1:**
- "Free Tier Strip" is new — it appears directly under the hero to justify the zero-friction CTA
- "Data Transparency" is a new section lower on the page — honest and specific (see §6)
- Stats bar moves below features, not above them — features earn attention first, stats reinforce
- Pricing moves after the "Built For" section, not before — personas prime the upgrade decision

---

## 6. Section-by-section copy

---

### NAV

Logo: FincWin
Links: Features · Pricing · App
CTA: `Get started free` *(change from "Sign in" — this is now a marketing homepage, lead with acquisition)*

---

### HERO

**Eyebrow:**
```
Personal Finance — Simplified
```

**H1:**
```
Every number that matters.
One place. Finally.
```

**Subheadline:**
```
FincWin brings your income, spending, debt, and savings together 
into one clear dashboard — so you can stop guessing 
and start making confident decisions.
```

**CTA pair:**
- Primary: `Get started free →`
- Secondary: `See how it works`

**Footnote (below CTAs):**
```
No card required  ·  Free plan, no expiry  ·  Pro from $39/year
```

*Remove entirely:* "Your data never leaves your device" — this is not accurate as stated (account data does go to Firebase) and it's the wrong hook for the hero anyway. Address data honestly in the dedicated section (§6, Data Transparency).

---

### FREE TIER STRIP

A tight, scannable band directly below the hero. Purpose: prove the free plan is real, not bait.

**Label:** What's free, forever

**4-item grid:**
1. Core dashboard · Income, expenses & bills tracked
2. Budget categories · 14 pre-built, nothing to configure
3. Savings goal · Track your first goal from day one
4. PIN-protected · Your data locked to your device

**Anchor line below grid:**
```
No trial period. No expiry. Start using FincWin today 
and upgrade only if you want more.
```

---

### PROBLEM SECTION (dark background)

**Section label:** Why most people feel behind

**H2:**
```
You're not bad with money.
You just don't have the right view.
```

**Lead paragraph:**
```
Most people make financial decisions by feel — 
a rough sense of what's in the account, a mental estimate of what's left. 
That's not a personal failing. 
It's what happens when your financial life is spread across 
four apps, two bank accounts, and a spreadsheet nobody updates.
```

**Problem grid (3 items):**

**01 — The balance that doesn't tell you anything**
```
Your bank app shows what's there right now. 
It doesn't show what's already committed — 
the rent due Friday, the insurance renewal on the 12th, 
the subscription you forgot you agreed to. 
The number is accurate. The picture it gives you isn't.
```

**02 — The drain you can't name**
```
Recurring charges accumulate quietly. 
Each one is small. Together, they absorb a significant portion 
of most households' monthly income — 
and most people can name fewer than half of them. 
You don't need to spend less. 
You need to see what you're already spending.
```

**03 — The debt without a deadline**
```
You make the payment every month. The balance barely moves. 
Without a payoff date — a real calendar year — 
there's nothing to stay motivated by. 
"Someday" is not a plan. 
A date is.
```

---

### FEATURES SECTION

**Section label:** How FincWin works

**H2:**
```
Every dollar has a job.
You decide what it is.
```

---

**Feature 1 — Budget Envelopes**

Tag: `Spending — made visible`

H3:
```
See your money
before you spend it.
```

Body:
```
Assign every category a monthly cap. 
Housing, food, transport, subscriptions — each one gets its own envelope. 
As you spend, the bar fills. 
When a category is at 60% on day 8, you know — 
not when the statement arrives, but while there's still time to adjust.
```

CTA link: `Explore budget envelopes →`

---

**Feature 2 — Loan Payoff Tracker** *(Pro feature — tag it)*

Tag: `Debt — made finite`

H3:
```
Know the exact date
you'll be free.
```

Body:
```
Enter your loan details. Model the avalanche or snowball method. 
Add an extra monthly amount and watch the payoff date move forward — 
sometimes by years. 
People with a concrete payoff plan consistently clear debt faster 
than those making payments without one.
```

Feature note: *Available on Pro*

CTA link: `See loan calculator →`

---

**Feature 3 — Savings Goals** *(Free tier — one goal; unlimited on Pro)*

Tag: `Goals — made trackable`

H3:
```
Track what you're
building toward.
```

Body:
```
Name your goal. Give it an amount and a date. 
Log contributions as you make them. 
Watch the percentage fill. 
The simple act of seeing progress — 
a number climbing, a bar growing — 
is what makes goals last longer than week two.
```

CTA link: `See savings goals →`

---

### STATS BAR

Four numbers drawn from the industry research in §3. These sit below the features and above the persona section — they provide the "so this matters because…" context.

| Number | Label |
|---|---|
| 1 in 3 | people consistently track where their money goes |
| 2× | more savings among people who budget regularly |
| 12+ | active recurring charges the average household carries |
| Faster | debt elimination for people with a written payoff plan |

*Design note on the fourth stat:* Use a qualitative signal rather than an inflated multiplier. "Faster" is honest; "2.2×" sounds precise but is a specific US figure. If the design needs a number, use "measurably faster" as the stat label.

---

### "BUILT FOR" SECTION (replaces Testimonials)

**Section label:** Who FincWin is for

**H2:**
```
Your situation is specific.
The tools are flexible.
```

**Three persona cards:**

**Card 1 — For the one who earns but can't account for it**
```
You have income. You have expenses. 
Somewhere in between, the month just... happens. 
FincWin's envelope view shows every category 
filling in real time — so you can see the pattern 
before it becomes a problem.
```

**Card 2 — For the one carrying debt**
```
You know you owe. You make the payment. 
But there's no finish line in sight. 
The loan payoff calculator shows you exactly when you'll be done — 
and what happens if you add just a little more each month.
```

**Card 3 — For the one with goals but no system**
```
The house deposit. The emergency fund. The trip. 
You know what you're working toward — 
you just don't have a way to track how close you're getting. 
Savings goals give your money a name and a destination.
```

*No fake names, no fake quotes, no star ratings.* These cards communicate fit, not fabricated social proof.

---

### PRICING SECTION

**Section label:** Simple pricing

**H2:**
```
Simple annual billing. No surprise upsells.
Or buy Lifetime and never pay again.
```

**Subheadline:**
```
FincWin is free to use. You pay to unlock more of it — 
not to access your own data.
```

**Three-column card layout:**

| | Free | Pro (hero) | Lifetime |
|---|---|---|---|
| Price | $0 | $39/year (toggle: $4.99/mo) | $149 one-time |
| Tagline | Try it free | Full access, billed annually | Pay once, own it forever |
| Badge | — | Most popular | — |
| CTA | Get started free | Get Pro — $39/yr | Get Lifetime |

**Break-even callout (below cards):**
```
Lifetime pays for itself in under 4 years. After that, it's free forever.
```

**Footer trust line:**
```
All plans include a 14-day refund — no questions asked  ·  
Secure payment via Lemon Squeezy  ·  Your financial data never touches our servers
```

**AI Coach copy (in Pro feature list):**
```
AI financial coach — bring your own API key
```
*Why "bring your own API key":* This is honest about how it works, sets the right expectation, and implicitly communicates that FincWin isn't charging you for AI calls — you control the cost. It also makes the feature feel transparent, not opaque.

---

### DATA TRANSPARENCY SECTION

This is a new section that didn't exist before. It belongs below pricing and above the final CTA. Its purpose is to pre-empt the question "what does FincWin do with my data?" — which will form in the mind of any thoughtful prospect, especially in markets with strong privacy awareness (EU, UK, Canada, Australia).

**This section must be accurate. Do not simplify to the point of inaccuracy.**

**Section label:** Your data — plainly explained

**H2:**
```
What stays on your device.
What doesn't. And why.
```

**Three-panel explainer:**

**Panel 1 — Financial data (local)**
```
Your budgets, expenses, loan details, savings goals — 
everything financial — lives in your browser's local storage. 
It is never transmitted to FincWin or any backend. 
We can't see it. We don't have it.
```
Icon suggestion: browser/device icon

**Panel 2 — Account data (external, limited)**
```
To restore your licence on a new device, we store your email address, 
licence key, display name, and plan in a secure database. 
This is the minimum needed to manage your account. 
It contains nothing financial.
```
Icon suggestion: key/lock icon

**Panel 3 — Google Drive backup (encrypted, optional)**
```
If you choose to enable Drive backup, your financial data 
is encrypted on your device before it reaches Google. 
Neither Google nor FincWin can read the backup — 
only your licence key can decrypt it.
```
Icon suggestion: cloud/shield icon

**Anchor line below panels:**
```
No advertising. No data brokering. No selling your usage patterns. 
FincWin is a product you pay for, not a product you are.
```

*The last line is the tone marker.* It contrasts FincWin with the free-but-monetised class of apps (Mint, Credit Karma) without naming them. It's confident, not preachy.

---

### FINAL CTA

**Section label:** Start today

**H2:**
```
Your next paycheck
deserves a plan.
```

**Body:**
```
Most people spend more time researching a new phone 
than planning their finances for the month. 
FincWin takes 10 minutes to set up 
and gives you a view of your money you've probably never had before.
```

**CTA pair:**
- Primary: `Get started free →`
- Secondary: `View pricing`

---

## 7. What to remove, replace, or relocate

| Current element | Decision | Reason |
|---|---|---|
| Hero footnote: "Your data never leaves your device" | Remove | Inaccurate as stated (account data is external); addressed correctly in Data Transparency section |
| Trust bar: all 4 current items | Replace with Free Tier Strip | Privacy signals were the old positioning; free tier is the new entry hook |
| Stats: "100% data stays on device" | Remove | Inaccurate shorthand; replaced by accurate Data Transparency section |
| Stats: "0 third parties with your data" | Remove | Also inaccurate (Firebase is a third party for account data) |
| Feature section: AI Coach as a full feature row | Remove from homepage features | Minor adoption expected; appears in Pro pricing list only |
| Testimonials: 3 fabricated quotes | Replace with persona cards | New app; fabricated social proof damages trust |
| Pricing: old tier names (Starter/Pro/Lifetime at $49/$89/$149) | Full replacement | Pricing model has changed |
| "Pay once. Own it forever." as section H2 | Replace with new pricing headline | Pro is now annual, not one-time |
| US-specific statistics | Replace with universal/global framing | Global app — US-only stats exclude most of the audience |

---

## 8. Tone guidelines (unchanged from v1, reproduced for reference)

**Write as if:** You're a calm, competent friend who knows finance — not a startup trying to sound edgy, not a bank trying to sound safe.

**Avoid:**
- Fear-based language ("You're losing money every day you don't act")
- Privacy evangelism ("Big banks are watching you")
- Feature-dumping ("14 categories, 5 frequency types, 3 export formats")
- Vague empowerment ("Take control of your financial future")
- Hedging ("May help some users potentially improve")
- US-only framing presented as universal

**Use:**
- Observed human truths that apply across geographies
- Concrete scenarios the reader recognises from their own life
- Short, declarative sentences — especially in body copy
- Italics in headlines for emotional weight (the serif italic is doing design work)
- Second-person "you" throughout — this is personal

---

## 9. SEO and meta updates

| Element | New value |
|---|---|
| `<title>` | FincWin — Personal Finance Dashboard |
| `<meta description>` | FincWin is the personal finance dashboard that brings income, spending, debt, and savings into one view. Free to start. Pro from $39/year. Your financial data stays on your device. |
| OG / Twitter title | FincWin — Personal Finance Dashboard |
| OG / Twitter description | Match meta description |
| `<meta name="robots">` | Remove `noindex, nofollow` — this is the public marketing page |

---

## 10. Execution order

When ready to write the page:

1. Update `<head>` meta tags (title, description, robots)
2. Update NAV CTA from "Sign in" → "Get started free"
3. Rewrite HERO (H1, sub, footnote, primary CTA label)
4. Add FREE TIER STRIP section (new — needs new CSS component)
5. Rewrite PROBLEM SECTION (headline, lead para, 3 items — globalise language)
6. Rewrite FEATURES (keep Envelopes + Loans + Savings Goals; remove AI Coach row; tag Loans as Pro)
7. Rewrite STATS BAR (4 new universal items)
8. Replace TESTIMONIALS with "BUILT FOR" persona cards
9. Full replacement of PRICING section (new tiers, toggle, new copy)
10. Add DATA TRANSPARENCY section (new — needs new CSS component)
11. Rewrite FINAL CTA body, update CTA label to "Get started free"
12. Update FOOTER links if needed

**New CSS components needed (minimal):**
- Free Tier Strip — a tight feature grid, similar to trust-bar style
- Data Transparency — a 3-panel row, similar to problem-grid style (can reuse `.problem-grid` pattern with light background variant)
- Pricing toggle (month/year) — a small JS-driven toggle on the Pro card
