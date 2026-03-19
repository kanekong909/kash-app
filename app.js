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
  let deleteCallback = null;

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

  function confirmDelete(cb) {
    deleteCallback = cb;
    document.getElementById('delete-modal').classList.remove('hidden');
  }

  // Modal de pdf con contraseña
    document.getElementById('pass-modal-close').addEventListener('click', () => {
    document.getElementById('pass-modal').classList.add('hidden');
  });

  document.getElementById('btn-pass-confirm').addEventListener('click', () => {
    const pass = document.getElementById('pdf-pass').value;
    if (!pass) {
      document.getElementById('pass-error').classList.remove('hidden');
      return;
    }
    document.getElementById('pass-error').classList.add('hidden');
    document.getElementById('pass-modal').classList.add('hidden');
    const { gastos, anio, mes } = window._pdfData;
    generarPDF(gastos, anio, mes, pass);
  });

  document.getElementById('pdf-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-pass-confirm').click();
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
      <div class="gasto-item-top">
        <span class="cat-badge cat-${g.categoria}">${g.categoria}</span>
        <div class="gasto-info">
          <div class="gasto-desc">${desc}</div>
          <div class="gasto-fecha">${fmtFecha(g.fecha.slice(0,10))} · ${(g.hora||'').slice(0,5)}</div>
        </div>
        <div class="gasto-monto">${fmt(g.monto)}</div>
      </div>
      <div class="gasto-item-bottom">
        <div class="gasto-actions">
          <button class="btn-edit">Editar</button>
          <button class="btn-del">Eliminar</button>
        </div>
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
        confirmDelete(async () => {
          await api(`/gastos/${id}`, { method: 'DELETE' });
          verDetalleMes(anio, mes);
        });
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
  // ── SECCIÓN REPORTE ────────────────────────────────
  async function initReporte() {
    const anioSel = document.getElementById('rep-anio');
    const mesSel  = document.getElementById('rep-mes');

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
    } catch(e) {
      anioSel.innerHTML = '<option>Error</option>';
    }
  }

 function actualizarMeses(periodos) {
  const anio   = document.getElementById('rep-anio').value;
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
    const mes  = document.getElementById('rep-mes').value;
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
        csv += `${fmtFecha(g.fecha.slice(0,10))},${(g.hora||'').slice(0,5)},${g.monto},${g.categoria},"${(g.descripcion||'').replace(/"/g,'""')}"\n`;
      });

      preview.textContent = csv.slice(0, 500) + (csv.length > 500 ? '…' : '');
      preview.classList.remove('hidden');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `gastos_${MESES[Number(mes)]}_${anio}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch(e) {
      alert('Error: ' + e.message);
    } finally {
      document.getElementById('btn-descargar-csv').innerHTML = '<span>⬇</span> Descargar CSV';
    }
  });

 document.getElementById('btn-descargar-pdf').addEventListener('click', async () => {
  const anio = document.getElementById('rep-anio').value;
  const mes  = document.getElementById('rep-mes').value;

  try {
    document.getElementById('btn-descargar-pdf').textContent = 'Cargando…';
    const gastos = await api(`/gastos?anio=${anio}&mes=${mes}`);
    if (!gastos.length) { alert('No hay registros para el período.'); return; }
    window._pdfData = { gastos, anio, mes };
    document.getElementById('pdf-pass').value = '';
    document.getElementById('pass-modal').classList.remove('hidden');
  } catch(e) {
    alert('Error: ' + e.message);
  } finally {
    document.getElementById('btn-descargar-pdf').innerHTML = '<span>⬇</span> Descargar PDF';
  }
});

  function generarPDF(gastos, anio, mes, password) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const W = 210, H = 297;
    const amber  = [245, 166, 35];
    const dark   = [13, 13, 15];
    const dark2  = [20, 20, 23];
    const gray   = [152, 152, 168];
    const white  = [232, 232, 236];

    // ── Fondo ─────────────────────────────────────────
    doc.setFillColor(...dark);
    doc.rect(0, 0, W, H, 'F');

    // ── Header bar ────────────────────────────────────
    doc.setFillColor(...dark2);
    doc.rect(0, 0, W, 42, 'F');

    // Línea acento amber
    doc.setFillColor(...amber);
    doc.rect(0, 42, W, 1.5, 'F');

    // Logo ◈
    doc.setTextColor(...amber);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('◈ GASTOS', 14, 20);

    // Subtítulo
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');
    doc.text('REPORTE MENSUAL DE GASTOS', 14, 28);

    // Mes y año alineado a la derecha
    doc.setFontSize(18);
    doc.setTextColor(...white);
    doc.setFont('helvetica', 'bold');
    doc.text(`${MESES[Number(mes)]} ${anio}`, W - 14, 22, { align: 'right' });

    // Usuario
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'normal');
    doc.text(usuario.nombre, W - 14, 30, { align: 'right' });
    doc.text(usuario.email,  W - 14, 36, { align: 'right' });

    // ── Tarjeta resumen ───────────────────────────────
    const total = gastos.reduce((s, g) => s + Number(g.monto), 0);
    const porCat = {};
    gastos.forEach(g => {
      porCat[g.categoria] = (porCat[g.categoria] || 0) + Number(g.monto);
    });

    // Fondo tarjeta
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

    // Categorías en la tarjeta
    let cx = 100;
    Object.entries(porCat).slice(0, 4).forEach(([cat, val]) => {
      doc.setFontSize(7);
      doc.setTextColor(...gray);
      doc.text(cat.toUpperCase(), cx, 60);
      doc.setFontSize(10);
      doc.setTextColor(...white);
      doc.setFont('helvetica', 'bold');
      doc.text(fmt(val), cx, 68);
      doc.setFont('helvetica', 'normal');
      cx += 28;
    });

    // ── Tabla de registros ────────────────────────────
    const CAT_COLORS = {
      'Comida':          [62, 207, 142],
      'Transporte':      [96, 165, 250],
      'Entretenimiento': [167, 139, 250],
      'Ropa':            [251, 146, 60],
      'Otros':           [148, 163, 184],
    };

    // Encabezado tabla
    let y = 92;
    doc.setFillColor(36, 36, 41);
    doc.rect(14, y, W - 28, 8, 'F');

    doc.setFontSize(7.5);
    doc.setTextColor(...gray);
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA',       18, y + 5.5);
    doc.text('HORA',        50, y + 5.5);
    doc.text('CATEGORÍA',   70, y + 5.5);
    doc.text('DESCRIPCIÓN', 108, y + 5.5);
    doc.text('MONTO',       W - 18, y + 5.5, { align: 'right' });

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

      // Fila alterna
      if (i % 2 === 0) {
        doc.setFillColor(20, 20, 23);
        doc.rect(14, y, W - 28, 9, 'F');
      }

      const catColor = CAT_COLORS[g.categoria] || [148, 163, 184];

      // Badge categoría
      doc.setFillColor(...catColor.map(c => Math.round(c * 0.15 + dark[0] * 0.85)));
      doc.roundedRect(67, y + 1.5, 36, 5.5, 1.5, 1.5, 'F');
      doc.setTextColor(...catColor);
      doc.setFontSize(6.5);
      doc.text(g.categoria.toUpperCase(), 85, y + 5.5, { align: 'center' });

      doc.setFontSize(8);
      doc.setTextColor(...white);
      doc.text(fmtFecha(g.fecha.slice(0,10)),         18,      y + 6);
      doc.text((g.hora||'').slice(0,5),               50,      y + 6);
      // descripción truncada
      const desc = (g.descripcion || '-').slice(0, 28);
      doc.text(desc,                                   108,     y + 6);
      doc.setTextColor(...amber);
      doc.setFont('helvetica', 'bold');
      doc.text(fmt(g.monto),                           W - 18,  y + 6, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      // Línea separadora
      doc.setDrawColor(46, 46, 53);
      doc.setLineWidth(0.2);
      doc.line(14, y + 9, W - 14, y + 9);

      y += 9;
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
  const mesSel  = document.getElementById('graf-mes');

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
    const mes  = mesSel.value;
    cargarGraficos(anio, mes);
  } catch(e) {
    console.error(e);
  }
}

function actualizarMesesGraf(periodos) {
  const anio   = document.getElementById('graf-anio').value;
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

    const byDay = {};
    gastos.forEach(g => {
      // Si hay mes seleccionado mostrar solo el día, si no mostrar dd/mm
      const key = mes
        ? g.fecha.slice(8,10)
        : MESES[Number(g.fecha.slice(5,7))];
      byDay[key] = (byDay[key] || 0) + Number(g.monto);
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

  // ── Toggle contraseña ─────────────────────────────
  document.querySelectorAll('.btn-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      btn.textContent = visible ? '👁' : '🙈';
    });
  });

  // ── Arrancar ──────────────────────────────────────
  if (token && usuario) {
    initApp();
  }
