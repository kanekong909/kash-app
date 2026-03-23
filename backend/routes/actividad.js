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

module.exports = { router, logActividad };