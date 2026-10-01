// Supply vs demand demo. Data comes from js/demo-data.js, generated from
// the gigadc-reporting CSVs by scripts/build_demo_data.py.
(function () {
  const D = window.DEMO_DATA;
  if (!D) return;

  const ALL = 'All regions';
  const M = { l: 52, r: 16, t: 16, b: 28 };
  let W = 960, H = 340;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));

  const asOfIdx = D.months.indexOf(D.asOf.slice(0, 7));
  const asOfLabel = new Date(D.asOf + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  $('dash-asof').textContent = asOfLabel;

  function seriesFor(name) {
    if (name !== ALL) return D.series[name];
    const sum = (key) => D.months.map((_, i) => D.regions.reduce((t, r) => t + D.series[r][key][i], 0));
    return { supply: sum('supply'), demand: sum('demand') };
  }

  const select = $('dash-region');
  [ALL, ...D.regions].forEach((r) => select.add(new Option(r, r)));

  const svg = $('dash-chart');
  const tip = $('dash-tip');

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }

  let current = null;

  function draw(name) {
    // Draw at the container's real pixel width so text stays readable on phones.
    W = Math.max(320, Math.round(svg.parentElement.clientWidth) || 960);
    H = W < 600 ? 280 : 340;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const s = seriesFor(name);
    current = s;
    svg.replaceChildren();
    const n = D.months.length;
    const max = Math.max(...s.supply, ...s.demand);
    const top = Math.ceil(max / 50) * 50;
    const x = (i) => M.l + (i / (n - 1)) * (W - M.l - M.r);
    const y = (v) => H - M.b - (v / top) * (H - M.t - M.b);

    // Gridlines and y labels
    const step = top / 4;
    for (let g = 0; g <= 4; g++) {
      const v = g * step;
      el('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), stroke: '#5B7AA8', 'stroke-opacity': .25 });
      const t = el('text', { x: M.l - 8, y: y(v) + 4, 'text-anchor': 'end' });
      t.textContent = Math.round(v);
    }
    const unit = el('text', { x: M.l, y: 10 });
    unit.textContent = 'MW';

    // X labels every 4 years
    D.months.forEach((m, i) => {
      if (m.endsWith('-01') && Number(m.slice(0, 4)) % 4 === 0) {
        const t = el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' });
        t.textContent = m.slice(0, 4);
      }
    });

    // Planned (after as-of) shading and as-of line
    el('rect', { x: x(asOfIdx), y: M.t, width: W - M.r - x(asOfIdx), height: H - M.t - M.b, fill: '#4F8DF0', 'fill-opacity': .07 });
    el('line', { x1: x(asOfIdx), x2: x(asOfIdx), y1: M.t, y2: H - M.b, stroke: '#B9C4D6', 'stroke-dasharray': '4 4' });
    const pl = el('text', { x: x(asOfIdx) + 6, y: M.t + 12 });
    pl.textContent = 'Planned →';

    // Series
    const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
    el('path', { d: path(s.supply), fill: 'none', stroke: '#25A06F', 'stroke-width': 2.5, 'stroke-linejoin': 'round' });
    el('path', { d: path(s.demand), fill: 'none', stroke: '#FF7A1A', 'stroke-width': 2.5, 'stroke-linejoin': 'round' });

    // Legend
    el('rect', { x: W - 250, y: 6, width: 10, height: 10, fill: '#25A06F', rx: 2 });
    el('text', { x: W - 235, y: 15 }).textContent = 'Net supply';
    el('rect', { x: W - 140, y: 6, width: 10, height: 10, fill: '#FF7A1A', rx: 2 });
    el('text', { x: W - 125, y: 15 }).textContent = 'Demand';

    // Hover marker
    el('line', { id: 'hv', y1: M.t, y2: H - M.b, stroke: '#F2F6FC', 'stroke-opacity': .6, visibility: 'hidden' });
    svg._x = x;

    kpis(name, asOfIdx);
    rows(name);
  }

  function kpis(name, i) {
    const s = current;
    const gap = s.supply[i] - s.demand[i];
    $('kpi-supply').textContent = fmt(s.supply[i]) + ' MW';
    $('kpi-demand').textContent = fmt(s.demand[i]) + ' MW';
    $('kpi-gap').textContent = signed(gap) + ' MW';
    $('kpi-gap-label').textContent = gap >= 0 ? 'Surplus' : 'Shortfall';
    $('kpi-gap').parentElement.className = 'kpi ' + (gap >= 0 ? 'good' : 'bad');
  }

  function rows(selected) {
    const body = $('dash-rows');
    body.replaceChildren();
    D.regions.forEach((r) => {
      const s = D.series[r];
      const gap = s.supply[asOfIdx] - s.demand[asOfIdx];
      const tr = body.insertRow();
      tr.tabIndex = 0;
      if (r === selected) tr.className = 'sel';
      tr.insertCell().textContent = r;
      tr.insertCell().textContent = fmt(s.supply[asOfIdx]);
      tr.insertCell().textContent = fmt(s.demand[asOfIdx]);
      const g = tr.insertCell();
      g.textContent = signed(gap);
      g.className = gap >= 0 ? 'pos' : 'neg';
      const pick = () => { select.value = r; draw(r); };
      tr.addEventListener('click', pick);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') pick(); });
    });
  }

  function onMove(evt) {
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * W;
    const n = D.months.length;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - M.l) / (W - M.l - M.r)) * (n - 1))));
    const hv = $('hv');
    hv.setAttribute('x1', svg._x(i));
    hv.setAttribute('x2', svg._x(i));
    hv.setAttribute('visibility', 'visible');
    const sup = current.supply[i], dem = current.demand[i], gap = sup - dem;
    const label = new Date(D.months[i] + '-01T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    tip.replaceChildren();
    const b = document.createElement('b');
    b.textContent = label + (i > asOfIdx ? ' (planned)' : '');
    tip.append(b, `Net supply ${fmt(sup)} MW`, document.createElement('br'),
      `Demand ${fmt(dem)} MW`, document.createElement('br'), `Gap ${signed(gap)} MW`);
    tip.hidden = false;
    const left = (svg._x(i) / W) * rect.width;
    tip.style.left = Math.min(Math.max(left, 90), rect.width - 90) + 'px';
    tip.style.top = '24px';
  }

  svg.addEventListener('mousemove', onMove);
  svg.addEventListener('mouseleave', () => {
    tip.hidden = true;
    const hv = $('hv');
    if (hv) hv.setAttribute('visibility', 'hidden');
  });
  select.addEventListener('change', () => draw(select.value));

  draw(ALL);
  let lastW = svg.parentElement.clientWidth;
  window.addEventListener('resize', () => {
    const w = svg.parentElement.clientWidth;
    if (w && w !== lastW) { lastW = w; draw(select.value); }
  });
})();
