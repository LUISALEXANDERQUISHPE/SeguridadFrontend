const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
]

const relativeFormatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

/** Fecha relativa al estilo "hace 5 meses". */
export function formatRelativeDate(isoDate: string | null, now: number = Date.now()): string {
  if (!isoDate) return '—'

  const elapsedSeconds = Math.round((new Date(isoDate).getTime() - now) / 1000)
  const match = RELATIVE_UNITS.find(([, seconds]) => Math.abs(elapsedSeconds) >= seconds)

  if (!match) return 'hace un momento'

  const [unit, seconds] = match
  return relativeFormatter.format(Math.round(elapsedSeconds / seconds), unit)
}

/** Fecha y hora completas en formato local (para tooltips). */
export function formatFullDate(isoDate: string | null): string {
  return isoDate ? new Date(isoDate).toLocaleString('es') : ''
}
