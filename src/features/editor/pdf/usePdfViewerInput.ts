import { useEffect, useRef, type RefObject } from 'react'

function isFindShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f'
}

/**
 * Atajo Ctrl+F para buscar en el PDF. Solo actúa si el último clic fue dentro del visor,
 * para no interferir con la búsqueda del editor de código (que usa el mismo atajo).
 */
export function useFindShortcut(containerRef: RefObject<HTMLElement | null>, onFind: () => void) {
  const isActiveRef = useRef(false)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      isActiveRef.current = Boolean(containerRef.current?.contains(event.target as Node))
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isActiveRef.current && isFindShortcut(event)) {
        event.preventDefault()
        onFind()
      }
    }

    globalThis.addEventListener('pointerdown', handlePointerDown, true)
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => {
      globalThis.removeEventListener('pointerdown', handlePointerDown, true)
      globalThis.removeEventListener('keydown', handleKeyDown)
    }
  }, [containerRef, onFind])
}

/**
 * Zoom con Ctrl + rueda del ratón (o gesto de pellizco en el touchpad) sobre las páginas.
 * El listener se registra como no pasivo porque debe cancelar el zoom propio del navegador.
 */
export function useWheelZoom(scrollRef: RefObject<HTMLElement | null>, onZoom: (direction: 'in' | 'out') => void) {
  const onZoomRef = useRef(onZoom)

  useEffect(() => {
    onZoomRef.current = onZoom
  }, [onZoom])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return undefined

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      onZoomRef.current(event.deltaY < 0 ? 'in' : 'out')
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [scrollRef])
}
