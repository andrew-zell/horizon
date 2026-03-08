import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useSkyUI } from '../../hooks/useSkyUI'
import { animateTo } from '../../lib/animator'
import { exportPNG, exportSVG } from '../../lib/export'
import {
  getActiveSeed,
  getParamsSnapshot,
  isSeedSynced,
  setEffectParam,
  setParam,
  setSeedState,
} from '../../lib/paramsStore'
import { PRESETS, PRESET_ORDER, type PresetName } from '../../lib/presets'
import { randomizeFromSeed } from '../../lib/randomizer'
import styles from './ControlPanel.module.css'

const prettify = (value: string) => value.replaceAll('_', ' ')
const hslCss = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  hue?: boolean
  format?: (value: number) => string
}

const Slider = ({ label, value, min, max, step = 1, onChange, hue, format }: SliderProps) => {
  const [localValue, setLocalValue] = useState(value)
  const draggingRef = useRef(false)

  useEffect(() => {
    if (!draggingRef.current) {
      setLocalValue(value)
    }
  }, [value])

  return (
    <label className={styles.sliderRow}>
      <span className={styles.sliderMeta}>
        <span>{label}</span>
        <span>{format ? format(localValue) : Math.round(localValue)}</span>
      </span>
      <input
        className={`${styles.slider} ${hue ? styles.hueSlider : ''}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onPointerDown={() => {
          draggingRef.current = true
        }}
        onPointerUp={() => {
          draggingRef.current = false
        }}
        onBlur={() => {
          draggingRef.current = false
        }}
        onChange={(event) => {
          const nextValue = Number(event.target.value)
          setLocalValue(nextValue)
          onChange(nextValue)
        }}
      />
    </label>
  )
}

const PNG_OPTIONS = [
  { label: '1920 × 1080', width: 1920, height: 1080 },
  { label: '2560 × 1440', width: 2560, height: 1440 },
  { label: '3840 × 2160', width: 3840, height: 2160 },
] as const

export const ControlPanel = () => {
  const params = useSkyUI()
  const [minimized, setMinimized] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const [dragState, setDragState] = useState<{ pointerOffsetX: number; pointerOffsetY: number } | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customWidth, setCustomWidth] = useState(1920)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!dragState) return
    const handleMove = (event: MouseEvent) => {
      setPosition({
        left: event.clientX - dragState.pointerOffsetX,
        top: event.clientY - dragState.pointerOffsetY,
      })
    }
    const handleUp = () => setDragState(null)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragState])

  useEffect(() => {
    if (!exportOpen) return
    const handleClick = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setExportOpen(false)
        setCustomOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [exportOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, button') || target?.isContentEditable) return

      event.preventDefault()
      const seed = Math.floor(Math.random() * 99999)
      setSeedState(seed, true)
      animateTo(randomizeFromSeed(seed))
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const floatingPosition = position
    ? { left: position.left, top: position.top, transform: 'none' as const }
    : undefined

  const triggerExport = (width: number, height: number) => {
    exportPNG(getParamsSnapshot(), width, height)
    setExportOpen(false)
    setCustomOpen(false)
  }

  const triggerPreset = (preset: PresetName) => {
    setSeedState(null, false)
    animateTo({
      ...PRESETS[preset],
      effects: { ...PRESETS[preset].effects },
    })
  }

  const triggerRandomize = () => {
    const seed = Math.floor(Math.random() * 99999)
    setSeedState(seed, true)
    animateTo(randomizeFromSeed(seed))
  }

  const customHeight = Math.round(customWidth / (16 / 9))
  const activeSeed = getActiveSeed()
  const formattedSeed = activeSeed === null ? '-----' : String(activeSeed).padStart(5, '0')

  return (
    <div className={styles.panelWrap} style={floatingPosition}>
      <motion.div className={styles.panel}>
        <div
          className={`${styles.headerStrip} ${dragState ? styles.dragging : ''}`}
          onMouseDown={(event) => {
            const target = event.target as HTMLElement
            if (target.closest('button') || target.closest('input')) return
            const rect = event.currentTarget.parentElement?.getBoundingClientRect()
            if (!rect) return
            setPosition((current) => current ?? { left: rect.left, top: rect.top })
            setDragState({
              pointerOffsetX: event.clientX - rect.left,
              pointerOffsetY: event.clientY - rect.top,
            })
          }}
        >
          <div className={styles.presetCompact}>
            {PRESET_ORDER.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`${styles.presetButton} ${params.preset === preset ? styles.presetActive : ''}`}
                onClick={() => triggerPreset(preset)}
              >
                {prettify(preset)}
              </button>
            ))}
          </div>
          <div className={styles.headerControls}>
            <span className={styles.headerDivider} aria-hidden="true" />
            <button type="button" className={styles.randomizeButton} onClick={triggerRandomize}>
              Randomize
            </button>
            <button
              type="button"
              className={`${styles.seedLabel} ${activeSeed !== null && isSeedSynced() ? '' : styles.seedDim}`}
              onClick={async () => {
                if (activeSeed === null) return
                await navigator.clipboard.writeText(formattedSeed)
              }}
              title={activeSeed === null ? 'No active seed' : 'Copy seed'}
            >
              Seed: {formattedSeed}
            </button>
            <button type="button" className={styles.expandButton} onClick={() => setMinimized((current) => !current)}>
              {minimized ? '▲ Expand' : '▼ Collapse'}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {!minimized && (
            <motion.div
              key="expanded-body"
              className={styles.body}
              initial={{ height: 52, opacity: 0 }}
              animate={{ height: 268, opacity: 1 }}
              exit={{ height: 52, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 32, mass: 0.8 }}
            >
              <div className={styles.scrollArea}>
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Atmosphere</h2>
                  <div className={styles.sliderList}>
                    <Slider label="Clarity" value={params.clarity * 100} min={0} max={100} onChange={(value) => setParam('clarity', value / 100)} />
                    <Slider label="Atmospheric Scatter" value={params.atmosphericScatter * 100} min={0} max={100} onChange={(value) => setParam('atmosphericScatter', value / 100)} />
                    <Slider label="Sunset Intensity" value={params.sunsetIntensity * 100} min={0} max={100} onChange={(value) => setParam('sunsetIntensity', value / 100)} />
                    <Slider label="Horizon Intensity" value={params.horizonIntensity * 100} min={0} max={100} onChange={(value) => setParam('horizonIntensity', value / 100)} />
                    <Slider label="Haze Width" value={params.hazeWidth * 100} min={0} max={100} onChange={(value) => setParam('hazeWidth', value / 100)} />
                    <Slider label="Dispersion" value={params.radialDispersion * 100} min={-100} max={100} onChange={(value) => setParam('radialDispersion', value / 100)} />
                    <Slider label="Scale" value={params.gradientScale * 100} min={50} max={200} onChange={(value) => setParam('gradientScale', value / 100)} format={(value) => (value / 100).toFixed(2)} />
                    <Slider label="Shift" value={params.gradientShift * 100} min={-30} max={30} onChange={(value) => setParam('gradientShift', value / 100)} format={(value) => (value / 100).toFixed(2)} />
                  </div>
                </section>

                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Colors</h2>
                  <div className={styles.colorGroups}>
                    <div className={styles.colorGroup}>
                      <div className={styles.colorHeader}>
                        <span className={styles.swatch} style={{ background: hslCss(params.zenithHue, params.zenithSaturation, params.zenithLightness) }} />
                        <span>Zenith</span>
                      </div>
                      <Slider label="Hue" value={params.zenithHue} min={0} max={360} hue onChange={(value) => setParam('zenithHue', value)} />
                      <Slider label="Saturation" value={params.zenithSaturation} min={0} max={100} onChange={(value) => setParam('zenithSaturation', value)} />
                      <Slider label="Lightness" value={params.zenithLightness} min={0} max={100} onChange={(value) => setParam('zenithLightness', value)} />
                    </div>
                    <div className={styles.colorGroup}>
                      <div className={styles.colorHeader}>
                        <span className={styles.swatch} style={{ background: hslCss(params.horizonHue, params.horizonSaturation, params.horizonLightness) }} />
                        <span>Horizon</span>
                      </div>
                      <Slider label="Hue" value={params.horizonHue} min={0} max={360} hue onChange={(value) => setParam('horizonHue', value)} />
                      <Slider label="Saturation" value={params.horizonSaturation} min={0} max={100} onChange={(value) => setParam('horizonSaturation', value)} />
                      <Slider label="Lightness" value={params.horizonLightness} min={0} max={100} onChange={(value) => setParam('horizonLightness', value)} />
                    </div>
                    <div className={styles.colorGroup}>
                      <div className={styles.colorHeader}>
                        <span className={styles.swatch} style={{ background: hslCss(params.groundHue, Math.max(10, params.horizonSaturation * 0.24), (1 - params.groundDarkness) * 28) }} />
                        <span>Ground</span>
                      </div>
                      <Slider label="Hue" value={params.groundHue} min={0} max={360} hue onChange={(value) => setParam('groundHue', value)} />
                      <Slider label="Darkness" value={params.groundDarkness * 100} min={0} max={100} onChange={(value) => setParam('groundDarkness', value / 100)} />
                    </div>
                  </div>
                </section>

                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Effects</h2>
                  <div className={styles.toggleRow}>
                    <span className={styles.toggleLabel}>Noise</span>
                    <button type="button" className={`${styles.toggleButton} ${params.effects.noiseEnabled ? styles.toggleOn : ''}`} onClick={() => setEffectParam('noiseEnabled', !params.effects.noiseEnabled)}>
                      {params.effects.noiseEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  <div className={styles.sliderList}>
                    <Slider label="Noise Opacity" value={params.effects.noiseOpacity * 100} min={0} max={15} step={0.5} format={(value) => `${value.toFixed(1)}%`} onChange={(value) => setEffectParam('noiseOpacity', value / 100)} />
                    <Slider label="Noise Scale" value={params.effects.noiseScale} min={10} max={200} onChange={(value) => setEffectParam('noiseScale', value)} />
                  </div>
                  <div className={styles.toggleRow} style={{ marginTop: 12 }}>
                    <span className={styles.toggleLabel}>Animated Noise</span>
                    <button type="button" className={`${styles.toggleButton} ${params.effects.noiseAnimated ? styles.toggleOn : ''}`} onClick={() => setEffectParam('noiseAnimated', !params.effects.noiseAnimated)}>
                      {params.effects.noiseAnimated ? 'On' : 'Off'}
                    </button>
                  </div>
                  <div className={styles.toggleRow} style={{ marginTop: 18 }}>
                    <span className={styles.toggleLabel}>Refractive Bars</span>
                    <button type="button" className={`${styles.toggleButton} ${params.effects.barsEnabled ? styles.toggleOn : ''}`} onClick={() => setEffectParam('barsEnabled', !params.effects.barsEnabled)}>
                      {params.effects.barsEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  <div className={styles.sliderList}>
                    <Slider label="Strip Width" value={params.effects.barWidth} min={8} max={80} onChange={(value) => setEffectParam('barWidth', value)} />
                    <Slider label="Refraction" value={params.effects.refractStrength} min={0} max={40} onChange={(value) => setEffectParam('refractStrength', value)} />
                    <Slider
                      label="Edge Highlight"
                      value={params.effects.highlightOpacity * 100}
                      min={0}
                      max={100}
                      onChange={(value) => setEffectParam('highlightOpacity', value / 100)}
                    />
                    <Slider label="Seed" value={params.effects.barSeed} min={1} max={999} step={1} onChange={(value) => setEffectParam('barSeed', value)} />
                  </div>
                </section>
              </div>

              <div className={styles.exportRow}>
                {exportOpen && (
                  <div className={styles.exportPopover} ref={popoverRef}>
                    <div className={styles.exportOptions}>
                      {PNG_OPTIONS.map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          className={styles.exportOption}
                          onClick={() => triggerExport(option.width, option.height)}
                        >
                          {option.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`${styles.exportOption} ${customOpen ? styles.presetActive : ''}`}
                        onClick={() => setCustomOpen((current) => !current)}
                      >
                        Custom
                      </button>
                    </div>
                    {customOpen && (
                      <div className={styles.customRow}>
                        <input
                          className={styles.customInput}
                          type="text"
                          inputMode="numeric"
                          value={customWidth}
                          onChange={(event) => {
                            const digits = event.target.value.replaceAll(/\D/g, '')
                            setCustomWidth(Math.max(16, Number(digits) || 16))
                          }}
                        />
                        <input className={styles.customInput} type="text" inputMode="numeric" value={customHeight} readOnly />
                        <button type="button" className={styles.downloadButton} onClick={() => triggerExport(customWidth, customHeight)}>
                          Download
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <button type="button" className={styles.exportButton} onClick={() => setExportOpen((current) => !current)}>
                  Export PNG
                </button>
                <button
                  type="button"
                  className={styles.exportButton}
                  onClick={() => {
                    exportSVG(getParamsSnapshot())
                    setExportOpen(false)
                    setCustomOpen(false)
                  }}
                >
                  Export SVG
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
