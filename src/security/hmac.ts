import { concatBytes } from './bytes.ts'
import { sha256, SHA256_BLOCK_SIZE, SHA256_DIGEST_SIZE } from './sha256.ts'

/**
 * HMAC-SHA256 (RFC 2104). Firma cada mensaje cifrado para detectar si fue
 * alterado o llegó incompleto: ChaCha20 por sí solo no lo detecta.
 */
export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockKey = new Uint8Array(SHA256_BLOCK_SIZE)
  blockKey.set(key.length > SHA256_BLOCK_SIZE ? sha256(key) : key)

  const innerPad = new Uint8Array(SHA256_BLOCK_SIZE)
  const outerPad = new Uint8Array(SHA256_BLOCK_SIZE)
  for (let i = 0; i < SHA256_BLOCK_SIZE; i++) {
    innerPad[i] = blockKey[i] ^ 0x36
    outerPad[i] = blockKey[i] ^ 0x5c
  }

  return sha256(concatBytes(outerPad, sha256(concatBytes(innerPad, message))))
}

/**
 * HKDF-SHA256 (RFC 5869): convierte el secreto de Diffie-Hellman en varias llaves
 * independientes, una para cada uso (cifrar, firmar, cada dirección).
 */
export function hkdf(inputKey: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  const prk = hmacSha256(salt.length ? salt : new Uint8Array(SHA256_DIGEST_SIZE), inputKey)
  const blocks = Math.ceil(length / SHA256_DIGEST_SIZE)
  if (blocks > 255) throw new Error('HKDF: longitud solicitada demasiado grande')

  const output = new Uint8Array(blocks * SHA256_DIGEST_SIZE)
  let previous: Uint8Array = new Uint8Array(0)
  for (let i = 1; i <= blocks; i++) {
    previous = hmacSha256(prk, concatBytes(previous, info, Uint8Array.of(i)))
    output.set(previous, (i - 1) * SHA256_DIGEST_SIZE)
  }
  return output.slice(0, length)
}
