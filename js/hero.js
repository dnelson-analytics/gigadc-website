// Hero chart: the all-regions net supply and demand trend, year-end points
// from js/demo-data.js, drawn as a smooth monotone curve (no overshoot).
(function () {
  const D = window.DEMO_DATA;
  const svg = document.getElementById('hero-chart');
  if (!D || !svg) return;

  const NS = 'http://www.w3.org/2000/svg';
  const M = { l: 12, r: 78, t: 30, b: 26 };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  // Year-end (December) totals across all regions.
  const idx = D.months.map((m, i) => (m.endsWith('-12') ? i : -1)).filter((i) => i >= 0);
  const total = (key) => idx.map((i) => D.regions.reduce((t, r) => t + D.series[r][key][i], 0));
  const years = idx.map((i) => Number(D.months[i].slice(0, 4)));
  const supply = total('supply');
  const demand = total('demand');
  const asOfYear = Number(D.asOf.slice(0, 4)) + Number(D.asOf.slice(5, 7)) / 12;

  // Fritsch-Carlson monotone cubic: Bezier control points through (xs, ys).
  function monotone(xs, ys) {
    const n = xs.length;
    const dx = [], slope = [];
    for (let i = 0; i < n - 1; i++) {
      dx.push(xs[i + 1] - xs[i]);
      slope.push((ys[i + 1] - ys[i]) / dx[i]);
    }
    const m = [slope[0]];
    for (let i = 1; i < n - 1; i++) {
      m.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
    }
    m.push(slope[n - 2]);
    for (let i = 0; i < n - 1; i++) {
      if (slope[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / slope[i], b = m[i + 1] / slope[i], h = Math.hypot(a, b);
      if (h > 3) { m[i] = (3 * a / h) * slope[i]; m[i + 1] = (3 * b / h) * slope[i]; }
    }
    let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const c1x = xs[i] + dx[i] / 3, c2x = xs[i + 1] - dx[i] / 3;
      d += `C${c1x.toFixed(1)} ${(ys[i] + m[i] * dx[i] / 3).toFixed(1)} ` +
           `${c2x.toFixed(1)} ${(ys[i + 1] - m[i + 1] * dx[i] / 3).toFixed(1)} ` +
           `${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`;
    }
    return d;
  }

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }

  function draw() {
    const W = Math.max(300, Math.round(svg.parentElement.clientWidth - 32) || 440);
    const H = W < 400 ? 250 : 290;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();

    const top = Math.ceil(Math.max(...supply, ...demand) / 250) * 250;
    const x = (yr) => M.l + ((yr - years[0]) / (years[years.length - 1] - years[0])) * (W - M.l - M.r);
    const y = (v) => H - M.b - (v / top) * (H - M.t - M.b);
    const xs = years.map(x);

    for (let g = 0; g <= 4; g++) {
      const gy = y((top / 4) * g);
      el('line', { x1: M.l, x2: W - M.r, y1: gy, y2: gy, stroke: '#5B7AA8', 'stroke-opacity': .22 });
    }

    // Planned shade and today marker
    el('rect', { x: x(asOfYear), y: M.t, width: W - M.r - x(asOfYear), height: H - M.t - M.b, fill: '#4F8DF0', 'fill-opacity': .07 });
    el('line', { x1: x(asOfYear), x2: x(asOfYear), y1: M.t, y2: H - M.b, stroke: '#B9C4D6', 'stroke-dasharray': '4 4' });
    el('text', { x: x(asOfYear) + 5, y: M.t + 12 }).textContent = 'Planned →';

    // Lines: demand drawn first so supply reads on top where they meet
    const sy = supply.map(y), dy = demand.map(y);
    el('path', { class: 'demand', d: monotone(xs, dy), pathLength: 1, fill: 'none', stroke: '#FF7A1A', 'stroke-width': 3, 'stroke-linecap': 'round' });
    el('path', { class: 'supply', d: monotone(xs, sy), pathLength: 1, fill: 'none', stroke: '#25A06F', 'stroke-width': 3, 'stroke-linecap': 'round' });

    // End labels with the 2040 values
    const last = years.length - 1;
    const lx = W - M.r + 8;
    const ys = [[sy[last], 'Net supply', supply[last], '#43C98A'], [dy[last], 'Demand', demand[last], '#FF9A4D']]
      .sort((a, b) => a[0] - b[0]);
    if (ys[1][0] - ys[0][0] < 30) { ys[0][0] -= 10; ys[1][0] += 10; }
    ys.forEach(([py, name, v, color]) => {
      const t = el('text', { x: lx, y: py - 2, fill: color, style: `fill:${color};font-weight:600` });
      t.textContent = fmt(v) + ' MW';
      el('text', { x: lx, y: py + 12, style: 'font-size:11px' }).textContent = name;
    });

    // X labels
    [years[0], 2026, years[last]].forEach((yr, i) => {
      el('text', { x: x(yr), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle' }).textContent = yr;
    });
    el('text', { x: M.l, y: 14 }).textContent = 'MW, all regions';
  }

  draw();
  let lastW = svg.parentElement.clientWidth;
  window.addEventListener('resize', () => {
    const w = svg.parentElement.clientWidth;
    if (w && w !== lastW) { lastW = w; draw(); }
  });
})();
