// Supply and Demand report (ADR 0002): a plain-HTML clone of the Power BI report.
// Data: js/reports/supply-and-demand-data.js, built by scripts/build_report_data.py.
// The browser only filters, rolls up by period, and draws.
(function () {
  const D = window.SUPPLY_DEMAND_DATA;
  if (!D) return;

  // --- Theme (GigaDC_PowerBI_theme.json) -------------------------------------
  const DATA_COLORS = ['#4F8DF0', '#25A06F', '#DB6A1C', '#7EAAF4', '#2F6FE0', '#5CC796'];
  const BAD = '#E5484D';                         // Gap is always the theme's bad red
  const TRENDS = [                               // the Trend field parameter, in order
    { name: 'Net Supply (MW)', key: 'netSupply' },
    { name: 'Supply (MW)', key: 'supply' },
    { name: 'Demand (MW)', key: 'demand' },
    { name: 'Gap (MW)', key: 'gap' },
  ];
  const BARS = 'Deliveries Shown (MW)';
  const GRAINS = ['Year', 'Quarter', 'Month'];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // --- Report state: the Power BI defaults ------------------------------------
  const state = {
    grain: 'Year',
    areas: new Set(),                            // empty = all, as an unfiltered slicer
    regions: new Set(),
    trends: new Set(['Net Supply (MW)', 'Demand (MW)', 'Gap (MW)']),
    bars: true,
  };

  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const fmt1 = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // Format strings from the model: #,0.0 and, for Gap, +#,0.0;-#,0.0;0.0
  const fmt = (n, key) => {
    const r = Math.round(n * 10) / 10;
    if (key !== 'gap') return fmt1(r);
    return (r > 0 ? '+' : r < 0 ? '-' : '') + fmt1(Math.abs(r));
  };

  // --- Slicer options -----------------------------------------------------------
  const regionsInScope = () => D.regions
    .filter((r) => state.areas.size === 0 || state.areas.has(r.area))
    .map((r) => r.name);
  const selectedRegions = () => {
    const scope = regionsInScope();
    return state.regions.size === 0 ? scope : scope.filter((r) => state.regions.has(r));
  };
  // A field parameter with nothing selected shows every field.
  const selectedTrends = () => TRENDS.filter((t) => state.trends.size === 0 || state.trends.has(t.name));

  // --- Periods at the selected grain ---------------------------------------------
  // Each period keeps its months; semi-additive measures read the last one.
  function periods() {
    const out = [];
    const byKey = new Map();
    D.months.forEach((m, i) => {
      const y = m.slice(0, 4), mo = Number(m.slice(5, 7));
      const key = state.grain === 'Year' ? y
        : state.grain === 'Quarter' ? `${y} Q${Math.ceil(mo / 3)}`
        : `${MONTH_NAMES[mo - 1]} ${y}`;
      if (!byKey.has(key)) { byKey.set(key, { label: key, months: [] }); out.push(byKey.get(key)); }
      byKey.get(key).months.push(i);
    });
    return out;
  }

  // Region × period values for the selected trends, plus deliveries per period.
  function compute() {
    const regs = selectedRegions();
    const ps = periods();
    const monthToPeriod = new Map();
    ps.forEach((p, pi) => p.months.forEach((mi) => monthToPeriod.set(D.months[mi], pi)));

    const value = (regList, key, mi) => {
      if (key === 'gap') return value(regList, 'netSupply', mi) - value(regList, 'demand', mi);
      return regList.reduce((t, r) => t + D.series[r][key][mi], 0);
    };
    const last = (p) => p.months[p.months.length - 1];

    const deliveries = ps.map(() => ({ mw: 0, buildings: [] }));
    const regSet = new Set(regs);
    D.buildings.forEach((b) => {
      const pi = monthToPeriod.get(b.supplyDate.slice(0, 7));
      if (pi === undefined || !regSet.has(b.region)) return;      // outside 2023–2040
      deliveries[pi].mw += b.mw;
      deliveries[pi].buildings.push(b);
    });

    return {
      regs, ps, deliveries,
      total: (key, pi) => value(regs, key, last(ps[pi])),
      byRegion: (reg, key, pi) => value([reg], key, last(ps[pi])),
    };
  }

  // --- Controls ----------------------------------------------------------------------
  function buttonGroup(container, options, current, onPick) {
    container.innerHTML = '';
    options.forEach((opt) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = opt;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(opt === current()));
      b.addEventListener('click', () => { onPick(opt); render(); });
      container.appendChild(b);
    });
  }

  let openMenu = null;
  function closeMenu() {
    if (!openMenu) return;
    openMenu.menu.remove();
    openMenu.button.setAttribute('aria-expanded', 'false');
    openMenu = null;
  }
  document.addEventListener('click', (e) => {
    if (openMenu && !openMenu.root.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openMenu) { const b = openMenu.button; closeMenu(); b.focus(); }
  });

  // A dropdown slicer with checkboxes; an empty selection means All.
  function dropdown(container, label, getOptions, selected) {
    container.innerHTML = '';
    const id = container.id + '-label';
    const lab = document.createElement('span');
    lab.className = 'slicer-label';
    lab.id = id;
    lab.textContent = label;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-labelledby', id + ' ' + container.id + '-value');
    const val = document.createElement('span');
    val.id = container.id + '-value';
    btn.appendChild(val);
    container.append(lab, btn);

    const opts = getOptions();
    const chosen = opts.filter((o) => selected.has(o));
    val.textContent = chosen.length === 0 ? 'All' : chosen.length === 1 ? chosen[0] : 'Multiple selections';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (openMenu && openMenu.button === btn) { closeMenu(); return; }
      closeMenu();
      const menu = document.createElement('div');
      menu.className = 'slicer-menu';
      menu.setAttribute('role', 'group');
      menu.setAttribute('aria-labelledby', id);
      const all = checkbox('Select all', chosen.length === 0, () => { selected.clear(); render(); reopen(); });
      all.classList.add('all');
      menu.appendChild(all);
      opts.forEach((o) => {
        menu.appendChild(checkbox(o, selected.has(o), (on) => {
          if (on) selected.add(o); else selected.delete(o);
          if (opts.every((x) => selected.has(x))) selected.clear();   // all ticked = All
          render(); reopen();
        }));
      });
      container.appendChild(menu);
      btn.setAttribute('aria-expanded', 'true');
      openMenu = { root: container, menu, button: btn };
      const first = menu.querySelector('input');
      if (first) first.focus();
    });

    // Re-open the same menu after a render rebuilt the slicer.
    function reopen() {
      const again = container.querySelector('button');
      if (again) again.click();
    }
  }

  function checkbox(text, checked, onToggle) {
    const l = document.createElement('label');
    const c = document.createElement('input');
    c.type = 'checkbox';
    c.checked = checked;
    c.addEventListener('change', (e) => { e.stopPropagation(); onToggle(c.checked); });
    l.append(c, document.createTextNode(text));
    l.addEventListener('click', (e) => e.stopPropagation());
    return l;
  }

  function renderControls() {
    buttonGroup($('grain'), GRAINS, () => state.grain, (g) => { state.grain = g; });
    buttonGroup($('bars'), ['Show Bars', 'Hide Bars'], () => (state.bars ? 'Show Bars' : 'Hide Bars'),
      (b) => { state.bars = b === 'Show Bars'; });
    // Region cascades from Area: drop selected regions no longer in scope.
    const scope = new Set(regionsInScope());
    [...state.regions].forEach((r) => { if (!scope.has(r)) state.regions.delete(r); });
    openMenu = null;
    dropdown($('slicer-area'), 'Area', () => D.areas, state.areas);
    dropdown($('slicer-region'), 'Region', regionsInScope, state.regions);
    dropdown($('slicer-trend'), 'Trend', () => TRENDS.map((t) => t.name), state.trends);
  }

  // --- Chart -----------------------------------------------------------------------------
  function el(name, attrs, parent, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    parent.appendChild(e);
    return e;
  }

  function niceTicks(min, max, count) {
    if (min === max) { max = min + 1; }
    const span = max - min;
    const step0 = Math.pow(10, Math.floor(Math.log10(span / count)));
    const err = (span / count) / step0;
    const step = step0 * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return ticks;
  }

  const axisFmt = (v) => (Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('en-US') + 'K' : v.toLocaleString('en-US'));

  function seriesColors(trends) {
    // Bars take data color 1; lines take the next colors by position. Gap stays red.
    return trends.map((t, i) => (t.key === 'gap' ? BAD : DATA_COLORS[(i + 1) % DATA_COLORS.length]));
  }

  function renderLegend(trends, colors) {
    const ul = $('legend');
    ul.innerHTML = '';
    const item = (name, color, bar) => {
      const li = document.createElement('li');
      const i = document.createElement('i');
      i.style.background = color;
      if (bar) i.className = 'bar';
      li.append(i, document.createTextNode(name));
      ul.appendChild(li);
    };
    item(BARS, DATA_COLORS[0], true);
    trends.forEach((t, i) => item(t.name, colors[i]));
  }

  function renderChart(c) {
    const trends = selectedTrends();
    const colors = seriesColors(trends);
    renderLegend(trends, colors);

    const svg = $('chart');
    const W = Math.max(320, $('chart-wrap').clientWidth);
    const H = W < 600 ? 300 : 420;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';
    const M = { l: 48, r: 52, t: 22, b: 32 };
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const n = c.ps.length;
    const band = pw / n;
    const x = (i) => M.l + band * (i + 0.5);

    // Left axis: deliveries (bars). Right axis: the trend lines, as in the report.
    const barVals = c.deliveries.map((d) => (state.bars ? d.mw : 0));
    const barTicks = niceTicks(0, Math.max(1, ...barVals), 5);
    const yb = (v) => M.t + ph - (v / barTicks[barTicks.length - 1]) * ph;
    const lineVals = trends.flatMap((t) => c.ps.map((_, pi) => c.total(t.key, pi)));
    const lineTicks = niceTicks(Math.min(0, ...lineVals), Math.max(1, ...lineVals), 5);
    const lo = lineTicks[0], hi = lineTicks[lineTicks.length - 1];
    const yl = (v) => M.t + ph - ((v - lo) / (hi - lo)) * ph;

    lineTicks.forEach((v) => {
      el('line', { x1: M.l, x2: W - M.r, y1: yl(v), y2: yl(v), class: v === 0 ? 'zero' : 'grid' }, svg);
      el('text', { x: W - M.r + 6, y: yl(v) + 4, class: 'axis-label' }, svg, axisFmt(v));
    });
    barTicks.forEach((v) => el('text', { x: M.l - 6, y: yb(v) + 4, 'text-anchor': 'end', class: 'axis-label' }, svg, axisFmt(v)));

    // Category labels, thinned so they never overlap.
    const labelW = state.grain === 'Year' ? 34 : state.grain === 'Quarter' ? 56 : 62;
    const every = Math.max(1, Math.ceil(labelW / band));
    c.ps.forEach((p, i) => {
      if (i % every) return;
      el('text', { x: x(i), y: H - M.b + 18, 'text-anchor': 'middle', class: 'axis-label' }, svg, p.label);
    });

    // Bars.
    // Data labels as in the report, but only where each period has room for them.
    const showLabels = n <= 24 && band >= 40;
    const bw = Math.max(1, band * 0.6);
    c.deliveries.forEach((d, i) => {
      if (!state.bars || d.mw <= 0) return;
      el('rect', { x: x(i) - bw / 2, y: yb(d.mw), width: bw, height: M.t + ph - yb(d.mw), fill: DATA_COLORS[0] }, svg);
      if (showLabels) el('text', { x: x(i), y: yb(d.mw) - 4, 'text-anchor': 'middle', class: 'data-label' }, svg, fmt1(d.mw));
    });

    // Lines, with data labels at coarse grains (the report shows them).
    trends.forEach((t, ti) => {
      const pts = c.ps.map((_, pi) => [x(pi), yl(c.total(t.key, pi))]);
      el('polyline', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: colors[ti], 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, svg);
      if (showLabels) {
        pts.forEach(([px, py], pi) => {
          el('text', { x: px, y: py - 7, 'text-anchor': 'middle', class: 'data-label', fill: colors[ti] }, svg,
            fmt(c.total(t.key, pi), t.key));
        });
      }
    });

    // Hover: a guide line and a tooltip for the nearest period.
    const hover = el('line', { y1: M.t, y2: M.t + ph, class: 'hover-line', visibility: 'hidden' }, svg);
    const overlay = el('rect', { x: M.l, y: M.t, width: pw, height: ph, fill: 'transparent' }, svg);
    const tip = $('tip');
    const showTip = (clientX) => {
      const r = svg.getBoundingClientRect();
      const sx = (clientX - r.left) * (W / r.width);
      const i = Math.min(n - 1, Math.max(0, Math.floor((sx - M.l) / band)));
      hover.setAttribute('x1', x(i)); hover.setAttribute('x2', x(i)); hover.setAttribute('visibility', 'visible');
      const rows = [];
      if (state.bars && c.deliveries[i].mw > 0) rows.push([BARS, fmt1(c.deliveries[i].mw)]);
      trends.forEach((t) => rows.push([t.name, fmt(c.total(t.key, i), t.key)]));
      tip.innerHTML = `<div class="period">${c.ps[i].label}</div><table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>`;
      tip.hidden = false;
      const px = x(i) * (r.width / W);
      const left = Math.min(Math.max(px + 12, 0), r.width - tip.offsetWidth);
      tip.style.left = (px + 12 + tip.offsetWidth > r.width ? px - tip.offsetWidth - 12 : left) + 'px';
      tip.style.top = '28px';
    };
    overlay.addEventListener('mousemove', (e) => showTip(e.clientX));
    overlay.addEventListener('mouseleave', () => { tip.hidden = true; hover.setAttribute('visibility', 'hidden'); });
  }

  // --- Table: regions down the side, periods across, the selected trends under each ----------
  function renderTable(c) {
    const trends = selectedTrends();
    const t = $('table');
    const head1 = `<tr><th class="region" rowspan="2" scope="col">Region</th>${c.ps.map((p) =>
      `<th class="period-head group-start" colspan="${trends.length}" scope="colgroup">${p.label}</th>`).join('')}</tr>`;
    const head2 = `<tr>${c.ps.map(() => trends.map((tr, i) =>
      `<th scope="col"${i === 0 ? ' class="group-start"' : ''}>${tr.name}</th>`).join('')).join('')}</tr>`;
    const body = c.regs.map((reg) => `<tr><td class="region">${reg}</td>${c.ps.map((_, pi) => trends.map((tr, i) =>
      `<td${i === 0 ? ' class="group-start"' : ''}>${fmt(c.byRegion(reg, tr.key, pi), tr.key)}</td>`).join('')).join('')}</tr>`).join('');
    t.innerHTML = `<caption class="sr-only">Supply and demand by region, MW, by ${state.grain.toLowerCase()}</caption><thead>${head1}${head2}</thead><tbody>${body}</tbody>`;
  }

  // --- Render ---------------------------------------------------------------------------
  function render() {
    renderControls();
    const c = compute();
    renderChart(c);
    renderTable(c);
  }

  $('asof').textContent = new Date(D.asOf + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => renderChart(compute()), 120); });
  render();
})();
