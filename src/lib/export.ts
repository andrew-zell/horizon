import { rgbToCss, sampleGradientStops } from './gradientEngine'
import { createGradientRenderer } from './gradientShader'
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
  const blob = await new Promise<Blob | null>((resolve) => offscreen.toBlob(resolve, 'image/png'))
  renderer.dispose()
  if (!blob) return
  downloadBlob(blob, `horizon-${Date.now()}.png`)
}

export const exportSVG = (params: SkyParams) => {
  const width = 1600
  const height = 900
  const stops = sampleGradientStops(params, 48, width, height)
  const stopMarkup = stops
    .map(
      ({ offset, color }) =>
        `<stop offset="${(offset * 100).toFixed(2)}%" stop-color="${rgbToCss(color)}" />`,
    )
    .join('')

  const gradientMarkup =
    params.radialDispersion >= 0.3
      ? `<radialGradient id="sky" cx="50%" cy="110%" r="120%">${stopMarkup}</radialGradient>`
      : `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stopMarkup}</linearGradient>`

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1600 900">
  <defs>
    ${gradientMarkup}
  </defs>
  <rect width="1600" height="900" fill="url(#sky)" />
</svg>`

  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `horizon-${Date.now()}.svg`)
}
