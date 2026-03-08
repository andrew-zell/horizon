import type { SkyParams } from '../types'
import { interpolateSky, smoothstep } from './gradientEngine'
import { getParamsSnapshot, setParamsDirect } from './paramsStore'

let animationFrame: number | null = null

export function animateTo(target: SkyParams, durationMs = 600) {
  if (animationFrame !== null) {
    window.cancelAnimationFrame(animationFrame)
  }

  const start = getParamsSnapshot()
  const startTime = performance.now()

  const tick = (now: number) => {
    const t = Math.min((now - startTime) / durationMs, 1)
    const eased = t < 1 ? smoothstep(0, 1, t) : 1

    setParamsDirect(interpolateSky(start, target, eased))

    if (t < 1) {
      animationFrame = window.requestAnimationFrame(tick)
    } else {
      animationFrame = null
    }
  }

  animationFrame = window.requestAnimationFrame(tick)
}
