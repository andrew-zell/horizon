import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { ControlPanel } from './components/ControlPanel/ControlPanel'
import { EffectsCanvas } from './components/EffectsCanvas/EffectsCanvas'
import { GradientCanvas } from './components/GradientCanvas/GradientCanvas'
import { LoadingScreen } from './components/LoadingScreen/LoadingScreen'
import horizonLogo from './logo/Horizon_white.svg'

function App() {
  const [showLoader, setShowLoader] = useState(true)
  const [showCornerLogo, setShowCornerLogo] = useState(false)

  useEffect(() => {
    if (showLoader) {
      setShowCornerLogo(false)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setShowCornerLogo(true)
    }, 200)

    return () => window.clearTimeout(timeoutId)
  }, [showLoader])

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
        <motion.img
          src={horizonLogo}
          alt="Horizon"
          initial={false}
          animate={{ opacity: showCornerLogo ? 0.78 : 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            display: 'block',
            width: 70,
            height: 'auto',
          }}
        />
      </div>

      <ControlPanel />
      {showLoader && <LoadingScreen onDone={() => setShowLoader(false)} />}
    </div>
  )
}

export default App
