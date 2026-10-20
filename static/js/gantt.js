window.ganttController = null;

function initGantt() {
  const container = document.getElementById('gantt-main');
  if (!container) return;

  const state = {
    mode:    'realtime',
    bloques: [],
    ticks:   0,
    maxTick: 60,
  };

  function getColorClass(idx) {
    if (idx < 0) return 'gantt-block-idle';
    return 'gantt-block-p' + ((idx % 8) + 1);
  }

  function render() {
    if (state.bloques.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📊</div>
        Inicia la simulación para ver el Gantt
      </div>`;
      return;
    }

    const procesos = {};
    state.bloques.forEach(b => {
      if (!procesos[b.nombre]) procesos[b.nombre] = { idx: b.idx, ticks: [] };
      procesos[b.nombre].ticks.push(b.tick);
    });

    const total = state.ticks || 1;
    const tickW = 100 / Math.max(total, state.maxTick);

    let html = '<div class="gantt-header">';
    const step = total <= 20 ? 1 : total <= 40 ? 2 : 5;
    for (let i = 0; i <= Math.min(total, state.maxTick); i += step) {
      html += `<div class="gantt-tick" style="min-width:${tickW * step}%;">${i}</div>`;
    }
    html += '</div>';

    Object.entries(procesos).forEach(([nombre, data]) => {
      const colorClass = getColorClass(data.idx);
      html += `<div class="gantt-row">
        <div class="gantt-label">
          <div class="gantt-dot ${colorClass}" style="border-radius:50%;width:8px;height:8px;
            background:var(--gantt-p${(data.idx % 8) + 1});"></div>
          ${nombre}
        </div>
        <div class="gantt-track">`;

      let grupos = [];
      let inicio = null;
      let prev   = null;

      data.ticks.sort((a, b) => a - b).forEach(t => {
        if (inicio === null) { inicio = t; prev = t; return; }
        if (t === prev + 1) { prev = t; return; }
        grupos.push({ inicio, fin: prev + 1 });
        inicio = t; prev = t;
      });
      if (inicio !== null) grupos.push({ inicio, fin: prev + 1 });

      grupos.forEach(g => {
        const left  = (g.inicio / Math.max(total, state.maxTick)) * 100;
        const width = ((g.fin - g.inicio) / Math.max(total, state.maxTick)) * 100;
        html += `<div class="gantt-block ${colorClass} animate"
          style="left:${left}%;width:${Math.max(width, 0.8)}%;"
          title="${nombre}: tick ${g.inicio}–${g.fin}">
          ${width > 4 ? nombre : ''}
        </div>`;
      });

      html += '</div></div>';
    });

    html += `<div class="gantt-cursor" id="gantt-cursor"
      style="left:${Math.min((state.ticks / Math.max(state.ticks, state.maxTick)) * 100, 100)}%;">
    </div>`;

    container.innerHTML = html;
    renderLegend(procesos);
    renderMetrics();
  }

  function renderLegend(procesos) {
    const legend = document.getElementById('gantt-legend');
    if (!legend) return;
    legend.innerHTML = Object.entries(procesos).map(([nombre, data]) => `
      <div class="gantt-legend-item">
        <div class="gantt-legend-color"
          style="background:var(--gantt-p${(data.idx % 8) + 1});"></div>
        ${nombre}
      </div>
    `).join('');
  }

  function renderMetrics() {
    const terminados = (window.simState?.procesos || []).filter(p => p.estado === 'terminado');
    if (terminados.length === 0) return;

    const te = terminados.reduce((s, p) => s + Math.max(0, p.te), 0) / terminados.length;
    const tr = terminados.reduce((s, p) => s + p.tr, 0) / terminados.length;

    let html = '<div class="gantt-metrics">';
    html += `<div class="gantt-metric-card">
      <div class="metric-val">${te.toFixed(1)}</div>
      <div class="metric-lbl">TE Promedio (ms)</div>
    </div>`;
    html += `<div class="gantt-metric-card">
      <div class="metric-val">${tr.toFixed(1)}</div>
      <div class="metric-lbl">TR Promedio (ms)</div>
    </div>`;
    html += `<div class="gantt-metric-card">
      <div class="metric-val">${terminados.length}</div>
      <div class="metric-lbl">Terminados</div>
    </div>`;
    html += `<div class="gantt-metric-card">
      <div class="metric-val">${state.ticks}</div>
      <div class="metric-lbl">Ticks totales</div>
    </div>`;
    html += '</div>';

    if (terminados.length > 0) {
      html += '<div class="table-wrapper" style="margin-top:14px;"><table class="gantt-table">';
      html += `<thead><tr>
        <th>Proceso</th><th>Llegada</th><th>Ráfaga</th>
        <th>T. Inicio</th><th>T. Fin</th><th>TR</th><th>TE</th>
      </tr></thead><tbody>`;
      terminados.forEach(p => {
        html += `<tr>
          <td style="font-weight:600;">${p.nombre}</td>
          <td>${p.llegada}</td>
          <td>${p.rafaga_original}</td>
          <td>${p.t_inicio ?? '—'}</td>
          <td>${p.t_fin ?? '—'}</td>
          <td>${p.tr.toFixed(0)} ms</td>
          <td>${Math.max(0, p.te).toFixed(0)} ms</td>
        </tr>`;
      });
      const avgTE = terminados.reduce((s, p) => s + Math.max(0, p.te), 0) / terminados.length;
      const avgTR = terminados.reduce((s, p) => s + p.tr, 0) / terminados.length;
      html += `<tr class="avg-row">
        <td colspan="5">Promedio</td>
        <td>${avgTR.toFixed(1)} ms</td>
        <td>${avgTE.toFixed(1)} ms</td>
      </tr>`;
      html += '</tbody></table></div>';
    }

    const existing = container.querySelector('.gantt-metrics');
    if (existing) existing.remove();
    const existingTable = container.querySelector('.table-wrapper');
    if (existingTable) existingTable.remove();
    container.insertAdjacentHTML('beforeend', html);
  }

  window.ganttController = {
    addBlock(nombre, idx, tick) {
      state.bloques.push({ nombre, idx, tick });
      state.ticks = tick;
      if (state.mode === 'realtime') render();
    },
    setMode(mode) {
      state.mode = mode;
      if (mode === 'full' || mode === 'step') render();
    },
    reset() {
      state.bloques = [];
      state.ticks   = 0;
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📊</div>
        Inicia la simulación para ver el Gantt
      </div>`;
      const legend = document.getElementById('gantt-legend');
      if (legend) legend.innerHTML = '';
    },
    render,
  };
}

document.addEventListener('DOMContentLoaded', initGantt);