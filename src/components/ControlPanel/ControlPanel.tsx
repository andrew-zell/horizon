import { useEffect, useRef, useState } from 'react'
import { useSkyUI } from '../../hooks/useSkyUI'
import { animateTo } from '../../lib/animator'
import { extractFromImage } from '../../lib/extractor'
import { exportPNG } from '../../lib/export'
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
    if (!draggingRef.current) setLocalValue(value)
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
        onPointerCancel={() => {
          draggingRef.current = false
        }}
        onBlur={() => {
          draggingRef.current = false
        }}
        onChange={(e) => {
          const v = Number(e.target.value)
          setLocalValue(v)
          onChange(v)
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

interface SectionProps {
  params: ReturnType<typeof useSkyUI>
  openSections: { atmosphere: boolean; colors: boolean; effects: boolean }
  toggleSection: (key: 'atmosphere' | 'colors' | 'effects') => void
}

interface BasicEffectsProps {
  params: ReturnType<typeof useSkyUI>
}

const BasicEffects = ({ params }: BasicEffectsProps) => (
  <>
    <div className={styles.section}>
      <div className={styles.toggleRow}>
        <span className={styles.toggleLabel}>Noise</span>
        <button
          type="button"
          className={`${styles.toggleButton} ${params.effects.noiseEnabled ? styles.toggleOn : ''}`}
          onClick={() => setEffectParam('noiseEnabled', !params.effects.noiseEnabled)}
        >
          {params.effects.noiseEnabled ? 'On' : 'Off'}
        </button>
      </div>
      {params.effects.noiseEnabled && (
        <div className={styles.sliderList}>
          <Slider
            label="Opacity"
            value={params.effects.noiseOpacity * 100}
            min={0}
            max={15}
            step={0.1}
            format={(v) => `${v.toFixed(1)}%`}
            onChange={(v) => setEffectParam('noiseOpacity', v / 100)}
          />
        </div>
      )}
    </div>

    <div className={styles.section}>
      <div className={styles.toggleRow}>
        <span className={styles.toggleLabel}>Refractive Bars</span>
        <button
          type="button"
          className={`${styles.toggleButton} ${params.effects.barsEnabled ? styles.toggleOn : ''}`}
          onClick={() => setEffectParam('barsEnabled', !params.effects.barsEnabled)}
        >
          {params.effects.barsEnabled ? 'On' : 'Off'}
        </button>
      </div>
      {params.effects.barsEnabled && (
        <div className={styles.sliderList}>
          <Slider
            label="Strip Width"
            value={params.effects.barWidth}
            min={8}
            max={80}
            onChange={(v) => setEffectParam('barWidth', v)}
          />
          <Slider
            label="Refraction"
            value={params.effects.refractStrength}
            min={0}
            max={300}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={(v) => setEffectParam('refractStrength', v)}
          />
        </div>
      )}
    </div>
  </>
)

const AtmosphereSection = ({ params, openSections, toggleSection }: SectionProps) => (
  <div className={styles.section}>
    <div className={styles.sectionHeader} onClick={() => toggleSection('atmosphere')}>
      <span className={styles.sectionTitle}>Atmosphere</span>
      <span
        className={`${styles.sectionChevron} ${openSections.atmosphere ? styles.sectionChevronOpen : ''}`}
      >
        ▼
      </span>
    </div>
    {openSections.atmosphere && (
      <div className={styles.sliderList}>
        <Slider
          label="Clarity"
          value={params.clarity * 100}
          min={0}
          max={100}
          onChange={(v) => setParam('clarity', v / 100)}
        />
        <Slider
          label="Dispersion"
          value={params.radialDispersion * 100}
          min={-100}
          max={100}
          onChange={(v) => setParam('radialDispersion', v / 100)}
        />
        <Slider
          label="Horizon Intensity"
          value={params.horizonIntensity * 100}
          min={0}
          max={100}
          onChange={(v) => setParam('horizonIntensity', v / 100)}
        />
        <Slider
          label="Sunset Intensity"
          value={params.sunsetIntensity * 100}
          min={0}
          max={100}
          onChange={(v) => setParam('sunsetIntensity', v / 100)}
        />
        <Slider
          label="Scale"
          value={params.gradientScale * 100}
          min={50}
          max={200}
          onChange={(v) => setParam('gradientScale', v / 100)}
          format={(v) => (v / 100).toFixed(2)}
        />
        <Slider
          label="Shift"
          value={params.gradientShift * 100}
          min={-30}
          max={30}
          onChange={(v) => setParam('gradientShift', v / 100)}
          format={(v) => (v / 100).toFixed(2)}
        />
        <Slider
          label="Scatter"
          value={params.atmosphericScatter * 100}
          min={0}
          max={100}
          onChange={(v) => setParam('atmosphericScatter', v / 100)}
        />
        <Slider
          label="Haze Width"
          value={params.hazeWidth * 100}
          min={0}
          max={100}
          onChange={(v) => setParam('hazeWidth', v / 100)}
        />
      </div>
    )}
  </div>
)

const ColorsSection = ({ params, openSections, toggleSection }: SectionProps) => (
  <div className={styles.section}>
    <div className={styles.sectionHeader} onClick={() => toggleSection('colors')}>
      <span className={styles.sectionTitle}>Colors</span>
      <span
        className={`${styles.sectionChevron} ${openSections.colors ? styles.sectionChevronOpen : ''}`}
      >
        ▼
      </span>
    </div>
    {openSections.colors && (
      <div className={styles.colorGroups}>
        <div className={styles.colorGroup}>
          <div className={styles.colorHeader}>
            <span
              className={styles.swatch}
              style={{
                background: hslCss(
                  params.zenithHue,
                  params.zenithSaturation,
                  params.zenithLightness,
                ),
              }}
            />
            <span>Zenith</span>
          </div>
          <Slider
            label="Hue"
            value={params.zenithHue}
            min={0}
            max={360}
            hue
            onChange={(v) => setParam('zenithHue', v)}
          />
          <Slider
            label="Saturation"
            value={params.zenithSaturation}
            min={0}
            max={100}
            onChange={(v) => setParam('zenithSaturation', v)}
          />
          <Slider
            label="Lightness"
            value={params.zenithLightness}
            min={0}
            max={100}
            onChange={(v) => setParam('zenithLightness', v)}
          />
        </div>
        <div className={styles.colorGroup}>
          <div className={styles.colorHeader}>
            <span
              className={styles.swatch}
              style={{
                background: hslCss(
                  params.horizonHue,
                  params.horizonSaturation,
                  params.horizonLightness,
                ),
              }}
            />
            <span>Horizon</span>
          </div>
          <Slider
            label="Hue"
            value={params.horizonHue}
            min={0}
            max={360}
            hue
            onChange={(v) => setParam('horizonHue', v)}
          />
          <Slider
            label="Saturation"
            value={params.horizonSaturation}
            min={0}
            max={100}
            onChange={(v) => setParam('horizonSaturation', v)}
          />
          <Slider
            label="Lightness"
            value={params.horizonLightness}
            min={0}
            max={100}
            onChange={(v) => setParam('horizonLightness', v)}
          />
        </div>
        <div className={styles.colorGroup}>
          <div className={styles.colorHeader}>
            <span
              className={styles.swatch}
              style={{
                background: hslCss(
                  params.groundHue,
                  Math.max(10, params.horizonSaturation * 0.24),
                  (1 - params.groundDarkness) * 28,
                ),
              }}
            />
            <span>Ground</span>
          </div>
          <Slider
            label="Hue"
            value={params.groundHue}
            min={0}
            max={360}
            hue
            onChange={(v) => setParam('groundHue', v)}
          />
          <Slider
            label="Darkness"
            value={params.groundDarkness * 100}
            min={0}
            max={100}
            onChange={(v) => setParam('groundDarkness', v / 100)}
          />
        </div>
      </div>
    )}
  </div>
)

const EffectsSection = ({ params, openSections, toggleSection }: SectionProps) => (
  <div className={styles.section}>
    <div className={styles.sectionHeader} onClick={() => toggleSection('effects')}>
      <span className={styles.sectionTitle}>Effects</span>
      <span
        className={`${styles.sectionChevron} ${openSections.effects ? styles.sectionChevronOpen : ''}`}
      >
        ▼
      </span>
    </div>
    {openSections.effects && (
      <>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Noise</span>
          <button
            type="button"
            className={`${styles.toggleButton} ${params.effects.noiseEnabled ? styles.toggleOn : ''}`}
            onClick={() => setEffectParam('noiseEnabled', !params.effects.noiseEnabled)}
          >
            {params.effects.noiseEnabled ? 'On' : 'Off'}
          </button>
        </div>
        <div className={styles.sliderList} style={{ marginBottom: 16 }}>
          <Slider
            label="Noise Opacity"
            value={params.effects.noiseOpacity * 100}
            min={0}
            max={15}
            step={0.1}
            format={(v) => `${v.toFixed(1)}%`}
            onChange={(v) => setEffectParam('noiseOpacity', v / 100)}
          />
          <Slider
            label="Noise Scale"
            value={params.effects.noiseScale}
            min={10}
            max={200}
            onChange={(v) => setEffectParam('noiseScale', v)}
          />
        </div>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Animated Noise</span>
          <button
            type="button"
            className={`${styles.toggleButton} ${params.effects.noiseAnimated ? styles.toggleOn : ''}`}
            onClick={() => setEffectParam('noiseAnimated', !params.effects.noiseAnimated)}
          >
            {params.effects.noiseAnimated ? 'On' : 'Off'}
          </button>
        </div>
        <div className={styles.toggleRow} style={{ marginTop: 16 }}>
          <span className={styles.toggleLabel}>Refractive Bars</span>
          <button
            type="button"
            className={`${styles.toggleButton} ${params.effects.barsEnabled ? styles.toggleOn : ''}`}
            onClick={() => setEffectParam('barsEnabled', !params.effects.barsEnabled)}
          >
            {params.effects.barsEnabled ? 'On' : 'Off'}
          </button>
        </div>
        <div className={styles.sliderList}>
          <Slider
            label="Strip Width"
            value={params.effects.barWidth}
            min={8}
            max={80}
            onChange={(v) => setEffectParam('barWidth', v)}
          />
          <Slider
            label="Refraction"
            value={params.effects.refractStrength}
            min={0}
            max={300}
            step={0.1}
            format={(v) => v.toFixed(1)}
            onChange={(v) => setEffectParam('refractStrength', v)}
          />
          <Slider
            label="Bar Seed"
            value={params.effects.barSeed}
            min={1}
            max={999}
            step={1}
            onChange={(v) => setEffectParam('barSeed', v)}
          />
        </div>
      </>
    )}
  </div>
)

export const ControlPanel = () => {
  const params = useSkyUI()
  const [mode, setMode] = useState<'basic' | 'advanced'>('basic')
  const [collapsed, setCollapsed] = useState(false)
  const [openSections, setOpenSections] = useState({
    atmosphere: true,
    colors: true,
    effects: true,
  })
  const [exportOpen, setExportOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customWidth, setCustomWidth] = useState(1920)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    if (!exportOpen) return
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setExportOpen(false)
        setCustomOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [exportOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, button') || target?.isContentEditable) return
      e.preventDefault()
      const seed = Math.floor(Math.random() * 99999)
      setSeedState(seed, true)
      animateTo(randomizeFromSeed(seed))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const triggerExport = (width: number, height: number) => {
    exportPNG(getParamsSnapshot(), width, height)
    setExportOpen(false)
    setCustomOpen(false)
  }

  const triggerPreset = (preset: PresetName) => {
    setSeedState(null, false)
    animateTo({ ...PRESETS[preset], effects: { ...PRESETS[preset].effects } })
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
    <div className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
      {collapsed ? (
        <button
          type="button"
          className={`${styles.collapseButton} ${styles.collapseButtonOnly}`}
          onClick={() => setCollapsed(false)}
        >
          ‹
        </button>
      ) : (
        <>
          <div className={styles.header}>
            <div className={styles.modeToggle}>
              <button
                type="button"
                className={`${styles.modeButton} ${mode === 'basic' ? styles.modeButtonActive : ''}`}
                onClick={() => setMode('basic')}
              >
                Basic
              </button>
              <button
                type="button"
                className={`${styles.modeButton} ${mode === 'advanced' ? styles.modeButtonActive : ''}`}
                onClick={() => setMode('advanced')}
              >
                Advanced
              </button>
            </div>
            <button type="button" className={styles.collapseButton} onClick={() => setCollapsed(true)}>
              ›
            </button>
          </div>

          <div className={styles.scrollArea}>
            <div className={styles.quickRow}>
              {PRESET_ORDER.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`${styles.pill} ${params.preset === preset ? styles.pillActive : ''}`}
                  onClick={() => triggerPreset(preset as PresetName)}
                >
                  {prettify(preset)}
                </button>
              ))}
              <label className={styles.pill} style={{ cursor: 'pointer' }}>
                Extract
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    extractFromImage(file)
                      .then((params) => {
                        setSeedState(null, false)
                        animateTo(params)
                      })
                      .catch(console.error)
                    e.target.value = ''
                  }}
                />
              </label>
              <button type="button" className={styles.pill} onClick={triggerRandomize}>
                Randomize
              </button>
            </div>

            <div className={styles.seedRow}>
              <span
                className={`${styles.seedLabel} ${!isSeedSynced() && activeSeed !== null ? styles.seedDim : ''}`}
                onClick={() => {
                  if (activeSeed !== null) navigator.clipboard.writeText(String(activeSeed))
                }}
              >
                Seed {formattedSeed}
              </span>
            </div>

            {mode === 'basic' && (
              <>
                <div className={styles.section}>
                  <div className={styles.sliderList}>
                    <Slider
                      label="Clarity"
                      value={params.clarity * 100}
                      min={0}
                      max={100}
                      onChange={(v) => setParam('clarity', v / 100)}
                    />
                    <Slider
                      label="Dispersion"
                      value={params.radialDispersion * 100}
                      min={-100}
                      max={100}
                      onChange={(v) => setParam('radialDispersion', v / 100)}
                    />
                    <Slider
                      label="Horizon Intensity"
                      value={params.horizonIntensity * 100}
                      min={0}
                      max={100}
                      onChange={(v) => setParam('horizonIntensity', v / 100)}
                    />
                    <Slider
                      label="Sunset Intensity"
                      value={params.sunsetIntensity * 100}
                      min={0}
                      max={100}
                      onChange={(v) => setParam('sunsetIntensity', v / 100)}
                    />
                    <Slider
                      label="Scale"
                      value={params.gradientScale * 100}
                      min={50}
                      max={200}
                      onChange={(v) => setParam('gradientScale', v / 100)}
                      format={(v) => (v / 100).toFixed(2)}
                    />
                    <Slider
                      label="Shift"
                      value={params.gradientShift * 100}
                      min={-30}
                      max={30}
                      onChange={(v) => setParam('gradientShift', v / 100)}
                      format={(v) => (v / 100).toFixed(2)}
                    />
                  </div>
                </div>
                <BasicEffects params={params} />
              </>
            )}

            {mode === 'advanced' && (
              <>
                <AtmosphereSection params={params} openSections={openSections} toggleSection={toggleSection} />
                <ColorsSection params={params} openSections={openSections} toggleSection={toggleSection} />
                <EffectsSection params={params} openSections={openSections} toggleSection={toggleSection} />
              </>
            )}
          </div>

          <div className={styles.exportFooter}>
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
                    className={`${styles.exportOption} ${customOpen ? styles.pillActive : ''}`}
                    onClick={() => setCustomOpen((c) => !c)}
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
                      onChange={(e) => {
                        const digits = e.target.value.replaceAll(/\D/g, '')
                        setCustomWidth(Math.max(16, Number(digits) || 16))
                      }}
                    />
                    <input
                      className={styles.customInput}
                      type="text"
                      inputMode="numeric"
                      value={customHeight}
                      readOnly
                    />
                    <button
                      type="button"
                      className={styles.downloadButton}
                      onClick={() => triggerExport(customWidth, customHeight)}
                    >
                      Download
                    </button>
                  </div>
                )}
              </div>
            )}
            <button type="button" className={styles.exportButton} onClick={() => setExportOpen((c) => !c)}>
              Export PNG
            </button>
          </div>
        </>
      )}
    </div>
  )
}
