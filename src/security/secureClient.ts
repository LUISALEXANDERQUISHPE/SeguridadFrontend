import { createGroup, computeSharedSecret, generateKeyPair, type DhGroup } from './diffieHellman.ts'
import { fromBase64, toBase64, toHex } from './bytes.ts'
import { randomBytes } from './random.ts'
import { DIRECTIONS, deriveSessionKeys, openFrame, packMessage, sealFrame, unpackMessage, type SessionKeys } from './transportCipher.ts'
import { SecureWebSocket } from './secureWebSocket.ts'

/**
 * Cliente del canal cifrado:
 *   1. Acuerda con el servidor una llave temporal con Diffie-Hellman (POST /secure/handshake).
 *      La llave nunca viaja por la red y vive solo en memoria (al recargar se acuerda otra).
 *   2. fetch(): envía cada petición (método, ruta, cabeceras con el token y cuerpo) cifrada con
 *      ChaCha20 por POST /secure/tunnel y devuelve la respuesta descifrada como un Response normal.
 *   3. openWebSocket(): WebSocket con cada trama cifrada (edición en tiempo real y avisos).
 */

const SESSION_HEADER = 'X-Secure-Session'
const SESSION_EXPIRED_CODE = 'SECURE_SESSION_EXPIRED'
// Se renueva un poco antes de que el servidor la dé por vencida
const EXPIRY_MARGIN_MS = 30_000
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304])
const TUNNEL_PREFIX = '/api'

export interface SecureSession {
  sessionId: string
  keys: SessionKeys
  expiresAt: number
  // Diferencia entre la hora del servidor y la del equipo (el servidor rechaza peticiones viejas)
  clockOffsetMs: number
}

export interface SecureClientOptions {
  baseUrl: string
  dhPrimeHex: string
  dhGenerator: string
  fetchImpl?: typeof fetch
  WebSocketImpl?: typeof WebSocket
}

interface EncodedRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: Uint8Array
}

interface ResponseMeta {
  rid: string
  status: number
  headers: Record<string, string>
}

type ErrorBody = { error?: string | { message?: string; code?: string } }

function errorFrom(body: ErrorBody): { message?: string; code?: string } {
  return typeof body.error === 'string' ? { message: body.error } : body.error ?? {}
}

/** Normaliza el cuerpo y las cabeceras igual que lo haría fetch (texto, JSON, FormData, Blob...). */
async function encodeRequest(path: string, init: RequestInit): Promise<EncodedRequest> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const request = new Request(new URL(cleanPath, 'http://canal-cifrado.local'), { ...init, signal: undefined })
  const headers: Record<string, string> = {}
  request.headers.forEach((value, name) => {
    headers[name] = value
  })
  const body = init.body == null ? new Uint8Array(0) : new Uint8Array(await request.arrayBuffer())
  return { method: request.method, url: `${TUNNEL_PREFIX}${cleanPath}`, headers, body }
}

export function createSecureClient({ baseUrl, dhPrimeHex, dhGenerator, fetchImpl = fetch, WebSocketImpl }: SecureClientOptions) {
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
      serverTime?: number
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
      clockOffsetMs: typeof body.serverTime === 'number' ? body.serverTime - Date.now() : 0,
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

  /** @returns null si el servidor ya no reconoce la sesión */
  async function sendThroughTunnel(request: EncodedRequest, session: SecureSession, signal?: AbortSignal | null): Promise<Response | null> {
    const rid = toHex(randomBytes(16))
    const meta = { rid, ts: Date.now() + session.clockOffsetMs, method: request.method, url: request.url, headers: request.headers }
    const frame = sealFrame(session.keys, session.sessionId, DIRECTIONS.CLIENT_TO_SERVER, packMessage(meta, request.body))

    const outer = await fetchImpl(`${baseUrl}/secure/tunnel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', [SESSION_HEADER]: session.sessionId },
      body: frame as Uint8Array<ArrayBuffer>,
      signal: signal ?? undefined,
    })

    if (!outer.ok) {
      const error = errorFrom((await outer.json().catch(() => ({}))) as ErrorBody)
      if (outer.status === 401 && error.code === SESSION_EXPIRED_CODE) return null
      throw new Error(error.message || 'No fue posible comunicarse por el canal cifrado')
    }

    const sealed = new Uint8Array(await outer.arrayBuffer())
    const { meta: responseMeta, body } = unpackMessage<ResponseMeta>(
      openFrame(session.keys, session.sessionId, DIRECTIONS.SERVER_TO_CLIENT, sealed),
    )
    if (responseMeta.rid !== rid) throw new Error('La respuesta cifrada no corresponde a la petición')

    return new Response(NULL_BODY_STATUSES.has(responseMeta.status) ? null : (body as Uint8Array<ArrayBuffer>), {
      status: responseMeta.status,
      headers: responseMeta.headers,
    })
  }

  /**
   * Igual que fetch(`${API}${path}`, init), pero todo viaja cifrado con ChaCha20.
   * Si el servidor ya no reconoce la sesión (p. ej. se reinició), acuerda otra y reintenta una vez.
   */
  async function secureFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const request = await encodeRequest(path, init)
    const first = await sendThroughTunnel(request, await getSession(), init.signal)
    if (first) return first

    resetSession()
    const retry = await sendThroughTunnel(request, await getSession(), init.signal)
    if (!retry) throw new Error('No fue posible establecer el canal cifrado')
    return retry
  }

  /** WebSocket cifrado hacia la URL indicada (edición en tiempo real y avisos). */
  function openWebSocket(url: string): SecureWebSocket {
    return new SecureWebSocket(url, { getSession, resetSession, WebSocketImpl })
  }

  return { getSession, resetSession, fetch: secureFetch, openWebSocket }
}

export type SecureClient = ReturnType<typeof createSecureClient>
