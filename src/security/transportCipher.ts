import { chacha20, CHACHA20_NONCE_SIZE } from './chacha20.ts'
import { hkdf, hmacSha256 } from './hmac.ts'
import { sha256 } from './sha256.ts'
import { randomBytes } from './random.ts'
import { concatBytes, constantTimeEqual, uint32BE, utf8Decode, utf8Encode } from './bytes.ts'

/**
 * Cifrado del canal navegador <-> servidor: ChaCha20 + HMAC-SHA256 (cifrar y luego firmar).
 *
 * El backend tiene una copia equivalente (BackendSeguridad/src/security/transport/transportCipher.js):
 * cualquier cambio de formato debe hacerse en ambos.
 */

export const PROTOCOL_VERSION = 1
const TAG_SIZE = 32
const KEY_DERIVATION_INFO = 'SecureLeaf transport v1'
const MAX_META_BYTES = 64 * 1024

export const DIRECTIONS = {
  CLIENT_TO_SERVER: 'c2s',
  SERVER_TO_CLIENT: 's2c',
} as const

export type Direction = (typeof DIRECTIONS)[keyof typeof DIRECTIONS]

interface DirectionKeys {
  encryption: Uint8Array
  mac: Uint8Array
}

export type SessionKeys = Record<Direction, DirectionKeys>

/** Llaves de la sesión a partir del secreto de Diffie-Hellman, amarradas a ambos valores públicos. */
export function deriveSessionKeys(sharedSecret: Uint8Array, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): SessionKeys {
  const salt = sha256(concatBytes(clientPublicKey, serverPublicKey))
  const material = hkdf(sharedSecret, salt, utf8Encode(KEY_DERIVATION_INFO), 128)
  return {
    [DIRECTIONS.CLIENT_TO_SERVER]: { encryption: material.slice(0, 32), mac: material.slice(32, 64) },
    [DIRECTIONS.SERVER_TO_CLIENT]: { encryption: material.slice(64, 96), mac: material.slice(96, 128) },
  }
}

/**
 * Datos firmados (no cifrados): versión, canal y dirección. "channel" es la sesión (HTTP)
 * o "sesión#conexión" (WebSocket): un mensaje de un canal no se acepta en otro.
 */
function associatedData(channel: string, direction: Direction): Uint8Array {
  const label = utf8Encode(`SecureLeaf-v${PROTOCOL_VERSION}|${channel}|${direction}`)
  return concatBytes(uint32BE(label.length), label)
}

/** Trama cifrada: nonce (12) | datos cifrados con ChaCha20 | firma (32). */
export function sealFrame(keys: SessionKeys, channel: string, direction: Direction, plaintext: Uint8Array): Uint8Array {
  const { encryption, mac } = keys[direction]
  const nonce = randomBytes(CHACHA20_NONCE_SIZE)
  const ciphertext = chacha20(encryption, nonce, plaintext)
  const tag = hmacSha256(mac, concatBytes(associatedData(channel, direction), nonce, ciphertext))
  return concatBytes(nonce, ciphertext, tag)
}

/** Verifica la firma y descifra; si la trama fue alterada, truncada o es de otro canal, falla. */
export function openFrame(keys: SessionKeys, channel: string, direction: Direction, frame: Uint8Array): Uint8Array {
  if (frame.length < CHACHA20_NONCE_SIZE + TAG_SIZE) throw new Error('Trama cifrada incompleta')
  const { encryption, mac } = keys[direction]
  const nonce = frame.subarray(0, CHACHA20_NONCE_SIZE)
  const ciphertext = frame.subarray(CHACHA20_NONCE_SIZE, frame.length - TAG_SIZE)
  const tag = frame.subarray(frame.length - TAG_SIZE)
  const expected = hmacSha256(mac, concatBytes(associatedData(channel, direction), nonce, ciphertext))
  if (!constantTimeEqual(expected, tag)) throw new Error('Mensaje cifrado alterado o incompleto')
  return chacha20(encryption, nonce, ciphertext)
}

/** Mensaje del túnel HTTP antes de cifrar: largo de metadatos (4) | metadatos JSON | cuerpo. */
export function packMessage(meta: object, body: Uint8Array = new Uint8Array(0)): Uint8Array {
  const metaBytes = utf8Encode(JSON.stringify(meta))
  return concatBytes(uint32BE(metaBytes.length), metaBytes, body)
}

export function unpackMessage<T>(bytes: Uint8Array): { meta: T; body: Uint8Array } {
  if (bytes.length < 4) throw new Error('Mensaje del túnel incompleto')
  const metaLength = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0)
  if (metaLength > MAX_META_BYTES || 4 + metaLength > bytes.length) throw new Error('Mensaje del túnel inválido')
  return {
    meta: JSON.parse(utf8Decode(bytes.subarray(4, 4 + metaLength))) as T,
    body: bytes.subarray(4 + metaLength),
  }
}
