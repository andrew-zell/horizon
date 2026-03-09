import { createGradientRenderer } from './gradientShader'
import { getNoiseBlurAmount, renderGrain } from './effectsEngine'
import type { SkyParams } from '../types'

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const exportPNG = async (params: SkyParams, width: number, height: number) => {
  const offscreen = document.createElement('canvas')
  offscreen.width = width
  offscreen.height = height
  const renderer = createGradientRenderer(offscreen, { preserveDrawingBuffer: true })
  renderer.render(params)
  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const outputCtx = output.getContext('2d')

  if (!outputCtx) {
    renderer.dispose()
    return
  }

  outputCtx.drawImage(offscreen, 0, 0)

  if (params.effects.noiseEnabled && params.effects.noiseOpacity > 0) {
    const noiseCanvas = document.createElement('canvas')
    noiseCanvas.width = width
    noiseCanvas.height = height
    const noiseCtx = noiseCanvas.getContext('2d')

    if (noiseCtx) {
      renderGrain(noiseCtx, width, height)
      outputCtx.save()
      outputCtx.filter = getNoiseBlurAmount(params.effects.noiseScale) > 0.1
        ? `blur(${getNoiseBlurAmount(params.effects.noiseScale)}px)`
        : 'none'
      outputCtx.globalCompositeOperation = 'overlay'
      outputCtx.globalAlpha = params.effects.noiseOpacity
      outputCtx.drawImage(noiseCanvas, 0, 0)
      outputCtx.restore()
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/png'))
  renderer.dispose()
  if (!blob) return
  downloadBlob(blob, `horizon-${Date.now()}.png`)
}
