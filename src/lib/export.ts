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
