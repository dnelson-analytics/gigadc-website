# ADR 0002: Report pages, the Power BI reports in plain HTML

- **Status:** Accepted
- **Date:** 2026-10-16
- **Builds on:** [ADR 0001](0001-website-scope-stack-and-demo-data.md)

## Context

The GigaDC Power BI reports live in the private `gigadc-reporting` repo. The
project owner wants to see how far the same reporting can go without Power
BI: pages on this site that present the reports in plain HTML, CSS, and
JavaScript. The first is the **Supply and Demand** report.

## Decision

### 1. A reports section that augments the site

- `reports/index.html` is a landing page listing the reports.
- Each report gets its own page: first `reports/supply-and-demand.html`.
- The header gains a **Reports** link on every page.
- The home page demo (`js/dashboard.js`, `js/demo-data.js`,
  `scripts/build_demo_data.py`) is left as it is. The reports have their
  own data file and build script, so the two stay independent.

### 2. The site is the frame; the report keeps its Power BI look

The site's dark header, navigation, and footer frame each report page.
Inside the frame, the report matches the Power BI theme
(`gigadc-reporting/brand/themes/GigaDC_PowerBI_theme.json`):

- A dark report canvas echoing the report backdrop: the GigaDC logo, a white
  title, and the blue-to-orange spark line with its pulse.
- The chart and table are white cards with a 1 px `#404040` border, 10 px
  corners, and black text.
- Segoe UI throughout; titles Semibold; slicer headers Segoe UI Light.
- Series colors from the theme: delivery bars blue `#4F8DF0`, Net Supply
  green `#25A06F`, Demand orange `#DB6A1C`, and the theme's following data
  colors by position. Gap is always the theme's bad red `#E5484D`.

### 3. Clone first

The first pass reproduces the Power BI report: the same controls, defaults,
visuals, and numbers. Web-only additions (links that keep the filters, CSV
export, building names in tooltips) come in a second pass.

### 4. Python computes; the browser filters and draws

`scripts/build_report_data.py` (stdlib) ports the model's Power Query
logic, including its rounding, and writes `js/reports/supply-and-demand-data.js`:

- Region × month Supply, Net Supply, Delivered and To Be Delivered supply,
  and Demand, over the report's range (2023-01 to 2040-12).
- One row per building (Delivery MW): MW, Supply Date, Delivery Status.
- The hierarchy's Areas and Regions with their sort order, and the As Of
  Date.

The browser only filters, rolls up by period (last month of the period for
the semi-additive Supply, Net Supply, Demand, and Gap; a sum for
Deliveries), and draws. Supply logic stays in one place outside Power BI.

### 5. No libraries

The chart is hand-written SVG, as on the home page. No charting library,
framework, or build step.

### 6. Publishing the data

The site is public. Publishing the report's full synthetic data (monthly by
region and per building) is accepted: it is generated, fictitious data.

## Consequences

- **No row-level security.** A static site has no sign-in, so the Area RLS
  in Power BI has no equivalent here.
- **Refresh is manual.** Rebuild the data file from the reporting repo's
  CSVs and commit it, as for the home page demo.
- **The Power Query port can drift** from the model. The numbers are
  reconciled against the live model when built, and again whenever the
  supply logic changes.
- The deploy workflow's file list gains `reports/`.

## Decision log

- **2026-10-16:**
  - Augment the site with report pages; leave the home page demo alone.
  - The site is the frame; the report inside matches the Power BI theme.
  - Clone first, extras second.
  - Python pre-computes; the browser filters, rolls up, and draws.
  - Public data accepted; no libraries.
