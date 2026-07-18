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
  const canvasW = displayW
  const canvasH = displayH

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

    let buffer = new Uint8Array(0)
    let configBuffer = new Uint8Array(0) // Stores SPS and PPS

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        const decoder = decoderRef.current
        if (!decoder || decoder.state === 'closed') return

        const chunk = new Uint8Array(e.data)
        const newBuffer = new Uint8Array(buffer.length + chunk.length)
        newBuffer.set(buffer)
        newBuffer.set(chunk, buffer.length)
        buffer = newBuffer

        // Find NAL units (0x00 0x00 0x00 0x01)
        let offset = 0
        while (offset < buffer.length - 4) {
          let nextStart = -1
          for (let i = offset + 4; i < buffer.length - 3; i++) {
            if (buffer[i] === 0 && buffer[i+1] === 0 && buffer[i+2] === 0 && buffer[i+3] === 1) {
              nextStart = i
              break
            }
          }
          if (nextStart === -1) break
          
          const nalUnit = buffer.slice(offset, nextStart)
          processNalUnit(nalUnit, decoder)
          offset = nextStart
        }
        
        if (offset > 0) {
          buffer = buffer.slice(offset)
        }
      }
    }

    function processNalUnit(nalUnit: Uint8Array, decoder: any) {
      if (nalUnit.length < 5) return
      try {
        const nalType = nalUnit[4] & 0x1F
        
        // SPS (7) or PPS (8)
        if (nalType === 7 || nalType === 8) {
          const newConfig = new Uint8Array(configBuffer.length + nalUnit.length)
          newConfig.set(configBuffer)
          newConfig.set(nalUnit, configBuffer.length)
          configBuffer = newConfig
          return // Do not decode yet
        }

        const isKey = nalType === 5 // IDR
        
        let dataToDecode = nalUnit
        if (isKey && configBuffer.length > 0) {
           // Prepend SPS/PPS to this IDR frame
           dataToDecode = new Uint8Array(configBuffer.length + nalUnit.length)
           dataToDecode.set(configBuffer)
           dataToDecode.set(nalUnit, configBuffer.length)
        }

        decoder.decode(new window.EncodedVideoChunk({
          type: isKey ? 'key' : 'delta',
          data: dataToDecode,
          timestamp: performance.now() * 1000
        }))
      } catch (err) {
        console.error("Decode error on NAL:", err)
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
