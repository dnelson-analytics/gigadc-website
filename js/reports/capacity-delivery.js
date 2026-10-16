// Capacity Delivery report (ADR 0002): a plain-HTML clone of the Power BI report's
// Overview and Schedule Matrix pages. Data: js/reports/capacity-delivery-data.js,
// built by scripts/build_delivery_data.py. The browser rolls status up and draws.
(function () {
  const D = window.CAPACITY_DELIVERY_DATA;
  if (!D) return;

  // --- Theme ------------------------------------------------------------------------------
  // Region colors: theme data colors 11-16, fixed per region in the treemap and columns.
  const REGION_COLOR = {
    'Pacific Northwest': '#1F5FBF', 'Arizona Flats': '#8E5CD6', 'Vegas': '#1C9DB5',
    'The Ozarks': '#5B6B85', 'Philly': '#B04C9E', 'Kentucky': '#7A5C43',
  };
  // Status Color: the theme's good, neutral, bad, and grey.
  const STATUS_COLOR = { Green: '#43C98A', Amber: '#F2B01E', Red: '#E5484D', Grey: '#8FA0B8' };
  const DELIVERED_CELL = '#B9C4D6';
  // Building Details shows only the three core milestones; the Schedule Matrix shows all ten.
  const CORE = ['Facility Ready', 'Infrastructure Ready', 'Building Ready'];              // Schedule Cell Background for a delivered milestone
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);

  const fmt1 = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtInt = (n) => n.toLocaleString('en-US');
  const fmtDate = (iso) => (iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : '');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // --- State: the Area slicer, cross-filter selection, and the page --------------------
  const state = { areas: new Set(), select: null };   // select: { region } or { dc }

  const regionOrder = new Map(D.regions.map((r, i) => [r.name, i]));
  const dcInfo = new Map(D.dataCenters.map((d, i) => [d.code, { ...d, order: i }]));
  const inArea = (b) => state.areas.size === 0 || state.areas.has(dcInfo.get(b.dataCenter).area);
  const inSelection = (b) => !state.select
    || (state.select.region && b.region === state.select.region)
    || (state.select.dc && b.dataCenter === state.select.dc);

  // --- Measures, as in the model's _Measures ---------------------------------------------
  const mwInFlight = (bs) => bs.reduce((t, b) => t + (b.deliveryStatus === 'To Be Delivered' ? b.mw : 0), 0);
  const inFlightPlanDate = (bs) => bs.filter((b) => b.deliveryStatus === 'To Be Delivered')
    .map((b) => b.planDate).sort()[0];

  // Status Rollup: the weighted score of the open rows, banded, with the Red override.
  function statusRollup(rows) {
    if (rows.length === 0) return null;
    const open = rows.filter((r) => r[3] !== 'Grey');
    if (open.length === 0) return 'Grey';
    const score = open.reduce((t, r) => t + ({ Green: 1, Amber: 2, Red: 3 })[r[3]], 0) / open.length;
    const band = score < 1.5 ? 'Green' : score < 2.5 ? 'Amber' : 'Red';
    return open.some((r) => r[3] === 'Red') && band === 'Green' ? 'Amber' : band;
  }
  const rowsOf = (bs) => bs.flatMap((b) => b.milestones.filter(Boolean));

  const bubble = (status) => (status ? `<span class="bubble" style="color:${STATUS_COLOR[status]}" title="${status}">&#9679;</span>` : '');

  // --- Area slicer (dropdown with checkboxes; empty = All) -------------------------------
  let menuOpen = false;
  function renderSlicer() {
    const box = $('slicer-area');
    box.innerHTML = '';
    const lab = document.createElement('span');
    lab.className = 'slicer-label';
    lab.id = 'slicer-area-label';
    lab.textContent = 'Area';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', String(menuOpen));
    const chosen = D.areas.filter((a) => state.areas.has(a));
    btn.textContent = chosen.length === 0 ? 'All' : chosen.join(', ');
    btn.setAttribute('aria-label', 'Area: ' + btn.textContent);
    btn.addEventListener('click', (e) => { e.stopPropagation(); menuOpen = !menuOpen; renderSlicer(); });
    box.append(lab, btn);
    if (!menuOpen) return;
    const menu = document.createElement('div');
    menu.className = 'slicer-menu';
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-labelledby', lab.id);
    const item = (text, checked, onChange, cls) => {
      const l = document.createElement('label');
      if (cls) l.className = cls;
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.checked = checked;
      c.addEventListener('change', onChange);
      l.append(c, document.createTextNode(text));
      l.addEventListener('click', (e) => e.stopPropagation());
      menu.appendChild(l);
      return c;
    };
    const first = item('Select all', chosen.length === 0, () => { state.areas.clear(); render(); }, 'all');
    D.areas.forEach((a) => item(a, state.areas.has(a), (e) => {
      if (e.target.checked) state.areas.add(a); else state.areas.delete(a);
      if (D.areas.every((x) => state.areas.has(x))) state.areas.clear();
      render();
    }));
    box.appendChild(menu);
    first.focus();
  }
  document.addEventListener('click', () => { if (menuOpen) { menuOpen = false; renderSlicer(); } });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) { menuOpen = false; renderSlicer(); $('slicer-area').querySelector('button').focus(); }
  });

  function toggleSelect(sel) {
    const same = state.select && ((sel.region && state.select.region === sel.region) || (sel.dc && state.select.dc === sel.dc));
    state.select = same ? null : sel;
    render();
  }

  // --- SVG helpers -------------------------------------------------------------------------
  function el(name, attrs, parent, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    parent.appendChild(e);
    return e;
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
  }

  // Squarified treemap layout (Bruls, Huizing, van Wijk).
  function squarify(items, x, y, w, h) {
    const total = items.reduce((t, i) => t + i.value, 0);
    const scale = (w * h) / total;
    const nodes = items.map((i) => ({ ...i, area: i.value * scale }));
    const out = [];
    let rect = { x, y, w, h };
    let row = [];
    const worst = (r, side) => {
      const s = r.reduce((t, n) => t + n.area, 0);
      const max = Math.max(...r.map((n) => n.area)), min = Math.min(...r.map((n) => n.area));
      return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
    };
    const layoutRow = (r) => {
      const s = r.reduce((t, n) => t + n.area, 0);
      if (rect.w >= rect.h) {
        const cw = s / rect.h;
        let cy = rect.y;
        r.forEach((n) => { const ch = n.area / cw; out.push({ ...n, x: rect.x, y: cy, w: cw, h: ch }); cy += ch; });
        rect = { x: rect.x + cw, y: rect.y, w: rect.w - cw, h: rect.h };
      } else {
        const ch = s / rect.w;
        let cx = rect.x;
        r.forEach((n) => { const cw = n.area / ch; out.push({ ...n, x: cx, y: rect.y, w: cw, h: ch }); cx += cw; });
        rect = { x: rect.x, y: rect.y + ch, w: rect.w, h: rect.h - ch };
      }
    };
    nodes.forEach((n) => {
      const side = Math.min(rect.w, rect.h);
      if (row.length === 0 || worst([...row, n], side) <= worst(row, side)) row.push(n);
      else { layoutRow(row); row = [n]; }
    });
    if (row.length) layoutRow(row);
    return out;
  }

  // --- Overview ------------------------------------------------------------------------------
  function renderTreemap(bs) {
    const svg = $('treemap');
    // The treemap fills its card, which the grid stretches to the right-hand card's height.
    const W = Math.max(280, $('treemap-wrap').clientWidth);
    const H = Math.max(260, $('treemap-wrap').clientHeight);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = '';
    const items = D.regions.map((r) => ({ region: r.name, value: mwInFlight(bs.filter((b) => b.region === r.name)) }))
      .filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
    if (!items.length) return;
    squarify(items, 0, 0, W, H).forEach((n) => {
      const dim = state.select && (state.select.region ? state.select.region !== n.region
        : dcInfo.get(state.select.dc).region !== n.region);
      const g = el('g', { class: 'tm-cell', tabindex: 0, role: 'button',
        'aria-label': `${n.region}: ${fmt1(n.value)} MW in flight`, opacity: dim ? 0.35 : 1 }, svg);
      el('rect', { x: n.x + 1, y: n.y + 1, width: Math.max(0, n.w - 2), height: Math.max(0, n.h - 2), fill: REGION_COLOR[n.region] }, g);
      if (n.w > 70 && n.h > 48) {
        el('text', { x: n.x + 10, y: n.y + 24, class: 'tm-name' }, g, n.region);
        el('text', { x: n.x + 10, y: n.y + 50, class: 'tm-value' }, g, fmt1(n.value));
      }
      const pick = () => toggleSelect({ region: n.region });
      g.addEventListener('click', (e) => { e.stopPropagation(); pick(); });
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
  }

  function renderColumns(bs) {
    const svg = $('columns');
    const W = Math.max(280, $('columns-wrap').clientWidth);
    const H = 310;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';
    // One column per data center with MW in flight, grouped by region in region order.
    const cols = D.dataCenters.map((d) => ({ ...d, value: mwInFlight(bs.filter((b) => b.dataCenter === d.code)) }))
      .filter((c) => c.value > 0)
      .sort((a, b) => regionOrder.get(a.region) - regionOrder.get(b.region) || a.code.localeCompare(b.code));
    if (!cols.length) return;
    // Tilt the data center labels when they don't fit side by side, as Power BI does.
    const tilt = (W - 48) / cols.length < 44;
    const M = { l: 40, r: 8, t: 18, b: tilt ? 78 : 50 };
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const max = niceMax(Math.max(...cols.map((c) => c.value)) * 1.08);
    const y = (v) => M.t + ph - (v / max) * ph;
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      el('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: 'grid' }, svg);
      el('text', { x: M.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'axis-label' }, svg, fmtInt(Math.round(v)));
    }
    const band = pw / cols.length;
    const bw = Math.min(56, band * 0.62);
    cols.forEach((c, i) => {
      const cx = M.l + band * (i + 0.5);
      const dim = state.select && (state.select.dc ? state.select.dc !== c.code : state.select.region !== c.region);
      const g = el('g', { class: 'col-bar', tabindex: 0, role: 'button', opacity: dim ? 0.35 : 1,
        'aria-label': `${c.code}, ${c.region}: ${fmt1(c.value)} MW in flight` }, svg);
      el('rect', { x: cx - bw / 2, y: y(c.value), width: bw, height: M.t + ph - y(c.value), fill: REGION_COLOR[c.region] }, g);
      el('text', { x: cx, y: y(c.value) - 5, 'text-anchor': 'middle', class: 'total-label' }, g, fmt1(c.value));
      if (tilt) el('text', { x: cx + 3, y: H - M.b + 10, 'text-anchor': 'end', class: 'axis-label dc-label',
        transform: `rotate(-45 ${cx + 3} ${H - M.b + 10})` }, svg, c.code);
      else el('text', { x: cx, y: H - M.b + 15, 'text-anchor': 'middle', class: 'axis-label dc-label' }, svg, c.code);
      const pick = () => toggleSelect({ dc: c.code });
      g.addEventListener('click', (e) => { e.stopPropagation(); pick(); });
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    // Region group labels under their columns.
    let start = 0;
    cols.forEach((c, i) => {
      if (i < cols.length - 1 && cols[i + 1].region === c.region) return;
      const x1 = M.l + band * start + 4, x2 = M.l + band * (i + 1) - 4;
      const ly = H - (tilt ? 30 : 28);
      el('line', { x1, x2, y1: ly, y2: ly, class: 'group-line' }, svg);
      // A long region name wraps onto two lines rather than overflow its group.
      const words = c.region.split(' ');
      const lines = x2 - x1 >= c.region.length * 6.8 || words.length === 1 ? [c.region]
        : [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')];
      const t = el('text', { x: (x1 + x2) / 2, y: ly + 14, 'text-anchor': 'middle', class: 'region-label' }, svg);
      lines.forEach((ln, li) => el('tspan', { x: (x1 + x2) / 2, dy: li ? 13 : 0 }, t, ln));
      start = i + 1;
    });
  }

  function renderDcTable(bs) {
    const rows = D.dataCenters.map((d) => {
      const dbs = bs.filter((b) => b.dataCenter === d.code);
      return { code: d.code, mw: mwInFlight(dbs), next: inFlightPlanDate(dbs), status: statusRollup(rowsOf(dbs)) };
    }).filter((r) => r.mw > 0).sort((a, b) => (a.next || '').localeCompare(b.next || ''));
    $('dc-table').innerHTML = `<thead><tr><th class="txt" scope="col">Data Center</th><th class="ctr" scope="col">Status</th>
      <th scope="col">MW In Flight</th><th class="ctr" scope="col">Next Building Ready</th></tr></thead><tbody>${rows.map((r) =>
      `<tr><td class="txt">${r.code}</td><td class="ctr">${bubble(r.status)}</td><td>${fmt1(r.mw)}</td><td class="ctr">${fmtDate(r.next)}</td></tr>`).join('')}</tbody>`;
  }

  // Building Details: Area, Region, Data Center, Building, MW down the side (row headers not
  // repeated), each milestone's Plan, Actual / Forecast, Drift, and Status across.
  function renderBuildingDetails(bs) {
    // Active buildings only, as on the Schedule Matrix: a delivered building drops out,
    // and so does a data center once all its buildings are delivered.
    const list = bs.filter((b) => b.deliveryStatus === 'To Be Delivered').sort(byHierarchy);
    const core = D.milestones.map((m, i) => i).filter((i) => CORE.includes(D.milestones[i].name));
    const head1 = `<tr>${['Area', 'Region', 'Data Center', 'Building', 'MW'].map((h) =>
      `<th class="rh" rowspan="2" scope="col">${h}</th>`).join('')}${core.map((i) =>
      `<th class="period-head group-start" colspan="4" scope="colgroup">${esc(D.milestones[i].name)}</th>`).join('')}</tr>`;
    const head2 = `<tr>${core.map(() => ['Plan', 'Actual / Forecast', 'Drift (days)', 'Status'].map((h, i) =>
      `<th scope="col" class="${i === 0 ? 'group-start ' : ''}${i === 1 || i === 0 ? 'ctr' : i === 3 ? 'ctr' : ''}">${h}</th>`).join('')).join('')}</tr>`;
    let prev = [];
    const body = list.map((b) => {
      const keys = [dcInfo.get(b.dataCenter).area, b.region, b.dataCenter];
      let changed = false;
      const heads = keys.map((v, i) => {
        changed = changed || prev[i] !== v;
        return `<td class="rh txt">${changed ? esc(v) : ''}</td>`;
      }).join('');
      prev = keys;
      const ms = core.map((i) => b.milestones[i]).map((m) => (m
        ? `<td class="group-start ctr">${fmtDate(m[0])}</td><td class="ctr">${fmtDate(m[1])}</td><td>${fmtInt(m[2])}</td><td class="ctr">${bubble(m[3])}</td>`
        : '<td class="group-start"></td><td></td><td></td><td></td>')).join('');
      return `<tr>${heads}<td class="rh txt">${b.building}</td><td class="rh">${fmt1(b.mw)}</td>${ms}</tr>`;
    }).join('');
    $('bd-table').innerHTML = `<thead>${head1}${head2}</thead><tbody>${body}</tbody>`;
    freezeColumns($('bd-table'), 5);
  }

  // Freeze the first n columns (the row headers) when the table scrolls sideways.
  function freezeColumns(table, n) {
    const first = table.querySelector('tbody tr') || table.querySelector('thead tr');
    if (!first) return;
    const lefts = [];
    let left = 0;
    for (let i = 0; i < n && i < first.cells.length; i++) { lefts.push(left); left += first.cells[i].offsetWidth; }
    table.querySelectorAll('tr').forEach((tr) => {
      // Header rows with rowspan cells line up with the first n body cells.
      if (tr.parentElement.tagName === 'THEAD' && tr !== table.tHead.rows[0]) return;
      for (let i = 0; i < lefts.length && i < tr.cells.length; i++) {
        tr.cells[i].classList.add('frozen');
        tr.cells[i].style.left = lefts[i] + 'px';
        if (i === lefts.length - 1) tr.cells[i].classList.add('frozen-last');
      }
    });
  }

  function byHierarchy(a, b) {
    return dcInfo.get(a.dataCenter).order - dcInfo.get(b.dataCenter).order || a.building.localeCompare(b.building);
  }

  // --- Schedule Matrix -------------------------------------------------------------------------
  // Active buildings only; each cell the milestone's plan date, grey when delivered, otherwise
  // in its status color. Hover a cell for the Milestone Tooltip.
  function renderSchedule(bs) {
    const list = bs.filter((b) => b.deliveryStatus === 'To Be Delivered').sort(byHierarchy);
    const head = `<tr>${['Area', 'Region', 'Data Center', 'Building'].map((h) => `<th class="rh" scope="col">${h}</th>`).join('')}${
      D.milestones.map((m) => `<th class="ctr" scope="col">${esc(m.label)}</th>`).join('')}</tr>`;
    let prev = [];
    const body = list.map((b) => {
      const keys = [dcInfo.get(b.dataCenter).area, b.region, b.dataCenter];
      let changed = false;
      const heads = keys.map((v, i) => { changed = changed || prev[i] !== v; return `<td class="rh txt">${changed ? esc(v) : ''}</td>`; }).join('');
      prev = keys;
      const cells = b.milestones.map((m, i) => {
        if (!m) return '<td></td>';
        const grey = m[3] === 'Grey';
        const style = grey ? `background:${DELIVERED_CELL};color:${DELIVERED_CELL}` : `color:${STATUS_COLOR[m[3]]}`;
        return `<td class="ctr sm-cell" style="${style}" data-b="${b.building}" data-m="${i}" tabindex="0"
          aria-label="${esc(D.milestones[i].name)}: plan ${fmtDate(m[0])}, actual or forecast ${fmtDate(m[1])}">${fmtDate(m[0])}</td>`;
      }).join('');
      return `<tr>${heads}<td class="rh txt">${b.building}</td>${cells}</tr>`;
    }).join('');
    $('sm-table').innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
    freezeColumns($('sm-table'), 4);
  }

  // The Milestone Tooltip: full name on top, Plan and Actual / Forecast side by side below.
  const byCode = new Map(D.buildings.map((b) => [b.building, b]));
  const tip = $('ms-tip');
  function showTip(cell) {
    const b = byCode.get(cell.dataset.b), i = Number(cell.dataset.m), m = b.milestones[i];
    tip.innerHTML = `<div class="ms-name">${esc(D.milestones[i].name)}</div>
      <div class="ms-dates"><div><b>${fmtDate(m[0])}</b><span>Plan</span></div><div><b>${fmtDate(m[1])}</b><span>Actual / Forecast</span></div></div>`;
    tip.hidden = false;
    const canvas = tip.parentElement.getBoundingClientRect(), r = cell.getBoundingClientRect();
    let left = r.left - canvas.left + r.width / 2 - tip.offsetWidth / 2;
    left = Math.max(8, Math.min(left, canvas.width - tip.offsetWidth - 8));
    const above = r.top - canvas.top - tip.offsetHeight - 8;
    tip.style.left = left + 'px';
    tip.style.top = (above > 0 ? above : r.bottom - canvas.top + 8) + 'px';
  }
  const smTable = $('sm-table');
  smTable.addEventListener('mouseover', (e) => { const c = e.target.closest('.sm-cell'); if (c) showTip(c); });
  smTable.addEventListener('mouseout', (e) => { if (e.target.closest('.sm-cell')) tip.hidden = true; });
  smTable.addEventListener('focusin', (e) => { const c = e.target.closest('.sm-cell'); if (c) showTip(c); });
  smTable.addEventListener('focusout', () => { tip.hidden = true; });

  // --- Pages (tabs) -----------------------------------------------------------------------------
  const TITLES = { overview: 'Capacity Delivery - Overview', schedule: 'Capacity Delivery - Schedule Matrix' };
  function currentPage() { return location.hash === '#schedule' ? 'schedule' : 'overview'; }
  function showPage() {
    const page = currentPage();
    ['overview', 'schedule'].forEach((p) => {
      $('page-' + p).hidden = p !== page;
      $('tab-' + p).setAttribute('aria-selected', String(p === page));
    });
    $('report-title').textContent = TITLES[page];
    tip.hidden = true;
    render();
  }
  window.addEventListener('hashchange', showPage);

  // --- Render -------------------------------------------------------------------------------------
  function render() {
    renderSlicer();
    const areaBs = D.buildings.filter(inArea);
    if (currentPage() === 'schedule') { renderSchedule(areaBs); return; }
    // The treemap and columns show the area; their selection cross-filters the tables.
    const sel = areaBs.filter(inSelection);
    renderColumns(areaBs);
    renderDcTable(sel);
    renderBuildingDetails(sel);
    renderTreemap(areaBs);
    // Once the layout has settled, size the treemap to its card exactly.
    requestAnimationFrame(() => renderTreemap(areaBs));
  }

  $('asof').textContent = fmtDate(D.asOf);
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 120); });
  showPage();
})();
