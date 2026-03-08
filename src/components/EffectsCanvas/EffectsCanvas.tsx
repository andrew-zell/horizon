import { useEffect, useRef } from 'react'
import { getNoiseBlurAmount, renderGrain } from '../../lib/effectsEngine'
import { getParams } from '../../lib/paramsStore'

export const EffectsCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let lastKey = ''
    let rafId = 0
    let running = true

    const resize = () => {
      canvas.width = Math.max(1, Math.round(window.innerWidth * window.devicePixelRatio))
      canvas.height = Math.max(1, Math.round(window.innerHeight * window.devicePixelRatio))
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
        timeoutRef.current = window.setTimeout(draw, 120)
        return
      }

      if (shouldRedraw) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const blur = getNoiseBlurAmount(params.noiseScale)
          canvas.style.filter = blur > 0.1 ? `blur(${blur}px)` : 'none'
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.save()
          ctx.globalCompositeOperation = 'overlay'
          renderGrain(ctx, canvas.width, canvas.height, params.noiseOpacity)
          ctx.restore()
        }
      }

      lastKey = key
      if (params.noiseAnimated) {
        rafId = window.requestAnimationFrame(draw)
      } else {
        timeoutRef.current = window.setTimeout(draw, 120)
      }
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
