/* ═══════════════════════════════════════════════════
   GASTOS DIARIOS — app.js
   Ajusta API_URL con la URL de tu backend en Railway
════════════════════════════════════════════════════ */

const API_URL = 'https://gastos-backend-production-fa36.up.railway.app/api'; // ← cambia esto

// ── Estado global ─────────────────────────────────
let token     = localStorage.getItem('gd_token') || null;
let usuario   = JSON.parse(localStorage.getItem('gd_usuario') || 'null');
let editId    = null;
let chartDonut = null, chartBar = null, chartLine = null;

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Helpers ───────────────────────────────────────
const fmt = n => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0
}).format(n);

const fmtFecha = d => {
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
};

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API_URL + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

function showError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}
function hideError(elId) {
  document.getElementById(elId).classList.add('hidden');
}

// ── Auth ──────────────────────────────────────────
function saveSession(data) {
  token   = data.token;
  usuario = data.usuario;
  localStorage.setItem('gd_token', token);
  localStorage.setItem('gd_usuario', JSON.stringify(usuario));
}

function logout() {
  token = null; usuario = null;
  localStorage.removeItem('gd_token');
  localStorage.removeItem('gd_usuario');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('panel-login').classList.add('active');
  document.getElementById('panel-register').classList.remove('active');
}

document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) return showError('login-error', 'Completa todos los campos');
  try {
    document.getElementById('btn-login').textContent = 'Ingresando…';
    const data = await api('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password: pass })
    });
    saveSession(data);
    initApp();
  } catch (e) {
    showError('login-error', e.message);
  } finally {
    document.getElementById('btn-login').textContent = 'Iniciar sesión';
  }
});

document.getElementById('btn-register').addEventListener('click', async () => {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email  = document.getElementById('reg-email').value.trim();
  const pass   = document.getElementById('reg-pass').value;
  if (!nombre || !email || !pass) return showError('reg-error', 'Completa todos los campos');
  if (pass.length < 6) return showError('reg-error', 'La contraseña debe tener al menos 6 caracteres');
  try {
    document.getElementById('btn-register').textContent = 'Creando cuenta…';
    const data = await api('/auth/register', {
      method: 'POST', body: JSON.stringify({ nombre, email, password: pass })
    });
    saveSession(data);
    initApp();
  } catch (e) {
    showError('reg-error', e.message);
  } finally {
    document.getElementById('btn-register').textContent = 'Crear cuenta';
  }
});

document.getElementById('go-register').addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('panel-login').classList.remove('active');
  document.getElementById('panel-register').classList.add('active');
});
document.getElementById('go-login').addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('panel-register').classList.remove('active');
  document.getElementById('panel-login').classList.add('active');
});

document.getElementById('btn-logout').addEventListener('click', logout);
document.getElementById('btn-logout-mobile').addEventListener('click', logout);

// ── Navegación ────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  document.querySelectorAll(`[data-section="${name}"]`).forEach(l => l.classList.add('active'));
  document.getElementById('mobile-menu').classList.add('hidden');

  if (name === 'resumen') cargarResumen();
  if (name === 'anteriores') cargarMeses();
  if (name === 'reporte') initReporte();
  if (name === 'graficos') initGraficos();
}

document.querySelectorAll('.nav-link').forEach(l => {
  l.addEventListener('click', e => {
    e.preventDefault();
    showSection(l.dataset.section);
  });
});

document.getElementById('nav-hamburger').addEventListener('click', () => {
  document.getElementById('mobile-menu').classList.toggle('hidden');
});

// ── Formulario nuevo gasto ─────────────────────────
function setDefaultDateTime() {
  const now = new Date();
  document.getElementById('f-fecha').value = now.toISOString().slice(0,10);
  document.getElementById('f-hora').value  = now.toTimeString().slice(0,5);
}

document.getElementById('btn-guardar').addEventListener('click', async () => {
  const fecha  = document.getElementById('f-fecha').value;
  const hora   = document.getElementById('f-hora').value;
  const monto  = document.getElementById('f-monto').value;
  const cat    = document.getElementById('f-categoria').value;
  const desc   = document.getElementById('f-descripcion').value.trim();

  if (!fecha || !hora || !monto || !cat)
    return showError('form-error', 'Fecha, hora, monto y categoría son obligatorios');

  try {
    document.getElementById('btn-guardar').innerHTML = '<span class="spinner"></span>';
    await api('/gastos', {
      method: 'POST',
      body: JSON.stringify({ fecha, hora, monto: Number(monto), categoria: cat, descripcion: desc })
    });
    document.getElementById('btn-limpiar').click();
    // Mostrar confirmación
    const btn = document.getElementById('btn-guardar');
    btn.textContent = '✓ Guardado';
    btn.style.background = 'var(--green)';
    setTimeout(() => {
      btn.textContent = 'Guardar gasto';
      btn.style.background = '';
    }, 2000);
  } catch (e) {
    showError('form-error', e.message);
  }
});

document.getElementById('btn-limpiar').addEventListener('click', () => {
  document.getElementById('f-monto').value = '';
  document.getElementById('f-categoria').value = '';
  document.getElementById('f-descripcion').value = '';
  hideError('form-error');
  setDefaultDateTime();
});

// ── Editar modal ──────────────────────────────────
function openEdit(gasto) {
  editId = gasto.id;
  document.getElementById('e-fecha').value       = gasto.fecha.slice(0,10);
  document.getElementById('e-hora').value        = gasto.hora.slice(0,5);
  document.getElementById('e-monto').value       = gasto.monto;
  document.getElementById('e-categoria').value   = gasto.categoria;
  document.getElementById('e-descripcion').value = gasto.descripcion || '';
  document.getElementById('edit-modal').classList.remove('hidden');
}

document.getElementById('modal-close').addEventListener('click',  () => document.getElementById('edit-modal').classList.add('hidden'));
document.getElementById('btn-cancel-edit').addEventListener('click', () => document.getElementById('edit-modal').classList.add('hidden'));
document.getElementById('edit-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('edit-modal'))
    document.getElementById('edit-modal').classList.add('hidden');
});

document.getElementById('btn-update').addEventListener('click', async () => {
  const fecha  = document.getElementById('e-fecha').value;
  const hora   = document.getElementById('e-hora').value;
  const monto  = document.getElementById('e-monto').value;
  const cat    = document.getElementById('e-categoria').value;
  const desc   = document.getElementById('e-descripcion').value.trim();

  if (!fecha || !hora || !monto || !cat)
    return showError('edit-error', 'Todos los campos principales son obligatorios');

  try {
    document.getElementById('btn-update').textContent = 'Guardando…';
    await api(`/gastos/${editId}`, {
      method: 'PUT',
      body: JSON.stringify({ fecha, hora, monto: Number(monto), categoria: cat, descripcion: desc })
    });
    document.getElementById('edit-modal').classList.add('hidden');
    cargarResumen();
  } catch (e) {
    showError('edit-error', e.message);
  } finally {
    document.getElementById('btn-update').textContent = 'Actualizar';
  }
});

// ── Construir item de gasto ────────────────────────
function buildGastoItem(g, onEdit, onDel) {
  const div = document.createElement('div');
  div.className = 'gasto-item';
  const desc = g.descripcion || g.categoria;
  div.innerHTML = `
    <span class="cat-badge cat-${g.categoria}">${g.categoria}</span>
    <div class="gasto-info">
      <div class="gasto-desc">${desc}</div>
      <div class="gasto-fecha">${fmtFecha(g.fecha.slice(0,10))} · ${(g.hora||'').slice(0,5)}</div>
    </div>
    <div class="gasto-monto">${fmt(g.monto)}</div>
    <div class="gasto-actions">
      <button class="btn-edit">Editar</button>
      <button class="btn-del">Eliminar</button>
    </div>`;
  div.querySelector('.btn-edit').addEventListener('click', () => onEdit(g));
  div.querySelector('.btn-del').addEventListener('click',  () => onDel(g.id));
  return div;
}

function emptyState() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = '<span class="empty-icon">◎</span><p>No hay registros</p>';
  return div;
}

function loadingRow() {
  const div = document.createElement('div');
  div.className = 'loading-row';
  div.innerHTML = '<span class="spinner"></span> Cargando…';
  return div;
}

// ── SECCIÓN RESUMEN ────────────────────────────────
async function cargarResumen() {
  const now = new Date();
  const anio = now.getFullYear();
  const mes  = now.getMonth() + 1;
  document.getElementById('resumen-titulo').textContent = `${MESES[mes]} ${anio}`;

  const tabla = document.getElementById('tabla-resumen');
  tabla.innerHTML = ''; tabla.appendChild(loadingRow());

  try {
    const cat    = document.getElementById('filtro-categoria').value;
    const buscar = document.getElementById('buscar-input').value.trim();
    let url = `/gastos?anio=${anio}&mes=${mes}`;
    if (cat)    url += `&categoria=${encodeURIComponent(cat)}`;
    if (buscar) url += `&buscar=${encodeURIComponent(buscar)}`;

    const gastos = await api(url);
    const total  = gastos.reduce((s, g) => s + Number(g.monto), 0);
    document.getElementById('resumen-total').textContent = fmt(total);

    tabla.innerHTML = '';
    if (!gastos.length) { tabla.appendChild(emptyState()); return; }
    gastos.forEach(g => tabla.appendChild(buildGastoItem(g, openEdit, async id => {
      if (!confirm('¿Eliminar este gasto?')) return;
      await api(`/gastos/${id}`, { method: 'DELETE' });
      cargarResumen();
    })));
  } catch (e) {
    tabla.innerHTML = `<div class="empty-state"><p>Error: ${e.message}</p></div>`;
  }
}

let debounceTimer;
document.getElementById('buscar-input').addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(cargarResumen, 400);
});
document.getElementById('filtro-categoria').addEventListener('change', cargarResumen);

// ── SECCIÓN MESES ANTERIORES ───────────────────────
async function cargarMeses() {
  const lista = document.getElementById('lista-meses');
  const detalle = document.getElementById('mes-detalle');
  detalle.classList.add('hidden');
  lista.classList.remove('hidden');
  lista.innerHTML = ''; lista.appendChild(loadingRow());

  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();

  try {
    const meses = await api('/gastos/meses');
    // Excluir mes actual
    const anteriores = meses.filter(m => !(Number(m.mes) === mesActual && Number(m.anio) === anioActual));
    lista.innerHTML = '';
    if (!anteriores.length) { lista.appendChild(emptyState()); return; }
    anteriores.forEach(m => {
      const card = document.createElement('div');
      card.className = 'mes-card';
      card.innerHTML = `
        <div class="mes-card-titulo">${MESES[m.mes]} ${m.anio}</div>
        <div class="mes-card-total">${fmt(m.total)}</div>
        <div class="mes-card-count">${m.registros} registro${m.registros!=1?'s':''}</div>`;
      card.addEventListener('click', () => verDetalleMes(m.anio, m.mes));
      lista.appendChild(card);
    });
  } catch (e) {
    lista.innerHTML = `<div class="empty-state"><p>Error: ${e.message}</p></div>`;
  }
}

async function verDetalleMes(anio, mes) {
  document.getElementById('lista-meses').classList.add('hidden');
  const detalle = document.getElementById('mes-detalle');
  detalle.classList.remove('hidden');
  document.getElementById('detalle-titulo').textContent = `${MESES[mes]} ${anio}`;

  const tabla = document.getElementById('tabla-detalle');
  tabla.innerHTML = ''; tabla.appendChild(loadingRow());

  try {
    const gastos = await api(`/gastos?anio=${anio}&mes=${mes}`);
    tabla.innerHTML = '';
    if (!gastos.length) { tabla.appendChild(emptyState()); return; }
    gastos.forEach(g => tabla.appendChild(buildGastoItem(g, openEdit, async id => {
      if (!confirm('¿Eliminar este gasto?')) return;
      await api(`/gastos/${id}`, { method: 'DELETE' });
      verDetalleMes(anio, mes);
    })));
  } catch(e) {
    tabla.innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
  }
}

document.getElementById('btn-back-mes').addEventListener('click', () => {
  document.getElementById('mes-detalle').classList.add('hidden');
  document.getElementById('lista-meses').classList.remove('hidden');
});

// ── SECCIÓN REPORTE ────────────────────────────────
function initReporte() {
  const anioSel = document.getElementById('rep-anio');
  if (!anioSel.options.length) {
    const y = new Date().getFullYear();
    for (let i = y; i >= y - 4; i--) {
      const o = new Option(i, i);
      if (i === y) o.selected = true;
      anioSel.appendChild(o);
    }
    document.getElementById('rep-mes').value = new Date().getMonth() + 1;
  }
}

document.getElementById('btn-descargar').addEventListener('click', async () => {
  const anio = document.getElementById('rep-anio').value;
  const mes  = document.getElementById('rep-mes').value;
  const preview = document.getElementById('reporte-preview');

  try {
    document.getElementById('btn-descargar').textContent = 'Generando…';
    const gastos = await api(`/gastos?anio=${anio}&mes=${mes}`);

    if (!gastos.length) {
      preview.textContent = 'No hay registros para el período seleccionado.';
      preview.classList.remove('hidden');
      return;
    }

    const nomMes = MESES[Number(mes)];
    let csv = 'Fecha,Hora,Monto,Categoría,Descripción\n';
    gastos.forEach(g => {
      csv += `${fmtFecha(g.fecha.slice(0,10))},${(g.hora||'').slice(0,5)},${g.monto},${g.categoria},"${(g.descripcion||'').replace(/"/g,'""')}"\n`;
    });

    // Preview
    preview.textContent = csv.slice(0, 500) + (csv.length > 500 ? '…' : '');
    preview.classList.remove('hidden');

    // Descarga
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `gastos_${nomMes}_${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Error al generar reporte: ' + e.message);
  } finally {
    document.getElementById('btn-descargar').innerHTML = '<span>⬇</span> Descargar CSV';
  }
});

// ── SECCIÓN GRÁFICOS ───────────────────────────────
function initGraficos() {
  const anioSel = document.getElementById('graf-anio');
  if (!anioSel.options.length) {
    const y = new Date().getFullYear();
    for (let i = y; i >= y - 4; i--) {
      const o = new Option(i, i);
      if (i === y) o.selected = true;
      anioSel.appendChild(o);
    }
  }
}

document.getElementById('btn-graf-cargar').addEventListener('click', async () => {
  const anio = document.getElementById('graf-anio').value;
  const mes  = document.getElementById('graf-mes').value;
  await cargarGraficos(anio, mes);
});

const CHART_COLORS = ['#f5a623','#3ecf8e','#60a5fa','#a78bfa','#fb923c','#f87171','#fbbf24'];

async function cargarGraficos(anio, mes) {
  try {
    let url = `/gastos/resumen?anio=${anio}`;
    if (mes) url += `&mes=${mes}`;
    const resumen = await api(url);

    let allUrl = `/gastos?anio=${anio}`;
    if (mes) allUrl += `&mes=${mes}`;
    const allGastos = await api(allUrl);

    renderDonut(resumen);
    renderBar(allGastos, anio, mes);
    await renderLine(anio);
  } catch (e) {
    console.error(e);
  }
}

function renderDonut(resumen) {
  const ctx = document.getElementById('chart-donut').getContext('2d');
  if (chartDonut) chartDonut.destroy();
  chartDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: resumen.map(r => r.categoria),
      datasets: [{
        data: resumen.map(r => Number(r.total)),
        backgroundColor: CHART_COLORS.slice(0, resumen.length),
        borderColor: '#141417',
        borderWidth: 3,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#9898a8', font: { size: 12 }, padding: 16 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmt(ctx.parsed)}`
          }
        }
      },
      cutout: '65%',
    }
  });
}

function renderBar(gastos, anio, mes) {
  const ctx = document.getElementById('chart-bar').getContext('2d');
  if (chartBar) chartBar.destroy();

  // Agrupar por día
  const byDay = {};
  gastos.forEach(g => {
    const day = g.fecha.slice(8,10);
    byDay[day] = (byDay[day] || 0) + Number(g.monto);
  });
  const labels = Object.keys(byDay).sort();
  const data   = labels.map(k => byDay[k]);

  chartBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Gasto diario',
        data,
        backgroundColor: 'rgba(245,166,35,.7)',
        borderColor: '#f5a623',
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)}` } }
      },
      scales: {
        x: { ticks: { color: '#5e5e6e' }, grid: { color: '#1c1c21' } },
        y: { ticks: { color: '#5e5e6e', callback: v => fmt(v) }, grid: { color: '#1c1c21' } }
      }
    }
  });
}

async function renderLine(anio) {
  const ctx = document.getElementById('chart-line').getContext('2d');
  if (chartLine) chartLine.destroy();

  try {
    const meses = await api('/gastos/meses');
    const delAnio = meses.filter(m => Number(m.anio) === Number(anio));
    const labels  = delAnio.map(m => MESES[m.mes]);
    const data    = delAnio.map(m => Number(m.total));

    chartLine = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total mensual',
          data,
          borderColor: '#f5a623',
          backgroundColor: 'rgba(245,166,35,.08)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#f5a623',
          pointRadius: 5,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)}` } }
        },
        scales: {
          x: { ticks: { color: '#5e5e6e' }, grid: { color: '#1c1c21' } },
          y: { ticks: { color: '#5e5e6e', callback: v => fmt(v) }, grid: { color: '#1c1c21' } }
        }
      }
    });
  } catch(e) { console.error(e); }
}

// ── Init app ──────────────────────────────────────
function initApp() {
  if (!token || !usuario) return;
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('nav-nombre').textContent = usuario.nombre.split(' ')[0];
  setDefaultDateTime();
  showSection('nuevo');
}

// ── Arrancar ──────────────────────────────────────
if (token && usuario) {
  initApp();
}
