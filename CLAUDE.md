# Project: GigaDC Website

House standards and how Doug works: the `myAI` repo (private, local
`E:\Code\Repos\myAI`; start with its `skills/doug-dev-environment`). This file
covers only what is specific to this project and wins where they differ.

## What this is
The corporate site for GigaDC Builders, a fictitious data center operator,
pitched as a SaaS platform for planning and delivering AI-scale data center
capacity. It is a portfolio piece: no real customers, products, or backend.
The domain (supply, demand, gap, delivery milestones) comes from the sibling
repo `gigadc-reporting` at `E:\Code\Repos\gigadc-reporting`. Scope and
decisions: `docs/adr/0001-website-scope-stack-and-demo-data.md`.

This repo is **public**: nothing from private repos or notes, no credentials,
and nothing from any employer's systems.

## Stack
- Plain HTML, CSS, JavaScript. No build step, no framework, no package manager.
  Ask before adding any of these.
- Preview locally: `python -m http.server 8000`, or open `index.html`.
- Pages: `index.html`, `about.html`, `pricing.html`. The header and footer are
  repeated per page, so a change to either goes into all three.
- Brand colors are CSS variables in `:root` of `css/styles.css`, matching the
  report theme: blue `#4F8DF0`, green `#25A06F`, orange `#FF7A1A` on navy.
- Deploy: `.github/workflows/pages.yml` publishes a **named list of files**
  (`index.html`, `about.html`, `pricing.html`, `assets/`, `css/`, `js/`) on every
  push to `main`. Add any new page or folder to its `cp` line. `scripts/`, `docs/`
  and the README are not published.

## Demo data
- `js/demo-data.js` is generated: never edit it by hand. Rebuild it with
  `python scripts/build_demo_data.py ../gigadc-reporting` (run
  `python -m generator` in the reporting repo first on a fresh clone).
- It approximates the Power BI Supply and Demand model: supply is cumulative
  Building Ready MW by actual date times the net supply factor (0.95, from the
  reporting repo's `reference/model_parameters.csv`). When the model's logic
  changes, change the script, then regenerate.
- Logos in `assets/logos/` are copies of `gigadc-reporting/brand/logos`. When a
  logo changes there, copy it again.

## Conventions
- The demo-request form is front-end only: it sends nothing and says so.
- Never invent customers, awards, testimonials, or real-sounding contact details.
- Scope mobile CSS to the element it belongs to (a past bug leaked the mobile
  menu rules onto the primary nav).

## Working style
- Test after every change: every page renders, the dashboard and hero chart work,
  nothing scrolls sideways at 375 px. After a deploy, check the live site
  (https://dnelson-analytics.github.io/gigadc-website/), not just the Actions status.
- Explain the approach before writing more than ~30 lines.
- Record decisions in `docs/adr/` as numbered markdown files.
- Small, single-purpose commits with real messages. Commit or push only when asked.
