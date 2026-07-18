'use client'
import { useRef, useState, useEffect, useCallback } from 'react'

interface Props {
  deviceId: string
  isOnline: boolean
  screenWidth: number
  screenHeight: number
  sendControl?: (data: any) => void
}

export default function DeviceScreen({ deviceId, isOnline, screenWidth, screenHeight, sendControl: externalSendControl }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const screenContainerRef = useRef<HTMLDivElement>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [rotated, setRotated] = useState(false)
  const [fps, setFps] = useState(0)
  const isPointerDown = useRef(false)
  const frameCount = useRef(0)
  const prevBlobUrl = useRef<string | null>(null)

  const sendControl = useCallback((data: any) => {
    if (externalSendControl) {
      externalSendControl(data)
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [externalSendControl])

  const connect = useCallback(() => {
    if (!isOnline) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws?type=browser&deviceId=${deviceId}`

    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setError('')
      frameCount.current = 0
    }

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        const blob = new Blob([e.data], { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)

        if (imgRef.current) {
          imgRef.current.src = url
        }

        // Revoke previous blob to prevent memory leak
        if (prevBlobUrl.current) {
          URL.revokeObjectURL(prevBlobUrl.current)
        }
        prevBlobUrl.current = url
        frameCount.current++
      }
    }

    ws.onclose = () => {
      setConnected(false)
      setTimeout(() => {
        if (isOnline) connect()
      }, 3000)
    }

    ws.onerror = () => {
      setError('Connection lost, reconnecting...')
    }
  }, [deviceId, isOnline])

  // FPS counter
  useEffect(() => {
    const interval = setInterval(() => {
      setFps(frameCount.current)
      frameCount.current = 0
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isOnline) connect()
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current)
    }
  }, [isOnline, connect])

  // Touch coordinates
  const getDeviceCoords = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current!
    const rect = img.getBoundingClientRect()
    const xRatio = (e.clientX - rect.left) / rect.width
    const yRatio = (e.clientY - rect.top) / rect.height
    const x = Math.round(xRatio * screenWidth)
    const y = Math.round(yRatio * screenHeight)
    return { x, y }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault()
    isPointerDown.current = true
    const { x, y } = getDeviceCoords(e)
    sendControl({ type: 'touch', action: 'down', x, y })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isPointerDown.current) return
    const { x, y } = getDeviceCoords(e)
    sendControl({ type: 'touch', action: 'move', x, y })
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLImageElement>) => {
    isPointerDown.current = false
    const { x, y } = getDeviceCoords(e)
    sendControl({ type: 'touch', action: 'up', x, y })
  }

  const handleRotate = () => {
    setRotated(r => !r)
    sendControl({ type: 'rotate', landscape: !rotated })
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      screenContainerRef.current?.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen()
    }
  }

  const handleKeyboard = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') sendControl({ type: 'key', keycode: 67 })
    else if (e.key === 'Enter') sendControl({ type: 'key', keycode: 66 })
    else if (e.key === 'Escape') sendControl({ type: 'key', keycode: 111 })
    else if (e.key.toLowerCase() === 'f') toggleFullscreen()
    else if (e.key.length === 1) sendControl({ type: 'text', text: e.key })
  }

  return (
    <div
      ref={screenContainerRef}
      className="screen-container"
      style={{ minHeight: 300, background: '#000' }}
      tabIndex={0}
      onKeyDown={handleKeyboard}
    >
      {isOnline ? (
        <>
          <img
            ref={imgRef}
            alt="Device Screen"
            draggable={false}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              outline: 'none',
              cursor: 'crosshair',
              touchAction: 'none',
              maxWidth: '100%',
              maxHeight: '80vh',
              userSelect: 'none',
              display: 'block',
              margin: '0 auto',
              transform: rotated ? 'rotate(90deg)' : 'none'
            }}
          />
          {error && (
            <div style={{
              position: 'absolute', bottom: 8, left: 8, right: 8,
              background: 'rgba(239,68,68,0.8)', color: 'white',
              padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem',
              textAlign: 'center', backdropFilter: 'blur(4px)'
            }}>
              ⚠️ {error}
            </div>
          )}
          <div className="screen-overlay">
            <span style={{
              background: 'rgba(0,0,0,0.6)', color: connected ? '#22c55e' : '#ef4444',
              padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem',
              fontFamily: 'monospace', backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {connected ? `${fps} FPS` : 'Connecting...'}
            </span>
            <button className="screen-btn" onClick={toggleFullscreen} title="Fullscreen (F)">
              ⛶
            </button>
            <button className="screen-btn" onClick={handleRotate} title="Rotate">
              {rotated ? '📱' : '📺'}
            </button>
          </div>
        </>
      ) : (
        <div className="screen-placeholder">
          <div className="screen-placeholder-icon">📵</div>
          <div>Device Offline</div>
          <div style={{fontSize: '0.8rem'}}>Waiting for agent connection...</div>
        </div>
      )}
    </div>
  )
}
