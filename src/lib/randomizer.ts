import { createDefaultEffects } from './presets'
import type { SkyParams } from '../types'

const seededRandom = (seed: number) => {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PALETTES = [
  [268, 28, 20],
  [228, 195, 220],
  [155, 280, 160],
  [0, 14, 8],
  [210, 185, 200],
  [248, 58, 240],
  [300, 45, 290],
  [180, 30, 170],
  [35, 200, 25],
  [260, 340, 250],
  [15, 240, 10],
  [190, 60, 180],
  [320, 160, 310],
  [50, 220, 40],
  [200, 10, 190],
  [275, 35, 265],
  [165, 300, 155],
  [100, 260, 90],
  [235, 15, 225],
  [350, 180, 340],
] as const

const ARCHETYPES = [
  { name: 'DRAMATIC', intensity: 0.9, hazeWidth: 0.35, scatter: 0.25, sunset: 0.85, clarity: 0.65, dispersion: 0.5, satZ: 60, satH: 88, lZ: 12, lH: 50 },
  { name: 'ATMOSPHERIC', intensity: 0.45, hazeWidth: 0.65, scatter: 0.7, sunset: 0.2, clarity: 0.45, dispersion: 0.2, satZ: 45, satH: 55, lZ: 18, lH: 65 },
  { name: 'MINIMAL', intensity: 0.2, hazeWidth: 0.75, scatter: 0.5, sunset: 0.05, clarity: 0.9, dispersion: 0.05, satZ: 25, satH: 30, lZ: 55, lH: 80 },
  { name: 'VOLCANIC', intensity: 1, hazeWidth: 0.5, scatter: 0.1, sunset: 1, clarity: 0.25, dispersion: 0.65, satZ: 10, satH: 95, lZ: 5, lH: 38 },
  { name: 'LUMINOUS', intensity: 0.6, hazeWidth: 0.45, scatter: 0.4, sunset: 0.5, clarity: 0.8, dispersion: 0.3, satZ: 70, satH: 75, lZ: 20, lH: 60 },
  { name: 'HAZY', intensity: 0.35, hazeWidth: 0.8, scatter: 0.85, sunset: 0.15, clarity: 0.15, dispersion: 0.15, satZ: 30, satH: 40, lZ: 35, lH: 72 },
  { name: 'DEEP', intensity: 0.7, hazeWidth: 0.4, scatter: 0.3, sunset: 0.4, clarity: 0.7, dispersion: 0.4, satZ: 80, satH: 70, lZ: 8, lH: 28 },
  { name: 'ELECTRIC', intensity: 0.8, hazeWidth: 0.3, scatter: 0.2, sunset: 0.6, clarity: 0.95, dispersion: 0.55, satZ: 90, satH: 85, lZ: 15, lH: 45 },
] as const

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const wrapHue = (value: number) => ((value % 360) + 360) % 360

export function randomizeFromSeed(seed: number): SkyParams {
  const rng = seededRandom(seed)
  const palette = PALETTES[Math.floor(rng() * PALETTES.length)]
  const archetype = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)]
  const jitter = (range: number) => (rng() - 0.5) * 2 * range

  return {
    zenithHue: wrapHue(palette[0] + jitter(8)),
    horizonHue: wrapHue(palette[1] + jitter(8)),
    groundHue: wrapHue(palette[2] + jitter(8)),
    zenithSaturation: clamp(archetype.satZ + jitter(6), 0, 100),
    horizonSaturation: clamp(archetype.satH + jitter(6), 0, 100),
    zenithLightness: clamp(archetype.lZ + jitter(5), 0, 100),
    horizonLightness: clamp(archetype.lH + jitter(5), 0, 100),
    horizonIntensity: archetype.intensity,
    hazeWidth: archetype.hazeWidth,
    atmosphericScatter: archetype.scatter,
    sunsetIntensity: archetype.sunset,
    clarity: archetype.clarity,
    groundDarkness: clamp(0.88 + jitter(0.08), 0, 1),
    radialDispersion: archetype.dispersion,
    gradientScale: 1,
    gradientShift: 0,
    preset: null,
    effects: createDefaultEffects(),
  }
}
