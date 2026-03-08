import { ControlPanel } from './components/ControlPanel/ControlPanel'
import { EffectsCanvas } from './components/EffectsCanvas/EffectsCanvas'
import { GradientCanvas } from './components/GradientCanvas/GradientCanvas'

function App() {
  return (
    <div>
      <GradientCanvas />
      <EffectsCanvas />

      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M4 1.5V16.5M14 1.5V16.5M4 9H14"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.02em' }}>
          Horizon
        </div>
      </div>

      <ControlPanel />
    </div>
  )
}

export default App
