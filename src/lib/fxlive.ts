import { FX_API_URL } from '../config/openai'

/**
 * Tipos de cambio en vivo.
 *
 * A API devolve «1 BASE = x MOEDA»; nós gardamos o inverso, «unidades de BASE
 * por 1 unidade da moeda», que é o que multiplica no gasto. Só afecta aos
 * movementos NOVOS: os xa gardados levan o seu tipo conxelado.
 */
export interface FxResult {
  rates: Record<string, number>
  date: string
}

export async function fetchRates(base: string, signal?: AbortSignal): Promise<FxResult> {
  const res = await fetch(`${FX_API_URL}/latest?from=${encodeURIComponent(base)}`, { signal })
  if (!res.ok) throw new Error(`fx: HTTP ${res.status}`)
  const json = (await res.json()) as { base?: string; date?: string; rates?: Record<string, number> }
  if (!json.rates) throw new Error('fx: unexpected response')

  const rates: Record<string, number> = { [base]: 1 }
  for (const [code, perBase] of Object.entries(json.rates)) {
    if (typeof perBase === 'number' && perBase > 0) {
      rates[code] = Number((1 / perBase).toPrecision(8))
    }
  }
  return { rates, date: json.date ?? new Date().toISOString().slice(0, 10) }
}
