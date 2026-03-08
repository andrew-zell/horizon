import type { SkyParams } from '../types'
import { createDefaultEffects } from './presets'

interface BandSample {
  h: number
  s: number
  l: number
  weight: number
}

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s * 100, l * 100]
}

const sampleBand = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  yStart: number,
  yEnd: number,
): BandSample => {
  const xStart = Math.floor(width * 0.2)
  const xEnd = Math.floor(width * 0.8)
  const hueBuckets = new Float32Array(36)
  let totalWeight = 0
  let totalS = 0
  let totalL = 0
  let samples = 0

  for (let y = Math.floor(yStart * height); y < Math.floor(yEnd * height); y++) {
    for (let x = xStart; x < xEnd; x += 2) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const [h, s, l] = rgbToHsl(r, g, b)
      const weight = s / 100
      const bucket = Math.floor(h / 10) % 36
      hueBuckets[bucket] += weight
      totalWeight += weight
      totalS += s
      totalL += l
      samples++
    }
  }

  let maxBucket = 0
  let maxWeight = 0
  for (let i = 0; i < 36; i++) {
    if (hueBuckets[i] > maxWeight) {
      maxWeight = hueBuckets[i]
      maxBucket = i
    }
  }

  return {
    h: maxBucket * 10 + 5,
    s: samples > 0 ? totalS / samples : 50,
    l: samples > 0 ? totalL / samples : 50,
    weight: totalWeight,
  }
}

export const extractFromImage = (file: File): Promise<SkyParams> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      const maxSize = 400
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      canvas.width = Math.floor(img.width * scale)
      canvas.height = Math.floor(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas context unavailable'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)

      const zenith = sampleBand(data, canvas.width, canvas.height, 0.0, 0.25)
      const upper = sampleBand(data, canvas.width, canvas.height, 0.25, 0.5)
      const horizon = sampleBand(data, canvas.width, canvas.height, 0.4, 0.65)
      const ground = sampleBand(data, canvas.width, canvas.height, 0.72, 1.0)

      const bands = [zenith, upper, horizon, ground]
      const brightestIdx = bands.reduce((bi, b, i) => (b.l > bands[bi].l ? i : bi), 0)
      const horizonIntensity = Math.min(horizon.s / 60, 1)
      const sunsetIntensity =
        horizon.h > 15 && horizon.h < 60 ? Math.min((horizon.s - 20) / 60, 1) : 0

      resolve({
        zenithHue: zenith.h,
        zenithSaturation: Math.max(zenith.s, 8),
        zenithLightness: zenith.l,
        horizonHue: horizon.h,
        horizonSaturation: Math.max(horizon.s, 15),
        horizonLightness: horizon.l,
        horizonIntensity: Math.max(horizonIntensity, 0.3),
        hazeWidth: 0.5,
        atmosphericScatter: upper.s > 30 ? 0.4 : 0.15,
        sunsetIntensity: Math.max(sunsetIntensity, 0),
        clarity: 0.7,
        groundHue: ground.h,
        groundDarkness: Math.max(1 - ground.l / 40, 0.3),
        radialDispersion: brightestIdx <= 1 ? -0.2 : 0.2,
        gradientScale: 1.0,
        gradientShift: 0.0,
        preset: null,
        effects: createDefaultEffects(),
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}
