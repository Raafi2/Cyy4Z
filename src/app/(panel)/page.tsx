'use client'
import { useState, useEffect } from 'react'
import DeviceCard from '@/components/DeviceCard'

export default function DashboardPage() {
  const [devices, setDevices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      setDevices(data.devices || [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 8000)
    return () => clearInterval(interval)
  }, [])

  const online = devices.filter(d => d.status === 'online').length

  if (loading) return (
    <div className="loading"><div className="spinner"></div> Memuat...</div>
  )

  return (
    <div>
      {/* STATS */}
      <div className="stats-grid" style={{marginBottom:'24px'}}>
        <div className="stat-card">
          <div className="stat-label">Total Device</div>
          <div className="stat-value accent">{devices.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Online</div>
          <div className="stat-value green">{online}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Offline</div>
          <div className="stat-value" style={{color:'var(--text3)'}}>{devices.length - online}</div>
        </div>
      </div>

      {/* SETUP GUIDE */}
      {devices.length === 0 && (
        <div className="card" style={{marginBottom:'24px'}}>
          <div className="card-header">
            <div className="card-title">📖 Cara Konek CloudPhone</div>
          </div>
          <div style={{padding:'20px'}}>
            <div className="tutorial-step">
              <div className="tutorial-num">1</div>
              <div>
                <div style={{fontWeight:600, marginBottom:'6px'}}>Jalankan script ini di Termux (HP harus Root)</div>
                <div className="code-block">curl -sSL https://raw.githubusercontent.com/Raafi2/Cyy4Z/main/agent/termux/install.sh | bash</div>
                <div style={{fontSize:'0.8rem', color:'var(--text3)', marginTop:'6px'}}>
                  Script ini akan otomatis menginstall agent, nyambungin ke panel, dan auto-register.
                </div>
              </div>
            </div>
            <div className="tutorial-step">
              <div className="tutorial-num">2</div>
              <div>
                <div style={{fontWeight:600}}>Selesai! Device akan otomatis muncul di panel ini.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEVICE GRID */}
      <div className="devices-grid">
        {devices.map(device => (
          <DeviceCard key={device.id} device={device} onRefresh={load} />
        ))}
      </div>
    </div>
  )
}
