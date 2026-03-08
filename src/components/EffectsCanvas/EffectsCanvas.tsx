import { useEffect, useRef } from 'react'
import { getNoiseBlurAmount, renderGrain } from '../../lib/effectsEngine'
import { getParams } from '../../lib/paramsStore'

export const EffectsCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const bufferRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!bufferRef.current) {
      bufferRef.current = document.createElement('canvas')
    }
    const bufferCanvas = bufferRef.current

    let lastKey = ''
    let rafId = 0
    let running = true

    const resize = () => {
      canvas.width = Math.max(1, Math.round(window.innerWidth * window.devicePixelRatio))
      canvas.height = Math.max(1, Math.round(window.innerHeight * window.devicePixelRatio))
      bufferCanvas.width = canvas.width
      bufferCanvas.height = canvas.height
      lastKey = ''
    }

    const draw = () => {
      if (!running) return
      const params = getParams().effects
      const key = [
        canvas.width,
        canvas.height,
        params.noiseEnabled,
        params.noiseOpacity,
        params.noiseScale,
        params.noiseAnimated,
      ].join(':')
      const shouldRedraw = params.noiseEnabled && (params.noiseAnimated || key !== lastKey)

      if (!params.noiseEnabled) {
        if (key !== lastKey) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
          }
        }
        lastKey = key
        rafId = window.requestAnimationFrame(draw)
        return
      }

      if (shouldRedraw) {
        const ctx = canvas.getContext('2d')
        const bufferCtx = bufferCanvas.getContext('2d')
        if (ctx && bufferCtx) {
          const blur = getNoiseBlurAmount(params.noiseScale)
          canvas.style.filter = blur > 0.1 ? `blur(${blur}px)` : 'none'
          bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height)
          renderGrain(bufferCtx, bufferCanvas.width, bufferCanvas.height)
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.save()
          ctx.globalCompositeOperation = 'overlay'
          ctx.globalAlpha = params.noiseOpacity
          ctx.drawImage(bufferCanvas, 0, 0)
          ctx.restore()
        }
      }

      lastKey = key
      rafId = window.requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    rafId = window.requestAnimationFrame(draw)

    return () => {
      running = false
      window.removeEventListener('resize', resize)
      window.cancelAnimationFrame(rafId)
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  )
}
