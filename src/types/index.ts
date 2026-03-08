export interface EffectsParams {
  noiseEnabled: boolean
  noiseOpacity: number
  noiseScale: number
  noiseAnimated: boolean
  barsEnabled: boolean
  barWidth: number
  refractStrength: number
  highlightOpacity: number
  barSeed: number
}

export interface SkyParams {
  zenithHue: number
  zenithSaturation: number
  zenithLightness: number
  horizonHue: number
  horizonSaturation: number
  horizonLightness: number
  horizonIntensity: number
  hazeWidth: number
  atmosphericScatter: number
  sunsetIntensity: number
  clarity: number
  groundHue: number
  groundDarkness: number
  radialDispersion: number
  gradientScale: number
  gradientShift: number
  preset: string | null
  effects: EffectsParams
}

export interface RGB {
  r: number
  g: number
  b: number
}
