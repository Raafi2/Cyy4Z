'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      if (res.ok) {
        router.push('/')
      } else {
        setError('Password salah!')
      }
    } catch {
      setError('Gagal konek ke server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-icon">📱</div>
        <h1 className="login-title">CloudPhone Panel</h1>
        <p className="login-sub">Masukkan password admin untuk melanjutkan</p>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password admin..."
              autoFocus
            />
          </div>
          {error && <p style={{color:'var(--red)', fontSize:'0.8rem', marginBottom:'12px'}}>{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%', justifyContent:'center', padding:'12px'}}>
            {loading ? 'Masuk...' : '🔐 Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
