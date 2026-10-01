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
| `css/styles.css` | All styling; brand colors are CSS variables in `:root` |
| `js/main.js` | Mobile menu and front-end demo form validation |
| `assets/logos/` | Copies of the logos from `gigadc-reporting/brand/logos` |

## Notes

- The demo form is front-end only; it sends nothing.
- When a logo changes in `gigadc-reporting/brand/`, copy it here again.
- Colors match the report theme: blue `#4F8DF0`, green `#25A06F`, orange
  `#FF7A1A` on navy.
