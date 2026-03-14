import { useSyncExternalStore, useCallback, useRef, useEffect } from 'react'
import { getState, subscribe } from './store'

export function useStore() {
  return useSyncExternalStore(subscribe, getState)
}

export function useStoreSelector<T>(selector: (state: ReturnType<typeof getState>) => T): T {
  const selectorRef = useRef(selector)
  selectorRef.current = selector

  const getSnapshot = useCallback(() => selectorRef.current(getState()), [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function useDebounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => fn(...args), delay)
    },
    [fn, delay]
  ) as T
}
