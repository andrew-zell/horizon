import { useEffect, useRef } from 'react'

export const useAnimationFrame = (callback: (time: number) => void, enabled = true) => {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) return

    let frame = 0
    const loop = (time: number) => {
      callbackRef.current(time)
      frame = window.requestAnimationFrame(loop)
    }

    frame = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(frame)
  }, [enabled])
}
