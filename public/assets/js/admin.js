const API = 'https://gastos-backend-production-fa36.up.railway.app/api';
let adminToken = localStorage.getItem('kash_admin_token') || null;
let todosLogs = [];
let logsFiltrados = [];
let paginaActual = 1;
const POR_PAGINA = 15;

const fmtFecha = ts => {
    const d = new Date(ts);
    return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

async function apiFetch(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    const res = await fetch(API + path, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

// ── LOGIN ──
document.getElementById('btn-admin-login').addEventListener('click', async () => {
    const email = document.getElementById('admin-email').value.trim();
    const pass = document.getElementById('admin-pass').value;
    const errEl = document.getElementById('admin-error');
    errEl.classList.add('hidden');
    if (!email || !pass) {
        errEl.textContent = 'Completa todos los campos';
        return errEl.classList.remove('hidden');
    }
    try {
        document.getElementById('btn-admin-login').textContent = 'Verificando…';
        const data = await apiFetch('/auth/login', {
            method: 'POST', body: JSON.stringify({ email, password: pass })
        });
        // Verificar que sea admin
        const resAdmin = await fetch(API + '/actividad/admin', {
            headers: { 'Authorization': `Bearer ${data.token}` }
        });
        if (resAdmin.status === 403) throw new Error('No tienes acceso de administrador');
        adminToken = data.token;
        localStorage.setItem('kash_admin_token', adminToken);
        document.getElementById('admin-nav-email').textContent = email;
        iniciarAdmin();
    } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.remove('hidden');
    } finally {
        document.getElementById('btn-admin-login').textContent = 'Ingresar';
    }
});

document.getElementById('admin-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-admin-login').click();
});

document.getElementById('btn-admin-logout').addEventListener('click', () => {
    localStorage.removeItem('kash_admin_token');
    adminToken = null;
    document.getElementById('admin-app').classList.add('hidden');
    document.getElementById('auth-wrap').classList.remove('hidden');
});

document.getElementById('btn-refresh').addEventListener('click', iniciarAdmin);

// ── INICIAR ADMIN ──
async function iniciarAdmin() {
    document.getElementById('auth-wrap').classList.add('hidden');
    document.getElementById('admin-app').classList.remove('hidden');
    await Promise.all([cargarResumen(), cargarLogs()]);
}

// ── RESUMEN ──
async function cargarResumen() {
    try {
        const d = await apiFetch('/actividad/admin/resumen');

        document.getElementById('stats-grid').innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Total acciones (30d)</div>
          <div class="stat-value accent">${d.total_acciones.toLocaleString()}</div>
          <div class="stat-sub">últimos 30 días</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Usuarios activos</div>
          <div class="stat-value green">${d.usuarios_activos}</div>
          <div class="stat-sub">de ${d.total_usuarios} registrados</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total usuarios</div>
          <div class="stat-value blue">${d.total_usuarios}</div>
          <div class="stat-sub">en la plataforma</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Promedio diario</div>
          <div class="stat-value purple">${Math.round(d.total_acciones / 30)}</div>
          <div class="stat-sub">acciones por día</div>
        </div>`;

        // Top usuarios
        document.getElementById('top-usuarios').innerHTML = d.usuarios_top.length
            ? d.usuarios_top.map((u, i) => `
            <div class="top-user-item">
              <div class="top-user-rank">#${i + 1}</div>
              <div class="top-user-info">
                <div class="top-user-nombre">${u.nombre}</div>
                <div class="top-user-email">${u.email}</div>
              </div>
              <div class="top-user-count">${u.acciones}</div>
            </div>`).join('')
            : '<div class="empty-state">Sin datos</div>';

        // Acciones por tipo
        const colores = {
            CREAR: 'badge-CREAR', EDITAR: 'badge-EDITAR', ELIMINAR: 'badge-ELIMINAR',
            RECARGAR: 'badge-RECARGAR', RESTAR: 'badge-RESTAR',
            LOGIN: 'badge-LOGIN', REGISTRO: 'badge-REGISTRO'
        };
        document.getElementById('acciones-tipo').innerHTML = d.acciones_por_tipo.length
            ? d.acciones_por_tipo.map(a => `
            <div class="accion-item">
              <span class="badge ${colores[a.accion] || ''}">${a.accion}</span>
              <span class="accion-total">${a.total}</span>
            </div>`).join('')
            : '<div class="empty-state">Sin datos</div>';

    } catch (e) {
        document.getElementById('stats-grid').innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
}

// ── LOGS ──
async function cargarLogs() {
    document.getElementById('tabla-logs').innerHTML =
        '<div class="loading-row"><span class="spinner"></span> Cargando…</div>';
    try {
        todosLogs = await apiFetch('/actividad/admin');

        // Poblar filtro de usuarios
        const usuarios = [...new Map(todosLogs.map(l =>
            [l.usuario_email, { email: l.usuario_email, nombre: l.usuario_nombre }]
        )).values()];
        const sel = document.getElementById('filtro-usuario');
        sel.innerHTML = '<option value="">Todos los usuarios</option>';
        usuarios.forEach(u => {
            sel.appendChild(new Option(`${u.nombre} (${u.email})`, u.email));
        });

        aplicarFiltros();
    } catch (e) {
        document.getElementById('tabla-logs').innerHTML =
            `<div class="empty-state">Error: ${e.message}</div>`;
    }
}

function aplicarFiltros() {
    const usuario = document.getElementById('filtro-usuario').value;
    const accion = document.getElementById('filtro-accion').value;
    const entidad = document.getElementById('filtro-entidad').value;
    const desde = document.getElementById('filtro-desde').value;
    const hasta = document.getElementById('filtro-hasta').value;

    logsFiltrados = todosLogs.filter(l => {
        if (usuario && l.usuario_email !== usuario) return false;
        if (accion && l.accion !== accion) return false;
        if (entidad && l.entidad !== entidad) return false;
        if (desde) {
            const fechaLog = new Date(l.created_at).toISOString().slice(0, 10);
            if (fechaLog < desde) return false;
        }
        if (hasta) {
            const fechaLog = new Date(l.created_at).toISOString().slice(0, 10);
            if (fechaLog > hasta) return false;
        }
        return true;
    });

    paginaActual = 1;
    renderTabla();
}

function renderTabla() {
    const inicio = (paginaActual - 1) * POR_PAGINA;
    const pagina = logsFiltrados.slice(inicio, inicio + POR_PAGINA);
    const totalPags = Math.ceil(logsFiltrados.length / POR_PAGINA);
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (!pagina.length) {
        document.getElementById('tabla-logs').innerHTML =
            '<div class="empty-state">No hay registros con esos filtros</div>';
        document.getElementById('pag-info').textContent = '0 resultados';
        btnPrev.disabled = true;
        btnNext.disabled = true;
        btnPrev.style.opacity = '.3';
        btnNext.style.opacity = '.3';
        return;
    }

    const colores = {
        CREAR: 'badge-CREAR', EDITAR: 'badge-EDITAR', ELIMINAR: 'badge-ELIMINAR',
        RECARGAR: 'badge-RECARGAR', RESTAR: 'badge-RESTAR',
        LOGIN: 'badge-LOGIN', REGISTRO: 'badge-REGISTRO'
    };

    document.getElementById('tabla-logs').innerHTML = pagina.map(l => `
      <div class="tabla-row">
        <div class="cell-usuario">
          <div class="cell-usuario-nombre">${l.usuario_nombre}</div>
          <div class="cell-usuario-email">${l.usuario_email}</div>
        </div>
        <span class="badge ${colores[l.accion] || ''}">${l.accion}</span>
        <span class="badge-entidad">${l.entidad}</span>
        <span class="cell-detalle" title="${l.detalle || ''}">${l.detalle || '—'}</span>
        <span class="cell-ip">${l.ip || '—'}</span>
        <span class="cell-fecha">${fmtFecha(l.created_at)}</span>
      </div>`).join('');

    document.getElementById('pag-info').textContent =
        `${inicio + 1}–${Math.min(inicio + POR_PAGINA, logsFiltrados.length)} de ${logsFiltrados.length}`;

    btnPrev.disabled = paginaActual <= 1;
    btnNext.disabled = paginaActual >= totalPags;
    btnPrev.style.opacity = paginaActual <= 1 ? '.3' : '1';
    btnNext.style.opacity = paginaActual >= totalPags ? '.3' : '1';
    btnPrev.style.cursor = paginaActual <= 1 ? 'default' : 'pointer';
    btnNext.style.cursor = paginaActual >= totalPags ? 'default' : 'pointer';
}

document.getElementById('btn-prev').addEventListener('click', () => {
    if (paginaActual <= 1) return;
    paginaActual--;
    renderTabla();
});

document.getElementById('btn-next').addEventListener('click', () => {
    const totalPags = Math.ceil(logsFiltrados.length / POR_PAGINA);
    if (paginaActual >= totalPags) return;
    paginaActual++;
    renderTabla();
});

document.getElementById('btn-filtrar').addEventListener('click', aplicarFiltros);

document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
    document.getElementById('filtro-usuario').value = '';
    document.getElementById('filtro-accion').value = '';
    document.getElementById('filtro-entidad').value = '';
    document.getElementById('filtro-desde').value = '';
    document.getElementById('filtro-hasta').value = '';
    aplicarFiltros();
});

// ── AUTO LOGIN si hay token guardado ──
if (adminToken) {
    apiFetch('/actividad/admin')
        .then(() => {
            const email = JSON.parse(atob(adminToken.split('.')[1])).email;
            document.getElementById('admin-nav-email').textContent = email;
            iniciarAdmin();
        })
        .catch(() => {
            localStorage.removeItem('kash_admin_token');
            adminToken = null;
        });
}