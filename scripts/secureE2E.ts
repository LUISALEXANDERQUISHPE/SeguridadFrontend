/**
 * Prueba de punta a punta del cifrado contra el backend real, con el mismo cliente que usa el navegador:
 *   1. Diffie-Hellman + túnel ChaCha20: texto -> servidor -> Huffman + AES -> lectura -> de vuelta (hasta 5 MB)
 *   2. la API rechaza peticiones sin cifrar
 *   3. el WebSocket solo acepta tramas cifradas (el servidor descifra el mensaje y responde)
 *
 * Requiere el backend corriendo con SECURE_DIAGNOSTICS_ENABLED=true.
 * Uso:  node scripts/secureE2E.ts [http://localhost:5000/api]
 */
import { readFileSync } from 'node:fs'
import { createSecureClient } from '../src/security/secureClient.ts'
import { sha256 } from '../src/security/sha256.ts'
import { toHex, utf8Encode } from '../src/security/bytes.ts'
import type { SecureRoundtripReport } from '../src/security/index.ts'

function readEnv(name: string): string {
  const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${name}=`))
  return line ? line.slice(name.length + 1).trim() : ''
}

const baseUrl = process.argv[2] || 'http://localhost:5000/api'
const client = createSecureClient({
  baseUrl,
  dhPrimeHex: readEnv('VITE_DH_PRIME_HEX'),
  dhGenerator: readEnv('VITE_DH_GENERATOR') || '2',
})

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? '✔' : '✖'} ${label}${detail ? `  ${detail}` : ''}`)
}

const session = await client.getSession()
console.log(`Diffie-Hellman OK: sesión ${session.sessionId}\n`)

// 1. Flujo completo por el túnel cifrado
const line = '\\subsection{Prueba} Texto con acentos áéíóú, ñ, símbolos $\\int_0^1 x\\,dx$ y emoji 🚀🔐.\n'
const cases: Array<[string, string]> = [
  ['vacío', ''],
  ['corto', 'Hola mundo'],
  ['unicode', 'Ñandú 😀 — “comillas” — 中文 — العربية'],
  ['1 MB', line.repeat(Math.ceil(1_000_000 / utf8Encode(line).length))],
  ['5 MB', line.repeat(Math.ceil(5_000_000 / utf8Encode(line).length))],
]

for (const [name, content] of cases) {
  const started = Date.now()
  const response = await client.fetch('/secure/diagnostics/roundtrip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  const { content: echoed, report } = (await response.json()) as { content: string; report: SecureRoundtripReport }
  const ok = response.status === 200 &&
    report.receivedSha256 === toHex(sha256(utf8Encode(content))) &&
    report.storageRoundtripOk &&
    echoed === content
  check(
    `túnel ${name.padEnd(8)}`,
    ok,
    `${String(report.receivedBytes).padStart(9)} B -> Huffman ${String(report.huffmanBytes).padStart(9)} B -> guardado ${String(report.storedBytes).padStart(9)} B  (${Date.now() - started} ms)`,
  )
}

// 2. Sin cifrar, la API no responde datos
const plain = await fetch(`${baseUrl}/projects`)
const plainBody = (await plain.json().catch(() => ({}))) as { error?: { code?: string } }
check('petición sin cifrar rechazada', plain.status === 403 && plainBody.error?.code === 'SECURE_CHANNEL_REQUIRED', `(${plain.status})`)

const health = await client.fetch('/health')
check('petición normal por el túnel (/health)', health.status === 200 && (await health.json()).status === 'UP')

// 3. WebSocket cifrado: el servidor descifra el "subscribe" y rechaza el token falso con 4401.
//    Si no pudiera descifrarlo respondería 4400 (mensaje inválido).
const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/collab`
const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
  const socket = client.openWebSocket(wsUrl)
  socket.onopen = () => socket.send(JSON.stringify({ type: 'subscribe', token: 'token-de-prueba' }))
  socket.onclose = (event) => resolve(event)
})
check('WebSocket cifrado (el servidor descifró el mensaje)', closeEvent.code === 4401, `(cierre ${closeEvent.code}: ${closeEvent.reason})`)

const rawSocketCode = await new Promise<number>((resolve) => {
  const socket = new WebSocket(`${wsUrl}?sid=${session.sessionId}&cid=${'0'.repeat(32)}`)
  socket.onopen = () => socket.send(JSON.stringify({ type: 'subscribe', token: 'x' }))
  socket.onclose = (event) => resolve(event.code)
})
check('WebSocket sin cifrar rechazado', rawSocketCode === 4400, `(cierre ${rawSocketCode})`)

console.log(failures ? `\n${failures} comprobación(es) fallaron` : '\nTodas las comprobaciones pasaron')
process.exit(failures ? 1 : 0)
