import type { SkyParams } from '../types'
import { PRESETS } from './presets'

const cloneParams = (params: SkyParams): SkyParams => ({
  ...params,
  effects: { ...params.effects },
})

const store = {
  params: {
    ...cloneParams(PRESETS.GOLDEN_HOUR),
    radialDispersion: 0,
    gradientScale: 1,
    gradientShift: 0,
  },
  dirty: true,
  gradientDirty: true,
  activeSeed: null as number | null,
  seedSynced: false,
  listeners: new Set<() => void>(),
  notifyFrame: null as number | null,
  lastNotify: 0,
}

const scheduleNotify = () => {
  if (store.notifyFrame !== null) return

  const tick = (now: number) => {
    if (now - store.lastNotify >= 100) {
      store.lastNotify = now
      store.notifyFrame = null
      notifyUI()
      return
    }

    store.notifyFrame = window.requestAnimationFrame(tick)
  }

  store.notifyFrame = window.requestAnimationFrame(tick)
}

export function getParams(): SkyParams {
  return store.params
}

export function getParamsSnapshot(): SkyParams {
  return cloneParams(store.params)
}

export function isDirty(): boolean {
  return store.dirty
}

export function isGradientDirty(): boolean {
  return store.gradientDirty
}

export function clearDirty() {
  store.dirty = false
  store.gradientDirty = false
}

export function markDirty(gradient = true) {
  store.dirty = true
  if (gradient) {
    store.gradientDirty = true
  }
}

export function setParam<K extends keyof SkyParams>(key: K, value: SkyParams[K]) {
  store.params[key] = value
  store.params.preset = null
  store.dirty = true
  store.gradientDirty = true
  if (store.activeSeed !== null) {
    store.seedSynced = false
  }
  scheduleNotify()
}

export function setEffectParam<K extends keyof SkyParams['effects']>(
  key: K,
  value: SkyParams['effects'][K],
) {
  store.params.effects[key] = value
  store.params.preset = null
  store.dirty = true
  store.gradientDirty = false
  if (store.activeSeed !== null) {
    store.seedSynced = false
  }
  scheduleNotify()
}

export function setParamsDirect(params: SkyParams) {
  store.params.zenithHue = params.zenithHue
  store.params.zenithSaturation = params.zenithSaturation
  store.params.zenithLightness = params.zenithLightness
  store.params.horizonHue = params.horizonHue
  store.params.horizonSaturation = params.horizonSaturation
  store.params.horizonLightness = params.horizonLightness
  store.params.horizonIntensity = params.horizonIntensity
  store.params.hazeWidth = params.hazeWidth
  store.params.hazeIntensity = params.hazeIntensity
  store.params.atmosphericScatter = params.atmosphericScatter
  store.params.sunsetIntensity = params.sunsetIntensity
  store.params.clarity = params.clarity
  store.params.groundHue = params.groundHue
  store.params.groundSaturation = params.groundSaturation
  store.params.groundLightness = params.groundLightness
  store.params.radialDispersion = params.radialDispersion
  store.params.gradientScale = params.gradientScale
  store.params.gradientShift = params.gradientShift
  store.params.preset = params.preset
  Object.assign(store.params.effects, params.effects)
  store.dirty = true
  store.gradientDirty = true
  scheduleNotify()
}

export function getActiveSeed() {
  return store.activeSeed
}

export function isSeedSynced() {
  return store.seedSynced
}

export function setSeedState(seed: number | null, synced: boolean) {
  store.activeSeed = seed
  store.seedSynced = synced
  scheduleNotify()
}

export function subscribe(fn: () => void) {
  store.listeners.add(fn)
  return () => {
    store.listeners.delete(fn)
  }
}

export function notifyUI() {
  store.listeners.forEach((fn) => fn())
}
