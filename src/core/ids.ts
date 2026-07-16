export function uid(): string {
  const g = globalThis as { crypto?: Crypto }
  if (g.crypto?.randomUUID) return g.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (g.crypto?.getRandomValues) g.crypto.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Token de compartición: quien tiene el enlace, tiene acceso. Que sea largo. */
export function shareToken(): string {
  return uid().replace(/-/g, '').slice(0, 22)
}

export function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
