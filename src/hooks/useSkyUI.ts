import { useEffect, useReducer } from 'react'
import { getParams, subscribe } from '../lib/paramsStore'

export function useSkyUI() {
  const [, forceUpdate] = useReducer((value) => value + 1, 0)

  useEffect(() => subscribe(() => forceUpdate()), [])

  return getParams()
}
