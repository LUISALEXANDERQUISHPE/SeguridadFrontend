/**
 * Prueba de punta a punta del cifrado contra el backend real:
 *   navegador (este cliente TS) --ChaCha20--> servidor --Huffman+AES--> guardado --> lectura --ChaCha20--> navegador
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

const line = '\\subsection{Prueba} Texto con acentos áéíóú, ñ, símbolos $\\int_0^1 x\\,dx$ y emoji 🚀🔐.\n'
const cases: Array<[string, string]> = [
  ['vacío', ''],
  ['corto', 'Hola mundo'],
  ['unicode', 'Ñandú 😀 — “comillas” — 中文 — العربية'],
  ['1 MB', line.repeat(Math.ceil(1_000_000 / utf8Encode(line).length))],
  ['5 MB', line.repeat(Math.ceil(5_000_000 / utf8Encode(line).length))],
]

let failures = 0
const session = await client.getSession()
console.log(`Diffie-Hellman OK: sesión ${session.sessionId}\n`)

for (const [name, content] of cases) {
  const started = Date.now()
  const { content: echoed, report } = await client.request<{ content: string; report: SecureRoundtripReport }>(
    '/secure/diagnostics/roundtrip',
    { method: 'POST', body: { content } },
  )
  const expectedHash = toHex(sha256(utf8Encode(content)))
  const checks = {
    'servidor recibió el mismo texto (SHA-256)': report.receivedSha256 === expectedHash,
    'Huffman + AES guardar/leer sin pérdida': report.storageRoundtripOk,
    'respuesta descifrada idéntica': echoed === content,
  }
  const ok = Object.values(checks).every(Boolean)
  if (!ok) failures++
  console.log(
    `${ok ? '✔' : '✖'} ${name.padEnd(8)} ${String(report.receivedBytes).padStart(9)} B -> Huffman ${String(report.huffmanBytes).padStart(9)} B -> guardado ${String(report.storedBytes).padStart(9)} B  (${Date.now() - started} ms)`,
  )
  for (const [label, passed] of Object.entries(checks)) if (!passed) console.log(`    ✖ ${label}`)
}

console.log(failures ? `\n${failures} caso(s) fallaron` : '\nTodas las comprobaciones pasaron')
process.exit(failures ? 1 : 0)
