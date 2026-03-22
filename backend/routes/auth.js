const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');

// ── POST /api/auth/register ────────────────────────────────
router.post('/register', async (req, res) => {
  const { nombre, email, password } = req.body;
  if (!nombre || !email || !password)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });

  try {
    const [existing] = await pool.query(
      'SELECT id FROM usuarios WHERE email = ?', [email]
    );
    if (existing.length > 0)
      return res.status(409).json({ error: 'El email ya está registrado' });

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)',
      [nombre.trim(), email.toLowerCase().trim(), hash]
    );

    const token = jwt.sign(
      { id: result.insertId, email, nombre: nombre.trim() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(201).json({ token, usuario: { id: result.insertId, nombre: nombre.trim(), email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM usuarios WHERE email = ?', [email.toLowerCase().trim()]
    );
    if (rows.length === 0)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const usuario = rows[0];
    const valid   = await bcrypt.compare(password, usuario.password);
    if (!valid)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, nombre: usuario.nombre },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/auth/perfil — actualizar nombre, email y/o contraseña
router.put('/perfil', authMiddleware, async (req, res) => {
  const { nombre, email, password_actual, password_nueva } = req.body;
  const userId = req.usuario.id;

  try {
    // Obtener usuario actual
    const [rows] = await db.query('SELECT * FROM usuarios WHERE id = ?', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const user = rows[0];

    let nuevoNombre = nombre?.trim() || user.nombre;
    let nuevoEmail  = email?.trim()  || user.email;
    let nuevoHash   = user.password;

    // Si quiere cambiar contraseña
    if (password_nueva) {
      if (!password_actual) return res.status(400).json({ error: 'Debes ingresar tu contraseña actual' });
      const valida = await bcrypt.compare(password_actual, user.password);
      if (!valida) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
      if (password_nueva.length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
      nuevoHash = await bcrypt.hash(password_nueva, 10);
    }

    // Si quiere cambiar email, verificar que no esté en uso
    if (nuevoEmail !== user.email) {
      const [existe] = await db.query('SELECT id FROM usuarios WHERE email = ? AND id != ?', [nuevoEmail, userId]);
      if (existe.length) return res.status(400).json({ error: 'Ese correo ya está registrado' });
    }

    await db.query(
      'UPDATE usuarios SET nombre = ?, email = ?, password = ?, updated_at = NOW() WHERE id = ?',
      [nuevoNombre, nuevoEmail, nuevoHash, userId]
    );

    res.json({ mensaje: 'Perfil actualizado', usuario: { id: userId, nombre: nuevoNombre, email: nuevoEmail } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
