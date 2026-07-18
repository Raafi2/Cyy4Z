'use client'
import { useState } from 'react'
import DeviceScreen from './DeviceScreen'
import LogPanel from './LogPanel'

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`
}

function formatLastSeen(dateStr: string | null) {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60000) return `${Math.floor(diff/1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`
  return `${Math.floor(diff/3600000)}h ago`
}

export default function DeviceCard({ device, onRefresh }: { device: any, onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState('screen')
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')

  const handleUploadApk = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadStatus(`Mengupload ${file.name}...`)
    try {
      const res = await fetch(`/api/upload_apk?deviceId=${device.id}&name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: file, // Raw stream
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      })
      if (res.ok) {
        setUploadStatus('✅ Berhasil dikirim! Sedang di-install di HP...')
      } else {
        setUploadStatus('❌ Gagal upload ke server.')
      }
    } catch {
      setUploadStatus('❌ Terjadi kesalahan jaringan.')
    } finally {
      setUploading(false)
      // reset file input
      e.target.value = ''
    }
  }
  const isOnline = device.status === 'online'
  const uptime = device.onlineSince ? Date.now() - new Date(device.onlineSince).getTime() : 0

  const handleDelete = async () => {
    if (!confirm(`Hapus device "${device.name}"? Agent di Termux akan otomatis berhenti.`)) return
    setDeleting(true)
    try {
      await fetch(`/api/devices/${device.id}`, { method: 'DELETE' })
      onRefresh()
    } catch {}
    finally { setDeleting(false) }
  }

  const cpuPct = device.cpuUsage || 0
  const ramPct = device.ramTotal > 0 ? Math.round((device.ramUsed / device.ramTotal) * 100) : 0
  const storagePct = device.storageTotal > 0 ? Math.round(((device.storageTotal - device.storageFree) / device.storageTotal) * 100) : 0

  return (
    <div className={`device-card ${isOnline ? 'online' : ''}`}>
      {/* HEADER */}
      <div className="device-card-header">
        <div>
          <div className="device-name">{device.name}</div>
          <div className="device-ip">
            {device.ipAddress || 'No IP'}
            {device.androidVersion && ` · Android ${device.androidVersion}`}
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <div className={`badge ${isOnline ? 'online' : 'offline'}`}>
            <div className="badge-dot"></div>
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? '...' : '🗑️'}
          </button>
        </div>
      </div>

      {/* SCREEN */}
      <DeviceScreen
        deviceId={device.id}
        isOnline={isOnline}
        screenWidth={device.screenWidth || 1080}
        screenHeight={device.screenHeight || 1920}
      />

      {/* INFO BAR */}
      <div className="device-info-bar">
        <div className="device-stat">
          <div className="device-stat-label">CPU</div>
          <div className="device-stat-value" style={{color: cpuPct > 80 ? 'var(--red)' : cpuPct > 60 ? 'var(--yellow)' : 'var(--green)'}}>
            {cpuPct.toFixed(1)}%
          </div>
        </div>
        <div className="device-stat">
          <div className="device-stat-label">RAM</div>
          <div className="device-stat-value" style={{color: ramPct > 85 ? 'var(--red)' : 'var(--text)'}}>
            {ramPct}%
          </div>
        </div>
        <div className="device-stat">
          <div className="device-stat-label">Storage</div>
          <div className="device-stat-value">{storagePct}%</div>
        </div>
        <div className="device-stat">
          <div className="device-stat-label">{isOnline ? 'Uptime' : 'Last seen'}</div>
          <div className="device-stat-value" style={{fontSize:'0.75rem'}}>
            {isOnline ? formatDuration(uptime) : formatLastSeen(device.lastSeen)}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'screen' ? 'active' : ''}`} onClick={() => setActiveTab('screen')}>🖥️ Kontrol</button>
        <button className={`tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>📋 Logs</button>
        <button className={`tab ${activeTab === 'clipboard' ? 'active' : ''}`} onClick={() => setActiveTab('clipboard')}>📎 Clipboard</button>
        <button className={`tab ${activeTab === 'apk' ? 'active' : ''}`} onClick={() => setActiveTab('apk')}>📦 Install APK</button>
        <button className={`tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>ℹ️ Info</button>
      </div>

      {activeTab === 'screen' && (
        <div className="tab-content">
          <p style={{fontSize:'0.78rem', color:'var(--text3)', textAlign:'center'}}>
            Klik layar untuk touch · Ketik untuk input teks · Gunakan tombol ◀ 🏠 ⊞ di sudut kanan atas
          </p>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="tab-content">
          <LogPanel logs={device.logs || []} />
        </div>
      )}

      {activeTab === 'clipboard' && (
        <div className="tab-content">
          <div style={{marginBottom:'8px', fontSize:'0.8rem', color:'var(--text3)'}}>Clipboard HP (auto-sync tiap 30s):</div>
          <div className="clipboard-box">
            {device.clipboard || <span style={{color:'var(--text3)', fontStyle:'italic'}}>Belum ada teks di clipboard</span>}
          </div>
          {device.clipboard && (
            <button className="btn btn-ghost btn-sm" style={{marginTop:'8px'}} onClick={() => navigator.clipboard.writeText(device.clipboard)}>
              📋 Copy ke Clipboard Komputer
            </button>
          )}
        </div>
      )}

      {activeTab === 'info' && (
        <div className="tab-content">
          <table style={{width:'100%', fontSize:'0.8rem', borderCollapse:'collapse'}}>
            {[
              ['Device ID', device.id],
              ['IP Address', device.ipAddress || '-'],
              ['Android', device.androidVersion || '-'],
              ['RAM', `${device.ramUsed?.toFixed(1) || 0} / ${device.ramTotal?.toFixed(1) || 0} GB`],
              ['Storage Free', `${device.storageFree?.toFixed(1) || 0} GB`],
              ['Resolusi', `${device.screenWidth}x${device.screenHeight}`],
            ].map(([k, v]) => (
              <tr key={k} style={{borderBottom:'1px solid var(--border)'}}>
                <td style={{padding:'8px 4px', color:'var(--text3)', width:'40%'}}>{k}</td>
                <td style={{padding:'8px 4px', fontFamily:'var(--font-mono)', fontSize:'0.75rem'}}>{v}</td>
              </tr>
            ))}
          </table>
        </div>
      )}

      {activeTab === 'apk' && (
        <div className="tab-content">
          <div style={{marginBottom:'12px', fontSize:'0.8rem', color:'var(--text2)'}}>
            Upload file APK. File akan didownload langsung oleh HP dan di-install otomatis (100MB+ support).
          </div>
          <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <label className="btn btn-primary" style={{cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1}}>
              {uploading ? '⏳ Mengupload...' : '📤 Pilih File APK'}
              <input type="file" accept=".apk,*/*" style={{display:'none'}} onChange={handleUploadApk} disabled={uploading} />
            </label>
          </div>
          {uploadStatus && (
            <div style={{marginTop:'12px', fontSize:'0.85rem', color:'var(--text)', padding:'8px 12px', background:'var(--surface2)', borderRadius:'6px'}}>
              {uploadStatus}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
