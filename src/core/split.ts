import type { Allocation, Cents, SplitSpec } from './types'

export class SplitError extends Error {}

/**
 * Reparte `total` céntimos entre N pesos, en enteros, con el método de
 * RESTOS MAYORES y desempate determinista (peso mayor, luego índice).
 *
 * Invariante garantizado: sum(resultado) === total, exactamente, siempre.
 */
export function allocate(total: Cents, weights: number[]): Cents[] {
  const n = weights.length
  if (n === 0) {
    if (total !== 0) throw new SplitError('nobody to split between')
    return []
  }
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new SplitError('weights cannot be negative')
  }
  const sumW = weights.reduce((a, b) => a + b, 0)
  if (sumW <= 0) throw new SplitError('the sum of weights must be greater than zero')

  const sign = total < 0 ? -1 : 1
  const abs = Math.abs(Math.round(total))

  const exact = weights.map((w) => (abs * w) / sumW)
  const floors = exact.map((e) => Math.floor(e + 1e-9))
  const assigned = floors.reduce((a, b) => a + b, 0)
  let rest = abs - assigned

  // Puede sobrar (o, por el epsilon, faltar) algún céntimo suelto.
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e + 1e-9), w: weights[i] }))
    .sort((a, b) => b.frac - a.frac || b.w - a.w || a.i - b.i)

  const out = floors.slice()
  let k = 0
  while (rest > 0) {
    out[order[k % n].i] += 1
    rest--
    k++
  }
  while (rest < 0) {
    // Solo puede ocurrir con pesos degenerados; se quita del que más recibió.
    const idx = order[order.length - 1 - (k % n)].i
    if (out[idx] > 0) { out[idx] -= 1; rest++ }
    k++
  }

  return out.map((v) => v * sign)
}

/**
 * Códigos de erro do reparto. A UI tradúceos (i18n: `split.err.*`); o core
 * non sabe en que idioma está a aplicación.
 */
export type SplitErrorCode =
  | 'noParticipants'
  | 'negative'
  | 'zero'
  | 'percent'
  | 'exact'

export interface SplitValidation {
  ok: boolean
  code?: SplitErrorCode
  /** Diferenza que falta por asignar (céntimos en EXACT, puntos en PERCENT). */
  diff?: number
  /** Suma actual, para o texto de erro de PERCENT. */
  sum?: number
}

/** Valida un reparto sen lanzar: pensado para a UI. */
export function validateSplit(total: Cents, spec: SplitSpec): SplitValidation {
  const entries = spec.entries
  if (entries.length === 0) return { ok: false, code: 'noParticipants' }

  switch (spec.mode) {
    case 'EQUAL':
      return { ok: true }
    case 'SHARES': {
      if (entries.some((e) => e.value < 0)) return { ok: false, code: 'negative' }
      const sum = entries.reduce((a, e) => a + e.value, 0)
      if (sum <= 0) return { ok: false, code: 'zero' }
      return { ok: true }
    }
    case 'PERCENT': {
      const sum = entries.reduce((a, e) => a + e.value, 0)
      const diff = Math.round((100 - sum) * 100) / 100
      if (Math.abs(diff) > 0.01) return { ok: false, code: 'percent', diff, sum }
      return { ok: true }
    }
    case 'EXACT': {
      const sum = entries.reduce((a, e) => a + Math.round(e.value), 0)
      const diff = total - sum
      if (diff !== 0) return { ok: false, code: 'exact', diff, sum }
      return { ok: true }
    }
  }
}

/**
 * Resuelve el reparto a importes concretos por participante.
 * El resultado se guarda CONGELADO en el gasto: así un cambio futuro del
 * algoritmo nunca altera un histórico ya cerrado.
 */
export function resolveSplit(total: Cents, spec: SplitSpec): Allocation[] {
  const ids = spec.entries.map((e) => e.participantId)

  if (spec.mode === 'EXACT') {
    const amounts = spec.entries.map((e) => Math.round(e.value))
    const sum = amounts.reduce((a, b) => a + b, 0)
    if (sum !== total) {
      throw new SplitError(`exact amounts add up to ${sum} but the total is ${total}`)
    }
    return ids.map((participantId, i) => ({ participantId, amount: amounts[i] }))
  }

  const weights =
    spec.mode === 'EQUAL' ? spec.entries.map(() => 1) : spec.entries.map((e) => e.value)

  const amounts = allocate(total, weights)
  return ids.map((participantId, i) => ({ participantId, amount: amounts[i] }))
}

/** Reparto por defecto: a partes iguales entre los participantes dados. */
export function equalSpec(participantIds: string[]): SplitSpec {
  return { mode: 'EQUAL', entries: participantIds.map((participantId) => ({ participantId, value: 1 })) }
}
