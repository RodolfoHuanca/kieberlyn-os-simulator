const PAGES = ['inicio','procesos','planificacion','gantt','hilos','concurrencia','recursos','configuracion'];

function showPage(name) {
  PAGES.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById('page-' + name);
  if (target) target.style.display = 'grid';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(el => {
    if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(name)) {
      el.classList.add('active');
    }
  });

  // ── init páginas ──
  if (name === 'planificacion' && document.getElementById('pl-tbody')?.children.length === 0)
    plCargarEjemplo();
  if (name === 'concurrencia')
    concActualizarDesc();
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.querySelector('.theme-toggle').textContent = isDark ? '🌙' : '☀️';
  if (window.cpuDonutChart) updateDonutTheme();
}

function setTipo(tipo) {
  document.getElementById('tipo-cpu').classList.toggle('active', tipo === 'cpu');
  document.getElementById('tipo-io').classList.toggle('active',  tipo === 'io');
  window._procesoTipo = tipo;
}

function ajustarCPU(delta) {
  const el = document.getElementById('param-cpus');
  let v = parseInt(el.textContent) + delta;
  v = Math.max(1, Math.min(8, v));
  el.textContent = v;
  document.getElementById('badge-cpus').textContent = 'CPU(s): ' + v;
  if (window.simState) window.simState.cpus = v;
}

function ajustarHilos(delta) {
  const el = document.getElementById('param-hilos');
  let v = parseInt(el.textContent) + delta;
  v = Math.max(1, Math.min(32, v));
  el.textContent = v;
  document.getElementById('badge-hilos').textContent = 'Hilos: ' + v;
  if (window.simState) window.simState.hilos = v;
}

function setConcMode(mode) {
  document.querySelectorAll('.toggle-group .toggle-btn').forEach((btn, i) => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
}

function setGanttMode(mode) {
  if (window.ganttController) window.ganttController.setMode(mode);
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return [h, m % 60, s % 60].map(x => String(x).padStart(2, '0')).join(':');
}

function formatMs(val) {
  return val > 0 ? val.toFixed(1) + ' ms' : '0 ms';
}

function getProcessColor(index) {
  const colors = [
    'var(--gantt-p1)', 'var(--gantt-p2)', 'var(--gantt-p3)', 'var(--gantt-p4)',
    'var(--gantt-p5)', 'var(--gantt-p6)', 'var(--gantt-p7)', 'var(--gantt-p8)'
  ];
  return colors[index % colors.length];
}

function getStateBadge(state) {
  const map = {
    'ejecutando': '<span class="badge badge-running">Ejecutando</span>',
    'listo':      '<span class="badge badge-ready">Listo</span>',
    'bloqueado':  '<span class="badge badge-blocked">Bloqueado</span>',
    'nuevo':      '<span class="badge badge-new">Nuevo</span>',
    'terminado':  '<span class="badge badge-finished">Terminado</span>',
  };
  return map[state] || '<span class="badge">' + state + '</span>';
}

function getPrioBadge(prio) {
  const map = {
    'alta':  '<span class="badge badge-prio-high">Alta</span>',
    'media': '<span class="badge badge-prio-medium">Media</span>',
    'baja':  '<span class="badge badge-prio-low">Baja</span>',
  };
  return map[prio] || '<span class="badge">' + prio + '</span>';
}

function updateTopbarAlgo(tipo, algo) {
  const dotTipo = document.getElementById('dot-tipo');
  const dotExp  = document.getElementById('dot-expulsivo');
  document.getElementById('badge-tipo').textContent = tipo || 'Planificación';
  document.getElementById('badge-expulsivo').textContent = algo || 'Algoritmo';
  if (dotTipo) dotTipo.style.background = tipo === 'Expulsivo'
    ? 'var(--prio-high)' : 'var(--state-ready)';
  if (dotExp) dotExp.style.background = 'var(--prio-medium)';
}

function addEventoReciente(texto, pid) {
  const list = document.getElementById('eventos-list');
  if (!list) return;
  const empty = list.querySelector('.empty-state');
  if (empty) empty.remove();
  const time = formatTime(window.simState ? window.simState.elapsed : 0);
  const item = document.createElement('div');
  item.className = 'event-item';
  item.innerHTML = `
    <span class="event-time">${time}</span>
    <span class="event-text"><strong>${pid || ''}</strong> ${texto}</span>
  `;
  list.prepend(item);
  const items = list.querySelectorAll('.event-item');
  if (items.length > 8) items[items.length - 1].remove();
}

function updateReadyQueue(procesos) {
  const list = document.getElementById('cola-listos-list');
  const count = document.getElementById('ready-count');
  if (!list) return;
  const listos = procesos.filter(p => p.estado === 'listo');
  count.textContent = listos.length;
  if (listos.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div>Cola vacía</div>';
    return;
  }
  list.innerHTML = listos.map((p, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
      <div style="width:10px;height:10px;border-radius:50%;background:${getProcessColor(p._idx)};flex-shrink:0;"></div>
      <span style="font-size:12px;font-weight:600;color:var(--text-primary);">${p.nombre}</span>
      <span class="td-mono" style="font-size:11px;margin-left:auto;">PID ${p.pid}</span>
    </div>
  `).join('');
}

function updateProcesoActual(proceso) {
  const empty = document.getElementById('proceso-actual-empty');
  const info  = document.getElementById('proceso-actual-info');
  if (!proceso) {
    empty.style.display = 'block';
    info.style.display  = 'none';
    return;
  }
  empty.style.display = 'none';
  info.style.display  = 'flex';
  document.getElementById('pa-pid').textContent      = proceso.pid;
  document.getElementById('pa-nombre').textContent   = proceso.nombre;
  document.getElementById('pa-prioridad').innerHTML  = getPrioBadge(proceso.prioridad);
  document.getElementById('pa-cpu').textContent      = (proceso.cpu_uso || 0).toFixed(1) + '%';
  document.getElementById('pa-tiempo').textContent   = formatTime(proceso.tiempo_cpu || 0);
  document.getElementById('pa-rafaga').textContent   = (proceso.rafaga_restante || 0) + ' ms';
}

function updateStats(stats) {
  if (!stats) return;
  document.getElementById('stat-te').textContent         = formatMs(stats.te_promedio);
  document.getElementById('stat-tr').textContent         = formatMs(stats.tr_promedio);
  document.getElementById('stat-throughput').textContent = (stats.throughput || 0).toFixed(2) + ' proc/s';
  document.getElementById('stat-cpu-pct').textContent    = (stats.cpu_uso || 0).toFixed(1) + '%';
  document.getElementById('stat-activos').textContent    =
    (stats.activos || 0) + ' / ' + (stats.total || 0);
  const mem = stats.memoria_usada || 0;
  const memMax = stats.memoria_total || 1024;
  document.getElementById('stat-mem').textContent =
    mem + ' MB / ' + memMax + ' MB';
  document.getElementById('mem-bar').style.width =
    Math.min(100, (mem / memMax) * 100) + '%';
}

window._procesoTipo = 'cpu';

document.addEventListener('DOMContentLoaded', () => {
  showPage('inicio');
});