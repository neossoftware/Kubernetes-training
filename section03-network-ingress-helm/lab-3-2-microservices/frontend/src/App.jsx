import { useState, useEffect, useCallback } from 'react'

const API = {
  customers: '/api/customers',
  products:  '/api/products',
}

// ── Customers ──────────────────────────────────────────────────────────────

function CustomersPanel() {
  const [list, setList]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [form, setForm]     = useState({ name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(API.customers)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setList(await res.json())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await fetch(API.customers, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setForm({ name: '', email: '', phone: '' })
      load()
    } finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!confirm('¿Eliminar este cliente?')) return
    await fetch(`${API.customers}/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="panel">
      <h2>👥 Clientes</h2>

      <form className="add-form" onSubmit={handleSubmit}>
        <input required placeholder="Nombre *"   value={form.name}  onChange={e => setForm({...form, name: e.target.value})} />
        <input required type="email" placeholder="Email *" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
        <input placeholder="Teléfono" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
        <button type="submit" className="btn-add" disabled={saving}>{saving ? 'Guardando…' : '+ Agregar'}</button>
      </form>

      {error   && <div className="error">Error al conectar con customers-api: {error}</div>}
      {loading && <div className="loading">Cargando…</div>}

      {!loading && !error && (
        <table>
          <thead>
            <tr><th>ID</th><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Creado</th><th></th></tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={6} style={{textAlign:'center',color:'#94a3b8'}}>Sin clientes aún</td></tr>
            )}
            {list.map(c => (
              <tr key={c.id}>
                <td className="td-id">{c.id}</td>
                <td>{c.name}</td>
                <td>{c.email}</td>
                <td>{c.phone || '—'}</td>
                <td className="td-date">{c.createdAt ? new Date(c.createdAt).toLocaleDateString('es-MX') : '—'}</td>
                <td><button className="btn-del" onClick={() => remove(c.id)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Products ───────────────────────────────────────────────────────────────

function ProductsPanel() {
  const [list, setList]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [form, setForm]     = useState({ name: '', price: '', stock: '', description: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(API.products)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setList(await res.json())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await fetch(API.products, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price: parseFloat(form.price), stock: parseInt(form.stock) }),
      })
      setForm({ name: '', price: '', stock: '', description: '' })
      load()
    } finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return
    await fetch(`${API.products}/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="panel">
      <h2>📦 Productos</h2>

      <form className="add-form" onSubmit={handleSubmit}>
        <input required placeholder="Nombre *"  value={form.name}  onChange={e => setForm({...form, name: e.target.value})} />
        <input required type="number" step="0.01" placeholder="Precio *" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
        <input required type="number" placeholder="Stock *" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
        <input placeholder="Descripción" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        <button type="submit" className="btn-add" disabled={saving}>{saving ? 'Guardando…' : '+ Agregar'}</button>
      </form>

      {error   && <div className="error">Error al conectar con products-api: {error}</div>}
      {loading && <div className="loading">Cargando…</div>}

      {!loading && !error && (
        <table>
          <thead>
            <tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Descripción</th><th></th></tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={6} style={{textAlign:'center',color:'#94a3b8'}}>Sin productos aún</td></tr>
            )}
            {list.map(p => (
              <tr key={p.id}>
                <td className="td-id">{p.id}</td>
                <td>{p.name}</td>
                <td className="td-price">${parseFloat(p.price).toFixed(2)}</td>
                <td>{p.stock}</td>
                <td className="td-desc">{p.description || '—'}</td>
                <td><button className="btn-del" onClick={() => remove(p.id)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('customers')

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <span className="header-icon">🧩</span>
          <div>
            <div className="header-title">Lab 3-2 — Microservicios en Kubernetes</div>
            <div className="header-sub">React → Ingress → Spring Boot × 2 → PostgreSQL (Docker)</div>
          </div>
        </div>
        <nav className="tabs">
          <button className={`tab ${tab === 'customers' ? 'active' : ''}`} onClick={() => setTab('customers')}>
            👥 Clientes
          </button>
          <button className={`tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>
            📦 Productos
          </button>
        </nav>
      </header>

      <main className="main">
        {tab === 'customers' ? <CustomersPanel /> : <ProductsPanel />}
      </main>
    </div>
  )
}
