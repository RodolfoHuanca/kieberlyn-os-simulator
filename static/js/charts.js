window.cpuDonutChart = null;

function initDonut() {
  const canvas = document.getElementById('cpu-donut');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 110;
  canvas.width  = size;
  canvas.height = size;

  let currentVal = 0;
  let targetVal  = 0;
  let animFrame  = null;

  function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function draw(val) {
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;
    const r  = 42;
    const lw = 10;
    const start = -Math.PI / 2;
    const end   = start + (val / 100) * 2 * Math.PI;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.strokeStyle = getCSSVar('--bg-hover');
    ctx.lineWidth   = lw;
    ctx.stroke();

    if (val > 0) {
      const color = val > 85
        ? getCSSVar('--cpu-high')
        : val > 60
          ? getCSSVar('--cpu-mid')
          : getCSSVar('--cpu-bar');

      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end);
      ctx.strokeStyle = color;
      ctx.lineWidth   = lw;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }

    document.getElementById('cpu-pct').textContent = Math.round(val) + '%';
    document.getElementById('stat-cpu-pct').textContent = Math.round(val) + '%';
  }

  function animate() {
    const diff = targetVal - currentVal;
    if (Math.abs(diff) < 0.3) {
      currentVal = targetVal;
      draw(currentVal);
      animFrame = null;
      return;
    }
    currentVal += diff * 0.12;
    draw(currentVal);
    animFrame = requestAnimationFrame(animate);
  }

  window.cpuDonutChart = {
    update(val) {
      targetVal = Math.max(0, Math.min(100, val));
      if (!animFrame) animFrame = requestAnimationFrame(animate);
    },
    reset() {
      targetVal  = 0;
      currentVal = 0;
      draw(0);
    }
  };

  draw(0);
}

function updateDonutTheme() {
  if (window.cpuDonutChart) {
    window.cpuDonutChart.update(
      parseFloat(document.getElementById('cpu-pct').textContent) || 0
    );
  }
}

window.miniCharts = {};

function initMiniChart(canvasId, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx  = canvas.getContext('2d');
  const data = [];
  const MAX  = 30;
  canvas.width  = 80;
  canvas.height = 28;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (data.length < 2) return;

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const w = canvas.width  / (MAX - 1);
    const h = canvas.height;

    ctx.beginPath();
    data.forEach((v, i) => {
      const x = i * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color || 'var(--accent)';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.stroke();
  }

  window.miniCharts[canvasId] = {
    push(val) {
      data.push(val);
      if (data.length > MAX) data.shift();
      draw();
    },
    reset() {
      data.length = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
}

function initAllMiniCharts() {
  const configs = [
    { id: 'mini-te',         color: '#ef4444' },
    { id: 'mini-tr',         color: '#3b82f6' },
    { id: 'mini-throughput', color: '#22c55e' },
    { id: 'mini-cpu',        color: '#6366f1' },
    { id: 'mini-mem',        color: '#06b6d4' },
  ];
  configs.forEach(c => initMiniChart(c.id, c.color));
}

function pushMiniCharts(stats) {
  if (!stats) return;
  if (window.miniCharts['mini-te'])
    window.miniCharts['mini-te'].push(stats.te_promedio || 0);
  if (window.miniCharts['mini-tr'])
    window.miniCharts['mini-tr'].push(stats.tr_promedio || 0);
  if (window.miniCharts['mini-throughput'])
    window.miniCharts['mini-throughput'].push(stats.throughput || 0);
  if (window.miniCharts['mini-cpu'])
    window.miniCharts['mini-cpu'].push(stats.cpu_uso || 0);
  if (window.miniCharts['mini-mem'])
    window.miniCharts['mini-mem'].push(
      stats.memoria_total ? (stats.memoria_usada / stats.memoria_total) * 100 : 0
    );
}

document.addEventListener('DOMContentLoaded', () => {
  initDonut();
  initAllMiniCharts();
});