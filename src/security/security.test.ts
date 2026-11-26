import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getDiffieHellman } from 'node:crypto'
import { sha256 } from './sha256.ts'
import { hkdf, hmacSha256 } from './hmac.ts'
import { chacha20 } from './chacha20.ts'
import { createGroup, computeSharedSecret, generateKeyPair } from './diffieHellman.ts'
import { fromBase64, fromHex, toBase64, toHex, utf8Encode } from './bytes.ts'
import { randomBytes } from './random.ts'
import { DIRECTIONS, deriveSessionKeys, openFrame, openJson, sealFrame, sealJson, type SessionKeys } from './transportCipher.ts'
import { createSecureClient } from './secureClient.ts'

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

describe('Canal cifrado (ChaCha20 + HMAC)', () => {
  function pairOfKeys(): SessionKeys {
    const group = createGroup(PRIME_HEX, '2')
    const client = generateKeyPair(group)
    const server = generateKeyPair(group)
    const clientSecret = computeSharedSecret(group, client.privateKey, server.publicKey)
    assert.deepEqual(clientSecret, computeSharedSecret(group, server.privateKey, client.publicKey))
    return deriveSessionKeys(clientSecret, client.publicKey, server.publicKey)
  }

  it('un mensaje largo (~3 MB) con Unicode llega idéntico', () => {
    const keys = pairOfKeys()
    const content = 'Línea con ñ, ü y 😀 \\section{x}\n'.repeat(100_000)
    const envelope = sealJson(keys, 's1', DIRECTIONS.CLIENT_TO_SERVER, { content })
    assert.ok(!envelope.data.includes('section'))
    assert.equal(openJson<{ content: string }>(keys, 's1', DIRECTIONS.CLIENT_TO_SERVER, envelope).content, content)
  })

  it('rechaza mensajes alterados, de otra sesión o de la otra dirección', () => {
    const keys = pairOfKeys()
    const envelope = sealJson(keys, 's1', DIRECTIONS.CLIENT_TO_SERVER, { a: 1 })
    const tampered = fromBase64(envelope.data)
    tampered[0] ^= 1
    assert.throws(() => openJson(keys, 's1', DIRECTIONS.CLIENT_TO_SERVER, { ...envelope, data: toBase64(tampered) }))
    assert.throws(() => openJson(keys, 's2', DIRECTIONS.CLIENT_TO_SERVER, { ...envelope, sid: 's2' }))
    assert.throws(() => openJson(keys, 's1', DIRECTIONS.SERVER_TO_CLIENT, envelope))
  })

  it('tramas binarias de tiempo real', () => {
    const keys = pairOfKeys()
    const update = randomBytes(150_000)
    const frame = sealFrame(keys, 's1', DIRECTIONS.SERVER_TO_CLIENT, update)
    assert.deepEqual(openFrame(keys, 's1', DIRECTIONS.SERVER_TO_CLIENT, frame), update)
    assert.throws(() => openFrame(keys, 's1', DIRECTIONS.SERVER_TO_CLIENT, frame.subarray(1)))
  })
})

describe('createSecureClient', () => {
  /** Servidor simulado que hace su parte de Diffie-Hellman y responde con eco cifrado. */
  function fakeServer() {
    const group = createGroup(PRIME_HEX, '2')
    const sessions = new Map<string, SessionKeys>()
    let handshakes = 0

    const fetchImpl = (async (url: string, init: RequestInit) => {
      const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
      if (url.endsWith('/secure/handshake')) {
        handshakes++
        const { clientPublicKey } = JSON.parse(String(init.body))
        const clientPublic = fromBase64(clientPublicKey)
        const server = generateKeyPair(group)
        const sessionId = `sesion-${handshakes}`
        sessions.set(sessionId, deriveSessionKeys(computeSharedSecret(group, server.privateKey, clientPublic), clientPublic, server.publicKey))
        return json(201, { sessionId, serverPublicKey: toBase64(server.publicKey), expiresAt: new Date(Date.now() + 3_600_000).toISOString() })
      }
      const sessionId = (init.headers as Record<string, string>)['X-Secure-Session']
      const keys = sessions.get(sessionId)
      if (!keys) return json(401, { error: { message: 'expirada', code: 'SECURE_SESSION_EXPIRED' } })
      const body = openJson(keys, sessionId, DIRECTIONS.CLIENT_TO_SERVER, JSON.parse(String(init.body)))
      return json(200, sealJson(keys, sessionId, DIRECTIONS.SERVER_TO_CLIENT, { echo: body }))
    }) as typeof fetch

    return { fetchImpl, sessions, handshakeCount: () => handshakes }
  }

  it('acuerda la llave una sola vez y reutiliza la sesión', async () => {
    const server = fakeServer()
    const client = createSecureClient({ baseUrl: '/api', dhPrimeHex: PRIME_HEX, dhGenerator: '2', fetchImpl: server.fetchImpl })
    const content = 'x'.repeat(2_000_000)
    const [a, b] = await Promise.all([
      client.request<{ echo: { content: string } }>('/eco', { body: { content } }),
      client.request<{ echo: { n: number } }>('/eco', { body: { n: 2 } }),
    ])
    assert.equal(a.echo.content, content)
    assert.equal(b.echo.n, 2)
    assert.equal(server.handshakeCount(), 1)
  })

  it('si el servidor olvidó la sesión, acuerda otra y reintenta', async () => {
    const server = fakeServer()
    const client = createSecureClient({ baseUrl: '/api', dhPrimeHex: PRIME_HEX, dhGenerator: '2', fetchImpl: server.fetchImpl })
    await client.request('/eco', { body: { n: 1 } })
    server.sessions.clear()
    const result = await client.request<{ echo: { n: number } }>('/eco', { body: { n: 2 } })
    assert.equal(result.echo.n, 2)
    assert.equal(server.handshakeCount(), 2)
  })
})
