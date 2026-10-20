window.concurrenciaController = null;

const PROBLEMAS = {
  productor_consumidor: {
    nombre: 'Productor - Consumidor',
    descripcion: 'Un productor genera items y un consumidor los procesa usando un buffer compartido.',
    recursos: ['Buffer'],
    actores: ['Productor', 'Consumidor'],
  },
  lectores_escritores: {
    nombre: 'Lectores - Escritores',
    descripcion: 'Múltiples lectores pueden leer simultáneamente, pero un escritor necesita acceso exclusivo.',
    recursos: ['Base de datos'],
    actores: ['Lector 1', 'Lector 2', 'Escritor'],
  },
  filosofos: {
    nombre: 'Filósofos Comensales',
    descripcion: '5 filósofos comparten 5 tenedores. Necesitan 2 para comer, generando riesgo de deadlock.',
    recursos: ['Tenedor 1','Tenedor 2','Tenedor 3','Tenedor 4','Tenedor 5'],
    actores: ['F1','F2','F3','F4','F5'],
  },
  barbero: {
    nombre: 'Barbero Dormilón',
    descripcion: 'El barbero duerme si no hay clientes. Los clientes esperan si hay sillas disponibles.',
    recursos: ['Silla barbero', 'Sala espera'],
    actores: ['Barbero', 'Cliente 1', 'Cliente 2', 'Cliente 3'],
  },
  fumadores: {
    nombre: 'Fumadores',
    descripcion: 'Tres fumadores necesitan 3 ingredientes. El agente provee 2 al azar cada vez.',
    recursos: ['Tabaco', 'Papel', 'Fósforos'],
    actores: ['Fumador 1', 'Fumador 2', 'Fumador 3', 'Agente'],
  },
};

let concState = {
  problema:  'productor_consumidor',
  running:   false,
  intervalo: null,
  tick:      0,
  actores:   [],
  recursos:  [],
  eventos:   [],
  sinSync:   false,
};

function initConcurrencia() {
  window.concurrenciaController = {
    setProblema(p) { setConcProblema(p); },
    start()  { startConcSim(); },
    stop()   { stopConcSim(); },
    reset()  { resetConcSim(); },
    setSinSync(v) { concState.sinSync = v; },
  };
}

function setConcProblema(p) {
  concState.problema = p;
  const def = PROBLEMAS[p];
  if (!def) return;

  concState.actores  = def.actores.map((nombre, i) => ({
    id: i, nombre, estado: 'esperando', recurso: null, cpu: 0, tick_inicio: 0,
  }));
  concState.recursos = def.recursos.map((nombre, i) => ({
    id: i, nombre, libre: true, dueño: null,
  }));
  concState.eventos  = [];
  concState.tick     = 0;
  renderConcPanel();
}

function startConcSim() {
  if (concState.running) return;
  concState.running  = true;
  concState.intervalo = setInterval(tickConc, 1000);
}

function stopConcSim() {
  concState.running = false;
  clearInterval(concState.intervalo);
}

function resetConcSim() {
  stopConcSim();
  setConcProblema(concState.problema);
}

function tickConc() {
  concState.tick++;
  const { problema, actores, recursos, sinSync } = concState;

  switch (problema) {
    case 'productor_consumidor': tickPC(actores, recursos, sinSync); break;
    case 'lectores_escritores':  tickLE(actores, recursos, sinSync); break;
    case 'filosofos':            tickFilosofos(actores, recursos, sinSync); break;
    case 'barbero':              tickBarbero(actores, recursos, sinSync); break;
    case 'fumadores':            tickFumadores(actores, recursos, sinSync); break;
  }

  renderConcPanel();
}

function tickPC(actores, recursos, sinSync) {
  const buffer   = recursos[0];
  const productor = actores[0];
  const consumidor = actores[1];

  if (sinSync) {
    productor.estado  = Math.random() > 0.3 ? 'produciendo' : 'esperando';
    consumidor.estado = Math.random() > 0.3 ? 'consumiendo' : 'esperando';
    if (productor.estado === 'produciendo' && consumidor.estado === 'consumiendo') {
      addConcEvento('⚠️ Race condition detectada', 'danger');
      buffer.libre = false;
      buffer.dueño = 'CONFLICTO';
    }
    return;
  }

  if (productor.estado === 'esperando' && buffer.libre) {
    buffer.libre    = false;
    buffer.dueño    = productor.nombre;
    productor.estado = 'produciendo';
    addConcEvento('Productor tomó el buffer', 'info');
  } else if (productor.estado === 'produciendo') {
    productor.estado = 'esperando';
    buffer.libre    = true;
    buffer.dueño    = null;
    addConcEvento('Productor liberó el buffer', 'success');
  }

  if (consumidor.estado === 'esperando' && buffer.libre) {
    buffer.libre     = false;
    buffer.dueño     = consumidor.nombre;
    consumidor.estado = 'consumiendo';
    addConcEvento('Consumidor tomó el buffer', 'info');
  } else if (consumidor.estado === 'consumiendo') {
    consumidor.estado = 'esperando';
    buffer.libre     = true;
    buffer.dueño     = null;
    addConcEvento('Consumidor liberó el buffer', 'success');
  }
}

function tickLE(actores, recursos, sinSync) {
  const db = recursos[0];
  actores.forEach(actor => {
    const esEscritor = actor.nombre.includes('Escritor');
    if (sinSync) {
      actor.estado = Math.random() > 0.5
        ? (esEscritor ? 'escribiendo' : 'leyendo') : 'esperando';
      const escritores = actores.filter(a => a.estado === 'escribiendo');
      const lectores   = actores.filter(a => a.estado === 'leyendo');
      if (escritores.length > 0 && lectores.length > 0) {
        addConcEvento('⚠️ Escritor y lector simultáneos — Race condition', 'danger');
      }
      return;
    }
    if (esEscritor) {
      if (actor.estado === 'esperando' && db.libre) {
        db.libre    = false;
        db.dueño    = actor.nombre;
        actor.estado = 'escribiendo';
        addConcEvento(actor.nombre + ' accedió (exclusivo)', 'info');
      } else if (actor.estado === 'escribiendo') {
        actor.estado = 'esperando';
        db.libre    = true;
        db.dueño    = null;
        addConcEvento(actor.nombre + ' liberó la DB', 'success');
      }
    } else {
      if (actor.estado === 'esperando' && (db.libre || db.dueño?.includes('Lector'))) {
        actor.estado = 'leyendo';
        db.dueño    = 'Lectores';
        addConcEvento(actor.nombre + ' leyendo (compartido)', 'info');
      } else if (actor.estado === 'leyendo' && Math.random() > 0.6) {
        actor.estado = 'esperando';
        addConcEvento(actor.nombre + ' terminó lectura', 'success');
        const aun = actores.filter(a => a.estado === 'leyendo');
        if (aun.length === 0) { db.libre = true; db.dueño = null; }
      }
    }
  });
}

function tickFilosofos(actores, recursos, sinSync) {
  actores.forEach((f, i) => {
    const izq = recursos[i];
    const der = recursos[(i + 1) % 5];

    if (sinSync) {
      if (f.estado === 'esperando' && Math.random() > 0.5) {
        izq.libre = false; izq.dueño = f.nombre;
        der.libre = false; der.dueño = f.nombre;
        f.estado  = 'comiendo';
        addConcEvento(f.nombre + ' tomó ambos tenedores', 'info');
      } else if (f.estado === 'comiendo') {
        f.estado = 'pensando';
        addConcEvento(f.nombre + ' terminó de comer', 'success');
      } else {
        f.estado = 'esperando';
      }
      const deadlock = actores.every(a => a.estado === 'esperando')
        && recursos.every(r => !r.libre);
      if (deadlock) addConcEvento('💀 DEADLOCK detectado entre filósofos', 'danger');
      return;
    }

    if (f.estado === 'esperando' && izq.libre && der.libre) {
      izq.libre = false; izq.dueño = f.nombre;
      der.libre = false; der.dueño = f.nombre;
      f.estado  = 'comiendo';
      addConcEvento(f.nombre + ' come (tenedores ' + i + ' y ' + ((i+1)%5) + ')', 'info');
    } else if (f.estado === 'comiendo') {
      izq.libre = true; izq.dueño = null;
      der.libre = true; der.dueño = null;
      f.estado  = 'pensando';
      addConcEvento(f.nombre + ' liberó tenedores', 'success');
    } else if (f.estado === 'pensando' && Math.random() > 0.5) {
      f.estado = 'esperando';
    }
  });
}

function tickBarbero(actores, recursos, sinSync) {
  const barbero  = actores[0];
  const clientes = actores.slice(1);
  const silla    = recursos[0];
  const espera   = recursos[1];

  const clienteEsperando = clientes.find(c => c.estado === 'esperando');

  if (barbero.estado === 'durmiendo' && clienteEsperando) {
    barbero.estado         = 'cortando';
    clienteEsperando.estado = 'siendo_atendido';
    silla.libre = false; silla.dueño = clienteEsperando.nombre;
    addConcEvento('Barbero despertó para ' + clienteEsperando.nombre, 'info');
  } else if (barbero.estado === 'cortando') {
    barbero.estado = 'durmiendo';
    const atendido = clientes.find(c => c.estado === 'siendo_atendido');
    if (atendido) {
      atendido.estado = 'listo';
      addConcEvento(atendido.nombre + ' fue atendido', 'success');
    }
    silla.libre = true; silla.dueño = null;
  } else if (!clienteEsperando) {
    barbero.estado = 'durmiendo';
    addConcEvento('Barbero se durmió (sin clientes)', 'info');
  }

  clientes.forEach(c => {
    if (c.estado === 'listo' && Math.random() > 0.7) c.estado = 'esperando';
  });
}

function tickFumadores(actores, recursos, sinSync) {
  const agente    = actores[actores.length - 1];
  const fumadores = actores.slice(0, 3);

  if (agente.estado === 'esperando') {
    const r1 = Math.floor(Math.random() * 3);
    let r2 = Math.floor(Math.random() * 3);
    while (r2 === r1) r2 = Math.floor(Math.random() * 3);
    recursos.forEach((r, i) => { r.libre = (i === r1 || i === r2); });
    agente.estado = 'proveyendo';
    addConcEvento('Agente colocó: ' + recursos[r1].nombre + ' + ' + recursos[r2].nombre, 'info');
    const necesita = fumadores.find((_, i) => i !== r1 && i !== r2);
    if (necesita) {
      necesita.estado = 'fumando';
      addConcEvento(necesita.nombre + ' puede fumar', 'success');
    }
  } else {
    agente.estado = 'esperando';
    fumadores.forEach(f => { if (f.estado === 'fumando') f.estado = 'esperando'; });
    recursos.forEach(r => { r.libre = false; r.dueño = null; });
  }
}

function addConcEvento(texto, tipo) {
  concState.eventos.unshift({ texto, tipo, tick: concState.tick });
  if (concState.eventos.length > 10) concState.eventos.pop();
  addEventoReciente(texto, '🔄');
}

function renderConcPanel() {
  const recursosList = document.getElementById('recursos-list');
  const eventosList  = document.getElementById('eventos-list');
  if (!recursosList) return;

  recursosList.innerHTML = concState.recursos.map(r => `
    <div class="resource-item">
      <span style="font-size:12.5px;">${r.nombre}</span>
      <div style="display:flex;align-items:center;gap:6px;">
        ${r.dueño ? `<span style="font-size:11px;color:var(--text-muted);">${r.dueño}</span>` : ''}
        <span class="resource-status ${r.libre ? 'resource-free' : 'resource-busy'}">
          ${r.libre ? 'Libre' : 'Ocupado'}
        </span>
      </div>
    </div>
  `).join('');

  if (eventosList) {
    if (concState.eventos.length === 0) {
      eventosList.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Sin eventos aún</div>';
      return;
    }
    eventosList.innerHTML = concState.eventos.slice(0, 6).map(e => `
      <div class="event-item">
        <span class="event-time">t=${e.tick}</span>
        <span class="event-text" style="color:${
          e.tipo === 'danger'  ? 'var(--prio-high)'  :
          e.tipo === 'success' ? 'var(--state-running)' : 'var(--text-secondary)'
        };">${e.texto}</span>
      </div>
    `).join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initConcurrencia();
  setConcProblema('productor_consumidor');
});