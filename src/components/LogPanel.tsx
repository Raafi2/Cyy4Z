'use client'
import { useEffect, useRef } from 'react'

interface Log {
  id: string
  level: string
  message: string
  createdAt: string
}

export default function LogPanel({ logs }: { logs: Log[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  if (logs.length === 0) {
    return (
      <div className="log-panel" style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:'80px'}}>
        <span style={{color:'var(--text3)', fontStyle:'italic'}}>Belum ada log</span>
      </div>
    )
  }

  return (
    <div className="log-panel">
      {logs.slice().reverse().map(log => {
        const time = new Date(log.createdAt).toLocaleTimeString('id-ID', { hour12: false })
        const levelColor = log.level === 'error' ? 'error' : log.level === 'warn' ? 'warn' : ''
        return (
          <div key={log.id} className="log-line">
            <span className="log-time">{time}</span>
            <span className={`log-msg ${levelColor}`}>{log.message}</span>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
