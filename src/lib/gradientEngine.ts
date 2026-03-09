import type { RGB, SkyParams } from '../types'

type GradientSurface = HTMLCanvasElement | OffscreenCanvas

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export const smootherstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const clampChannel = (value: number) => Math.min(255, Math.max(0, value))

const hslToRgb = (h: number, s: number, l: number): RGB => {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp(s / 100)
  const light = clamp(l / 100)
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const hp = hue / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let [r1, g1, b1] = [0, 0, 0]

  if (hp < 1) [r1, g1, b1] = [c, x, 0]
  else if (hp < 2) [r1, g1, b1] = [x, c, 0]
  else if (hp < 3) [r1, g1, b1] = [0, c, x]
  else if (hp < 4) [r1, g1, b1] = [0, x, c]
  else if (hp < 5) [r1, g1, b1] = [x, 0, c]
  else [r1, g1, b1] = [c, 0, x]

  const m = light - c / 2
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  }
}

const mix = (a: RGB, b: RGB, t: number): RGB => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
})

const tint = (rgb: RGB, target: RGB, amount: number) => mix(rgb, target, clamp(amount))

export const getSkyColor = (y: number, params: SkyParams): RGB => {
  const zenithBase = hslToRgb(
    params.zenithHue + (1 - params.clarity) * 10,
    params.zenithSaturation * (0.84 + params.clarity * 0.1),
    params.zenithLightness,
  )
  const zenith = tint(
    zenithBase,
    hslToRgb(275, 22, 28),
    smoothstep(0, 0.34, y) * 0.18 + (1 - params.clarity) * 0.08,
  )

  const midBase = mix(
    zenith,
    hslToRgb(
      params.horizonHue - 12,
      params.horizonSaturation * (0.6 + params.sunsetIntensity * 0.22),
      params.horizonLightness * 0.76,
    ),
    smootherstep(0.35, 0.62, y),
  )

  const scattered = tint(
    midBase,
    hslToRgb(208, 72, 62),
    params.atmosphericScatter * (1 - Math.abs(y - 0.5) / 0.22) * 0.22,
  )

  const horizonGlow = hslToRgb(
    params.horizonHue,
    params.horizonSaturation,
    params.horizonLightness,
  )
  const hazeLight = hslToRgb(
    params.horizonHue - 4,
    params.horizonSaturation * 0.48,
    Math.min(97, params.horizonLightness + 26),
  )
  const hazeCenter = 0.72
  const hazeHalfWidth = 0.06 + params.hazeWidth * 0.16
  const glowFactor =
    Math.max(0, 1 - Math.abs(y - hazeCenter) / hazeHalfWidth) *
    params.hazeIntensity *
    params.horizonIntensity *
    (0.45 + params.sunsetIntensity * 0.55)

  const horizonBand = mix(
    tint(horizonGlow, hazeLight, 0.42 + (1 - params.clarity) * 0.28),
    hazeLight,
    smoothstep(0.62, 0.82, y) * (0.22 + params.hazeWidth * 0.32),
  )
  const withGlow = tint(scattered, horizonBand, glowFactor)

  const ground = hslToRgb(
    params.groundHue,
    params.groundSaturation,
    params.groundLightness,
  )

  const zenithToMid = smoothstep(0.18, 0.45, y)
  const midToHorizon = smoothstep(0.54, 0.74, y)
  const horizonToGround = smoothstep(0.8, 1, y)

  let color = mix(zenith, scattered, zenithToMid)
  color = mix(color, withGlow, midToHorizon)
  color = mix(color, ground, horizonToGround)

  return tint(color, hslToRgb(210, 15, 88), (1 - params.clarity) * 0.12)
}

const interpolateEffects = (from: SkyParams['effects'], to: SkyParams['effects'], t: number) => ({
  noiseEnabled: t < 1 ? from.noiseEnabled || to.noiseEnabled : to.noiseEnabled,
  noiseOpacity: from.noiseOpacity + (to.noiseOpacity - from.noiseOpacity) * t,
  noiseScale: from.noiseScale + (to.noiseScale - from.noiseScale) * t,
  noiseAnimated: t < 1 ? from.noiseAnimated || to.noiseAnimated : to.noiseAnimated,
  barsEnabled: t < 1 ? from.barsEnabled || to.barsEnabled : to.barsEnabled,
  barWidth: from.barWidth + (to.barWidth - from.barWidth) * t,
  refractStrength: from.refractStrength + (to.refractStrength - from.refractStrength) * t,
  barSeed: t < 1 ? from.barSeed : to.barSeed,
})

export const interpolateSky = (from: SkyParams, to: SkyParams, t: number): SkyParams => ({
  zenithHue: from.zenithHue + (to.zenithHue - from.zenithHue) * t,
  zenithSaturation: from.zenithSaturation + (to.zenithSaturation - from.zenithSaturation) * t,
  zenithLightness: from.zenithLightness + (to.zenithLightness - from.zenithLightness) * t,
  horizonHue: from.horizonHue + (to.horizonHue - from.horizonHue) * t,
  horizonSaturation: from.horizonSaturation + (to.horizonSaturation - from.horizonSaturation) * t,
  horizonLightness: from.horizonLightness + (to.horizonLightness - from.horizonLightness) * t,
  horizonIntensity: from.horizonIntensity + (to.horizonIntensity - from.horizonIntensity) * t,
  hazeWidth: from.hazeWidth + (to.hazeWidth - from.hazeWidth) * t,
  hazeIntensity: from.hazeIntensity + (to.hazeIntensity - from.hazeIntensity) * t,
  atmosphericScatter: from.atmosphericScatter + (to.atmosphericScatter - from.atmosphericScatter) * t,
  sunsetIntensity: from.sunsetIntensity + (to.sunsetIntensity - from.sunsetIntensity) * t,
  clarity: from.clarity + (to.clarity - from.clarity) * t,
  groundHue: from.groundHue + (to.groundHue - from.groundHue) * t,
  groundSaturation: from.groundSaturation + (to.groundSaturation - from.groundSaturation) * t,
  groundLightness: from.groundLightness + (to.groundLightness - from.groundLightness) * t,
  radialDispersion: from.radialDispersion + (to.radialDispersion - from.radialDispersion) * t,
  gradientScale: from.gradientScale + (to.gradientScale - from.gradientScale) * t,
  gradientShift: from.gradientShift + (to.gradientShift - from.gradientShift) * t,
  preset: t < 1 ? null : to.preset,
  effects: interpolateEffects(from.effects, to.effects, t),
})

const getGradientSamplePosition = (
  x: number,
  y: number,
  width: number,
  height: number,
  params: Pick<SkyParams, 'radialDispersion' | 'gradientScale' | 'gradientShift'>,
) => {
  const linearT = y / Math.max(1, height)
  const xCurve = 1 - Math.pow(Math.abs(x / Math.max(1, width) - 0.5) * 2, 2)
  const bend = params.radialDispersion * xCurve * 0.35
  const baseT = linearT - bend
  return clamp(baseT / Math.max(0.0001, params.gradientScale) - params.gradientShift)
}

export const buildSkyGradient = (
  params: SkyParams,
  width: number,
  height: number,
): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = getGradientSamplePosition(x, y, width, height, params)
      const color = getSkyColor(t, params)
      const index = (y * width + x) * 4
      data[index] = Math.round(clampChannel(color.r + (Math.random() - 0.5) * 2))
      data[index + 1] = Math.round(clampChannel(color.g + (Math.random() - 0.5) * 2))
      data[index + 2] = Math.round(clampChannel(color.b + (Math.random() - 0.5) * 2))
      data[index + 3] = 255
    }
  }

  return new ImageData(data, width, height)
}

export const drawSkyGradient = (
  canvas: GradientSurface,
  params: SkyParams,
  width = canvas.width,
  height = canvas.height,
) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.putImageData(buildSkyGradient(params, width, height), 0, 0)
}

export const sampleGradientStops = (
  params: SkyParams,
  count: number,
  width = 1600,
  height = 900,
) =>
  Array.from({ length: count }, (_, index) => {
    const offset = index / Math.max(1, count - 1)
    const y = offset * height
    const x = width / 2
    const t = getGradientSamplePosition(x, y, width, height, params)
    return { offset, color: getSkyColor(t, params) }
  })

export const rgbToCss = ({ r, g, b }: RGB) =>
  `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
