const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

async function logActividad(usuario_id, accion, entidad, detalle = null, ip = null) {
  try {
    await db.query(
      'INSERT INTO actividad_log (usuario_id, accion, entidad, detalle, ip) VALUES (?, ?, ?, ?, ?)',
      [usuario_id, accion, entidad, detalle, ip]
    );
  } catch(e) {
    console.error('Log error:', e.message);
  }
}

router.get('/mia', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, accion, entidad, detalle, ip, created_at
       FROM actividad_log
       WHERE usuario_id = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       ORDER BY created_at DESC
       LIMIT 200`,
      [req.usuario.id]
    );
    res.json(rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/admin', auth, async (req, res) => {
  if (req.usuario.email !== process.env.ADMIN_EMAIL)
    return res.status(403).json({ error: 'Sin acceso' });
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.accion, a.entidad, a.detalle, a.ip, a.created_at,
              u.nombre as usuario_nombre, u.email as usuario_email
       FROM actividad_log a
       JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       ORDER BY a.created_at DESC
       LIMIT 500`
    );
    res.json(rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/actividad/admin/resumen
router.get('/admin/resumen', auth, async (req, res) => {
  if (req.usuario.email !== process.env.ADMIN_EMAIL)
    return res.status(403).json({ error: 'Sin acceso' });
  try {
    const [[{ total_acciones }]] = await db.query(
      `SELECT COUNT(*) as total_acciones FROM actividad_log
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const [[{ usuarios_activos }]] = await db.query(
      `SELECT COUNT(DISTINCT usuario_id) as usuarios_activos FROM actividad_log
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const [[{ total_usuarios }]] = await db.query(
      `SELECT COUNT(*) as total_usuarios FROM usuarios`
    );
    const [acciones_por_tipo] = await db.query(
      `SELECT accion, COUNT(*) as total FROM actividad_log
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY accion ORDER BY total DESC`
    );
    const [usuarios_top] = await db.query(
      `SELECT u.nombre, u.email, COUNT(*) as acciones
       FROM actividad_log a
       JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY a.usuario_id ORDER BY acciones DESC LIMIT 5`
    );
    res.json({ total_acciones, usuarios_activos, total_usuarios, acciones_por_tipo, usuarios_top });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = { router, logActividad };