# ADR 0001: Website scope, stack, and demo data

- **Status:** Accepted
- **Date:** 2026-10-01

## Context

GigaDCBuilders is a fictitious data center operator created for the
`gigadc-reporting` Power BI project. The project owner wants a corporate
website that presents it as a SaaS company selling a platform for planning
and delivering high-capacity, AI-oriented data centers. That platform is the
domain the reports already model: forecast power demand, supply built from
deliveries, the gap between them, and delivery milestones per building.

The site is a portfolio piece. It has no real customers, products, or
backend.

## Decision

### 1. The site lives in its own repo

`gigadc-website`, a sibling of `gigadc-reporting`. The reporting repo's
conventions (PBIP, TMDL, Power Query, the `powerbi-dev-standards` skill) do
not apply to a web front end, and a site brings its own tooling and deploy
path. The two repos stay independent.

### 2. Plain HTML, CSS, and JavaScript

No framework, no package manager, no build step, no dependencies. The site
opens from `file://` or any static host. This matches the stdlib-only habit
of the reporting repo. Frameworks (Astro, Next.js) were considered and
deferred until the site needs components at scale or a real application.

### 3. First version is one home page

Hero, problem, platform capabilities, a dashboard demo, how it works, scale
figures, and a demo-request form. About, pricing, and separate platform
pages are later work.

### 4. The product pitch comes from the reporting domain

The four capabilities (Demand, Supply, Gap, Delivery) and the figures on the
page (2 Areas, 6 Regions, 2012 to 2040, 95% net supply) restate what the
reporting repo models. The footer states that the company is fictitious.

### 5. Brand assets are copies, with the reporting repo as master

Logos are copied from `gigadc-reporting/brand/logos` into `assets/logos/`,
the same way reports hold imported copies. Colors match the report theme:
blue `#4F8DF0`, green `#25A06F`, orange `#FF7A1A` on navy. When a master
asset changes, copy it again. The site uses a dark presentation where the
Power BI theme is light, because the logos and backdrop are designed for
dark backgrounds.

### 6. The dashboard demo reads pre-aggregated data

`scripts/build_demo_data.py` (Python stdlib) reads the generated CSVs and
reference files in `gigadc-reporting` and writes `js/demo-data.js`, a
Region × month series of net supply and demand. The file is committed, so the
site needs neither the CSVs nor a server. The chart is hand-written SVG; no
charting library.

- Net supply is cumulative Building Ready MW by **actual** date, times the
  net supply factor read from `reference/model_parameters.csv` (0.95),
  accumulated to month end.
- Demand is the generated Region × month MW.
- The as-of date (2026-09-30) is fixed in the script to match the reports'
  default, and months after it are shown as planned.

### 7. The demo form is front-end only

It validates name and email in the browser and sends nothing. No form
backend, analytics, or cookies.

## Consequences

- **Demo numbers are an approximation of the Power BI model, not the model.**
  The logic is re-implemented in Python and has not been reconciled against
  the report. Verify before presenting the figures as the same.
- **The data can go stale.** If the generator or Delivery logic changes,
  `demo-data.js` must be rebuilt by hand. Nothing detects drift.
- **The as-of date is hard-coded** in the build script, separately from the
  Power Query parameter.
- **Logos can drift** from the master copies in the reporting repo.
- **No hosting yet.** The repo has no remote and no deploy configuration.
- **No license or real-company content.** Per the reporting repo's rule, no
  employer data, code, or metadata belongs here.

## Alternatives considered

- **A subfolder inside `gigadc-reporting`.** Keeps brand assets shared, but
  mixes a web stack into a BI repo whose conventions do not fit it.
- **Astro or Next.js.** Rejected for now: dependencies and Node tooling for a
  one-page site. Revisit if the site grows.
- **Reading the CSVs in the browser.** Rejected: `fetch` fails from
  `file://`, and the generated CSVs are not committed upstream.
- **A charting library (Chart.js, D3).** Rejected to stay dependency-free;
  one two-series line chart is small in SVG.
- **Screenshots of the Power BI reports instead of a live chart.** Possible
  later as an addition; they would not be interactive.

## Out of scope

- Hosting, domain, and deployment.
- A real form backend, analytics, or a login.
- Per-capability pages and any pages beyond Home, About, and Pricing.
- Automating the demo-data rebuild or reconciling it against the semantic
  model.

## Decision log

- **2026-10-01:** Separate repo; plain HTML/CSS/JS; home page only for v1
  (chosen by the project owner).
- **2026-10-01:** Add the dashboard demo from the CSVs, via a build script
  and a committed JS data file.
- **2026-10-01:** Add About and Pricing pages. Header and footer are copied
  into each page (no includes without a build step). Pricing tiers (Pilot,
  Portfolio, Enterprise) and prices are invented and labeled illustrative.
