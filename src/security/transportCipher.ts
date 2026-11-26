import { chacha20, CHACHA20_NONCE_SIZE } from './chacha20.ts'
import { hkdf, hmacSha256 } from './hmac.ts'
import { sha256 } from './sha256.ts'
import { randomBytes } from './random.ts'
import { concatBytes, constantTimeEqual, fromBase64, toBase64, uint32BE, utf8Decode, utf8Encode } from './bytes.ts'

/**
 * Cifrado del canal navegador <-> servidor: ChaCha20 + HMAC-SHA256 (cifrar y luego firmar).
 *
 * El backend tiene una copia idéntica (BackendSeguridad/src/security/transport/transportCipher.js):
 * cualquier cambio de formato debe hacerse en ambos.
 */

export const PROTOCOL_VERSION = 1
const TAG_SIZE = 32
const KEY_DERIVATION_INFO = 'SecureLeaf transport v1'

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

/** Sobre JSON que viaja en las peticiones HTTP. */
export interface SecureEnvelope {
  v: number
  sid: string
  nonce: string
  data: string
  tag: string
}

/** Llaves de la sesión a partir del secreto de Diffie-Hellman, amarradas a ambos valores públicos. */
export function deriveSessionKeys(sharedSecret: Uint8Array, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): SessionKeys {
  const salt = sha256(concatBytes(clientPublicKey, serverPublicKey))
  const material = hkdf(sharedSecret, salt, utf8Encode(KEY_DERIVATION_INFO), 128)
  return {
    [DIRECTIONS.CLIENT_TO_SERVER]: { encryption: material.slice(0, 32), mac: material.slice(32, 64) },
    [DIRECTIONS.SERVER_TO_CLIENT]: { encryption: material.slice(64, 96), mac: material.slice(96, 128) },
  }
}

function associatedData(sessionId: string, direction: Direction): Uint8Array {
  const label = utf8Encode(`SecureLeaf-v${PROTOCOL_VERSION}|${sessionId}|${direction}`)
  return concatBytes(uint32BE(label.length), label)
}

function computeTag(macKey: Uint8Array, sessionId: string, direction: Direction, nonce: Uint8Array, ciphertext: Uint8Array) {
  return hmacSha256(macKey, concatBytes(associatedData(sessionId, direction), nonce, ciphertext))
}

export function sealBytes(keys: SessionKeys, sessionId: string, direction: Direction, plaintext: Uint8Array) {
  const { encryption, mac } = keys[direction]
  const nonce = randomBytes(CHACHA20_NONCE_SIZE)
  const ciphertext = chacha20(encryption, nonce, plaintext)
  return { nonce, ciphertext, tag: computeTag(mac, sessionId, direction, nonce, ciphertext) }
}

/** Verifica la firma y descifra; si el mensaje fue alterado o truncado, falla antes de descifrar. */
export function openBytes(
  keys: SessionKeys,
  sessionId: string,
  direction: Direction,
  parts: { nonce: Uint8Array; ciphertext: Uint8Array; tag: Uint8Array },
): Uint8Array {
  const { encryption, mac } = keys[direction]
  if (parts.nonce.length !== CHACHA20_NONCE_SIZE || parts.tag.length !== TAG_SIZE) {
    throw new Error('Mensaje cifrado con formato inválido')
  }
  const expected = computeTag(mac, sessionId, direction, parts.nonce, parts.ciphertext)
  if (!constantTimeEqual(expected, parts.tag)) throw new Error('Mensaje cifrado alterado o incompleto')
  return chacha20(encryption, parts.nonce, parts.ciphertext)
}

export function isEnvelope(value: unknown): value is SecureEnvelope {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.nonce === 'string' && typeof candidate.data === 'string' && typeof candidate.tag === 'string'
}

export function sealJson(keys: SessionKeys, sessionId: string, direction: Direction, payload: unknown): SecureEnvelope {
  const json = JSON.stringify(payload === undefined ? null : payload)
  const { nonce, ciphertext, tag } = sealBytes(keys, sessionId, direction, utf8Encode(json))
  return { v: PROTOCOL_VERSION, sid: sessionId, nonce: toBase64(nonce), data: toBase64(ciphertext), tag: toBase64(tag) }
}

export function openJson<T>(keys: SessionKeys, sessionId: string, direction: Direction, envelope: unknown): T {
  if (!isEnvelope(envelope) || envelope.v !== PROTOCOL_VERSION || envelope.sid !== sessionId) {
    throw new Error('Mensaje cifrado con formato inválido')
  }
  const plaintext = openBytes(keys, sessionId, direction, {
    nonce: fromBase64(envelope.nonce),
    ciphertext: fromBase64(envelope.data),
    tag: fromBase64(envelope.tag),
  })
  return JSON.parse(utf8Decode(plaintext)) as T
}

/** Trama binaria para WebSocket (edición en tiempo real): nonce | cifrado | firma. */
export function sealFrame(keys: SessionKeys, sessionId: string, direction: Direction, plaintext: Uint8Array): Uint8Array {
  const { nonce, ciphertext, tag } = sealBytes(keys, sessionId, direction, plaintext)
  return concatBytes(nonce, ciphertext, tag)
}

export function openFrame(keys: SessionKeys, sessionId: string, direction: Direction, frame: Uint8Array): Uint8Array {
  if (frame.length < CHACHA20_NONCE_SIZE + TAG_SIZE) throw new Error('Trama cifrada incompleta')
  return openBytes(keys, sessionId, direction, {
    nonce: frame.subarray(0, CHACHA20_NONCE_SIZE),
    ciphertext: frame.subarray(CHACHA20_NONCE_SIZE, frame.length - TAG_SIZE),
    tag: frame.subarray(frame.length - TAG_SIZE),
  })
}
