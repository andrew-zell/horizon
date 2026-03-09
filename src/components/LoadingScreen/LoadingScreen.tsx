import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { interpolateSky, smoothstep } from '../../lib/gradientEngine'
import { createGradientRenderer } from '../../lib/gradientShader'
import { PRESETS } from '../../lib/presets'
import type { SkyParams } from '../../types'
import horizonLogo from '../../logo/Horizon_white.svg'
import styles from './LoadingScreen.module.css'

interface LoadingScreenProps {
  onDone: () => void
}

const cloneParams = (params: SkyParams): SkyParams => ({
  ...params,
  effects: { ...params.effects },
})

export const LoadingScreen = ({ onDone }: LoadingScreenProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<ReturnType<typeof createGradientRenderer> | null>(null)
  const paramsRef = useRef<SkyParams>(cloneParams(PRESETS.STORM))
  const timeoutsRef = useRef<number[]>([])
  const animationFrameRef = useRef<number | null>(null)
  const renderFrameRef = useRef<number | null>(null)
  const completeRef = useRef(false)
  const completeFnRef = useRef<() => void>(() => {})
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width = Math.max(1, Math.round(window.innerWidth * window.devicePixelRatio))
      canvas.height = Math.max(1, Math.round(window.innerHeight * window.devicePixelRatio))
    }

    const animateLocalTo = (target: SkyParams, durationMs = 600) => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }

      const start = cloneParams(paramsRef.current)
      const end = cloneParams(target)
      const startTime = performance.now()

      const tick = (now: number) => {
        const t = Math.min((now - startTime) / durationMs, 1)
        const eased = smoothstep(0, 1, t)
        paramsRef.current = interpolateSky(start, end, eased)

        if (t < 1) {
          animationFrameRef.current = window.requestAnimationFrame(tick)
        } else {
          animationFrameRef.current = null
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(tick)
    }

    const complete = () => {
      if (completeRef.current) return
      completeRef.current = true
      timeoutsRef.current.forEach((id) => window.clearTimeout(id))
      timeoutsRef.current = []
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      paramsRef.current = cloneParams(PRESETS.GOLDEN_HOUR)
      setIsExiting(true)
    }

    completeFnRef.current = complete

    rendererRef.current = createGradientRenderer(canvas)
    resize()

    paramsRef.current = cloneParams(PRESETS.STORM)
    timeoutsRef.current.push(
      window.setTimeout(() => animateLocalTo(cloneParams(PRESETS.BLUE_HOUR)), 500),
      window.setTimeout(() => animateLocalTo(cloneParams(PRESETS.ARCTIC)), 1000),
      window.setTimeout(() => animateLocalTo(cloneParams(PRESETS.GOLDEN_HOUR)), 1500),
      window.setTimeout(() => complete(), 2100),
    )

    const renderLoop = () => {
      rendererRef.current?.render(paramsRef.current)
      renderFrameRef.current = window.requestAnimationFrame(renderLoop)
    }

    window.addEventListener('resize', resize)
    renderFrameRef.current = window.requestAnimationFrame(renderLoop)

    return () => {
      completeRef.current = true
      window.removeEventListener('resize', resize)
      timeoutsRef.current.forEach((id) => window.clearTimeout(id))
      timeoutsRef.current = []
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current)
      }
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [])

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 1 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onClick={() => {
        completeFnRef.current()
      }}
      onAnimationComplete={() => {
        if (isExiting) {
          onDone()
        }
      }}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      <motion.img
        src={horizonLogo}
        alt="Horizon"
        className={styles.logo}
        initial={{ opacity: 0, x: '-50%', y: '-50%' }}
        animate={{ opacity: isExiting ? 0 : 1, top: '50%', left: '50%', x: '-50%', y: '-50%' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </motion.div>
  )
}
