import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function ProductCard({ product, onDelete }) {
  return (
    <div style={{
      background:'white', border:'1px solid #e2e8f0', borderRadius:'10px',
      padding:'16px', marginBottom:'10px', display:'flex',
      justifyContent:'space-between', alignItems:'center', boxShadow:'0 1px 4px rgba(0,0,0,.06)'
    }}>
      <div>
        <div style={{fontWeight:700,fontSize:'15px',color:'#1e293b'}}>{product.name}</div>
        <div style={{color:'#64748b',fontSize:'13px'}}>Stock: {product.stock} unidades</div>
      </div>
      <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
        <span style={{fontWeight:700,color:'#2563eb',fontSize:'18px'}}>
          ${product.price.toFixed(2)}
        </span>
        <button onClick={() => onDelete(product.id)} style={{
          background:'#fee2e2',color:'#dc2626',border:'none',
          borderRadius:'6px',padding:'6px 10px',cursor:'pointer'
        }}>✕</button>
      </div>
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [form,     setForm]     = useState({ name:'', price:'', stock:'' });
  const [info,     setInfo]     = useState(null);

  // Cargar info del servidor
  useEffect(() => {
    axios.get(`${API_URL}/api/hello`)
      .then(r => setInfo(r.data))
      .catch(() => {});
  }, []);

  // Cargar productos
  const fetchProducts = () => {
    setLoading(true);
    axios.get(`${API_URL}/api/products`)
      .then(r => { setProducts(r.data.data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };
  useEffect(() => { fetchProducts(); }, []);

  // Crear producto
  const handleCreate = async (e) => {
    e.preventDefault();
    await axios.post(`${API_URL}/api/products`, {
      name: form.name,
      price: parseFloat(form.price),
      stock: parseInt(form.stock) || 0,
    });
    setForm({ name:'', price:'', stock:'' });
    fetchProducts();
  };

  // Eliminar producto
  const handleDelete = async (id) => {
    await axios.delete(`${API_URL}/api/products/${id}`);
    fetchProducts();
  };

  return (
    <div style={{
      maxWidth:'700px', margin:'0 auto', padding:'32px 20px',
      fontFamily:'Inter, sans-serif'
    }}>
      <h1 style={{fontSize:'28px',fontWeight:700,marginBottom:'4px',color:'#1e293b'}}>
        🥷 K8s Ninja — Lab 1-A
      </h1>

      {info && (
        <div style={{
          background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'8px',
          padding:'10px 16px', marginBottom:'20px', fontSize:'13px', color:'#1e40af'
        }}>
          🌐 Servidor: {info.hostname} · Env: {info.env}
        </div>
      )}

      <form onSubmit={handleCreate} style={{
        background:'white', border:'1px solid #e2e8f0', borderRadius:'10px',
        padding:'20px', marginBottom:'24px', display:'flex', gap:'10px', flexWrap:'wrap'
      }}>
        <input
          placeholder="Nombre del producto"
          value={form.name}
          onChange={e => setForm({...form, name:e.target.value})}
          required
          style={{flex:2,minWidth:'160px',padding:'8px 12px',borderRadius:'6px',border:'1px solid #e2e8f0'}}
        />
        <input
          placeholder="Precio"
          type="number" step="0.01"
          value={form.price}
          onChange={e => setForm({...form, price:e.target.value})}
          required
          style={{width:'100px',padding:'8px 12px',borderRadius:'6px',border:'1px solid #e2e8f0'}}
        />
        <input
          placeholder="Stock"
          type="number"
          value={form.stock}
          onChange={e => setForm({...form, stock:e.target.value})}
          style={{width:'80px',padding:'8px 12px',borderRadius:'6px',border:'1px solid #e2e8f0'}}
        />
        <button type="submit" style={{
          background:'#2563eb',color:'white',border:'none',
          borderRadius:'6px',padding:'8px 20px',cursor:'pointer',fontWeight:600
        }}>+ Agregar</button>
      </form>

      <h2 style={{fontSize:'16px',fontWeight:600,color:'#475569',marginBottom:'12px'}}>
        Productos ({products.length})
      </h2>
      {loading && <p style={{color:'#94a3b8'}}>Cargando...</p>}
      {error   && <p style={{color:'#dc2626'}}>Error: {error}</p>}
      {products.map(p => (
        <ProductCard key={p.id} product={p} onDelete={handleDelete} />
      ))}
    </div>
  );
}