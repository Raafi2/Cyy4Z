'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  deviceId: string
  isOnline: boolean
  screenWidth: number
  screenHeight: number
}

export default function DeviceScreen({ deviceId, isOnline, screenWidth, screenHeight }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const jmuxerRef = useRef<any>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [rotated, setRotated] = useState(false)
  const isPointerDown = useRef(false)

  // Displayed dimensions
  const displayW = rotated ? screenHeight : screenWidth
  const displayH = rotated ? screenWidth : screenHeight

  const loadJMuxer = async () => {
    if (typeof window !== 'undefined' && !(window as any).JMuxer) {
      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/jmuxer@2.0.5/dist/jmuxer.min.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load JMuxer'))
        document.body.appendChild(script)
      })
    }
  }

  const connect = useCallback(async () => {
    if (!isOnline) return
    const video = videoRef.current
    if (!video) return

    try {
      await loadJMuxer()
    } catch (e: any) {
      setError(e.message)
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws?type=browser&deviceId=${deviceId}`
    
    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setError('')
      
      if (jmuxerRef.current) {
        jmuxerRef.current.destroy()
      }
      
      // @ts-ignore
      jmuxerRef.current = new window.JMuxer({
        node: video,
        mode: 'video',
        flushingTime: 0,
        fps: 60,
        debug: false
      })
    }

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        const jmuxer = jmuxerRef.current
        if (jmuxer) {
          try {
            jmuxer.feed({ video: new Uint8Array(e.data) })
          } catch (err) {
            console.error("JMuxer feed error:", err)
          }
        }
      }
    }

    ws.onclose = () => {
      setConnected(false)
      if (jmuxerRef.current) {
        try { jmuxerRef.current.destroy() } catch {}
        jmuxerRef.current = null
      }
      setTimeout(() => {
        if (isOnline) connect()
      }, 3000)
    }

    ws.onerror = () => {
      setError('WebSocket error')
    }
  }, [deviceId, isOnline])

  useEffect(() => {
    if (isOnline) connect()
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (jmuxerRef.current) {
        try { jmuxerRef.current.destroy() } catch {}
      }
    }
  }, [isOnline, connect])

  // Calculate touch coordinates mapped to device resolution
  const getDeviceCoords = (e: React.MouseEvent<HTMLVideoElement>) => {
    const video = videoRef.current!
    const rect = video.getBoundingClientRect()
    const xRatio = (e.clientX - rect.left) / rect.width
    const yRatio = (e.clientY - rect.top) / rect.height
    // Map to actual device resolution
    const x = Math.round(xRatio * screenWidth)
    const y = Math.round(yRatio * screenHeight)
    return { x, y }
  }

  const sendControl = (msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLVideoElement>) => {
    isPointerDown.current = true
    const { x, y } = getDeviceCoords(e)
    sendControl({ type: 'touch', action: 'down', x, y })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!isPointerDown.current) return
    const { x, y } = getDeviceCoords(e)
    sendControl({ type: 'touch', action: 'move', x, y })
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLVideoElement>) => {
    isPointerDown.current = false
    const { x, y } = getDeviceCoords(e)
    sendControl({ type: 'touch', action: 'up', x, y })
  }

  const handleRotate = () => {
    setRotated(r => !r)
    sendControl({ type: 'rotate', landscape: !rotated })
  }

  const handleKeyboard = (e: React.KeyboardEvent<HTMLVideoElement>) => {
    if (e.key === 'Backspace') sendControl({ type: 'key', keycode: 67 })
    else if (e.key === 'Enter') sendControl({ type: 'key', keycode: 66 })
    else if (e.key === 'Escape') sendControl({ type: 'key', keycode: 111 })
    else if (e.key.length === 1) sendControl({ type: 'text', text: e.key })
  }

  return (
    <div className="screen-container" style={{minHeight: 300}}>
      {isOnline ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            muted
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onKeyDown={handleKeyboard}
            tabIndex={0}
            style={{outline:'none', cursor:'crosshair', touchAction:'none', maxWidth:'100%', maxHeight:'80vh'}}
          />
          {error && (
            <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', flexDirection:'column', gap:'8px'}}>
              <span style={{fontSize:'1.5rem'}}>⚠️</span>
              <span style={{color:'var(--yellow)', fontSize:'0.8rem', textAlign:'center', padding:'0 16px'}}>{error}</span>
            </div>
          )}
          {!connected && !error && (
            <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.5)'}}>
              <div className="spinner" style={{margin:0}}></div>
            </div>
          )}
          <div className="screen-overlay">
            <button className="screen-btn" onClick={handleRotate} title="Rotate">
              {rotated ? '📱' : '📺'}
            </button>
            <button className="screen-btn" onClick={() => sendControl({ type: 'key', keycode: 4 })} title="Back">◀</button>
            <button className="screen-btn" onClick={() => sendControl({ type: 'key', keycode: 3 })} title="Home">🏠</button>
            <button className="screen-btn" onClick={() => sendControl({ type: 'key', keycode: 187 })} title="Recents">⊞</button>
          </div>
        </>
      ) : (
        <div className="screen-placeholder">
          <div className="screen-placeholder-icon">📱</div>
          <div style={{fontSize:'0.85rem'}}>Device offline</div>
          <div style={{fontSize:'0.75rem', color:'var(--text3)'}}>Jalankan agent di Termux</div>
        </div>
      )}
    </div>
  )
}
