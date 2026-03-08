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
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.02em' }}>
          Horizon
        </div>
      </div>

      <ControlPanel />
    </div>
  )
}

export default App
