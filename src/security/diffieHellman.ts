import { randomBytes } from './random.ts'
import { toHex } from './bytes.ts'

/**
 * Diffie-Hellman sobre un grupo MODP (p primo, g generador), implementado a mano con BigInt.
 * El navegador elige un secreto a, envía A = g^a mod p y calcula s = B^a mod p con el valor
 * B del servidor. La llave s nunca viaja por la red.
 */

export interface DhGroup {
  prime: bigint
  generator: bigint
  byteLength: number
}

export interface DhKeyPair {
  privateKey: bigint
  publicKey: Uint8Array
}

const PRIVATE_KEY_BYTES = 32

function bytesToBigInt(bytes: Uint8Array): bigint {
  return bytes.length ? BigInt(`0x${toHex(bytes)}`) : 0n
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const hex = value.toString(16).padStart(length * 2, '0')
  if (hex.length > length * 2) throw new Error('Diffie-Hellman: valor más grande que el módulo')
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

/** Exponenciación modular por cuadrados sucesivos. */
export function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n
  let b = base % modulus
  let e = exponent
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus
    b = (b * b) % modulus
    e >>= 1n
  }
  return result
}

export function createGroup(primeHex: string, generator: string | number): DhGroup {
  const cleanHex = primeHex.replace(/\s+/g, '')
  if (!/^[0-9a-fA-F]+$/.test(cleanHex)) throw new Error('Diffie-Hellman: primo inválido en la configuración')
  const prime = BigInt(`0x${cleanHex}`)
  const g = BigInt(generator)
  if (prime < 2n ** 2047n) throw new Error('Diffie-Hellman: el primo debe tener al menos 2048 bits')
  if (g < 2n || g >= prime - 1n) throw new Error('Diffie-Hellman: generador inválido')
  return { prime, generator: g, byteLength: Math.ceil(cleanHex.length / 2) }
}

export function generateKeyPair(group: DhGroup): DhKeyPair {
  let privateKey = 0n
  while (privateKey < 2n) privateKey = bytesToBigInt(randomBytes(PRIVATE_KEY_BYTES))
  return { privateKey, publicKey: bigIntToBytes(modPow(group.generator, privateKey, group.prime), group.byteLength) }
}

/** Rechaza valores triviales (0, 1, p-1 o fuera de rango) que forzarían un secreto conocido. */
export function computeSharedSecret(group: DhGroup, privateKey: bigint, peerPublicBytes: Uint8Array): Uint8Array {
  const peerPublic = bytesToBigInt(peerPublicBytes)
  if (peerPublic <= 1n || peerPublic >= group.prime - 1n) {
    throw new Error('Diffie-Hellman: valor público del servidor inválido')
  }
  return bigIntToBytes(modPow(peerPublic, privateKey, group.prime), group.byteLength)
}
