const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(auth);

// ── GET /api/gastos?anio=&mes= ─────────────────────────────
router.get('/', async (req, res) => {
  const { anio, mes, categoria, buscar } = req.query;
  const uid = req.usuario.id;

  let sql    = 'SELECT * FROM gastos WHERE usuario_id = ?';
  const params = [uid];

  if (anio && mes) {
    sql += ' AND YEAR(fecha) = ? AND MONTH(fecha) = ?';
    params.push(anio, mes);
  } else if (anio) {
    sql += ' AND YEAR(fecha) = ?';
    params.push(anio);
  }

  if (categoria) {
    sql += ' AND categoria = ?';
    params.push(categoria);
  }

  if (buscar) {
    sql += ' AND descripcion LIKE ?';
    params.push(`%${buscar}%`);
  }

  sql += ' ORDER BY fecha DESC, hora DESC';

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

// ── GET /api/gastos/meses — lista de meses con gastos ──────
router.get('/meses', async (req, res) => {
  const uid = req.usuario.id;
  try {
    const [rows] = await pool.query(
      `SELECT YEAR(fecha) AS anio, MONTH(fecha) AS mes,
              SUM(monto) AS total, COUNT(*) AS registros
       FROM gastos
       WHERE usuario_id = ?
       GROUP BY YEAR(fecha), MONTH(fecha)
       ORDER BY anio DESC, mes DESC`,
      [uid]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener meses' });
  }
});

// ── GET /api/gastos/resumen — por categoría (mes/año) ──────
router.get('/resumen', async (req, res) => {
  const { anio, mes } = req.query;
  const uid = req.usuario.id;

  let sql = `SELECT categoria, SUM(monto) AS total, COUNT(*) AS registros
             FROM gastos WHERE usuario_id = ?`;
  const params = [uid];

  if (anio && mes) {
    sql += ' AND YEAR(fecha) = ? AND MONTH(fecha) = ?';
    params.push(anio, mes);
  }

  sql += ' GROUP BY categoria ORDER BY total DESC';

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

// GET /api/gastos/periodos — años y meses con registros
router.get('/periodos', async (req, res) => {
  const uid = req.usuario.id;
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT YEAR(fecha) AS anio, MONTH(fecha) AS mes
       FROM gastos WHERE usuario_id = ?
       ORDER BY anio DESC, mes DESC`,
      [uid]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener períodos' });
  }
});

// ── POST /api/gastos ───────────────────────────────────────
router.post('/', async (req, res) => {
  const { fecha, hora, monto, categoria, descripcion, billtera_id } = req.body;
  const uid = req.usuario.id;

  if (!fecha || !hora || !monto || !categoria)
    return res.status(400).json({ error: 'Fecha, hora, monto y categoría son requeridos' });
  if (isNaN(monto) || Number(monto) <= 0)
    return res.status(400).json({ error: 'El monto debe ser un número positivo' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Obtener nombre de la billtera si se especificó
    let metodo_pago = null;
    if (billtera_id) {
      const [bil] = await conn.query(
        'SELECT nombre, emoji FROM billeteras WHERE id = ? AND usuario_id = ?',
        [billtera_id, uid]
      );
      if (!bil.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Billtera no encontrada' });
      }
      metodo_pago = `${bil[0].emoji} ${bil[0].nombre}`;
      await conn.query(
        'UPDATE billeteras SET saldo = saldo - ? WHERE id = ?',
        [Number(monto), billtera_id]
      );
    }

    const [result] = await conn.query(
      'INSERT INTO gastos (usuario_id, fecha, hora, monto, categoria, descripcion, billtera_id, metodo_pago) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uid, fecha, hora, Number(monto), categoria, descripcion || null, billtera_id || null, metodo_pago]
    );

    await conn.commit();
    const [rows] = await pool.query('SELECT * FROM gastos WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al crear gasto' });
  } finally {
    conn.release();
  }
});

// ── PUT /api/gastos/:id ────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const uid = req.usuario.id;
  const { fecha, hora, monto, categoria, descripcion, billtera_id } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(
      'SELECT * FROM gastos WHERE id = ? AND usuario_id = ?', [id, uid]
    );
    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    const gastoAnterior = existing[0];

    // Revertir descuento anterior si tenía billtera
    if (gastoAnterior.billtera_id) {
      await conn.query(
        'UPDATE billeteras SET saldo = saldo + ? WHERE id = ? AND usuario_id = ?',
        [Number(gastoAnterior.monto), gastoAnterior.billtera_id, uid]
      );
    }

    // Obtener nombre de la nueva billtera si se especificó
    let metodo_pago = null;
    if (billtera_id) {
      const [bil] = await conn.query(
        'SELECT nombre, emoji FROM billeteras WHERE id = ? AND usuario_id = ?',
        [billtera_id, uid]
      );
      if (bil.length) {
        metodo_pago = `${bil[0].emoji} ${bil[0].nombre}`;
      }
      await conn.query(
        'UPDATE billeteras SET saldo = saldo - ? WHERE id = ? AND usuario_id = ?',
        [Number(monto), billtera_id, uid]
      );
    }

    await conn.query(
      'UPDATE gastos SET fecha=?, hora=?, monto=?, categoria=?, descripcion=?, billtera_id=?, metodo_pago=? WHERE id=?',
      [fecha, hora, Number(monto), categoria, descripcion || null, billtera_id || null, metodo_pago, id]
    );

    await conn.commit();
    const [rows] = await pool.query('SELECT * FROM gastos WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar gasto' });
  } finally {
    conn.release();
  }
});

// ── DELETE /api/gastos/:id ─────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const uid = req.usuario.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(
      'SELECT * FROM gastos WHERE id = ? AND usuario_id = ?', [id, uid]
    );
    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    const gasto = existing[0];

    // Revertir descuento si tenía billtera
    if (gasto.billtera_id) {
      await conn.query(
        'UPDATE billeteras SET saldo = saldo + ? WHERE id = ? AND usuario_id = ?',
        [Number(gasto.monto), gasto.billtera_id, uid]
      );
    }

    await conn.query('DELETE FROM gastos WHERE id = ?', [id]);
    await conn.commit();
    res.json({ message: 'Gasto eliminado correctamente' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar gasto' });
  } finally {
    conn.release();
  }
});

module.exports = router;
