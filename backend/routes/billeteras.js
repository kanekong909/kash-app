const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/auth');

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
    res.json({ message: 'Billtera eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

module.exports = router;