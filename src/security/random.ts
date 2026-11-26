// getRandomValues acepta como máximo 65 536 bytes por llamada
const MAX_CHUNK = 65_536

/**
 * Bytes aleatorios del generador seguro del navegador.
 *
 * Es la única pieza que no se implementa a mano: un generador propio sería predecible.
 * Los algoritmos (ChaCha20, Diffie-Hellman, SHA-256) sí son propios.
 */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  for (let offset = 0; offset < length; offset += MAX_CHUNK) {
    globalThis.crypto.getRandomValues(bytes.subarray(offset, offset + MAX_CHUNK))
  }
  return bytes
}
