import type { EffectsParams } from '../types'

export const seededRandom = (seed: number) => {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const getNoiseBlurAmount = (scale: number) => ((scale - 10) / 190) * 2

export const renderGrain = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opacity: number,
) => {
  const image = ctx.createImageData(width, height)
  const data = image.data
  const alpha = Math.floor(opacity * 255)

  for (let i = 0; i < data.length; i += 4) {
    const value = Math.floor(Math.random() * 255)
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = alpha
  }

  ctx.putImageData(image, 0, 0)
}

export const renderRefractiveBars = (
  sourceCanvas: HTMLCanvasElement,
  outputCanvas: HTMLCanvasElement,
  params: Pick<EffectsParams, 'barWidth' | 'refractStrength' | 'barSeed'>,
) => {
  const srcCtx = sourceCanvas.getContext('2d')
  const outCtx = outputCanvas.getContext('2d')
  if (!srcCtx || !outCtx) return

  const W = sourceCanvas.width
  const H = sourceCanvas.height
  const srcData = srcCtx.getImageData(0, 0, W, H)
  const outData = outCtx.createImageData(W, H)

  const rng = seededRandom(params.barSeed)
  const numBars = Math.ceil(W / Math.max(1, params.barWidth))
  const barOffsets = Array.from({ length: numBars }, () => (rng() - 0.5) * 2 * params.refractStrength)

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const barIndex = Math.floor(x / Math.max(1, params.barWidth))
      const offset = barOffsets[barIndex] ?? 0
      const srcX = Math.min(W - 1, Math.max(0, Math.round(x + offset)))
      const srcIdx = (y * W + srcX) * 4
      const outIdx = (y * W + x) * 4
      outData.data[outIdx] = srcData.data[srcIdx]
      outData.data[outIdx + 1] = srcData.data[srcIdx + 1]
      outData.data[outIdx + 2] = srcData.data[srcIdx + 2]
      outData.data[outIdx + 3] = 255
    }
  }

  outCtx.putImageData(outData, 0, 0)
}
