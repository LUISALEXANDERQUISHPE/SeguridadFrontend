/** Cambio mínimo que transforma un texto en otro: borrar "deleteCount" caracteres en "index" e insertar "insert". */
export interface TextChange {
  index: number
  deleteCount: number
  insert: string
}

/** Formato de los cambios que reporta Yjs (Y.YTextEvent.delta). */
export type TextDelta = ReadonlyArray<{ retain?: number; delete?: number; insert?: unknown }>

/**
 * Calcula el cambio entre el texto anterior y el nuevo comparando prefijo y sufijo comunes.
 * Un textarea solo modifica un tramo contiguo por evento (tecleo, pegado, reemplazo...), así
 * que este cambio es exactamente la edición del usuario. Devuelve null si no hay diferencias.
 */
export function computeTextChange(previous: string, next: string): TextChange | null {
  if (previous === next) return null

  const maxPrefix = Math.min(previous.length, next.length)
  let prefix = 0
  while (prefix < maxPrefix && previous.charCodeAt(prefix) === next.charCodeAt(prefix)) prefix++

  const maxSuffix = Math.min(previous.length, next.length) - prefix
  let suffix = 0
  while (
    suffix < maxSuffix &&
    previous.charCodeAt(previous.length - 1 - suffix) === next.charCodeAt(next.length - 1 - suffix)
  ) {
    suffix++
  }

  // No partir pares sustitutos (emojis): retroceder si el corte quedó en medio de uno
  if (prefix > 0 && isHighSurrogate(previous.charCodeAt(prefix - 1))) prefix--
  if (suffix > 0 && isLowSurrogate(previous.charCodeAt(previous.length - suffix))) suffix--

  return {
    index: prefix,
    deleteCount: previous.length - prefix - suffix,
    insert: next.slice(prefix, next.length - suffix),
  }
}

/**
 * Ajusta una posición del texto (ej. el cursor local) después de aplicar un cambio remoto.
 * Las inserciones remotas justo en la posición del cursor no lo desplazan, de modo que quien
 * está escribiendo conserva su lugar.
 */
export function mapIndexThroughDelta(position: number, delta: TextDelta): number {
  let index = 0
  let mapped = position

  for (const op of delta) {
    if (index > position) break
    if (op.retain) {
      index += op.retain
    } else if (op.insert !== undefined) {
      const length = typeof op.insert === 'string' ? op.insert.length : 1
      if (index < position) mapped += length
    } else if (op.delete) {
      const removed = Math.min(op.delete, Math.max(0, position - index))
      mapped -= removed
      // El texto borrado deja de ocupar espacio en el documento original a partir de index
      index += op.delete
    }
  }

  return Math.max(0, mapped)
}

/** Línea y columna (desde 0) de una posición del texto. */
export function toLineColumn(text: string, position: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(position, text.length))
  const before = text.slice(0, clamped)
  const lineStart = before.lastIndexOf('\n') + 1
  let line = 0
  for (let i = 0; i < lineStart; i++) if (before.charCodeAt(i) === 10) line++
  return { line, column: clamped - lineStart }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function isHighSurrogate(code: number) {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number) {
  return code >= 0xdc00 && code <= 0xdfff
}
