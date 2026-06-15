const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const os      = require('os');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Pool de conexiones a PostgreSQL — credenciales desde variables de entorno (Secret de K8s)
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  user:     process.env.DB_USER     || 'admin',
  password: process.env.DB_PASSWORD || 'ninja123',
  database: process.env.DB_NAME     || 'labdb',
});

// Crear tabla e insertar datos de ejemplo si está vacía
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(100) NOT NULL,
      price       DECIMAL(10,2) NOT NULL,
      stock       INTEGER DEFAULT 0,
      description TEXT DEFAULT ''
    )
  `);
  const { rows } = await pool.query('SELECT COUNT(*) FROM products');
  if (parseInt(rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO products (name, price, stock, description) VALUES
      ('Teclado Mecanico',   89.99,  15, 'Switch Red, retroiluminado RGB'),
      ('Monitor Curvo 27"', 349.00,   8, 'QHD 165Hz, 1ms, HDR400'),
      ('Mouse Ergonomico',   45.50,  22, 'Inalambrico, 4000 DPI'),
      ('Laptop Stand',       32.00,  40, 'Aluminio ajustable, universal')
    `);
    console.log('Datos iniciales insertados');
  }
  console.log('Base de datos lista');
}

// ─── Rutas ───────────────────────────────────────────────────────────────────

// GET /api/hello — health check (muestra hostname del Pod para ver el balanceo)
app.get('/api/hello', (req, res) => {
  res.json({
    msg:      '¡Hola desde K8s Ninja Lab 2-10!',
    env:      process.env.NODE_ENV || 'development',
    hostname: os.hostname(),
  });
});

// GET /api/products — listar todos los productos
app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY id');
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id — obtener un producto por id
app.get('/api/products/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products — crear producto
app.post('/api/products', async (req, res) => {
  const { name, price, stock, description } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'name y price son requeridos' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO products (name, price, stock, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, parseFloat(price), parseInt(stock) || 0, description || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id — actualizar producto
app.put('/api/products/:id', async (req, res) => {
  const { name, price, stock, description } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE products SET
        name        = COALESCE($1, name),
        price       = COALESCE($2, price),
        stock       = COALESCE($3, stock),
        description = COALESCE($4, description)
       WHERE id = $5 RETURNING *`,
      [name, price ? parseFloat(price) : null, stock !== undefined ? parseInt(stock) : null, description, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id — eliminar producto
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ deleted: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Arranque ────────────────────────────────────────────────────────────────

initDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API corriendo en puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Error conectando a la BD:', err.message);
    process.exit(1);
  });
