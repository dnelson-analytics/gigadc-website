# GigaDC Builders website

Corporate site for GigaDC Builders, a fictitious data center operator. It
pitches a SaaS platform for planning and delivering AI-scale data center
capacity, the same domain modeled in the sibling `gigadc-reporting` repo
(supply, demand, gap, delivery milestones).

## Stack

Plain HTML, CSS and JavaScript. No build step and no dependencies.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
```

## Layout

| Path | Contents |
|---|---|
| `index.html` | The home page |
| `about.html`, `pricing.html` | About and Pricing pages (header and footer are repeated per page) |
| `reports/` | Report pages: the Power BI reports in plain HTML (ADR 0002). `index.html` lists them; `supply-and-demand.html` is the first |
| `css/reports.css` | Report styling, following the Power BI theme inside the site's frame |
| `js/reports/supply-and-demand.js` | The Supply and Demand report: slicers, period roll-ups, SVG chart, table |
| `js/reports/supply-and-demand-data.js` | Generated report data; do not edit |
| `js/reports/capacity-delivery.js` | The Capacity Delivery report: Overview (treemap, columns, DC and Building Details) and Schedule Matrix tabs |
| `js/reports/capacity-delivery-data.js` | Generated report data; do not edit |
| `scripts/build_delivery_data.py` | Builds the Capacity Delivery data, porting the Delivery and Delivery MW queries |
| `scripts/build_report_data.py` | Builds the report data from the gigadc-reporting CSVs, porting the model's Power Query |
| `css/styles.css` | All styling; brand colors are CSS variables in `:root` |
| `js/main.js` | Mobile menu and front-end demo form validation |
| `js/dashboard.js` | Supply vs demand demo: region picker, KPIs, chart, gap table |
| `js/demo-data.js` | Generated Region x month data; do not edit |
| `scripts/build_demo_data.py` | Builds `demo-data.js` from the gigadc-reporting CSVs |
| `assets/logos/` | Copies of the logos from `gigadc-reporting/brand/logos` |

## Notes

- The demo form is front-end only; it sends nothing.
- When a logo changes in `gigadc-reporting/brand/`, copy it here again.
- Colors match the report theme: blue `#4F8DF0`, green `#25A06F`, orange
  `#FF7A1A` on navy.

## Refreshing the demo data

The dashboard reads `js/demo-data.js`, which is committed. To rebuild it from
the reporting repo (run `python -m generator` there first on a fresh clone):

```bash
python scripts/build_demo_data.py ../gigadc-reporting
```

Supply is cumulative Building Ready MW by actual date, times the net supply
factor (0.95) from `reference/model_parameters.csv`. Demand is Region x month
as generated. It is a demo approximation of the Power BI model, not a copy.


## Refreshing the report data

The report pages read `js/reports/supply-and-demand-data.js`, which is
committed. Rebuild it from the reporting repo the same way:

```bash
python scripts/build_report_data.py ../gigadc-reporting
python scripts/build_delivery_data.py ../gigadc-reporting
```

It ports the Supply and Demand model's Delivery MW and Supply queries,
including Power Query's rounding (ADR 0002). Change it when those queries
change.

## Deploying

`.github/workflows/pages.yml` publishes `index.html`, `about.html`,
`pricing.html`, `assets/`, `css/`, `js/` and `reports/` to GitHub Pages on every push to
`main`. One-time setup: in the repo's Settings > Pages, set Source to
"GitHub Actions". `scripts/`, `docs/` and the README are not published.
