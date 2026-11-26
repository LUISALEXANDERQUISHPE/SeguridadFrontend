import type { Connect, Plugin } from 'vite'

/**
 * Cabeceras de seguridad para todo lo que sirve el frontend (página, JS, CSS, imágenes),
 * tanto en desarrollo (npm run dev) como al probar la versión compilada (npm run preview).
 * Al publicar en un hosting, configura en él estas mismas cabeceras (ver buildSecurityHeaders).
 *
 *   Content-Security-Policy   solo se ejecuta/carga lo que viene de este mismo sitio
 *   X-Frame-Options / frame-ancestors   la app no se puede incrustar en otra página (clickjacking)
 *   X-Content-Type-Options    el navegador no "adivina" el tipo de un archivo (MIME sniffing)
 */

export interface SecurityHeadersOptions {
  /** Nonce de los scripts y estilos que Vite inserta en desarrollo (html.cspNonce). */
  nonce?: string
  /** Orígenes externos a los que la app hace peticiones (ej. Supabase para el login). */
  connectSources?: string[]
}

/** Origen (protocolo + host) de cada URL válida; ignora las relativas como "/api". */
export function originsOf(urls: Array<string | undefined>): string[] {
  const origins = new Set<string>()
  for (const url of urls) {
    if (!url) continue
    try {
      const { origin } = new URL(url.trim())
      if (origin !== 'null') origins.add(origin)
    } catch {
      // Ruta relativa: es el mismo origen ('self')
    }
  }
  return [...origins]
}

export function buildContentSecurityPolicy({ nonce, connectSources = [] }: SecurityHeadersOptions): string {
  const self = "'self'"
  const withNonce = nonce ? [self, `'nonce-${nonce}'`] : [self]
  const directives: Record<string, string[]> = {
    'default-src': [self],
    'script-src': withNonce,
    'style-src': withNonce,
    // Vista previa de imágenes y PDFs del proyecto (se descargan cifrados y se muestran como blob:)
    'img-src': [self, 'data:', 'blob:'],
    'frame-src': [self, 'blob:'],
    'font-src': [self, 'data:'],
    // API y WebSocket por el mismo origen (proxy de Vite) + servicios externos configurados
    'connect-src': [self, ...connectSources],
    // pdf.js analiza los PDFs en un Web Worker
    'worker-src': [self, 'blob:'],
    'manifest-src': [self],
    'media-src': [self],
    'object-src': ["'none'"],
    'base-uri': [self],
    'form-action': [self],
    'frame-ancestors': ["'none'"],
  }
  return Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`).join('; ')
}

export function buildSecurityHeaders(options: SecurityHeadersOptions): Record<string, string> {
  return {
    'Content-Security-Policy': buildContentSecurityPolicy(options),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  }
}

/**
 * Agrega las cabeceras a cada respuesta. Las respuestas de la API (que llegan por el proxy)
 * conservan las cabeceras propias del backend (helmet), que las reemplazan si coinciden.
 */
export function securityHeadersPlugin(options: SecurityHeadersOptions): Plugin {
  const headers = buildSecurityHeaders(options)
  const applyHeaders: Connect.NextHandleFunction = (_req, res, next) => {
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
    next()
  }

  return {
    name: 'secureleaf-security-headers',
    configureServer(server) {
      server.middlewares.use(applyHeaders)
    },
    configurePreviewServer(server) {
      server.middlewares.use(applyHeaders)
    },
  }
}
