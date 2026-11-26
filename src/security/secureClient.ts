import { createGroup, computeSharedSecret, generateKeyPair, type DhGroup } from './diffieHellman.ts'
import { fromBase64, toBase64 } from './bytes.ts'
import {
  DIRECTIONS,
  deriveSessionKeys,
  isEnvelope,
  openFrame,
  openJson,
  sealFrame,
  sealJson,
  type SessionKeys,
} from './transportCipher.ts'

/**
 * Cliente del canal cifrado:
 *   1. Acuerda con el servidor una llave temporal con Diffie-Hellman (POST /secure/handshake).
 *   2. Cifra con ChaCha20 cada petición y descifra cada respuesta.
 * La llave vive solo en memoria: al recargar la página se acuerda otra.
 */

const SESSION_HEADER = 'X-Secure-Session'
const SESSION_EXPIRED_CODE = 'SECURE_SESSION_EXPIRED'
// Se renueva un poco antes de que el servidor la dé por vencida
const EXPIRY_MARGIN_MS = 30_000

export interface SecureSession {
  sessionId: string
  keys: SessionKeys
  expiresAt: number
}

export interface SecureClientOptions {
  baseUrl: string
  dhPrimeHex: string
  dhGenerator: string
  fetchImpl?: typeof fetch
}

export interface SecureRequestOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

type ErrorBody = { error?: string | { message?: string; code?: string } }

function errorFrom(body: ErrorBody): { message?: string; code?: string } {
  return typeof body.error === 'string' ? { message: body.error } : body.error ?? {}
}

export function createSecureClient({ baseUrl, dhPrimeHex, dhGenerator, fetchImpl = fetch }: SecureClientOptions) {
  let group: DhGroup | null = null
  let pending: Promise<SecureSession> | null = null

  async function handshake(): Promise<SecureSession> {
    group ??= createGroup(dhPrimeHex, dhGenerator)
    const client = generateKeyPair(group)
    const response = await fetchImpl(`${baseUrl}/secure/handshake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientPublicKey: toBase64(client.publicKey) }),
    })
    const body = (await response.json().catch(() => ({}))) as ErrorBody & {
      sessionId?: string
      serverPublicKey?: string
      expiresAt?: string
    }
    if (!response.ok || !body.sessionId || !body.serverPublicKey) {
      throw new Error(errorFrom(body).message || 'No fue posible establecer el canal cifrado')
    }

    const serverPublicKey = fromBase64(body.serverPublicKey)
    const sharedSecret = computeSharedSecret(group, client.privateKey, serverPublicKey)
    return {
      sessionId: body.sessionId,
      keys: deriveSessionKeys(sharedSecret, client.publicKey, serverPublicKey),
      expiresAt: body.expiresAt ? Date.parse(body.expiresAt) : Date.now() + 5 * 60_000,
    }
  }

  /** Sesión vigente; si no hay o está por vencer, acuerda una nueva (una sola a la vez). */
  async function getSession(): Promise<SecureSession> {
    if (pending) {
      const session = await pending.catch(() => null)
      if (session && session.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return session
    }
    const attempt = handshake()
    pending = attempt
    attempt.catch(() => {
      if (pending === attempt) pending = null
    })
    return attempt
  }

  function resetSession() {
    pending = null
  }

  async function send<T>(path: string, options: SecureRequestOptions, session: SecureSession) {
    const hasBody = options.body !== undefined
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: options.method ?? (hasBody ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...options.headers, [SESSION_HEADER]: session.sessionId },
      body: hasBody
        ? JSON.stringify(sealJson(session.keys, session.sessionId, DIRECTIONS.CLIENT_TO_SERVER, options.body))
        : undefined,
    })
    const raw: unknown = await response.json().catch(() => ({}))
    const body = isEnvelope(raw)
      ? openJson<T & ErrorBody>(session.keys, session.sessionId, DIRECTIONS.SERVER_TO_CLIENT, raw)
      : (raw as T & ErrorBody)
    return { response, body }
  }

  /**
   * Petición cifrada: el cuerpo sale cifrado y la respuesta se descifra y verifica.
   * Si el servidor ya no reconoce la sesión (p. ej. se reinició), acuerda otra y reintenta una vez.
   */
  async function request<T>(path: string, options: SecureRequestOptions = {}): Promise<T> {
    let result = await send<T>(path, options, await getSession())
    if (result.response.status === 401 && errorFrom(result.body).code === SESSION_EXPIRED_CODE) {
      resetSession()
      result = await send<T>(path, options, await getSession())
    }
    if (!result.response.ok) {
      throw new Error(errorFrom(result.body).message || 'No fue posible completar la solicitud')
    }
    return result.body
  }

  /** Para la edición en tiempo real: cifra/descifra tramas binarias de WebSocket. */
  async function sealRealtimeFrame(update: Uint8Array): Promise<{ sessionId: string; frame: Uint8Array }> {
    const session = await getSession()
    return { sessionId: session.sessionId, frame: sealFrame(session.keys, session.sessionId, DIRECTIONS.CLIENT_TO_SERVER, update) }
  }

  async function openRealtimeFrame(frame: Uint8Array): Promise<Uint8Array> {
    const session = await getSession()
    return openFrame(session.keys, session.sessionId, DIRECTIONS.SERVER_TO_CLIENT, frame)
  }

  return { getSession, resetSession, request, sealRealtimeFrame, openRealtimeFrame }
}

export type SecureClient = ReturnType<typeof createSecureClient>
