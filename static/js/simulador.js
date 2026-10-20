window.simState = {
  running:   false,
  paused:    false,
  elapsed:   0,
  tick:      0,
  speed:     1000,
  cpus:      1,
  hilos:     4,
  procesos:  [],
  pidCounter: 1,
  algoritmo: 'fcfs',
  quantum:   4,
  intervalo: null,
};

const SIM = window.simState;

function agregarProceso() {
  const nombre   = document.getElementById('f-nombre').value.trim() || ('P' + SIM.pidCounter);
  const prioridad= document.getElementById('f-prioridad').value;
  const rafaga   = parseInt(document.getElementById('f-rafaga').value) || 10;
  const llegada  = parseInt(document.getElementById('f-llegada').value) || 0;
  const memoria  = parseInt(document.getElementById('f-memoria').value) || 64;
  const tipo     = window._procesoTipo || 'cpu';

  const proceso = {
    pid:             SIM.pidCounter++,
    nombre,
    prioridad,
    rafaga,
    rafaga_original: rafaga,
    rafaga_restante: rafaga,
    llegada,
    memoria,
    tipo,
    estado:          'nuevo',
    tiempo_cpu:      0,
    cpu_uso:         0,
    te:              0,
    tr:              0,
    t_inicio:        null,
    t_fin:           null,
    t_espera_acum:   0,
    _idx:            SIM.procesos.length,
    _historial:      [],
  };

  SIM.procesos.push(proceso);
  document.getElementById('f-nombre').value = 'Proceso_' + SIM.pidCounter;
  renderProcessTable();
  updateReadyQueue(SIM.procesos);
  addEventoReciente('agregado al sistema', 'PID ' + proceso.pid);
}

function renderProcessTable() {
  const ids = ['process-table-body', 'procesos-full-tbody'];
  ids.forEach(id => {
    const tbody = document.getElementById(id);
    if (!tbody) return;
    if (SIM.procesos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10">
        <div class="empty-state"><div class="empty-icon">📭</div>No hay procesos.</div>
      </td></tr>`;
      return;
    }
    tbody.innerHTML = SIM.procesos.map(p => `
      <tr>
        <td class="td-mono">${p.pid}</td>
        <td style="font-weight:600;">${p.nombre}</td>
        <td>${getStateBadge(p.estado)}</td>
        <td>${getPrioBadge(p.prioridad)}</td>
        <td class="td-mono">${p.rafaga_original}ms</td>
        <td class="td-mono">${p.llegada}</td>
        <td class="td-mono">${p.memoria}MB</td>
        <td class="td-mono">${p.cpu_uso.toFixed(1)}%</td>
        <td class="td-mono">${Math.max(0,p.te).toFixed(0)}ms</td>
        <td class="td-mono">${p.tr.toFixed(0)}ms</td>
      </tr>
    `).join('');
  });
}

function togglePlay() {
  if (!SIM.running) {
    iniciarSimulacion();
  } else {
    togglePause();
  }
}

function togglePause() {
  if (!SIM.running) return;
  SIM.paused = !SIM.paused;
  document.getElementById('btn-play').textContent = SIM.paused ? '▶' : '⏸';
}

function setSpeed(val) {
  SIM.speed = parseInt(val);
  if (SIM.running) {
    clearInterval(SIM.intervalo);
    SIM.intervalo = setInterval(tickSimulacion, SIM.speed);
  }
}

function resetSim() {
  clearInterval(SIM.intervalo);
  SIM.running   = false;
  SIM.paused    = false;
  SIM.elapsed   = 0;
  SIM.tick      = 0;
  SIM.procesos  = [];
  SIM.pidCounter= 1;
  document.getElementById('btn-play').textContent = '▶';
  document.getElementById('timer-display').textContent = '00:00:00';
  document.getElementById('cpu-pct').textContent = '0%';
  renderProcessTable();
  updateReadyQueue([]);
  updateProcesoActual(null);
  updateStats({ te_promedio:0, tr_promedio:0, throughput:0, cpu_uso:0, activos:0, total:0, memoria_usada:0, memoria_total:1024 });
  if (window.ganttController) window.ganttController.reset();
  if (window.cpuDonutChart)   window.cpuDonutChart.reset();
  addEventoReciente('Simulación reiniciada', '');
}

function iniciarSimulacion() {
  if (SIM.procesos.length === 0) {
    alert('Agrega al menos un proceso antes de iniciar.');
    return;
  }
  SIM.running = true;
  SIM.paused  = false;
  document.getElementById('btn-play').textContent = '⏸';

  const algo = SIM.algoritmo;
  updateTopbarAlgo(
    esExpulsivo(algo) ? 'Expulsivo' : 'No Expulsivo',
    algo.toUpperCase().replace('_', ' ')
  );

  SIM.procesos.forEach(p => {
    if (p.estado === 'nuevo') p.estado = 'listo';
  });

  SIM.intervalo = setInterval(tickSimulacion, SIM.speed);
  addEventoReciente('Simulación iniciada con ' + algo.toUpperCase(), '');
}

function esExpulsivo(algo) {
  return ['round_robin','srt','prioridad_dinamica','mlfq','cfs','edf'].includes(algo);
}

function tickSimulacion() {
  if (SIM.paused) return;

  SIM.tick++;
  SIM.elapsed += SIM.speed;
  document.getElementById('timer-display').textContent = formatTime(SIM.elapsed);

  const listos = SIM.procesos.filter(p => p.estado === 'listo' && p.llegada <= SIM.tick);
  const ejecutando = SIM.procesos.find(p => p.estado === 'ejecutando');

  if (!ejecutando && listos.length === 0) {
    const pendientes = SIM.procesos.filter(p => p.estado !== 'terminado');
    if (pendientes.length === 0) {
      finalizarSimulacion();
      return;
    }
  }

  const seleccionado = seleccionarProceso(ejecutando, listos);

  SIM.procesos.forEach(p => {
    if (p.estado === 'ejecutando' && p !== seleccionado) {
      p.estado = 'listo';
      p.t_espera_acum = 0;
    }
    if (p.estado === 'listo' && p !== seleccionado) {
      p.te += SIM.speed;
    }
  });

  if (seleccionado) {
    if (seleccionado.t_inicio === null) seleccionado.t_inicio = SIM.tick;
    seleccionado.estado          = 'ejecutando';
    seleccionado.rafaga_restante = Math.max(0, seleccionado.rafaga_restante - 1);
    seleccionado.tiempo_cpu     += SIM.speed;
    seleccionado.cpu_uso         = (seleccionado.tiempo_cpu / SIM.elapsed) * 100;
    seleccionado._historial.push(SIM.tick);

    if (seleccionado.rafaga_restante <= 0) {
      seleccionado.estado = 'terminado';
      seleccionado.t_fin  = SIM.tick;
      seleccionado.tr     = (seleccionado.t_fin - seleccionado.llegada) * SIM.speed;
      seleccionado.te     = seleccionado.tr - seleccionado.rafaga_original * SIM.speed;
      addEventoReciente('terminó ejecución', seleccionado.nombre);
    }

    updateProcesoActual(seleccionado);

    if (window.ganttController) {
      window.ganttController.addBlock(seleccionado.nombre, seleccionado._idx, SIM.tick);
    }
  } else {
    updateProcesoActual(null);
    if (window.ganttController) {
      window.ganttController.addBlock('idle', -1, SIM.tick);
    }
  }

  const cpuUso = seleccionado ? 60 + Math.random() * 35 : Math.random() * 15;
  document.getElementById('cpu-pct').textContent = cpuUso.toFixed(0) + '%';
  if (window.cpuDonutChart) window.cpuDonutChart.update(cpuUso);

  calcularStats();
  renderProcessTable();
  updateReadyQueue(SIM.procesos);
}

function seleccionarProceso(ejecutando, listos) {
  const algo = SIM.algoritmo;
  const disponibles = SIM.procesos.filter(
    p => (p.estado === 'listo' || p.estado === 'ejecutando') && p.llegada <= SIM.tick
  );
  if (disponibles.length === 0) return null;

  switch (algo) {
    case 'fcfs':
      return disponibles.sort((a, b) => a.llegada - b.llegada)[0];

    case 'sjf':
      if (ejecutando && ejecutando.estado === 'ejecutando') return ejecutando;
      return disponibles.sort((a, b) => a.rafaga_restante - b.rafaga_restante)[0];

    case 'prioridad_estatica': {
      if (ejecutando && ejecutando.estado === 'ejecutando') return ejecutando;
      const pmap = { alta: 0, media: 1, baja: 2 };
      return disponibles.sort((a, b) => pmap[a.prioridad] - pmap[b.prioridad])[0];
    }

    case 'hrrn': {
      if (ejecutando && ejecutando.estado === 'ejecutando') return ejecutando;
      return disponibles.sort((a, b) => {
        const hrA = (a.te + a.rafaga_restante * SIM.speed) / (a.rafaga_restante * SIM.speed);
        const hrB = (b.te + b.rafaga_restante * SIM.speed) / (b.rafaga_restante * SIM.speed);
        return hrB - hrA;
      })[0];
    }

    case 'round_robin': {
      if (ejecutando && ejecutando.estado === 'ejecutando') {
        ejecutando.t_espera_acum = (ejecutando.t_espera_acum || 0) + 1;
        if (ejecutando.t_espera_acum < SIM.quantum) return ejecutando;
        ejecutando.t_espera_acum = 0;
        ejecutando.estado = 'listo';
      }
      const rr = disponibles.filter(p => p.estado === 'listo');
      return rr.length > 0 ? rr[0] : null;
    }

    case 'srt':
      return disponibles.sort((a, b) => a.rafaga_restante - b.rafaga_restante)[0];

    case 'prioridad_dinamica': {
      const pmap = { alta: 0, media: 1, baja: 2 };
      return disponibles.sort((a, b) => pmap[a.prioridad] - pmap[b.prioridad])[0];
    }

    case 'mlfq': {
      const pmap = { alta: 0, media: 1, baja: 2 };
      const sorted = disponibles.sort((a, b) => pmap[a.prioridad] - pmap[b.prioridad]);
      const top = sorted[0];
      if (ejecutando && ejecutando.estado === 'ejecutando') {
        if (pmap[ejecutando.prioridad] <= pmap[top.prioridad]) {
          ejecutando.t_espera_acum = (ejecutando.t_espera_acum || 0) + 1;
          if (ejecutando.t_espera_acum < SIM.quantum) return ejecutando;
          ejecutando.t_espera_acum = 0;
          if (ejecutando.prioridad === 'alta') ejecutando.prioridad = 'media';
          else if (ejecutando.prioridad === 'media') ejecutando.prioridad = 'baja';
        }
      }
      return top;
    }

    case 'cfs': {
      return disponibles.sort((a, b) => (a.tiempo_cpu || 0) - (b.tiempo_cpu || 0))[0];
    }

    case 'edf': {
      return disponibles.sort((a, b) =>
        (a.llegada + a.rafaga_original) - (b.llegada + b.rafaga_original)
      )[0];
    }

    default:
      return disponibles[0];
  }
}

function calcularStats() {
  const terminados = SIM.procesos.filter(p => p.estado === 'terminado');
  const todos      = SIM.procesos;
  const te_prom    = terminados.length
    ? terminados.reduce((s, p) => s + Math.max(0, p.te), 0) / terminados.length : 0;
  const tr_prom    = terminados.length
    ? terminados.reduce((s, p) => s + p.tr, 0) / terminados.length : 0;
  const throughput = SIM.elapsed > 0 ? terminados.length / (SIM.elapsed / 1000) : 0;
  const cpuUso     = todos.length
    ? todos.reduce((s, p) => s + p.cpu_uso, 0) / todos.length : 0;
  const memUsada   = todos.reduce((s, p) => s + (p.memoria || 0), 0);

  updateStats({
    te_promedio:    te_prom,
    tr_promedio:    tr_prom,
    throughput,
    cpu_uso:        cpuUso,
    activos:        todos.filter(p => p.estado !== 'terminado').length,
    total:          todos.length,
    memoria_usada:  memUsada,
    memoria_total:  1024,
  });
}

function finalizarSimulacion() {
  clearInterval(SIM.intervalo);
  SIM.running = false;
  document.getElementById('btn-play').textContent = '▶';
  addEventoReciente('Simulación finalizada', '✅');
}

function setAlgoritmo(algo) {
  SIM.algoritmo = algo;
  updateTopbarAlgo(
    esExpulsivo(algo) ? 'Expulsivo' : 'No Expulsivo',
    algo.toUpperCase().replace('_', ' ')
  );
}


// ─── PLANIFICACIÓN ─────────────────────────────────────────── esto es nuevoooooooo añadidoooooo
const PL_DESC = {
  fcfs:"Primero en llegar, primero en ser atendido. Sin expulsión.",
  sjf:"Elige el proceso con menor ráfaga disponible. Sin expulsión.",
  prioridad_estatica:"Ejecuta el de mayor prioridad disponible. Sin expulsión.",
  hrrn:"Ratio = (espera + ráfaga) / ráfaga. Elige el mayor. Sin expulsión.",
  round_robin:"Turno fijo (quantum) para cada proceso. Expulsivo.",
  srt:"SJF expulsivo: interrumpe si llega uno con menor ráfaga restante.",
  prioridad_dinamica:"Expulsa si llega proceso de mayor prioridad.",
  mlfq:"3 colas con quantum creciente. Degrada prioridad al agotar quantum.",
  cfs:"Linux: elige el de menor tiempo de CPU acumulado.",
  edf:"Tiempo real: elige el de deadline más próximo.",
};
const PL_EXPULSIVOS = ["round_robin","srt","prioridad_dinamica","mlfq","cfs","edf"];
const PL_COLORS = ["#6366f1","#22d3ee","#f59e0b","#10b981","#ef4444","#a78bfa","#fb923c","#34d399"];
let plPidCounter = 1, plChartBarras = null;

document.getElementById("pl-algoritmo")?.addEventListener("change", function() {
  document.getElementById("pl-quantum-group").style.display =
    PL_EXPULSIVOS.includes(this.value) ? "flex" : "none";
  document.getElementById("pl-algo-desc").textContent = PL_DESC[this.value] || "";
});
document.getElementById("pl-algoritmo")?.dispatchEvent(new Event("change"));

function plAgregarFila(p = {}) {
  const id = p.pid || `P${plPidCounter++}`;
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="form-input" style="width:52px;padding:4px 6px;" value="${id}"></td>
    <td><input class="form-input" style="width:80px;padding:4px 6px;" value="${p.nombre||id}"></td>
    <td><input class="form-input" type="number" style="width:60px;padding:4px 6px;" value="${p.llegada??0}" min="0"></td>
    <td><input class="form-input" type="number" style="width:60px;padding:4px 6px;" value="${p.rafaga??4}" min="1"></td>
    <td>
      <select class="form-select" style="padding:4px 6px;">
        <option value="1" ${p.prioridad==1?"selected":""}>Alta</option>
        <option value="2" ${!p.prioridad||p.prioridad==2?"selected":""}>Media</option>
        <option value="3" ${p.prioridad==3?"selected":""}>Baja</option>
      </select>
    </td>
    <td><input class="form-input" type="number" style="width:60px;padding:4px 6px;" value="${p.memoria??64}" min="0"></td>
    <td><button class="btn-icon btn-danger" onclick="this.closest('tr').remove()">✕</button></td>
  `;
  document.getElementById("pl-tbody").appendChild(tr);
}

function plCargarEjemplo() {
  document.getElementById("pl-tbody").innerHTML = "";
  plPidCounter = 1;
  [{pid:"P1",nombre:"Sistema",llegada:0,rafaga:6,prioridad:1},
   {pid:"P2",nombre:"Usuario",llegada:2,rafaga:4,prioridad:2},
   {pid:"P3",nombre:"IO Task",llegada:4,rafaga:2,prioridad:3},
   {pid:"P4",nombre:"Daemon", llegada:6,rafaga:8,prioridad:2}]
  .forEach(plAgregarFila);
}

function plGetProcesos() {
  return [...document.querySelectorAll("#pl-tbody tr")].map(tr => {
    const ins = tr.querySelectorAll("input");
    const sel = tr.querySelector("select");
    return {pid:ins[0].value, nombre:ins[1].value, llegada:+ins[2].value,
            rafaga:+ins[3].value, prioridad:+sel.value, memoria:+ins[4].value};
  });
}

async function plSimular() {
  const procesos = plGetProcesos();
  if (!procesos.length) return;
  const algoritmo = document.getElementById("pl-algoritmo").value;
  const quantum   = +document.getElementById("pl-quantum").value;

  const btn = document.getElementById("pl-btn-simular");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Simulando..."; }

  const res = await fetch("/api/simular", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({algoritmo, procesos, quantum})
  }).then(r => r.json());

  if (btn) { btn.disabled = false; btn.textContent = "▶ Simular"; }
  if (res.error) { alert(res.error); return; }

  plMostrarGantt(res.gantt, procesos);
  plMostrarStats(res);
  plMostrarTabla(res.tabla);
  plMostrarLog(res.log || []);
  plMostrarLineaTiempo(res.tabla, res.gantt);
}

function plColorPID(pid, procesos) {
  const i = procesos.findIndex(p => p.pid === pid);
  return PL_COLORS[i % PL_COLORS.length];
}

function plMostrarGantt(gantt, procesos) {
  const canvas = document.getElementById("pl-gantt-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = canvas.parentElement.offsetWidth || 800;
  canvas.height = 60 + procesos.length * 44;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!gantt.length) return;

  const total = gantt[gantt.length - 1].t + 1;
  const W = (canvas.width - 80) / total;
  const rowH = 36;
  const offsetX = 80;
  const offsetY = 20;

  const porProceso = {};
  procesos.forEach((p, i) => { porProceso[p.pid] = { idx: i, grupos: [] }; });

  let inicio = null, pidActual = null;
  gantt.forEach(({ pid, t }) => {
    if (pid !== pidActual) {
      if (pidActual !== null && porProceso[pidActual]) {
        porProceso[pidActual].grupos.push({ inicio, fin: t });
      }
      pidActual = pid;
      inicio = t;
    }
  });
  if (pidActual && porProceso[pidActual]) {
    porProceso[pidActual].grupos.push({ inicio, fin: gantt[gantt.length - 1].t + 1 });
  }

  // fondo filas
  procesos.forEach((p, i) => {
    ctx.fillStyle = i % 2 === 0
      ? getComputedStyle(document.documentElement).getPropertyValue('--bg-surface-2').trim()
      : getComputedStyle(document.documentElement).getPropertyValue('--bg-surface').trim();
    ctx.fillRect(offsetX, offsetY + i * (rowH + 8), canvas.width - offsetX, rowH);
  });

  // etiquetas
  ctx.font = "bold 12px Inter, sans-serif";
  ctx.textAlign = "right";
  procesos.forEach((p, i) => {
    ctx.fillStyle = PL_COLORS[i % PL_COLORS.length];
    ctx.fillText(p.pid, offsetX - 8, offsetY + i * (rowH + 8) + rowH / 2 + 4);
  });

  // bloques
  procesos.forEach((p, i) => {
    const data = porProceso[p.pid];
    if (!data) return;
    data.grupos.forEach(({ inicio, fin }) => {
      const x = offsetX + inicio * W;
      const w = Math.max((fin - inicio) * W - 2, 2);
      const y = offsetY + i * (rowH + 8);

      ctx.fillStyle = PL_COLORS[i % PL_COLORS.length];
      ctx.beginPath();
      ctx.roundRect(x, y, w, rowH, 4);
      ctx.fill();

      if (w > 24) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText(p.pid, x + w / 2, y + rowH / 2 + 4);
      }
    });
  });

  // ticks eje X
  ctx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--text-muted').trim() || "#888";
  ctx.font = "10px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  const step = total <= 20 ? 1 : total <= 50 ? 5 : 10;
  for (let t = 0; t <= total; t += step) {
    const x = offsetX + t * W;
    ctx.fillText(t, x, offsetY + procesos.length * (rowH + 8) + 14);
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--border').trim();
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + procesos.length * (rowH + 8));
    ctx.stroke();
  }

  // leyenda
  const legend = document.getElementById("pl-gantt-legend");
  if (legend) {
    legend.innerHTML = procesos.map((p, i) => `
      <span style="display:flex;align-items:center;gap:4px;">
        <span style="width:12px;height:12px;border-radius:3px;
          background:${PL_COLORS[i % PL_COLORS.length]};display:inline-block;"></span>
        <span style="font-size:11px;color:var(--text-secondary);">${p.pid} — ${p.nombre}</span>
      </span>
    `).join("");
  }
}

function plMostrarStats(res) {
  document.getElementById("pl-te-prom").textContent = res.te_promedio;
  document.getElementById("pl-tr-prom").textContent = res.tr_promedio;
  const n = res.tabla.length, fin = Math.max(...res.tabla.map(p => p.t_fin));
  document.getElementById("pl-throughput").textContent = fin > 0 ? (n/fin).toFixed(2) + " proc/u" : "—";
  if (plChartBarras) plChartBarras.destroy();
  plChartBarras = new Chart(document.getElementById("pl-chart-barras"), {
    type:"bar",
    data:{
      labels: res.tabla.map(p => p.pid),
      datasets:[
        {label:"TE", data:res.tabla.map(p=>p.te), backgroundColor:"#6366f1"},
        {label:"TR", data:res.tabla.map(p=>p.tr), backgroundColor:"#22d3ee"},
      ]
    },
    options:{responsive:true, plugins:{legend:{position:"top"}},
             scales:{y:{beginAtZero:true}}}
  });
}

function plMostrarTabla(tabla) {
  document.getElementById("pl-res-tbody").innerHTML = tabla.map(p => `
    <tr>
      <td class="td-mono">${p.pid}</td>
      <td>${p.nombre}</td>
      <td class="td-mono">${p.llegada}</td>
      <td class="td-mono">${p.rafaga}</td>
      <td class="td-mono">${p.t_inicio}</td>
      <td class="td-mono">${p.t_fin}</td>
      <td class="td-mono" style="color:#6366f1;font-weight:700;">${p.te}</td>
      <td class="td-mono" style="color:#22d3ee;font-weight:700;">${p.tr}</td>
    </tr>`).join("");
}


// ─── CONCURRENCIA ────────────────────────────────────────────
const CONC_DESC = {
  productor_consumidor:"Buffer limitado compartido. Semáforos <b>lleno</b> y <b>vacío</b> + mutex evitan condiciones de carrera entre productor y consumidor.",
  lectores_escritores:"Múltiples lectores acceden simultáneamente. El escritor necesita acceso exclusivo. Mutex + contador de lectores activos.",
  filosofos:"5 filósofos, 5 tenedores. Árbitro (semáforo n-1) evita deadlock permitiendo solo 4 filósofos a la vez.",
  barbero:"Sillas de espera limitadas. Barbero duerme sin clientes. Semáforos sincronizan llegada y atención.",
  fumadores:"Agente pone 2 ingredientes al azar. El fumador con el tercero puede fumar. Semáforos por ingrediente.",
};
const CONC_MEC = {
  productor_consumidor:["Sem. lleno","Sem. vacío","Mutex"],
  lectores_escritores: ["Mutex lectura","Sem. escritura","Contador lectores"],
  filosofos:           ["5 Sem. tenedores","Sem. árbitro"],
  barbero:             ["Sem. clientes","Sem. barbero","Mutex sillas"],
  fumadores:           ["Sem. tabaco","Sem. papel","Sem. fósforos"],
};
const CONC_COLORS = ["#6366f1","#22d3ee","#f59e0b","#10b981","#ef4444","#a78bfa","#fb923c"];
let concChart = null;

function concActualizarDesc() {
  const p = document.getElementById("conc-problema").value;
  document.getElementById("conc-desc").innerHTML = CONC_DESC[p] || "";
  document.getElementById("conc-mecanismos").innerHTML =
    (CONC_MEC[p]||[]).map(m =>
      `<span class="badge badge-ready">${m}</span>`).join("");
}
concActualizarDesc();

async function concSimular() {
  const problema   = document.getElementById("conc-problema").value;
  const n_segundos = +document.getElementById("conc-segundos").value;
  const btn = document.getElementById("conc-btn");
  btn.disabled = true; btn.textContent = "⏳ Simulando...";
  const res = await fetch("/api/concurrencia", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({problema, n_segundos})
  }).then(r => r.json());
  btn.disabled = false; btn.textContent = "▶ Simular";
  if (res.error) { alert(res.error); return; }
  concMostrarLogAnimado(res.log);
  concMostrarChart(res.log);
}

function concMostrarLog(log) {
  const colMap = {};
  let ci = 0;
  document.getElementById("conc-log-count").textContent = `${log.length} eventos`;
  document.getElementById("conc-log").innerHTML = log.map(e => {
    if (!colMap[e.actor]) colMap[e.actor] = CONC_COLORS[ci++ % CONC_COLORS.length];
    return `<div class="event-item">
      <span class="event-time">${e.t.toFixed(2)}s</span>
      <span style="font-weight:700;color:${colMap[e.actor]};min-width:110px;">${e.actor}</span>
      <span class="event-text">${e.evento}</span>
    </div>`;
  }).join("");
}

function concMostrarChart(log) {
  const actores = [...new Set(log.map(e => e.actor))];
  const counts  = actores.map(a => log.filter(e => e.actor === a).length);
  if (concChart) concChart.destroy();
  concChart = new Chart(document.getElementById("conc-chart"), {
    type:"bar",
    data:{
      labels: actores,
      datasets:[{label:"Eventos", data:counts,
        backgroundColor: actores.map((_,i) => CONC_COLORS[i % CONC_COLORS.length])}]
    },
    options:{responsive:true, plugins:{legend:{display:false}},
             scales:{y:{beginAtZero:true}}}
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const selPl = document.getElementById('pl-algoritmo');
  if (selPl) {
    selPl.addEventListener('change', function() {
      SIM.algoritmo = this.value;
    });
  }
  if (typeof concActualizarDesc === 'function') concActualizarDesc();
});


function concMostrarLogAnimado(log) {
  const contenedor = document.getElementById("conc-log");
  contenedor.innerHTML = "";
  document.getElementById("conc-log-count").textContent = `${log.length} eventos`;

  const colMap = {};
  const colores = ["#6366f1","#22d3ee","#f59e0b","#10b981","#ef4444","#a78bfa","#fb923c"];
  let ci = 0;

  log.forEach((e, i) => {
    if (!colMap[e.actor]) colMap[e.actor] = colores[ci++ % colores.length];
  });

  let i = 0;
  function mostrarSiguiente() {
    if (i >= log.length) return;
    const e = log[i++];

    const div = document.createElement("div");
    div.className = "event-item";
    div.style.opacity = "0";
    div.style.transform = "translateX(-10px)";
    div.style.transition = "all 0.25s ease";

    const esError = e.evento.includes("lleno") || e.evento.includes("deadlock") || e.evento.includes("se va");
    const esExito = e.evento.includes("fuma") || e.evento.includes("come") || e.evento.includes("atendido") || e.evento.includes("consume");

    div.innerHTML = `
      <span class="event-time">${e.t}s</span>
      <span style="font-weight:700;min-width:110px;color:${colMap[e.actor]};">${e.actor}</span>
      <span class="event-text" style="color:${
        esError ? 'var(--prio-high)' :
        esExito ? 'var(--state-running)' :
        'var(--text-secondary)'
      };">${e.evento}</span>
      ${e.buffer !== undefined
        ? `<span class="td-mono" style="font-size:11px;margin-left:auto;">buf:${e.buffer}</span>`
        : ''}
    `;

    contenedor.appendChild(div);
    contenedor.scrollTop = contenedor.scrollHeight;

    requestAnimationFrame(() => {
      div.style.opacity = "1";
      div.style.transform = "translateX(0)";
    });

    const delay = i < log.length ? Math.max(80, (log[i].t - e.t) * 300) : 0;
    setTimeout(mostrarSiguiente, delay);
  }

  mostrarSiguiente();
}

function plMostrarLog(log) {
  const terminal = document.getElementById("pl-terminal");
  if (!terminal) return;
  terminal.innerHTML = "";
  let i = 0;
  function siguiente() {
    if (i >= log.length) return;
    const linea = document.createElement("div");
    linea.style.cssText = "opacity:0;transform:translateY(4px);transition:all 0.15s ease;";
    const texto = log[i];
    const esTermina = texto.includes("termina");
    const esSelecciona = texto.includes("selecciona") || texto.includes("ejecuta") || texto.includes("CFS") || texto.includes("EDF");
    const esOciosa = texto.includes("ociosa") || texto.includes("ociosa");
    const esLlega = texto.includes("llega") || texto.includes("Entra");
    const esDegrada = texto.includes("degrada") || texto.includes("vuelve");
    linea.innerHTML = `<span style="color:${
      esTermina   ? '#4ade80' :
      esSelecciona? '#818cf8' :
      esOciosa    ? '#f87171' :
      esLlega     ? '#22d3ee' :
      esDegrada   ? '#fbbf24' :
      '#9099b8'
    };">${texto}</span>`;
    terminal.appendChild(linea);
    terminal.scrollTop = terminal.scrollHeight;
    requestAnimationFrame(() => {
      linea.style.opacity = "1";
      linea.style.transform = "translateY(0)";
    });
    i++;
    setTimeout(siguiente, 60);
  }
  siguiente();
}

function plMostrarLineaTiempo(tabla, gantt) {
  const contenedor = document.getElementById("pl-timeline");
  if (!contenedor || !tabla.length) return;
  const total = Math.max(...tabla.map(p => p.t_fin));
  const W = 100 / total;
  contenedor.innerHTML = tabla.map((p, idx) => {
    const color = PL_COLORS[idx % PL_COLORS.length];
    const bloques = [];
    let enEjecucion = false;
    let inicioBloque = 0;
    for (let t = 0; t <= total; t++) {
      const ejecutando = gantt.some(g => g.pid === p.pid && g.t === t);
      if (ejecutando && !enEjecucion) { inicioBloque = t; enEjecucion = true; }
      if (!ejecutando && enEjecucion) { bloques.push({inicio: inicioBloque, fin: t}); enEjecucion = false; }
    }
    if (enEjecucion) bloques.push({inicio: inicioBloque, fin: total});

    const barras = bloques.map(b => `
      <div style="position:absolute;left:${b.inicio*W}%;width:${(b.fin-b.inicio)*W}%;
        height:100%;background:${color};border-radius:2px;opacity:0.85;">
      </div>
    `).join('');

    const espera = p.t_inicio > p.llegada ? `
      <div style="position:absolute;left:${p.llegada*W}%;width:${(p.t_inicio-p.llegada)*W}%;
        height:100%;background:#3b82f6;border-radius:2px;opacity:0.5;">
      </div>
    ` : '';

    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="width:40px;font-size:11px;font-weight:700;color:${color};text-align:right;flex-shrink:0;">${p.pid}</span>
        <div style="flex:1;height:20px;background:var(--bg-surface-2);border-radius:3px;position:relative;border:1px solid var(--border);">
          ${espera}${barras}
        </div>
      </div>
    `;
  }).join('');

  const legend = `
    <div style="display:flex;gap:12px;margin-top:8px;font-size:11px;color:var(--text-muted);">
      <span><span style="display:inline-block;width:10px;height:10px;background:#6366f1;border-radius:2px;margin-right:4px;"></span>Ejecutando</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:#3b82f6;border-radius:2px;margin-right:4px;opacity:0.5;"></span>Esperando</span>
    </div>
  `;
  contenedor.insertAdjacentHTML('beforeend', legend);
}

function plEnviarAlSimulador() {
  const filas = plGetProcesos();
  if (!filas.length) return;
  
  SIM.procesos = [];
  SIM.pidCounter = 1;

  filas.forEach((p, i) => {
    SIM.procesos.push({
      pid:             SIM.pidCounter++,
      nombre:          p.nombre,
      prioridad:       p.prioridad == 1 ? 'alta' : p.prioridad == 3 ? 'baja' : 'media',
      rafaga:          p.rafaga,
      rafaga_original: p.rafaga,
      rafaga_restante: p.rafaga,
      llegada:         p.llegada,
      memoria:         p.memoria || 64,
      tipo:            'cpu',
      estado:          'nuevo',
      tiempo_cpu:      0,
      cpu_uso:         0,
      te:              0,
      tr:              0,
      t_inicio:        null,
      t_fin:           null,
      t_espera_acum:   0,
      _idx:            i,
      _historial:      [],
    });
  });

  renderProcessTable();
  updateReadyQueue(SIM.procesos);
  addEventoReciente('Procesos cargados desde Planificación', '📋');
  showPage('inicio');
}