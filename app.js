/* ═══════════════════════════════════════════════════
  GASTOS DIARIOS — app.js
  Ajusta API_URL con la URL de tu backend en Railway
════════════════════════════════════════════════════ */

const API_URL = 'https://gastos-backend-production-fa36.up.railway.app/api'; // ← cambia esto

// ── Estado global ─────────────────────────────────
let token = localStorage.getItem('gd_token') || null;
let usuario = JSON.parse(localStorage.getItem('gd_usuario') || 'null');
let editId = null;
let chartDonut = null, chartBar = null, chartLine = null;
let deleteCallback = null;

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ── Helpers ───────────────────────────────────────
const fmt = n => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0
}).format(n);

const fmtFecha = d => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const fmtHora = h => {
  if (!h) return '';
  const [hh, mm] = h.slice(0, 5).split(':');
  const hora = parseInt(hh);
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const h12 = hora % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
};

// ── FORMATO MILES ─────────────────────────────────
function fmtInput(val) {
  const num = val.replace(/\./g, '').replace(/\D/g, '');
  if (!num) return '';
  return Number(num).toLocaleString('es-CO');
}

function getNumericValue(inputId) {
  const raw = document.getElementById(inputId).value;
  return Number(raw.replace(/\./g, '').replace(/,/g, '').replace(/\D/g, '')) || 0;
}

function bindMontoInput(inputId) {
  const input = document.getElementById(inputId);
  input.addEventListener('input', function() {
    const pos = this.selectionStart;
    const prevLen = this.value.length;
    this.value = fmtInput(this.value);
    // Ajustar posición del cursor
    const diff = this.value.length - prevLen;
    this.setSelectionRange(pos + diff, pos + diff);
  });
}

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
  token = data.token;
  usuario = data.usuario;
  localStorage.setItem('gd_token', token);
  localStorage.setItem('gd_usuario', JSON.stringify(usuario));
}

function logout() {
  token = null; usuario = null;
  localStorage.removeItem('gd_token');
  localStorage.removeItem('gd_usuario');

  // Limpiar campos de login y registro
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('reg-nombre').value = '';
  document.getElementById('reg-email').value = '';
  document.getElementById('reg-pass').value = '';

  // Resetear ojos de contraseña
  document.getElementById('login-pass').type = 'password';
  document.getElementById('reg-pass').type = 'password';
  document.querySelectorAll('.btn-eye').forEach(btn => btn.textContent = '👁');

  // Mostrar login
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('panel-login').classList.add('active');
  document.getElementById('panel-register').classList.remove('active');
}

document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (!email || !pass) return showError('login-error', 'Completa todos los campos');
  try {
    document.getElementById('btn-login').textContent = 'Ingresando…';
    const data = await api('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password: pass })
    });
    saveSession(data);

    // Notificar si hay otra sesión activa
    if (data.otraSesionActiva) {
      const otro = data.dispositivoActual === 'móvil' ? 'computador' : 'móvil';
      sessionNotification(`Tu cuenta también está abierta en otro ${otro}.`);
    }

    initApp();
  } catch (e) {
    showError('login-error', e.message);
  } finally {
    document.getElementById('btn-login').textContent = 'Iniciar sesión';
  }
});

document.getElementById('btn-register').addEventListener('click', async () => {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
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

// ── Navegación ────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(l => l.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  document.querySelectorAll(`[data-section="${name}"]`).forEach(l => l.classList.add('active'));

  if (name === 'resumen') cargarResumen();
  if (name === 'anteriores') cargarMeses();
  if (name === 'reporte') initReporte();
  if (name === 'graficos') initGraficos();
}

document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(l => {
  l.addEventListener('click', e => {
    e.preventDefault();
    showSection(l.dataset.section);
  });
});

// ── Formulario nuevo gasto ─────────────────────────
function setDefaultDateTime() {
  const now = new Date();
  document.getElementById('f-fecha').value = now.toISOString().slice(0, 10);
  document.getElementById('f-hora').value = now.toTimeString().slice(0, 5);
}

document.getElementById('btn-guardar').addEventListener('click', async () => {
  const fecha = document.getElementById('f-fecha').value;
  const hora = document.getElementById('f-hora').value;
  const monto = getNumericValue('f-monto');
  const catSelect = document.getElementById('f-categoria').value;
  const catCustom = document.getElementById('f-categoria-custom').value.trim();
  const cat = catSelect === 'Otros' && catCustom ? catCustom : catSelect;
  const desc = document.getElementById('f-descripcion').value.trim();

  if (!fecha || !hora || !monto || !cat)
    return showError('form-error', 'Fecha, hora, monto y categoría son obligatorios');

  try {
    document.getElementById('btn-guardar').innerHTML = '<span class="spinner"></span>';
    await api('/gastos', {
      method: 'POST',
      body: JSON.stringify({ fecha, hora, monto: Number(monto), categoria: cat, descripcion: desc, billtera_id: document.getElementById('f-billtera').value || null })
    });
    document.getElementById('btn-limpiar').click();
    // Mostrar confirmación
    const btn = document.getElementById('btn-guardar');
    btn.textContent = '✓ Guardado';
    btn.style.background = 'var(--green)';
    cargarBilleteras();
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
  document.getElementById('f-categoria-custom').value = '';
  document.getElementById('f-categoria-custom-wrap').classList.add('hidden');
  document.getElementById('f-billtera').value = '';  // ← agrega esta línea
  hideError('form-error');
  setDefaultDateTime();
});

// ── Editar modal ──────────────────────────────────
function openEdit(gasto) {
  editId = gasto.id;
  document.getElementById('e-fecha').value = gasto.fecha.slice(0, 10);
  document.getElementById('e-hora').value = gasto.hora.slice(0, 5);
  document.getElementById('e-monto').value = Number(gasto.monto).toLocaleString('es-CO');
  document.getElementById('e-descripcion').value = gasto.descripcion || '';

  // Categoría — detectar si es fija o personalizada
  const categoriasFijas = ['Comida', 'Transporte', 'Entretenimiento', 'Ropa', 'Otros'];
  const esCategoriaFija = categoriasFijas.includes(gasto.categoria);

  if (esCategoriaFija) {
    document.getElementById('e-categoria').value = gasto.categoria;
    document.getElementById('e-categoria-custom-wrap').classList.add('hidden');
    document.getElementById('e-categoria-custom').value = '';
  } else {
    document.getElementById('e-categoria').value = 'Otros';
    document.getElementById('e-categoria-custom').value = gasto.categoria;
    document.getElementById('e-categoria-custom-wrap').classList.remove('hidden');
  }

  // Actualizar opciones del select de billtera
  const eSel = document.getElementById('e-billtera');
  eSel.innerHTML = '<option value="">Sin especificar</option>';
  billeteras.forEach(b => {
    const o = new Option(`${b.emoji} ${b.nombre} — ${fmt(b.saldo)}`, b.id);
    eSel.appendChild(o);
  });
  if (gasto.billtera_id) eSel.value = gasto.billtera_id;

  document.getElementById('edit-modal').classList.remove('hidden');
}

// ── CATEGORÍA PERSONALIZADA ───────────────────────
document.getElementById('f-categoria').addEventListener('change', function() {
  const wrap = document.getElementById('f-categoria-custom-wrap');
  const input = document.getElementById('f-categoria-custom');
  if (this.value === 'Otros') {
    wrap.classList.remove('hidden');
    input.focus();
  } else {
    wrap.classList.add('hidden');
    input.value = '';
  }
});

document.getElementById('e-categoria').addEventListener('change', function() {
  const wrap = document.getElementById('e-categoria-custom-wrap');
  const input = document.getElementById('e-categoria-custom');
  if (this.value === 'Otros') {
    wrap.classList.remove('hidden');
    input.focus();
  } else {
    wrap.classList.add('hidden');
    input.value = '';
  }
});

document.getElementById('modal-close').addEventListener('click', () => document.getElementById('edit-modal').classList.add('hidden'));
document.getElementById('btn-cancel-edit').addEventListener('click', () => document.getElementById('edit-modal').classList.add('hidden'));
document.getElementById('edit-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('edit-modal'))
    document.getElementById('edit-modal').classList.add('hidden');
});
// Eliminar modal
document.getElementById('btn-delete-cancel').addEventListener('click', () => {
  document.getElementById('delete-modal').classList.add('hidden');
  deleteCallback = null;
});
document.getElementById('btn-delete-confirm').addEventListener('click', async () => {
  if (deleteCallback) await deleteCallback();
  document.getElementById('delete-modal').classList.add('hidden');
  deleteCallback = null;
});

function confirmDelete(cb, titulo = '¿Eliminar gasto?') {
  deleteCallback = cb;
  document.getElementById('delete-modal-titulo').textContent = titulo;
  document.getElementById('delete-modal').classList.remove('hidden');
}

// Modal de pdf con contraseña
document.getElementById('pass-modal-close').addEventListener('click', () => {
  document.getElementById('pass-modal').classList.add('hidden');
});

document.getElementById('btn-pass-confirm').addEventListener('click', async () => {
  const pass = document.getElementById('pdf-pass').value;
  if (!pass) {
    document.getElementById('pass-error').classList.remove('hidden');
    document.getElementById('pass-error').textContent = 'Ingresa una contraseña';
    return;
  }

  // Verificar contraseña contra el backend
  try {
    document.getElementById('btn-pass-confirm').textContent = 'Verificando…';
    await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: usuario.email, password: pass })
    });
    // Si llega aquí, la contraseña es correcta
    document.getElementById('pass-error').classList.add('hidden');
    document.getElementById('pass-modal').classList.add('hidden');
    const { gastos, anio, mes } = window._pdfData;
    generarPDF(gastos, anio, mes, pass);
  } catch (e) {
    document.getElementById('pass-error').classList.remove('hidden');
    document.getElementById('pass-error').textContent = 'Contraseña incorrecta';
  } finally {
    document.getElementById('btn-pass-confirm').textContent = 'Generar PDF';
  }
});

document.getElementById('pdf-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-pass-confirm').click();
});

// Modal detalle de registro
document.getElementById('detail-modal-close').addEventListener('click', () => {
  document.getElementById('detail-modal').classList.add('hidden');
});
document.getElementById('detail-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('detail-modal'))
    document.getElementById('detail-modal').classList.add('hidden');
});

document.getElementById('btn-update').addEventListener('click', async () => {
  const fecha = document.getElementById('e-fecha').value;
  const hora = document.getElementById('e-hora').value;
  const monto = getNumericValue('e-monto');
  const catSelect = document.getElementById('e-categoria').value;
  const catCustom = document.getElementById('e-categoria-custom').value.trim();
  const cat = catSelect === 'Otros' && catCustom ? catCustom : catSelect;
  const desc = document.getElementById('e-descripcion').value.trim();

  if (!fecha || !hora || !monto || !cat)
    return showError('edit-error', 'Todos los campos principales son obligatorios');

  try {
    document.getElementById('btn-update').textContent = 'Guardando…';
    await api(`/gastos/${editId}`, {
      method: 'PUT',
      body: JSON.stringify({ fecha, hora, monto: Number(monto), categoria: cat, descripcion: desc, billtera_id: document.getElementById('e-billtera') ? document.getElementById('e-billtera').value || null : null })
    });
    document.getElementById('edit-modal').classList.add('hidden');
    cargarResumen();
    cargarBilleteras();
  } catch (e) {
    showError('edit-error', e.message);
  } finally {
    document.getElementById('btn-update').textContent = 'Actualizar';
  }
});

// Funcion abrir detalle del gasto
function openDetail(g) {
  const billtera = billeteras.find(b => b.id === g.billtera_id);
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-grid">
      <div class="detail-row">
        <span class="detail-label">Categoría</span>
        ${getCategoriaBadge(g.categoria)}
      </div>
      <div class="detail-row">
        <span class="detail-label">Descripción</span>
        <span class="detail-value">${g.descripcion || '—'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Monto</span>
        <span class="detail-value detail-monto">${fmt(g.monto)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Pagado con</span>
        <span class="detail-value">${g.metodo_pago || '—'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Fecha</span>
        <span class="detail-value">${fmtFecha(g.fecha.slice(0,10))}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Hora</span>
        <span class="detail-value">${fmtHora(g.hora)}</span>
      </div>
    </div>`;
  document.getElementById('detail-modal').classList.remove('hidden');
}

// ── COLOR DINÁMICO PARA CATEGORÍAS PERSONALIZADAS ──
const CATEGORIAS_FIJAS = ['Comida', 'Transporte', 'Entretenimiento', 'Ropa', 'Otros'];
const COLORES_CUSTOM = [
  { bg: 'rgba(251,191,36,.15)',  color: '#fbbf24' },  // amarillo
  { bg: 'rgba(34,211,238,.15)',  color: '#22d3ee' },  // cyan
  { bg: 'rgba(244,114,182,.15)', color: '#f472b6' },  // rosa
  { bg: 'rgba(74,222,128,.15)',  color: '#4ade80' },  // verde claro
  { bg: 'rgba(249,115,22,.15)',  color: '#f97316' },  // naranja
  { bg: 'rgba(168,85,247,.15)',  color: '#a855f7' },  // púrpura
  { bg: 'rgba(20,184,166,.15)',  color: '#14b8a6' },  // teal
];

function getCategoriaBadge(categoria) {
  if (CATEGORIAS_FIJAS.includes(categoria)) {
    return `<span class="cat-badge cat-${categoria}">${categoria}</span>`;
  }
  // Hash simple del texto para elegir siempre el mismo color
  let hash = 0;
  for (let i = 0; i < categoria.length; i++) {
    hash = categoria.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % COLORES_CUSTOM.length;
  const { bg, color } = COLORES_CUSTOM[idx];
  return `<span class="cat-badge" style="background:${bg};color:${color};">${categoria}</span>`;
}

// ── Construir item de gasto ────────────────────────
function buildGastoItem(g, onEdit, onDel) {
  const div = document.createElement('div');
  div.className = 'gasto-item';
  div.style.cursor = 'pointer';
  div.addEventListener('click', e => {
    if (!e.target.closest('.gasto-actions')) openDetail(g);
  });
  const desc = g.descripcion || g.categoria;
  const billtera = billeteras.find(b => b.id === g.billtera_id);
  div.innerHTML = `
      <div class="gasto-item-top">
        ${getCategoriaBadge(g.categoria)}
        <div class="gasto-info">
          <div class="gasto-desc">${desc}</div>
          <div class="gasto-fecha">${fmtFecha(g.fecha.slice(0, 10))} · ${fmtHora(g.hora)}</div>
        </div>
        <div class="gasto-monto">${fmt(g.monto)}</div>
      </div>
      <div class="gasto-item-bottom">
        <span class="gasto-billtera">${g.metodo_pago || ''}</span>
        <div class="gasto-actions">
          <button class="btn-edit">Editar</button>
          <button class="btn-del">Eliminar</button>
        </div>
      </div>`;
  div.querySelector('.btn-edit').addEventListener('click', () => onEdit(g));
  div.querySelector('.btn-del').addEventListener('click', () => onDel(g.id));
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
  const mes = now.getMonth() + 1;
  document.getElementById('resumen-titulo').textContent = `${MESES[mes]} ${anio}`;

  const tabla = document.getElementById('tabla-resumen');
  tabla.innerHTML = ''; tabla.appendChild(loadingRow());

  try {
    const cat = document.getElementById('filtro-categoria').value;
    const buscar = document.getElementById('buscar-input').value.trim();
    let url = `/gastos?anio=${anio}&mes=${mes}`;
    if (cat) url += `&categoria=${encodeURIComponent(cat)}`;
    if (buscar) url += `&buscar=${encodeURIComponent(buscar)}`;

    const gastos = await api(url);
    const total = gastos.reduce((s, g) => s + Number(g.monto), 0);
    document.getElementById('resumen-total').textContent = fmt(total);

    tabla.innerHTML = '';
    if (!gastos.length) { tabla.appendChild(emptyState()); return; }
    gastos.forEach(g => tabla.appendChild(buildGastoItem(g, openEdit, async id => {
      confirmDelete(async () => {
        await api(`/gastos/${id}`, { method: 'DELETE' });
        cargarResumen();
      });
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
    const anteriores = meses.filter(m => !(Number(m.mes) === mesActual && Number(m.anio) === anioActual));
    lista.innerHTML = '';
    if (!anteriores.length) { lista.appendChild(emptyState()); return; }

    // Agrupar por año
    const porAnio = {};
    anteriores.forEach(m => {
      if (!porAnio[m.anio]) porAnio[m.anio] = [];
      porAnio[m.anio].push(m);
    });

    // Renderizar por año (más reciente primero)
    Object.keys(porAnio)
      .sort((a, b) => b - a)
      .forEach(anio => {
        // Título del año
        const h = document.createElement('h2');
        h.className = 'anio-titulo';
        h.textContent = anio;
        lista.appendChild(h);

        // Grid de meses de ese año
        const grid = document.createElement('div');
        grid.className = 'meses-grid';
        porAnio[anio].forEach(m => {
          const card = document.createElement('div');
          card.className = 'mes-card';
          card.innerHTML = `
            <div class="mes-card-titulo">${MESES[m.mes]}</div>
            <div class="mes-card-total">${fmt(m.total)}</div>
            <div class="mes-card-count">${m.registros} registro${m.registros != 1 ? 's' : ''}</div>`;
          card.addEventListener('click', () => verDetalleMes(m.anio, m.mes));
          grid.appendChild(card);
        });
        lista.appendChild(grid);
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
      confirmDelete(async () => {
        await api(`/gastos/${id}`, { method: 'DELETE' });
        verDetalleMes(anio, mes);
      });
    })));
  } catch (e) {
    tabla.innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
  }
}

document.getElementById('btn-back-mes').addEventListener('click', () => {
  document.getElementById('mes-detalle').classList.add('hidden');
  document.getElementById('lista-meses').classList.remove('hidden');
});

// ── SECCIÓN REPORTE ────────────────────────────────
// ── SECCIÓN REPORTE ────────────────────────────────
async function initReporte() {
  const anioSel = document.getElementById('rep-anio');
  const mesSel = document.getElementById('rep-mes');

  // Cargar periodos disponibles
  try {
    const periodos = await api('/gastos/periodos');
    anioSel.innerHTML = '';

    // Años únicos
    const anios = [...new Set(periodos.map(p => p.anio))];
    anios.forEach(a => {
      const o = new Option(a, a);
      anioSel.appendChild(o);
    });

    // Al cambiar año, actualizar meses disponibles
    anioSel.addEventListener('change', () => actualizarMeses(periodos));
    actualizarMeses(periodos);
  } catch (e) {
    anioSel.innerHTML = '<option>Error</option>';
  }
}

function actualizarMeses(periodos) {
  const anio = document.getElementById('rep-anio').value;
  const mesSel = document.getElementById('rep-mes');
  mesSel.innerHTML = '';
  periodos
    .filter(p => String(p.anio) === String(anio))
    .sort((a, b) => a.mes - b.mes)  // ← agrega esto
    .forEach(p => {
      mesSel.appendChild(new Option(MESES[p.mes], p.mes));
    });
}

document.getElementById('btn-descargar-csv').addEventListener('click', async () => {
  const anio = document.getElementById('rep-anio').value;
  const mes = document.getElementById('rep-mes').value;
  const preview = document.getElementById('reporte-preview');

  try {
    document.getElementById('btn-descargar-csv').textContent = 'Generando…';
    const gastos = await api(`/gastos?anio=${anio}&mes=${mes}`);

    if (!gastos.length) {
      preview.textContent = 'No hay registros para el período seleccionado.';
      preview.classList.remove('hidden');
      return;
    }

    let csv = 'Fecha,Hora,Monto,Categoría,Descripción\n';
    gastos.forEach(g => {
      csv += `${fmtFecha(g.fecha.slice(0, 10))},${(g.hora || '').slice(0, 5)},${g.monto},${g.categoria},"${(g.descripcion || '').replace(/"/g, '""')}"\n`;
    });

    preview.textContent = csv.slice(0, 500) + (csv.length > 500 ? '…' : '');
    preview.classList.remove('hidden');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gastos_${MESES[Number(mes)]}_${anio}.csv`;
    a.click(); URL.revokeObjectURL(url);
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    document.getElementById('btn-descargar-csv').innerHTML = '<span>⬇</span> Descargar CSV';
  }
});

document.getElementById('btn-descargar-pdf').addEventListener('click', async () => {
  const anio = document.getElementById('rep-anio').value;
  const mes = document.getElementById('rep-mes').value;

  try {
    document.getElementById('btn-descargar-pdf').textContent = 'Cargando…';
    const gastos = await api(`/gastos?anio=${anio}&mes=${mes}`);
    if (!gastos.length) { alert('No hay registros para el período.'); return; }
    window._pdfData = { gastos, anio, mes };
    document.getElementById('pdf-pass').value = '';
    document.getElementById('pass-modal').classList.remove('hidden');
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    document.getElementById('btn-descargar-pdf').innerHTML = '<span>⬇</span> Descargar PDF';
  }
});

function generarPDF(gastos, anio, mes, password) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = 210, H = 297;
  const amber = [245, 166, 35];
  const dark = [13, 13, 15];
  const dark2 = [20, 20, 23];
  const gray = [152, 152, 168];
  const white = [232, 232, 236];

  // ── Fondo ─────────────────────────────────────────
  doc.setFillColor(...dark);
  doc.rect(0, 0, W, H, 'F');

  // ── Header bar ────────────────────────────────────
  doc.setFillColor(...dark2);
  doc.rect(0, 0, W, 42, 'F');

  doc.setFillColor(...amber);
  doc.rect(0, 42, W, 1.5, 'F');

  doc.setTextColor(...amber);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('KASH', 14, 20);

  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.setFont('helvetica', 'normal');
  doc.text('REPORTE MENSUAL DE GASTOS', 14, 28);

  doc.setFontSize(18);
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'bold');
  doc.text(`${MESES[Number(mes)]} ${anio}`, W - 14, 22, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.setFont('helvetica', 'normal');
  doc.text(usuario.nombre, W - 14, 30, { align: 'right' });
  doc.text(usuario.email, W - 14, 36, { align: 'right' });

  // ── Tarjeta resumen ───────────────────────────────
  const total = gastos.reduce((s, g) => s + Number(g.monto), 0);
  const porCat = {};
  gastos.forEach(g => {
    porCat[g.categoria] = (porCat[g.categoria] || 0) + Number(g.monto);
  });

  doc.setFillColor(28, 28, 33);
  doc.roundedRect(14, 50, W - 28, 32, 4, 4, 'F');
  doc.setDrawColor(...amber);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, 50, W - 28, 32, 4, 4, 'S');

  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text('TOTAL DEL MES', 22, 60);

  doc.setFontSize(20);
  doc.setTextColor(...amber);
  doc.setFont('helvetica', 'bold');
  doc.text(fmt(total), 22, 72);

  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.setFont('helvetica', 'normal');
  doc.text(`${gastos.length} registro${gastos.length !== 1 ? 's' : ''}`, 22, 78);

  // ── Tabla de registros ────────────────────────────
  const CAT_COLORS_PDF = {
    'Comida':          [62, 207, 142],
    'Transporte':      [96, 165, 250],
    'Entretenimiento': [167, 139, 250],
    'Ropa':            [251, 146, 60],
    'Otros':           [148, 163, 184],
  };
  const COLORES_CUSTOM_PDF = [
    [251, 191, 36], [34, 211, 238], [244, 114, 182],
    [74, 222, 128], [249, 115, 22], [168, 85, 247], [20, 184, 166],
  ];

  function getCatColorPDF(categoria) {
    if (CAT_COLORS_PDF[categoria]) return CAT_COLORS_PDF[categoria];
    let hash = 0;
    for (let i = 0; i < categoria.length; i++)
      hash = categoria.charCodeAt(i) + ((hash << 5) - hash);
    return COLORES_CUSTOM_PDF[Math.abs(hash) % COLORES_CUSTOM_PDF.length];
  }

  // Encabezado tabla
  let y = 92;
  doc.setFillColor(36, 36, 41);
  doc.rect(14, y, W - 28, 8, 'F');

  doc.setFontSize(7.5);
  doc.setTextColor(...gray);
  doc.setFont('helvetica', 'bold');
  doc.text('FECHA', 18, y + 5.5);
  doc.text('HORA', 46, y + 5.5);
  doc.text('CATEGORÍA', 63, y + 5.5);
  doc.text('DESCRIPCIÓN', 101, y + 5.5);
  doc.text('MÉTODO', 148, y + 5.5);
  doc.text('MONTO', W - 18, y + 5.5, { align: 'right' });

  y += 8;

  // Filas
  doc.setFont('helvetica', 'normal');
  gastos.forEach((g, i) => {
    if (y > H - 20) {
      doc.addPage();
      doc.setFillColor(...dark);
      doc.rect(0, 0, W, H, 'F');
      y = 14;
    }

    if (i % 2 === 0) {
      doc.setFillColor(20, 20, 23);
      doc.rect(14, y, W - 28, 9, 'F');
    }

    const catColor = getCatColorPDF(g.categoria);

    // Badge categoría
    doc.setFillColor(...catColor.map(c => Math.round(c * 0.15 + dark[0] * 0.85)));
    doc.roundedRect(61, y + 1.5, 36, 5.5, 1.5, 1.5, 'F');
    doc.setTextColor(...catColor);
    doc.setFontSize(6.5);
    doc.text(g.categoria.toUpperCase(), 79, y + 5.5, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(...white);
    doc.text(fmtFecha(g.fecha.slice(0, 10)), 18, y + 6);
    doc.text(fmtHora(g.hora), 46, y + 6);
    const desc = (g.descripcion || '-').slice(0, 22);
    doc.text(desc, 101, y + 6);
    const metodo = (g.metodo_pago || '-').slice(0, 10);
    doc.text(metodo, 148, y + 6);
    doc.setTextColor(...amber);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(g.monto), W - 18, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    doc.setDrawColor(46, 46, 53);
    doc.setLineWidth(0.2);
    doc.line(14, y + 9, W - 14, y + 9);

    y += 9;
  });

  // ── Recuadro resumen por categoría ───────────────
  const catEntries = Object.entries(porCat);
  const altCat = catEntries.length * 10 + 14;

  if (y + altCat > H - 20) {
    doc.addPage();
    doc.setFillColor(...dark);
    doc.rect(0, 0, W, H, 'F');
    y = 14;
  }

  y += 6;

  doc.setFillColor(28, 28, 33);
  doc.roundedRect(14, y, W - 28, altCat, 4, 4, 'F');
  doc.setDrawColor(...amber);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, y, W - 28, altCat, 4, 4, 'S');

  doc.setFontSize(7);
  doc.setTextColor(...amber);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN POR CATEGORÍA', 22, y + 8);

  let yCat = y + 14;
  catEntries.forEach(([cat, val]) => {
    const pct = ((val / total) * 100).toFixed(1);

    doc.setFontSize(8);
    doc.setTextColor(...white);
    doc.setFont('helvetica', 'normal');
    doc.text(cat, 22, yCat);

    doc.setTextColor(...amber);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(val), W - 40, yCat, { align: 'right' });

    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`${pct}%`, W - 18, yCat, { align: 'right' });

    yCat += 10;
  });

  // ── Footer ────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...dark2);
    doc.rect(0, H - 12, W, 12, 'F');
    doc.setFillColor(...amber);
    doc.rect(0, H - 13, W, 1, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado el ${new Date().toLocaleDateString('es-CO')} · Gastos Diarios`, 14, H - 5);
    doc.text(`Página ${i} de ${pageCount}`, W - 14, H - 5, { align: 'right' });
  }

  // ── Encriptar y guardar ───────────────────────────
  doc.save(`gastos_${MESES[Number(mes)]}_${anio}.pdf`, {
    userPassword: password,
    ownerPassword: password + '_owner',
    userPermissions: ['print', 'copy']
  });
}

// ── SECCIÓN GRÁFICOS ───────────────────────────────
async function initGraficos() {
  const anioSel = document.getElementById('graf-anio');
  const mesSel = document.getElementById('graf-mes');

  try {
    const periodos = await api('/gastos/periodos');
    anioSel.innerHTML = '';

    const anios = [...new Set(periodos.map(p => p.anio))];
    anios.forEach(a => {
      const o = new Option(a, a);
      anioSel.appendChild(o);
    });

    // Al cambiar año actualizar meses
    anioSel.addEventListener('change', () => actualizarMesesGraf(periodos));
    actualizarMesesGraf(periodos);

    // Cargar gráficos automáticamente
    const anio = anioSel.value;
    const mes = mesSel.value;
    cargarGraficos(anio, mes);
  } catch (e) {
    console.error(e);
  }
}

function actualizarMesesGraf(periodos) {
  const anio = document.getElementById('graf-anio').value;
  const mesSel = document.getElementById('graf-mes');
  mesSel.innerHTML = '<option value="">Todo el año</option>';
  periodos
    .filter(p => String(p.anio) === String(anio))
    .sort((a, b) => a.mes - b.mes)  // ← agrega esto
    .forEach(p => {
      mesSel.appendChild(new Option(MESES[p.mes], p.mes));
    });
}

document.getElementById('btn-graf-cargar').addEventListener('click', async () => {
  const anio = document.getElementById('graf-anio').value;
  const mes = document.getElementById('graf-mes').value;
  await cargarGraficos(anio, mes);
});

const CHART_COLORS = ['#f5a623', '#3ecf8e', '#60a5fa', '#a78bfa', '#fb923c', '#f87171', '#fbbf24'];

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

  const byDay = {};
  gastos.forEach(g => {
    // Si hay mes seleccionado mostrar solo el día, si no mostrar dd/mm
    const key = mes
      ? g.fecha.slice(8, 10)
      : MESES[Number(g.fecha.slice(5, 7))];
    byDay[key] = (byDay[key] || 0) + Number(g.monto);
  });

  const labels = Object.keys(byDay).sort();
  const data = labels.map(k => byDay[k]);

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
        x: { ticks: { color: '#5e5e6e', maxRotation: 45 }, grid: { color: '#1c1c21' } },
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
    const delAnio = meses
      .filter(m => Number(m.anio) === Number(anio))
      .sort((a, b) => a.mes - b.mes);
    const labels = delAnio.map(m => MESES[m.mes]);
    const data = delAnio.map(m => Number(m.total));

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
  } catch (e) { console.error(e); }
}

// ── AVATAR NAVBAR ─────────────────────────────────
function renderNavAvatar() {
  const navNombre = document.getElementById('nav-nombre');
  let navAvatar = document.getElementById('nav-avatar');

  if (!navAvatar) {
    navAvatar = document.createElement('div');
    navAvatar.id = 'nav-avatar';
    navAvatar.style.cssText = 'width:28px;height:28px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid var(--accent);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.85rem;background:var(--accent-dim);';
    navNombre.parentNode.insertBefore(navAvatar, navNombre);
    navAvatar.addEventListener('click', abrirPerfilModal);
  }

  if (usuario && usuario.avatar) {
    navAvatar.innerHTML = `<img src="${usuario.avatar}" style="width:100%;height:100%;object-fit:cover;"/>`;
  } else {
    navAvatar.innerHTML = '👤';
  }
}

// ── NOTIFICACIÓN DE SESIÓN ────────────────────────
function sessionNotification(msg) {
  // Eliminar si ya existe
  const prev = document.getElementById('session-notif');
  if (prev) prev.remove();

  const notif = document.createElement('div');
  notif.id = 'session-notif';
  notif.style.cssText = `
    position: fixed;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg3);
    border: 1px solid rgba(245,166,35,.4);
    color: var(--text);
    border-radius: 10px;
    padding: .65rem 1.25rem;
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: .75rem;
    box-shadow: 0 8px 24px rgba(0,0,0,.4);
    z-index: 9999;
    max-width: 340px;
    width: calc(100% - 2rem);
    animation: slideUp .3s ease;
  `;
  notif.innerHTML = `
    <span style="font-size:1.1rem;">📱</span>
    <span style="flex:1;">${msg}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:1rem;padding:0;">✕</button>
  `;
  document.body.appendChild(notif);

  // Auto-cerrar a los 6 segundos
  setTimeout(() => notif?.remove(), 6000);
}

// ── Init app ──────────────────────────────────────
function initApp() {
  if (!token || !usuario) return;
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('nav-nombre').textContent = usuario.nombre.split(' ')[0];
  setDefaultDateTime();
  showSection('nuevo');

  cargarBilleteras();
  renderNavAvatar();
  bindMontoInput('f-monto');
  bindMontoInput('e-monto');
}

// ── Toggle contraseña ─────────────────────────────
document.querySelectorAll('.btn-eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    btn.textContent = visible ? '👁' : '🙈';
  });
});

// ── BILLETERAS ────────────────────────────────────
let billeteras = [];
let billteraActiva = null;
let emojiSeleccionado = '💳';

async function cargarBilleteras() {
  try {
    billeteras = await api('/billeteras');
    renderFabBilleteras();
    actualizarSelectBilltera();
  } catch(e) { console.error(e); }
}

function renderFabBilleteras() {
  const lista = document.getElementById('wallet-drawer-lista');
  lista.innerHTML = '';

  if (!billeteras.length) {
    lista.innerHTML = '<div class="empty-state" style="padding:2rem 0;"><span class="empty-icon">💳</span><p>No tienes billeteras</p></div>';
    return;
  }

  billeteras.forEach(b => {
    const item = document.createElement('div');
    item.className = 'wallet-drawer-item';
    item.innerHTML = `
      <span class="wallet-drawer-item-emoji">${b.emoji}</span>
      <div class="wallet-drawer-item-info">
        <div class="wallet-drawer-item-nombre">${b.nombre}</div>
        <div class="wallet-drawer-item-saldo ${Number(b.saldo) < 0 ? 'negativo' : ''}">${fmt(b.saldo)}</div>
      </div>`;
    item.addEventListener('click', () => {
      abrirBillteraModal(b);
    });
    lista.appendChild(item);
  });
}

function actualizarSelectBilltera() {
  ['f-billtera', 'e-billtera'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">Sin especificar</option>';
    billeteras.forEach(b => {
      sel.appendChild(new Option(`${b.emoji} ${b.nombre} — ${fmt(b.saldo)}`, b.id));
    });
    if (val) sel.value = val;
  });
}

function abrirBillteraModal(b) {
  // cerrarWalletDrawer();
  billteraActiva = b;
  document.getElementById('billtera-modal-titulo').textContent = `${b.emoji} ${b.nombre}`;
  const saldoEl = document.getElementById('billtera-saldo-display');
  saldoEl.textContent = fmt(b.saldo);
  saldoEl.className = 'billtera-saldo-grande' + (Number(b.saldo) < 0 ? ' negativo' : '');
  document.getElementById('recarga-manual-input').value = '';
  document.getElementById('billtera-error').classList.add('hidden');
  document.getElementById('billtera-modal').classList.remove('hidden');
}

// ── WALLET DRAWER ─────────────────────────────────
function abrirWalletDrawer() {
  document.getElementById('wallet-drawer').classList.add('open');
  document.getElementById('wallet-drawer-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function cerrarWalletDrawer() {
  document.getElementById('wallet-drawer').classList.remove('open');
  document.getElementById('wallet-drawer-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('fab-wallet-btn').addEventListener('click', abrirWalletDrawer);
document.getElementById('wallet-drawer-close').addEventListener('click', cerrarWalletDrawer);
document.getElementById('wallet-drawer-overlay').addEventListener('click', cerrarWalletDrawer);

// Recargar o restar billetera
let modoRecarga = 'recargar'; // 'recargar' | 'restar'

document.getElementById('toggle-recargar').addEventListener('click', () => {
  modoRecarga = 'recargar';
  document.getElementById('toggle-recargar').classList.add('active');
  document.getElementById('toggle-restar').classList.remove('active');
  document.querySelectorAll('.btn-recarga').forEach(b => {
    b.textContent = `+$${Number(b.dataset.monto) >= 1000 ? (Number(b.dataset.monto)/1000)+'K' : b.dataset.monto}`;
    b.classList.remove('btn-recarga-restar');
  });
});

document.getElementById('toggle-restar').addEventListener('click', () => {
  modoRecarga = 'restar';
  document.getElementById('toggle-restar').classList.add('active');
  document.getElementById('toggle-recargar').classList.remove('active');
  document.querySelectorAll('.btn-recarga').forEach(b => {
    b.textContent = `-$${Number(b.dataset.monto) >= 1000 ? (Number(b.dataset.monto)/1000)+'K' : b.dataset.monto}`;
    b.classList.add('btn-recarga-restar');
  });
});

document.getElementById('billtera-modal-close').addEventListener('click', () => {
  document.getElementById('billtera-modal').classList.add('hidden');
});
document.getElementById('billtera-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('billtera-modal'))
    document.getElementById('billtera-modal').classList.add('hidden');
});

// Botones de recarga rápida
document.querySelectorAll('.btn-recarga').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!billteraActiva) return;

    const raw = Number(btn.dataset.monto);
    const monto = modoRecarga === 'restar' ? -raw : raw;

    try {
      const updated = await api(`/billeteras/${billteraActiva.id}/recargar`, {
        method: 'PUT',
        body: JSON.stringify({ monto })
      });

      billteraActiva = updated;

      const idx = billeteras.findIndex(b => b.id === updated.id);

      if (idx !== -1) billeteras[idx] = updated;
      abrirBillteraModal(updated);
      renderFabBilleteras();
      actualizarSelectBilltera();
    } catch(e) { 
        showError('billtera-error', e.message || 'Saldo insuficiente');
    }
  });
});

// Recarga manual
document.getElementById('btn-recarga-manual').addEventListener('click', async () => {
  if (!billteraActiva) return;
  const raw = Number(document.getElementById('recarga-manual-input').value);
  if (!raw || raw <= 0) return;
  const monto = modoRecarga === 'restar' ? -raw : raw;
  try {
    const updated = await api(`/billeteras/${billteraActiva.id}/recargar`, {
      method: 'PUT',
      body: JSON.stringify({ monto })
    });
    billteraActiva = updated;
    const idx = billeteras.findIndex(b => b.id === updated.id);
    if (idx !== -1) billeteras[idx] = updated;
    abrirBillteraModal(updated);
    renderFabBilleteras();
    actualizarSelectBilltera();

    // limpiar input después de éxito
    document.getElementById('recarga-manual-input').value = '';
  } catch(e) { 
      showError('billtera-error', e.message || 'No se pudo realizar la operación');
  }
});

// Eliminar billtera
document.getElementById('btn-billtera-eliminar').addEventListener('click', () => {
  if (!billteraActiva) return;
  document.getElementById('billtera-modal').classList.add('hidden');
  confirmDelete(async () => {
    try {
      await api(`/billeteras/${billteraActiva.id}`, { method: 'DELETE' });
      billeteras = billeteras.filter(b => b.id !== billteraActiva.id);
      renderFabBilleteras();
      actualizarSelectBilltera();
    } catch(e) { 
        // document.getElementById('billtera-modal').classList.remove('hidden');
        showError('nueva-billtera-error', e.message);
    }
  }, `¿Eliminar ${billteraActiva.nombre}?`);
});

// Modal nueva billtera
document.getElementById('fab-add-billtera').addEventListener('click', () => {
  document.getElementById('nueva-billtera-nombre').value = '';
  document.getElementById('nueva-billtera-saldo').value = '';
  document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('active'));
  document.querySelector('.emoji-opt[data-emoji="💳"]').classList.add('active');
  emojiSeleccionado = '💳';
  document.getElementById('nueva-billtera-modal').classList.remove('hidden');
});
document.getElementById('nueva-billtera-close').addEventListener('click', () => {
  document.getElementById('nueva-billtera-modal').classList.add('hidden');
});
document.querySelectorAll('.emoji-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('active'));
    btn.classList.add('active');
    emojiSeleccionado = btn.dataset.emoji;
  });
});

document.getElementById('btn-crear-billtera').addEventListener('click', async () => {
  const nombre = document.getElementById('nueva-billtera-nombre').value.trim();
  const saldo  = document.getElementById('nueva-billtera-saldo').value;
  if (!nombre) {
    showError('nueva-billtera-error', 'El nombre es requerido');
    return;
  }
  try {
    document.getElementById('btn-crear-billtera').textContent = 'Creando…';
    const nueva = await api('/billeteras', {
      method: 'POST',
      body: JSON.stringify({ nombre, saldo: Number(saldo) || 0, emoji: emojiSeleccionado })
    });
    billeteras.push(nueva);
    document.getElementById('nueva-billtera-modal').classList.add('hidden');
    renderFabBilleteras();
    actualizarSelectBilltera();
  } catch(e) {
    showError('nueva-billtera-error', e.message);
  } finally {
    document.getElementById('btn-crear-billtera').textContent = 'Crear billtera';
  }
});

// ── RECURRENTES ───────────────────────────────────
let recurrentes = [];

async function cargarRecurrentes() {
  try {
    recurrentes = await api('/recurrentes');
    renderRecurrentesLista();
    actualizarSelectsRecurrentes();
  } catch(e) { console.error(e); }
}

// ── VERIFICAR PENDIENTES (CORREGIDO) ─────────────────────────────

async function verificarPendientes() {
  try {
    const pendientes = await api('/recurrentes/pendientes');

    // Ocultar banner y lista si no hay pendientes reales
    const banner = document.getElementById('banner-recurrentes');
    const wrap = document.getElementById('recurrentes-pendientes-wrap');

    if (!pendientes || pendientes.length === 0) {
      banner.classList.add('hidden');
      wrap.classList.add('hidden');
      return;
    }

    // Mostrar banner con conteo correcto
    document.getElementById('banner-texto').textContent = 
      `Tienes ${pendientes.length} gasto${pendientes.length > 1 ? 's' : ''} recurrente${pendientes.length > 1 ? 's' : ''} pendiente${pendientes.length > 1 ? 's' : ''} este mes`;

    banner.classList.remove('hidden');

    // Auto-ocultar después de 25 segundos (más elegante)
    setTimeout(() => {
      banner.classList.add('hidden');
    }, 25000);

    // Renderizar lista en la sección Resumen
    renderPendientes(pendientes);

  } catch (e) {
    console.error('Error al verificar pendientes:', e);
  }
}

function renderPendientes(pendientes) {
  const wrap = document.getElementById('recurrentes-pendientes-wrap');
  const lista = document.getElementById('recurrentes-pendientes-lista');
  lista.innerHTML = '';

  if (!pendientes.length) {
    wrap.classList.add('hidden');
    return;
  }

  wrap.classList.remove('hidden');

  pendientes.forEach(r => {
    const div = document.createElement('div');
    div.className = 'recurrente-pendiente-item';

    // Mejoramos el texto mostrado
    const billteraInfo = r.billtera_nombre 
      ? ` · ${r.billtera_emoji || ''} ${r.billtera_nombre}` 
      : '';

    div.innerHTML = `
      <div class="rp-info">
        <div class="rp-nombre">${r.nombre}</div>
        <div class="rp-detalle">
          Día ${r.dia_mes} de cada mes ${billteraInfo}
        </div>
      </div>
      <div class="rp-monto">${fmt(r.monto)}</div>
      <button class="btn-rp-registrar">Registrar ahora</button>`;

    div.querySelector('.btn-rp-registrar').addEventListener('click', () => {
      abrirRegistrarRecurrente(r);
    });

    lista.appendChild(div);
  });
}

let recurrenteEditId = null;

function abrirEditarRecurrente(r) {
  recurrenteEditId = r.id;
  document.getElementById('rec-nombre').value      = r.nombre;
  document.getElementById('rec-monto').value       = r.monto;
  document.getElementById('rec-dia').value         = r.dia_mes;
  const catsFijas = ['Comida', 'Transporte', 'Entretenimiento', 'Ropa', 'Otros'];
  if (catsFijas.includes(r.categoria)) {
    document.getElementById('rec-categoria').value = r.categoria;
  } else {
    document.getElementById('rec-categoria').value = 'Otros';
  }
  document.getElementById('rec-descripcion').value = r.descripcion || '';
  document.getElementById('rec-billtera').value    = r.billtera_id || '';

  const btn = document.getElementById('btn-crear-recurrente');
  btn.textContent = 'Actualizar recurrente';
  btn.dataset.modo = 'editar';

  document.getElementById('rec-nombre').scrollIntoView({ behavior: 'smooth' });
}

function renderRecurrentesLista() {
  const lista = document.getElementById('recurrentes-lista');
  lista.innerHTML = '';

  if (!recurrentes.length) {
    lista.innerHTML = '<div class="empty-state" style="padding:1rem 0"><span class="empty-icon">◎</span><p>No tienes gastos recurrentes</p></div>';
    return;
  }

  recurrentes.forEach(r => {
    const div = document.createElement('div');
    div.className = 'recurrente-item';
    div.innerHTML = `
      <div class="recurrente-item-top">
        <div class="recurrente-item-info">
          <div class="recurrente-item-nombre">${r.nombre}</div>
          <div class="recurrente-item-detalle">Día ${r.dia_mes} de cada mes · ${r.categoria}</div>
        </div>
        <div class="recurrente-item-monto">${fmt(r.monto)}</div>
      </div>
      <div class="recurrente-item-bottom">
        <div style="display:flex;gap:.4rem;">
          <button class="btn-edit btn-rec-editar">Editar</button>
          <button class="btn-rec-eliminar">Eliminar</button>
        </div>
      </div>`;
    div.querySelector('.btn-rec-editar').addEventListener('click', () => abrirEditarRecurrente(r));
    div.querySelector('.btn-rec-eliminar').addEventListener('click', () => {
      confirmDelete(async () => {
        await api(`/recurrentes/${r.id}`, { method: 'DELETE' });
        await cargarRecurrentes();
      }, `¿Eliminar "${r.nombre}"?`);
    });
    lista.appendChild(div);
  });
}

function actualizarSelectsRecurrentes() {
  ['rec-billtera', 'rr-billtera'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">Sin especificar</option>';
    billeteras.forEach(b => {
      sel.appendChild(new Option(`${b.emoji} ${b.nombre}`, b.id));
    });
    if (val) sel.value = val;
  });
}

function abrirRegistrarRecurrente(r) {
  const now = new Date();
  document.getElementById('registrar-rec-titulo').textContent = `Registrar: ${r.nombre}`;
  document.getElementById('rr-fecha').value = now.toISOString().slice(0,10);
  document.getElementById('rr-hora').value  = now.toTimeString().slice(0,5);
  document.getElementById('rr-monto').value = r.monto;
  document.getElementById('rr-categoria').value = r.categoria;
  document.getElementById('rr-descripcion').value = r.descripcion || r.nombre;

  const rrSel = document.getElementById('rr-billtera');
  rrSel.innerHTML = '<option value="">Sin especificar</option>';
  billeteras.forEach(b => rrSel.appendChild(new Option(`${b.emoji} ${b.nombre}`, b.id)));
  if (r.billtera_id) rrSel.value = r.billtera_id;

  document.getElementById('registrar-rec-modal').classList.remove('hidden');
}

// Banner cerrar
document.getElementById('banner-close').addEventListener('click', () => {
  document.getElementById('banner-recurrentes').classList.add('hidden');
});

// Banner ver pendientes
document.getElementById('banner-btn-ver').addEventListener('click', () => {
  document.getElementById('banner-recurrentes').classList.add('hidden');
  showSection('resumen');
});

// Modal gestionar recurrentes
document.getElementById('btn-gestionar-recurrentes').addEventListener('click', async () => {
  await cargarRecurrentes();
  document.getElementById('recurrentes-modal').classList.remove('hidden');
});
document.getElementById('recurrentes-modal-close').addEventListener('click', () => {
  document.getElementById('recurrentes-modal').classList.add('hidden');
});

// Crear recurrente
document.getElementById('btn-crear-recurrente').addEventListener('click', async () => {
  const nombre = document.getElementById('rec-nombre').value.trim();
  const monto  = document.getElementById('rec-monto').value;
  const dia    = document.getElementById('rec-dia').value;
  const cat    = document.getElementById('rec-categoria').value;
  const desc   = document.getElementById('rec-descripcion').value.trim();
  const bill   = document.getElementById('rec-billtera').value;
  const btn    = document.getElementById('btn-crear-recurrente');
  const modoEditar = btn.dataset.modo === 'editar';

  if (!nombre || !monto || !dia || !cat)
    return showError('rec-error', 'Nombre, monto, día y categoría son obligatorios');
  if (dia < 1 || dia > 31)
    return showError('rec-error', 'El día debe estar entre 1 y 31');

  try {
    btn.textContent = 'Guardando…';

    if (modoEditar) {
      await api(`/recurrentes/${recurrenteEditId}`, {
        method: 'PUT',
        body: JSON.stringify({ nombre, monto: Number(monto), dia_mes: Number(dia), categoria: cat, descripcion: desc, billtera_id: bill || null, activo: 1 })
      });
      recurrenteEditId = null;
      btn.dataset.modo = 'crear';
    } else {
      await api('/recurrentes', {
        method: 'POST',
        body: JSON.stringify({ nombre, monto: Number(monto), dia_mes: Number(dia), categoria: cat, descripcion: desc, billtera_id: bill || null })
      });
    }

    // Limpiar formulario
    document.getElementById('rec-nombre').value = '';
    document.getElementById('rec-monto').value = '';
    document.getElementById('rec-dia').value = '';
    document.getElementById('rec-categoria').value = '';
    document.getElementById('rec-descripcion').value = '';
    document.getElementById('rec-billtera').value = '';

    await cargarRecurrentes();
    await verificarPendientes();
  } catch(e) {
    showError('rec-error', e.message);
  } finally {
    btn.textContent = 'Guardar recurrente';
    btn.dataset.modo = 'crear';
  }
});

// Modal registrar recurrente
document.getElementById('registrar-rec-close').addEventListener('click', () => {
  document.getElementById('registrar-rec-modal').classList.add('hidden');
});
document.getElementById('btn-rr-cancelar').addEventListener('click', () => {
  document.getElementById('registrar-rec-modal').classList.add('hidden');
});

document.getElementById('btn-rr-guardar').addEventListener('click', async () => {
  const fecha = document.getElementById('rr-fecha').value;
  const hora  = document.getElementById('rr-hora').value;
  const monto = document.getElementById('rr-monto').value;
  const cat   = document.getElementById('rr-categoria').value;
  const desc  = document.getElementById('rr-descripcion').value.trim();
  const bill  = document.getElementById('rr-billtera').value;

  if (!fecha || !hora || !monto || !cat)
    return showError('rr-error', 'Completa todos los campos obligatorios');

  try {
    document.getElementById('btn-rr-guardar').textContent = 'Guardando…';
    await api('/gastos', {
      method: 'POST',
      body: JSON.stringify({ fecha, hora, monto: Number(monto), categoria: cat, descripcion: desc, billtera_id: bill || null })
    });
    document.getElementById('registrar-rec-modal').classList.add('hidden');
    await verificarPendientes();
    cargarResumen();
    cargarBilleteras();
  } catch(e) {
    showError('rr-error', e.message);
  } finally {
    document.getElementById('btn-rr-guardar').textContent = 'Guardar gasto';
  }
});

// ── TEMA ──────────────────────────────────────────
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = tema === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('gd_tema', tema);
}

const temaGuardado = localStorage.getItem('gd_tema') || 'dark';
aplicarTema(temaGuardado);

document.getElementById('btn-theme').addEventListener('click', () => {
  const actual = document.documentElement.getAttribute('data-theme');
  aplicarTema(actual === 'dark' ? 'light' : 'dark');
});

// ── PERFIL ────────────────────────────────────────
function abrirPerfilModal() {
  document.getElementById('perfil-nombre').value      = usuario.nombre;
  document.getElementById('perfil-email').value       = usuario.email;
  document.getElementById('perfil-pass-actual').value = '';
  document.getElementById('perfil-pass-nueva').value  = '';
  document.getElementById('perfil-info-nombre').textContent = usuario.nombre;
  document.getElementById('perfil-info-email').textContent  = usuario.email;
  document.getElementById('perfil-error').classList.add('hidden');
  document.getElementById('perfil-success').classList.add('hidden');

  // Resetear ojos
  document.getElementById('perfil-pass-actual').type = 'password';
  document.getElementById('perfil-pass-nueva').type  = 'password';

  // Cargar avatar actual
  const avatarImg   = document.getElementById('perfil-avatar-img');
  const avatarEmoji = document.getElementById('perfil-avatar-emoji');
  if (usuario.avatar) {
    avatarImg.src = usuario.avatar;
    avatarImg.style.display   = 'block';
    avatarEmoji.style.display = 'none';
  } else {
    avatarImg.style.display   = 'none';
    avatarEmoji.style.display = 'block';
  }

  // Limpiar selección previa de imagen
  document.getElementById('perfil-avatar-input').value      = '';
  document.getElementById('perfil-avatar-input').dataset.base64 = '';

  document.getElementById('perfil-modal').classList.remove('hidden');
}

// Click en el círculo abre el file input
document.getElementById('perfil-avatar-circle').addEventListener('click', () => {
  document.getElementById('perfil-avatar-input').click();
});

// Al seleccionar imagen
document.getElementById('perfil-avatar-input').addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;

  // Validar tamaño máximo 2MB
  if (file.size > 2 * 1024 * 1024) {
    showError('perfil-error', 'La imagen no puede superar 2MB');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;

    // Redimensionar antes de guardar
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 200; // px cuadrado
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Recortar al centro (crop cuadrado)
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);

      const resized = canvas.toDataURL('image/jpeg', 0.8);

      // Mostrar preview
      const avatarImg = document.getElementById('perfil-avatar-img');
      avatarImg.src = resized;
      avatarImg.style.display = 'block';
      document.getElementById('perfil-avatar-emoji').style.display = 'none';

      // Guardar temporalmente en el input
      document.getElementById('perfil-avatar-input').dataset.base64 = resized;
    };
    img.src = base64;
  };
  reader.readAsDataURL(file);
});

document.getElementById('nav-nombre').addEventListener('click', abrirPerfilModal);

document.getElementById('perfil-modal-close').addEventListener('click', () => {
  document.getElementById('perfil-modal').classList.add('hidden');
});
document.getElementById('btn-perfil-cancelar').addEventListener('click', () => {
  document.getElementById('perfil-modal').classList.add('hidden');
});
document.getElementById('perfil-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('perfil-modal'))
    document.getElementById('perfil-modal').classList.add('hidden');
});

document.getElementById('btn-perfil-guardar').addEventListener('click', async () => {
  const nombre     = document.getElementById('perfil-nombre').value.trim();
  const email      = document.getElementById('perfil-email').value.trim();
  const passActual = document.getElementById('perfil-pass-actual').value;
  const passNueva  = document.getElementById('perfil-pass-nueva').value;

  if (!nombre || !email)
    return showError('perfil-error', 'El nombre y el correo son obligatorios');

  if (passNueva && !passActual)
    return showError('perfil-error', 'Debes ingresar tu contraseña actual para cambiarla');
  if (passActual && !passNueva)
    return showError('perfil-error', 'Ingresa la nueva contraseña');

  try {
    const btn = document.getElementById('btn-perfil-guardar');
    btn.textContent = 'Guardando…';

    const avatarBase64 = document.getElementById('perfil-avatar-input').dataset.base64 || undefined;

    const body = { nombre, email };
    if (passNueva) {
      body.password_actual = passActual;
      body.password_nueva  = passNueva;
    }
    if (avatarBase64) body.avatar = avatarBase64;

    const res = await api('/auth/perfil', { method: 'PUT', body: JSON.stringify(body) });

    // Actualizar sesión local
    usuario.nombre = res.usuario.nombre;
    usuario.email  = res.usuario.email;
    if (res.usuario.avatar) usuario.avatar = res.usuario.avatar;
    localStorage.setItem('gd_usuario', JSON.stringify(usuario));

    // Actualizar navbar
    document.getElementById('nav-nombre').textContent = usuario.nombre.split(' ')[0];
    renderNavAvatar();

    // Limpiar contraseñas y archivo
    document.getElementById('perfil-pass-actual').value = '';
    document.getElementById('perfil-pass-nueva').value  = '';
    document.getElementById('perfil-avatar-input').value = '';
    document.getElementById('perfil-avatar-input').dataset.base64 = '';

    // Actualizar info visible
    document.getElementById('perfil-info-nombre').textContent = usuario.nombre;
    document.getElementById('perfil-info-email').textContent  = usuario.email;
    document.getElementById('perfil-error').classList.add('hidden');
    document.getElementById('perfil-success').classList.remove('hidden');
    setTimeout(() => document.getElementById('perfil-success').classList.add('hidden'), 3000);

  } catch (e) {
    showError('perfil-error', e.message);
  } finally {
    document.getElementById('btn-perfil-guardar').textContent = 'Guardar';
  }
});

// ── COMPARAR MESES ────────────────────────────────
async function iniciarComparar() {
  document.getElementById('lista-meses').classList.add('hidden');
  document.getElementById('mes-detalle').classList.add('hidden');
  document.getElementById('comparar-view').classList.remove('hidden');
  document.getElementById('comparar-resultado').classList.add('hidden');

  // Poblar selects con periodos disponibles
  try {
    const periodos = await api('/gastos/periodos');
    const opts = periodos
      .sort((a, b) => b.anio - a.anio || b.mes - a.mes)
      .map(p => `<option value="${p.anio}-${p.mes}">${MESES[p.mes]} ${p.anio}</option>`)
      .join('');
    document.getElementById('comparar-mes-a').innerHTML = opts;
    document.getElementById('comparar-mes-b').innerHTML = opts;
    // Seleccionar segundo por defecto para mes B
    if (document.getElementById('comparar-mes-b').options.length > 1)
      document.getElementById('comparar-mes-b').selectedIndex = 1;
  } catch(e) { console.error(e); }
}

async function ejecutarComparar() {
  const [anioA, mesA] = document.getElementById('comparar-mes-a').value.split('-');
  const [anioB, mesB] = document.getElementById('comparar-mes-b').value.split('-');

  if (anioA === anioB && mesA === mesB) {
    alert('Selecciona dos meses diferentes');
    return;
  }

  try {
    document.getElementById('btn-comparar-cargar').textContent = 'Cargando…';
    const [gastosA, gastosB] = await Promise.all([
      api(`/gastos?anio=${anioA}&mes=${mesA}`),
      api(`/gastos?anio=${anioB}&mes=${mesB}`)
    ]);

    const totalA = gastosA.reduce((s, g) => s + Number(g.monto), 0);
    const totalB = gastosB.reduce((s, g) => s + Number(g.monto), 0);
    const diffAbs = totalB - totalA;
    const diffPct = totalA > 0 ? ((diffAbs / totalA) * 100).toFixed(1) : '—';

    // Totales
    const labelA = `${MESES[Number(mesA)]} ${anioA}`;
    const labelB = `${MESES[Number(mesB)]} ${anioB}`;

    document.getElementById('comp-total-a').innerHTML = `
      <div class="comp-mes-label">Mes A</div>
      <div class="comp-mes-nombre">${labelA}</div>
      <div class="comp-total-valor">${fmt(totalA)}</div>`;

    document.getElementById('comp-total-b').innerHTML = `
      <div class="comp-mes-label">Mes B</div>
      <div class="comp-mes-nombre">${labelB}</div>
      <div class="comp-total-valor">${fmt(totalB)}</div>`;

    const diffClass = diffAbs > 0 ? 'diff-sube' : diffAbs < 0 ? 'diff-baja' : 'diff-igual';
    const diffSign = diffAbs > 0 ? '▲' : diffAbs < 0 ? '▼' : '=';
    document.getElementById('comp-diff').innerHTML = `
      <div class="diff-valor ${diffClass}">${diffSign} ${diffPct}%</div>
      <div class="diff-label">${diffAbs >= 0 ? '+' : ''}${fmt(diffAbs)}</div>`;

    // Categorías
    const catsA = {};
    const catsB = {};
    gastosA.forEach(g => catsA[g.categoria] = (catsA[g.categoria] || 0) + Number(g.monto));
    gastosB.forEach(g => catsB[g.categoria] = (catsB[g.categoria] || 0) + Number(g.monto));
    const todasCats = [...new Set([...Object.keys(catsA), ...Object.keys(catsB)])];
    todasCats.sort((a, b) => (catsB[b] || 0) - (catsA[a] || 0));

    const tabla = document.getElementById('comparar-tabla-cats');
    tabla.innerHTML = `
      <div class="comparar-cat-tabla">
        <div class="comparar-cat-header">
          <span>Categoría</span>
          <span>${labelA}</span>
          <span>${labelB}</span>
          <span style="text-align:right">Dif.</span>
        </div>
        ${todasCats.map(cat => {
          const vA = catsA[cat] || 0;
          const vB = catsB[cat] || 0;
          const d = vB - vA;
          const dClass = d > 0 ? 'sube' : d < 0 ? 'baja' : 'igual';
          const dSign = d > 0 ? '▲' : d < 0 ? '▼' : '=';
          return `
            <div class="comparar-cat-row">
              <span class="comp-cat-nombre">${getCategoriaBadge(cat)}</span>
              <span class="comp-cat-val ${vA > 0 ? 'activo' : ''}">${vA > 0 ? fmt(vA) : '—'}</span>
              <span class="comp-cat-val ${vB > 0 ? 'activo' : ''}">${vB > 0 ? fmt(vB) : '—'}</span>
              <span class="comp-cat-diff ${dClass}">${dSign} ${fmt(Math.abs(d))}</span>
            </div>`;
        }).join('')}
      </div>`;

    document.getElementById('comparar-resultado').classList.remove('hidden');
  } catch(e) {
    console.error(e);
  } finally {
    document.getElementById('btn-comparar-cargar').textContent = 'Comparar';
  }
}

document.getElementById('btn-ir-comparar').addEventListener('click', iniciarComparar);
document.getElementById('btn-back-comparar').addEventListener('click', () => {
  document.getElementById('comparar-view').classList.add('hidden');
  document.getElementById('lista-meses').classList.remove('hidden');
});
document.getElementById('btn-comparar-cargar').addEventListener('click', ejecutarComparar);

// ── ACTIVIDAD LOG ─────────────────────────────────
const ACCION_META = {
  CREAR:    { icon: '＋', color: 'var(--green)' },
  EDITAR:   { icon: '✎',  color: 'var(--blue)'  },
  ELIMINAR: { icon: '✕',  color: 'var(--red)'   },
  RECARGAR: { icon: '↑',  color: 'var(--accent)' },
  RESTAR:   { icon: '↓',  color: 'var(--text3)'  },
  LOGIN:    { icon: '→',  color: 'var(--text3)'  },
  REGISTRO: { icon: '★',  color: 'var(--accent)' },
};

const ENTIDAD_LABEL = {
  gasto: 'Gasto', billtera: 'Billtera',
  recurrente: 'Recurrente', perfil: 'Perfil'
};

document.getElementById('btn-ver-actividad').addEventListener('click', async () => {
  document.getElementById('perfil-modal').classList.add('hidden');
  const lista = document.getElementById('actividad-lista');
  lista.innerHTML = '<div class="loading-row"><span class="spinner"></span> Cargando…</div>';
  document.getElementById('actividad-modal').classList.remove('hidden');

  try {
    const logs = await api('/actividad/mia');
    if (!logs.length) {
      lista.innerHTML = '<div class="empty-state"><span class="empty-icon">◎</span><p>Sin actividad reciente</p></div>';
      return;
    }

    // Agrupar por fecha
    const grupos = {};
    logs.forEach(l => {
      const fecha = new Date(l.created_at);
      const key = fecha.toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' });
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(l);
    });

    lista.innerHTML = Object.entries(grupos).map(([fecha, items]) => `
      <div class="actividad-grupo">
        <div class="actividad-grupo-fecha">${fecha}</div>
        ${items.map(l => {
          const meta = ACCION_META[l.accion] || { icon: '·', color: 'var(--text3)' };
          const entidad = ENTIDAD_LABEL[l.entidad] || l.entidad;
          const hora = fmtHora(new Date(l.created_at).toTimeString());
          return `
            <div class="actividad-item">
              <div class="actividad-icon" style="color:${meta.color};border-color:${meta.color}20;">
                ${meta.icon}
              </div>
              <div class="actividad-info">
                <div class="actividad-titulo">
                  <span style="color:${meta.color};font-weight:700;font-size:12px;">${l.accion}</span>
                  <span class="actividad-entidad">${entidad}</span>
                </div>
                ${l.detalle ? `<div class="actividad-detalle">${l.detalle}</div>` : ''}
                <div class="actividad-fecha">${hora}</div>
              </div>
            </div>`;
        }).join('')}
      </div>`
    ).join('');
  } catch(e) {
    lista.innerHTML = `<div class="empty-state"><p>Error: ${e.message}</p></div>`;
  }
});

document.getElementById('actividad-modal-close').addEventListener('click', () => {
  document.getElementById('actividad-modal').classList.add('hidden');
});
document.getElementById('actividad-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('actividad-modal'))
    document.getElementById('actividad-modal').classList.add('hidden');
});

// ── TRANSFERIR BILLTERA ───────────────────────────
document.getElementById('btn-billtera-transferir').addEventListener('click', () => {
  if (!billteraActiva) return;
  if (billeteras.length < 2) {
    alert('Necesitas al menos 2 billeteras para transferir');
    return;
  }

  // Info de origen
  document.getElementById('transferir-origen-nombre').textContent =
    `${billteraActiva.emoji} ${billteraActiva.nombre}`;
  document.getElementById('transferir-origen-saldo').textContent =
    fmt(billteraActiva.saldo);

  // Poblar destinos (todas menos la activa)
  const sel = document.getElementById('transferir-destino');
  sel.innerHTML = '<option value="">Seleccionar…</option>';
  billeteras
    .filter(b => b.id !== billteraActiva.id)
    .forEach(b => sel.appendChild(new Option(`${b.emoji} ${b.nombre} — ${fmt(b.saldo)}`, b.id)));

  document.getElementById('transferir-monto').value = '';
  document.getElementById('transferir-error').classList.add('hidden');
  document.getElementById('billtera-modal').classList.add('hidden');
  document.getElementById('transferir-modal').classList.remove('hidden');
});

document.getElementById('transferir-modal-close').addEventListener('click', () => {
  document.getElementById('transferir-modal').classList.add('hidden');
});
document.getElementById('transferir-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('transferir-modal'))
    document.getElementById('transferir-modal').classList.add('hidden');
});

document.getElementById('btn-transferir-confirmar').addEventListener('click', async () => {
  const destino_id = document.getElementById('transferir-destino').value;
  const monto = Number(document.getElementById('transferir-monto').value);

  if (!destino_id) return showError('transferir-error', 'Selecciona una billtera de destino');
  if (!monto || monto <= 0) return showError('transferir-error', 'Ingresa un monto válido');

  try {
    document.getElementById('btn-transferir-confirmar').textContent = 'Transfiriendo…';
    const result = await api('/billeteras/transferir', {
      method: 'POST',
      body: JSON.stringify({
        origen_id: billteraActiva.id,
        destino_id: Number(destino_id),
        monto
      })
    });

    // Actualizar billeteras locales
    [result.origen, result.destino].forEach(updated => {
      const idx = billeteras.findIndex(b => b.id === updated.id);
      if (idx !== -1) billeteras[idx] = updated;
    });

    renderFabBilleteras();
    actualizarSelectBilltera();

    document.getElementById('transferir-modal').classList.add('hidden');

    // Mostrar confirmación
    billteraActiva = result.origen;
    abrirBillteraModal(result.origen);

    // Notificación breve
    sessionNotification(`✓ Transferencia exitosa de ${fmt(monto)}`);
  } catch(e) {
    showError('transferir-error', e.message);
  } finally {
    document.getElementById('btn-transferir-confirmar').textContent = 'Transferir';
  }
});

// ── Arrancar ──────────────────────────────────────
if (token && usuario) {
  initApp();
  cargarRecurrentes();
  verificarPendientes();
}
