const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Base de datos simulada en memoria
let products = [
  { id: 1, name: 'Teclado Mecánico',  price: 89.99,  stock: 15 },
  { id: 2, name: 'Monitor Curvo',     price: 349.00, stock: 8  },
  { id: 3, name: 'Mouse Ergonómico',  price: 45.50,  stock: 22 },
  { id: 4, name: 'Laptop Stand',      price: 32.00,  stock: 40 },
];
let nextId = 5;

// ─── Rutas ───────────────────────────────────

// GET /api/hello — health check
app.get('/api/hello', (req, res) => {
  res.json({
    msg: '¡Hola desde Kubernetes Ninja Lab!',
    env: process.env.NODE_ENV || 'development',
    hostname: require('os').hostname(),
  });
});

// GET /api/products — listar productos
app.get('/api/products', (req, res) => {
  res.json({ data: products, total: products.length });
});

// GET /api/products/:id — obtener uno
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(product);
});

// POST /api/products — crear producto
app.post('/api/products', (req, res) => {
  const { name, price, stock } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'name y price son requeridos' });
  }
  const product = { id: nextId++, name, price: parseFloat(price), stock: stock || 0 };
  products.push(product);
  res.status(201).json(product);
});

// PUT /api/products/:id — actualizar
app.put('/api/products/:id', (req, res) => {
  const idx = products.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Producto no encontrado' });
  products[idx] = { ...products[idx], ...req.body, id: products[idx].id };
  res.json(products[idx]);
});

// DELETE /api/products/:id — eliminar
app.delete('/api/products/:id', (req, res) => {
  const idx = products.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Producto no encontrado' });
  const deleted = products.splice(idx, 1)[0];
  res.json({ deleted });
});

// Arrancar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API corriendo en puerto ${PORT}`);
});