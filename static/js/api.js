const API = {
  base: '',

  async get(endpoint) {
    try {
      const res = await fetch(API.base + endpoint);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('API GET error:', e);
      return null;
    }
  },

  async post(endpoint, data) {
    try {
      const res = await fetch(API.base + endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('API POST error:', e);
      return null;
    }
  },

  async simularAlgoritmo(algoritmo, procesos, quantum) {
    return await API.post('/api/simular', { algoritmo, procesos, quantum });
  },

  async getEstado() {
    return await API.get('/api/estado');
  },

  async resetear() {
    return await API.post('/api/reset', {});
  },
};

async function cargarResultadosBackend(algoritmo) {
  const procesos = window.simState.procesos.map(p => ({
    pid:      p.pid,
    nombre:   p.nombre,
    llegada:  p.llegada,
    rafaga:   p.rafaga_original,
    prioridad: p.prioridad === 'alta' ? 1 : p.prioridad === 'media' ? 2 : 3,
    memoria:  p.memoria,
    tipo:     p.tipo,
  }));

  if (procesos.length === 0) return null;

  const resultado = await API.simularAlgoritmo(
    algoritmo,
    procesos,
    window.simState.quantum
  );

  if (!resultado) return null;

  if (resultado.procesos) {
    resultado.procesos.forEach(rp => {
      const local = window.simState.procesos.find(p => p.pid === rp.pid);
      if (local) {
        local.te = rp.te;
        local.tr = rp.tr;
        local.t_inicio = rp.t_inicio;
        local.t_fin    = rp.t_fin;
      }
    });
  }

  return resultado;
}

function syncAlgoritmoSelect() {
  const sel = document.getElementById('algo-select');
  if (sel) {
    sel.addEventListener('change', () => {
      setAlgoritmo(sel.value);
    });
  }

  const quantumInput = document.getElementById('quantum-input');
  if (quantumInput) {
    quantumInput.addEventListener('change', () => {
      window.simState.quantum = parseInt(quantumInput.value) || 4;
    });
  }
}

document.addEventListener('DOMContentLoaded', syncAlgoritmoSelect);