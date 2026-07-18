'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  deviceId: string
  isOnline: boolean
  screenWidth: number
  screenHeight: number
}

export default function DeviceScreen({ deviceId, isOnline, screenWidth, screenHeight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const decoderRef = useRef<any>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [rotated, setRotated] = useState(false)
  const isPointerDown = useRef(false)

  // Displayed dimensions
  const displayW = rotated ? screenHeight : screenWidth
  const displayH = rotated ? screenWidth : screenHeight
  const scale = Math.min(400 / displayW, 560 / displayH)
  const canvasW = Math.round(displayW * scale)
  const canvasH = Math.round(displayH * scale)

  const setupDecoder = useCallback((canvas: HTMLCanvasElement) => {
    if (typeof window === 'undefined' || !('VideoDecoder' in window)) {
      setError('WebCodecs not supported. Use Chrome/Edge.')
      return null
    }
    const ctx = canvas.getContext('2d')
    // @ts-ignore
    const decoder = new window.VideoDecoder({
      output: (frame: any) => {
        if (ctx) {
          ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
        }
        frame.close()
      },
      error: (e: any) => {
        console.error('VideoDecoder error:', e)
        setError('Decoder error: ' + e.message)
      }
    })
    decoder.configure({
      codec: 'avc1.42E01E',
      codedWidth: screenWidth,
      codedHeight: screenHeight,
      hardwareAcceleration: 'prefer-hardware',
    })
    return decoder
  }, [screenWidth, screenHeight])

  const connect = useCallback(() => {
    if (!isOnline) return
    const canvas = canvasRef.current
    if (!canvas) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws?type=browser&deviceId=${deviceId}`
    
    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setError('')
      // Setup decoder
      const decoder = setupDecoder(canvas)
      decoderRef.current = decoder
    }

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        // Binary: H.264 frame
        const decoder = decoderRef.current
        if (!decoder || decoder.state === 'closed') return
        try {
          // Simple heuristic: check if this is a keyframe (starts with 0x00 0x00 0x00 0x01 0x65 or 0x67)
          const bytes = new Uint8Array(e.data)
          let isKey = false
          if (bytes.length > 4) {
            // NAL unit type
            const nalType = bytes[4] & 0x1F
            isKey = nalType === 5 || nalType === 7 // IDR or SPS
          }
          // @ts-ignore
          decoder.decode(new window.EncodedVideoChunk({
            type: isKey ? 'key' : 'delta',
            data: e.data,
            timestamp: performance.now() * 1000
          }))
        } catch (err) {
          // decoder error, skip frame
        }
      } else {
        // JSON message (stats, log, etc) - ignore in screen component
      }
    }

    ws.onclose = () => {
      setConnected(false)
      if (decoderRef.current) {
        try { decoderRef.current.close() } catch {}
        decoderRef.current = null
      }
      // Reconnect after 3s
      setTimeout(() => {
        if (isOnline) connect()
      }, 3000)
    }

    ws.onerror = () => {
      setError('WebSocket error')
    }
  }, [deviceId, isOnline, setupDecoder])

  useEffect(() => {
    if (isOnline) connect()
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (decoderRef.current) {
        try { decoderRef.current.close() } catch {}
      }
    }
  }, [isOnline, connect])

  // Calculate touch coordinates mapped to device resolution
  const getDeviceCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isPointerDown.current = true
    const { x, y } = getDeviceCoords(e)
    sendControl({ type: 'touch', action: 'down', x, y })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPointerDown.current) return
    const { x, y } = getDeviceCoords(e)
    sendControl({ type: 'touch', action: 'move', x, y })
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isPointerDown.current = false
    const { x, y } = getDeviceCoords(e)
    sendControl({ type: 'touch', action: 'up', x, y })
  }

  const handleRotate = () => {
    setRotated(r => !r)
    sendControl({ type: 'rotate', landscape: !rotated })
  }

  const handleKeyboard = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === 'Backspace') sendControl({ type: 'key', keycode: 67 })
    else if (e.key === 'Enter') sendControl({ type: 'key', keycode: 66 })
    else if (e.key === 'Escape') sendControl({ type: 'key', keycode: 111 })
    else if (e.key.length === 1) sendControl({ type: 'text', text: e.key })
  }

  return (
    <div className="screen-container" style={{minHeight: canvasH || 300}}>
      {isOnline ? (
        <>
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onKeyDown={handleKeyboard}
            tabIndex={0}
            style={{outline:'none', cursor:'crosshair', touchAction:'none'}}
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
