import { concatBytes, toHex, utf8Decode, utf8Encode } from './bytes.ts'
import { randomBytes } from './random.ts'
import { DIRECTIONS, openFrame, sealFrame, type SessionKeys } from './transportCipher.ts'

/**
 * WebSocket cifrado con ChaCha20 para la edición en tiempo real y los avisos.
 *
 * Tiene la misma forma que un WebSocket (onopen, onmessage, onclose, send, close, readyState),
 * pero envía y recibe texto en claro mientras por la red solo viajan tramas cifradas:
 *   - se conecta con ?sid=<sesión>&cid=<conexión nueva>, así las tramas quedan amarradas a esta conexión,
 *   - cada trama lleva un número de secuencia: una trama repetida o reordenada se rechaza.
 */

/** El servidor ya no reconoce la sesión cifrada: se acuerda otra y el llamador reconecta. */
export const SECURE_SESSION_EXPIRED_CLOSE_CODE = 4440
const INVALID_FRAME_CLOSE_CODE = 4400
const HANDSHAKE_FAILED_CLOSE_CODE = 4503
const SEQUENCE_SIZE = 8

export interface SecureCloseEvent {
  code: number
  reason: string
  wasClean: boolean
}

export interface SecureMessageEvent {
  data: string
}

export interface SecureWebSocketOptions {
  getSession(): Promise<{ sessionId: string; keys: SessionKeys }>
  resetSession(): void
  WebSocketImpl?: typeof WebSocket
}

function encodeSequence(value: number): Uint8Array {
  const bytes = new Uint8Array(SEQUENCE_SIZE)
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value))
  return bytes
}

export class SecureWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = SecureWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: SecureMessageEvent) => void) | null = null
  onclose: ((event: SecureCloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  #socket: WebSocket | null = null
  #keys: SessionKeys | null = null
  #channel = ''
  #outgoing = 0
  #incoming = 0
  #pendingClose: SecureCloseEvent | null = null

  constructor(url: string, options: SecureWebSocketOptions) {
    void this.#connect(url, options)
  }

  async #connect(url: string, options: SecureWebSocketOptions) {
    let session: { sessionId: string; keys: SessionKeys }
    try {
      session = await options.getSession()
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'No fue posible establecer el canal cifrado'
      this.#finish({ code: HANDSHAKE_FAILED_CLOSE_CODE, reason, wasClean: false })
      return
    }
    // close() se llamó mientras se acordaba la llave
    if (this.#pendingClose) {
      this.#finish(this.#pendingClose)
      return
    }

    const channelId = toHex(randomBytes(16))
    this.#keys = session.keys
    this.#channel = `${session.sessionId}#${channelId}`
    const separator = url.includes('?') ? '&' : '?'
    const Impl = options.WebSocketImpl ?? WebSocket
    const socket = new Impl(`${url}${separator}sid=${encodeURIComponent(session.sessionId)}&cid=${channelId}`)
    socket.binaryType = 'arraybuffer'
    this.#socket = socket

    socket.onopen = () => {
      this.readyState = SecureWebSocket.OPEN
      this.onopen?.()
    }
    socket.onmessage = (event: MessageEvent) => {
      let text: string
      try {
        text = this.#decrypt(new Uint8Array(event.data as ArrayBuffer))
      } catch {
        socket.close(INVALID_FRAME_CLOSE_CODE, 'Trama cifrada inválida')
        return
      }
      this.onmessage?.({ data: text })
    }
    socket.onerror = (event: Event) => this.onerror?.(event)
    socket.onclose = (event: CloseEvent) => {
      if (event.code === SECURE_SESSION_EXPIRED_CLOSE_CODE) options.resetSession()
      this.#finish({ code: event.code, reason: event.reason, wasClean: event.wasClean })
    }
  }

  #decrypt(frame: Uint8Array): string {
    if (!this.#keys) throw new Error('Canal cifrado sin llave')
    const plaintext = openFrame(this.#keys, this.#channel, DIRECTIONS.SERVER_TO_CLIENT, frame)
    if (plaintext.length < SEQUENCE_SIZE) throw new Error('Trama cifrada incompleta')
    const sequence = Number(new DataView(plaintext.buffer, plaintext.byteOffset, SEQUENCE_SIZE).getBigUint64(0))
    if (sequence !== this.#incoming) throw new Error('Trama cifrada repetida o fuera de orden')
    this.#incoming++
    return utf8Decode(plaintext.subarray(SEQUENCE_SIZE))
  }

  #finish(event: SecureCloseEvent) {
    if (this.readyState === SecureWebSocket.CLOSED) return
    this.readyState = SecureWebSocket.CLOSED
    this.onclose?.(event)
  }

  /** Cifra y envía un mensaje de texto. */
  send(text: string) {
    if (this.readyState !== SecureWebSocket.OPEN || !this.#socket || !this.#keys) {
      throw new Error('El canal cifrado no está abierto')
    }
    const plaintext = concatBytes(encodeSequence(this.#outgoing++), utf8Encode(text))
    this.#socket.send(sealFrame(this.#keys, this.#channel, DIRECTIONS.CLIENT_TO_SERVER, plaintext) as Uint8Array<ArrayBuffer>)
  }

  close(code = 1000, reason = '') {
    if (this.readyState >= SecureWebSocket.CLOSING) return
    this.readyState = SecureWebSocket.CLOSING
    if (this.#socket) this.#socket.close(code, reason)
    else this.#pendingClose = { code, reason, wasClean: true }
  }
}
