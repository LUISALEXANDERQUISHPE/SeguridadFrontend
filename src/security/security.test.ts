import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getDiffieHellman } from 'node:crypto'
import { sha256 } from './sha256.ts'
import { hkdf, hmacSha256 } from './hmac.ts'
import { chacha20 } from './chacha20.ts'
import { createGroup, computeSharedSecret, generateKeyPair } from './diffieHellman.ts'
import { concatBytes, fromBase64, fromHex, toBase64, toHex, utf8Decode, utf8Encode } from './bytes.ts'
import { randomBytes } from './random.ts'
import { DIRECTIONS, deriveSessionKeys, openFrame, packMessage, sealFrame, unpackMessage, type SessionKeys } from './transportCipher.ts'
import { createSecureClient } from './secureClient.ts'
import { SECURE_SESSION_EXPIRED_CLOSE_CODE } from './secureWebSocket.ts'

const PRIME_HEX = getDiffieHellman('modp14').getPrime('hex')

describe('Vectores oficiales', () => {
  it('SHA-256 de "abc"', () => {
    assert.equal(toHex(sha256(utf8Encode('abc'))), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('HMAC-SHA256 (RFC 4231, caso 2)', () => {
    const tag = hmacSha256(utf8Encode('Jefe'), utf8Encode('what do ya want for nothing?'))
    assert.equal(toHex(tag), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
  })

  it('HKDF-SHA256 (RFC 5869, caso 1)', () => {
    const okm = hkdf(new Uint8Array(22).fill(0x0b), fromHex('000102030405060708090a0b0c'), fromHex('f0f1f2f3f4f5f6f7f8f9'), 42)
    assert.equal(toHex(okm), '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865')
  })

  it('ChaCha20 (RFC 8439, sección 2.4.2)', () => {
    const key = fromHex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f')
    const nonce = fromHex('000000000000004a00000000')
    const plaintext = utf8Encode("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.")
    const hex = toHex(chacha20(key, nonce, plaintext, 1))
    assert.equal(hex.slice(0, 64), '6e2e359a2568f98041ba0728dd0d6981e97e7aec1d4360c20a27afccfd9fae0b')
    assert.equal(hex.slice(-36), '5af90bbf74a35be6b40b8eedf2785e42874d')
  })
})

function pairOfKeys(): SessionKeys {
  const group = createGroup(PRIME_HEX, '2')
  const client = generateKeyPair(group)
  const server = generateKeyPair(group)
  const clientSecret = computeSharedSecret(group, client.privateKey, server.publicKey)
  assert.deepEqual(clientSecret, computeSharedSecret(group, server.privateKey, client.publicKey))
  return deriveSessionKeys(clientSecret, client.publicKey, server.publicKey)
}

describe('Tramas cifradas (ChaCha20 + HMAC)', () => {
  it('un mensaje largo (~3 MB) con Unicode llega idéntico', () => {
    const keys = pairOfKeys()
    const content = utf8Encode('Línea con ñ, ü y 😀 \\section{x}\n'.repeat(100_000))
    const frame = sealFrame(keys, 's1', DIRECTIONS.CLIENT_TO_SERVER, packMessage({ url: '/api/x' }, content))
    const { meta, body } = unpackMessage<{ url: string }>(openFrame(keys, 's1', DIRECTIONS.CLIENT_TO_SERVER, frame))
    assert.equal(meta.url, '/api/x')
    assert.deepEqual(body, content)
  })

  it('rechaza tramas alteradas, truncadas, de otro canal o de la otra dirección', () => {
    const keys = pairOfKeys()
    const frame = sealFrame(keys, 's1', DIRECTIONS.CLIENT_TO_SERVER, utf8Encode('hola'))
    const tampered = new Uint8Array(frame)
    tampered[14] ^= 1
    assert.throws(() => openFrame(keys, 's1', DIRECTIONS.CLIENT_TO_SERVER, tampered))
    assert.throws(() => openFrame(keys, 's1', DIRECTIONS.CLIENT_TO_SERVER, frame.subarray(1)))
    assert.throws(() => openFrame(keys, 's2', DIRECTIONS.CLIENT_TO_SERVER, frame))
    assert.throws(() => openFrame(keys, 's1', DIRECTIONS.SERVER_TO_CLIENT, frame))
  })
})

/**
 * Servidor simulado con el mismo protocolo que el backend: acuerdo de llave y túnel que
 * devuelve como eco la petición recibida (o un archivo binario).
 */
function fakeServer() {
  const group = createGroup(PRIME_HEX, '2')
  const sessions = new Map<string, SessionKeys>()
  const seen: Array<{ meta: Record<string, unknown>; body: Uint8Array; outer: Uint8Array }> = []
  let handshakes = 0
  const binary = randomBytes(1_500_000)

  const fetchImpl = (async (url: string, init: RequestInit) => {
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
    if (url.endsWith('/secure/handshake')) {
      handshakes++
      const clientPublic = fromBase64(JSON.parse(String(init.body)).clientPublicKey)
      const server = generateKeyPair(group)
      const sessionId = `sesion-${handshakes}`
      sessions.set(sessionId, deriveSessionKeys(computeSharedSecret(group, server.privateKey, clientPublic), clientPublic, server.publicKey))
      return json(201, { sessionId, serverPublicKey: toBase64(server.publicKey), expiresAt: new Date(Date.now() + 3_600_000).toISOString(), serverTime: Date.now() })
    }

    const sessionId = (init.headers as Record<string, string>)['X-Secure-Session']
    const keys = sessions.get(sessionId)
    if (!keys) return json(401, { error: { message: 'expirada', code: 'SECURE_SESSION_EXPIRED' } })
    const outer = init.body as Uint8Array
    const { meta, body } = unpackMessage<Record<string, unknown>>(openFrame(keys, sessionId, DIRECTIONS.CLIENT_TO_SERVER, outer))
    seen.push({ meta, body, outer })

    const isFile = String(meta.url).endsWith('/archivo')
    const responseBody = isFile ? binary : utf8Encode(JSON.stringify({ eco: utf8Decode(body), meta }))
    const headers = isFile ? { 'content-type': 'application/pdf' } : { 'content-type': 'application/json' }
    const frame = sealFrame(keys, sessionId, DIRECTIONS.SERVER_TO_CLIENT, packMessage({ rid: meta.rid, status: 201, headers }, responseBody))
    return new Response(frame as Uint8Array<ArrayBuffer>, { status: 200, headers: { 'content-type': 'application/octet-stream' } })
  }) as typeof fetch

  return { fetchImpl, sessions, seen, binary, handshakeCount: () => handshakes }
}

describe('secureFetch (túnel cifrado)', () => {
  it('envía método, ruta, token y cuerpo cifrados, y entrega un Response normal', async () => {
    const server = fakeServer()
    const client = createSecureClient({ baseUrl: '/api', dhPrimeHex: PRIME_HEX, dhGenerator: '2', fetchImpl: server.fetchImpl })
    const content = 'Contraseña ñandú 😀 '.repeat(100_000)

    const response = await client.fetch('/projects?archived=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-secreto' },
      body: JSON.stringify({ content }),
    })
    assert.equal(response.status, 201)
    const data = (await response.json()) as { eco: string; meta: { method: string; url: string; headers: Record<string, string> } }
    assert.equal(JSON.parse(data.eco).content, content)
    assert.equal(data.meta.method, 'POST')
    assert.equal(data.meta.url, '/api/projects?archived=false')
    assert.equal(data.meta.headers.authorization, 'Bearer token-secreto')

    const outer = server.seen[0].outer
    for (const secret of ['token-secreto', 'ñandú', '/projects']) {
      assert.ok(!Buffer.from(outer).includes(Buffer.from(secret)), `"${secret}" no debe viajar en claro`)
    }
  })

  it('descarga binarios grandes (PDF) sin perder bytes', async () => {
    const server = fakeServer()
    const client = createSecureClient({ baseUrl: '/api', dhPrimeHex: PRIME_HEX, dhGenerator: '2', fetchImpl: server.fetchImpl })
    const response = await client.fetch('/documents/1/archivo')
    const blob = await response.blob()
    assert.equal(blob.type, 'application/pdf')
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), server.binary)
  })

  it('acuerda la llave una sola vez y, si el servidor la olvidó, acuerda otra y reintenta', async () => {
    const server = fakeServer()
    const client = createSecureClient({ baseUrl: '/api', dhPrimeHex: PRIME_HEX, dhGenerator: '2', fetchImpl: server.fetchImpl })
    await Promise.all([client.fetch('/a'), client.fetch('/b'), client.fetch('/c')])
    assert.equal(server.handshakeCount(), 1)

    server.sessions.clear()
    const response = await client.fetch('/d', { method: 'PUT', body: 'x', headers: { 'Content-Type': 'text/plain' } })
    assert.equal(response.status, 201)
    assert.equal(server.handshakeCount(), 2)
  })
})

/** WebSocket falso que hace de servidor con el mismo protocolo que el backend. */
function createFakeWebSocketClass(keysFor: (sessionId: string) => SessionKeys | undefined) {
  const instances: FakeSocket[] = []
  class FakeSocket {
    binaryType = 'blob'
    onopen: (() => void) | null = null
    onmessage: ((event: { data: ArrayBuffer }) => void) | null = null
    onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null = null
    onerror: (() => void) | null = null
    sent: Uint8Array[] = []
    sessionId: string
    channel: string
    outgoing = 0
    constructor(url: string) {
      const params = new URL(url, 'http://x').searchParams
      this.sessionId = params.get('sid') ?? ''
      this.channel = `${this.sessionId}#${params.get('cid')}`
      instances.push(this)
      queueMicrotask(() => {
        if (!keysFor(this.sessionId)) this.onclose?.({ code: SECURE_SESSION_EXPIRED_CLOSE_CODE, reason: 'SECURE_SESSION_EXPIRED', wasClean: true })
        else this.onopen?.()
      })
    }
    send(frame: Uint8Array) { this.sent.push(frame) }
    close(code: number, reason: string) { this.onclose?.({ code, reason, wasClean: true }) }
    /** El servidor descifra lo recibido (secuencia + texto). */
    received(index: number): string {
      const plain = openFrame(keysFor(this.sessionId)!, this.channel, DIRECTIONS.CLIENT_TO_SERVER, this.sent[index])
      return utf8Decode(plain.subarray(8))
    }
    /** El servidor envía un mensaje cifrado al navegador. */
    push(text: string, sequence = this.outgoing++) {
      const seq = new Uint8Array(8)
      new DataView(seq.buffer).setBigUint64(0, BigInt(sequence))
      const frame = sealFrame(keysFor(this.sessionId)!, this.channel, DIRECTIONS.SERVER_TO_CLIENT, concatBytes(seq, utf8Encode(text)))
      this.onmessage?.({ data: frame.slice().buffer })
    }
  }
  return { FakeSocket: FakeSocket as unknown as typeof WebSocket, instances }
}

describe('WebSocket cifrado (edición en tiempo real)', () => {
  it('envía y recibe texto en claro mientras por la red solo viajan tramas cifradas', async () => {
    const server = fakeServer()
    const { FakeSocket, instances } = createFakeWebSocketClass((id) => server.sessions.get(id))
    const client = createSecureClient({ baseUrl: '/api', dhPrimeHex: PRIME_HEX, dhGenerator: '2', fetchImpl: server.fetchImpl, WebSocketImpl: FakeSocket })

    const socket = client.openWebSocket('ws://localhost/api/collab')
    const received: string[] = []
    socket.onmessage = (event) => received.push(event.data)
    await new Promise<void>((resolve) => { socket.onopen = resolve })

    const update = JSON.stringify({ type: 'update', update: 'x'.repeat(500_000) })
    socket.send(JSON.stringify({ type: 'join', token: 'token-secreto' }))
    socket.send(update)
    const fake = instances[0]
    assert.ok(!Buffer.from(fake.sent[0]).includes(Buffer.from('token-secreto')))
    assert.equal(fake.received(1), update)

    fake.push('{"type":"saved"}')
    fake.push('{"type":"saved"}', 0) // repetida: el navegador cierra la conexión
    assert.deepEqual(received, ['{"type":"saved"}'])
    assert.equal(socket.readyState, 3)
  })

  it('si el servidor ya no reconoce la sesión, avisa con el código 4440 y la siguiente conexión acuerda otra llave', async () => {
    const server = fakeServer()
    const { FakeSocket } = createFakeWebSocketClass((id) => server.sessions.get(id))
    const client = createSecureClient({ baseUrl: '/api', dhPrimeHex: PRIME_HEX, dhGenerator: '2', fetchImpl: server.fetchImpl, WebSocketImpl: FakeSocket })
    await client.getSession()
    server.sessions.clear()

    const first = client.openWebSocket('ws://localhost/api/collab')
    const code = await new Promise<number>((resolve) => { first.onclose = (event) => resolve(event.code) })
    assert.equal(code, SECURE_SESSION_EXPIRED_CLOSE_CODE)

    const second = client.openWebSocket('ws://localhost/api/collab')
    await new Promise<void>((resolve) => { second.onopen = resolve })
    assert.equal(server.handshakeCount(), 2)
  })
})
