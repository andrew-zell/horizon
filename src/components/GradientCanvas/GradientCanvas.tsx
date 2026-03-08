import { useEffect, useRef } from 'react'
import { clearDirty, getParams, isDirty, markDirty } from '../../lib/paramsStore'
import { createGradientRenderer } from '../../lib/gradientShader'

export const GradientCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<ReturnType<typeof createGradientRenderer> | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const width = Math.max(1, Math.round(window.innerWidth * window.devicePixelRatio))
      const height = Math.max(1, Math.round(window.innerHeight * window.devicePixelRatio))
      canvas.width = width
      canvas.height = height
      markDirty(true)
    }

    rendererRef.current = createGradientRenderer(canvas)
    resize()

    let rafId = 0
    const loop = () => {
      const renderer = rendererRef.current

      if (renderer && isDirty()) {
        renderer.render(getParams())
        clearDirty()
      }

      rafId = window.requestAnimationFrame(loop)
    }

    window.addEventListener('resize', resize)
    rafId = window.requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('resize', resize)
      window.cancelAnimationFrame(rafId)
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
    />
  )
}
