const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/auth');
const { logActividad } = require('./actividad');

router.use(auth);

// GET /api/billeteras
router.get('/', async (req, res) => {
  const uid = req.usuario.id;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM billeteras WHERE usuario_id = ? ORDER BY nombre ASC',
      [uid]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener billeteras' });
  }
});

// POST /api/billeteras — crear
router.post('/', async (req, res) => {
  const { nombre, saldo, emoji } = req.body;
  const uid = req.usuario.id;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const [result] = await pool.query(
      'INSERT INTO billeteras (usuario_id, nombre, saldo, emoji) VALUES (?, ?, ?, ?)',
      [uid, nombre.trim(), Number(saldo) || 0, emoji || '💳']
    );
    const [rows] = await pool.query('SELECT * FROM billeteras WHERE id = ?', [result.insertId]);
    await logActividad(uid, 'CREAR', 'billtera',
      `Nombre: ${nombre.trim()} | Saldo inicial: $${(Number(saldo) || 0).toLocaleString()}`,
      req.ip);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear billtera' });
  }
});


// PUT /api/billeteras/:id/recargar — sumar saldo
router.put('/:id/recargar', async (req, res) => {
  const { id } = req.params;
  const { monto } = req.body;
  const uid = req.usuario.id;
  if (!monto || monto === 0)
    return res.status(400).json({ error: 'Monto inválido' });
  try {
    const [existing] = await pool.query(
      'SELECT * FROM billeteras WHERE id = ? AND usuario_id = ?', [id, uid]
    );
    if (!existing.length) return res.status(404).json({ error: 'Billtera no encontrada' });
    await pool.query(
      'UPDATE billeteras SET saldo = saldo + ? WHERE id = ?',
      [Number(monto), id]
    );
    const [rows] = await pool.query('SELECT * FROM billeteras WHERE id = ?', [id]);
    const accion = Number(monto) > 0 ? 'RECARGAR' : 'RESTAR';
    await logActividad(uid, accion, 'billtera',
      `${existing[0].nombre} | Monto: $${Math.abs(Number(monto)).toLocaleString()} | Saldo nuevo: $${Number(rows[0].saldo).toLocaleString()}`,
      req.ip);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al recargar' });
  }
});

// PUT /api/billeteras/:id — editar nombre/emoji
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, emoji } = req.body;
  const uid = req.usuario.id;
  try {
    const [existing] = await pool.query(
      'SELECT id FROM billeteras WHERE id = ? AND usuario_id = ?', [id, uid]
    );
    if (!existing.length) return res.status(404).json({ error: 'Billtera no encontrada' });
    await pool.query(
      'UPDATE billeteras SET nombre = ?, emoji = ? WHERE id = ?',
      [nombre, emoji || '💳', id]
    );
    const [rows] = await pool.query('SELECT * FROM billeteras WHERE id = ?', [id]);
    await logActividad(uid, 'EDITAR', 'billtera',
      `ID: ${id} | Nombre: ${nombre}`,
      req.ip);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// DELETE /api/billeteras/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const uid = req.usuario.id;
  try {
    const [existing] = await pool.query(
      'SELECT id FROM billeteras WHERE id = ? AND usuario_id = ?', [id, uid]
    );
    if (!existing.length) return res.status(404).json({ error: 'Billtera no encontrada' });
    await pool.query('DELETE FROM billeteras WHERE id = ?', [id]);
    await logActividad(uid, 'ELIMINAR', 'billtera',
      `ID: ${id}`,
      req.ip);
    res.json({ message: 'Billtera eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// POST /api/billeteras/transferir
router.post('/transferir', async (req, res) => {
  const { origen_id, destino_id, monto } = req.body;
  const uid = req.usuario.id;

  if (!origen_id || !destino_id || !monto || Number(monto) <= 0)
    return res.status(400).json({ error: 'Datos incompletos o monto inválido' });
  if (origen_id === destino_id)
    return res.status(400).json({ error: 'No puedes transferir a la misma billtera' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [origen] = await conn.query(
      'SELECT * FROM billeteras WHERE id = ? AND usuario_id = ?', [origen_id, uid]
    );
    const [destino] = await conn.query(
      'SELECT * FROM billeteras WHERE id = ? AND usuario_id = ?', [destino_id, uid]
    );

    if (!origen.length || !destino.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Billtera no encontrada' });
    }

    await conn.query(
      'UPDATE billeteras SET saldo = saldo - ? WHERE id = ?',
      [Number(monto), origen_id]
    );
    await conn.query(
      'UPDATE billeteras SET saldo = saldo + ? WHERE id = ?',
      [Number(monto), destino_id]
    );

    await conn.commit();

    await logActividad(uid, 'TRANSFERIR', 'billtera',
      `De: ${origen[0].nombre} → A: ${destino[0].nombre} | Monto: $${Number(monto).toLocaleString()}`,
      req.ip);

    const [updatedOrigen] = await pool.query('SELECT * FROM billeteras WHERE id = ?', [origen_id]);
    const [updatedDestino] = await pool.query('SELECT * FROM billeteras WHERE id = ?', [destino_id]);

    res.json({ origen: updatedOrigen[0], destino: updatedDestino[0] });
  } catch(e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;