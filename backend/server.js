require('dotenv').config();
const express         = require('express');
const cors            = require('cors');
const authRoutes      = require('./routes/auth');
const gastosRoutes    = require('./routes/gastos');
const billterasRoutes = require('./routes/billeteras');
const recurrentesRoutes = require('./routes/recurrentes');
const { router: actividadRoutes } = require('./routes/actividad');

const app  = express();
const PORT = process.env.PORT || 3000;

const corsOptions = {
  origin: [
    'capacitor://localhost',
    'http://localhost',
    'http://localhost:8100'
  ],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

// ── Rutas ──────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/gastos',      gastosRoutes);
app.use('/api/billeteras',  billterasRoutes);
app.use('/api/recurrentes', recurrentesRoutes);
app.use('/api/actividad',   actividadRoutes);

// ── IA: Análisis comparar meses ───────────────────────────
app.post('/api/ai/analisis', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt requerido' });
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(500).json({ error: 'API key no configurada' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Error API');
    res.json({ texto: data.content?.[0]?.text || '' });
  } catch(e) {
    console.error('AI error:', e.message);
    res.status(500).json({ error: 'Error al generar análisis' });
  }
});

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', node: process.version }));

app.listen(PORT, () => {
  console.log(`✅  Servidor corriendo en puerto ${PORT}`);
});