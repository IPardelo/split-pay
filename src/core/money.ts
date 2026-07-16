import type { Cents } from './types'

/**
 * Decimais de cada moeda segundo a ISO 4217. Só listamos as que non teñen 2,
 * que é o valor por defecto.
 */
export const CURRENCY_DECIMALS: Record<string, number> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0,
  RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
}

/**
 * Locale activo para formatear cantidades. Non importamos i18n desde o core
 * (queremos que estes módulos sexan puros e testeables sen React): é i18n quen
 * chama a `setMoneyLocale` cando cambia o idioma.
 */
let activeLocale = 'gl-ES'

export function setMoneyLocale(l: string) {
  activeLocale = l
}

export function moneyLocale(): string {
  return activeLocale
}

export function decimalsFor(currency: string): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2
}

export function factorFor(currency: string): number {
  return 10 ** decimalsFor(currency)
}

/** Unidade mínima → número decimal (só para amosar ou exportar). */
export function toUnits(cents: Cents, currency = 'EUR'): number {
  return cents / factorFor(currency)
}

/** Número decimal → unidade mínima enteira. */
export function fromUnits(units: number, currency = 'EUR'): Cents {
  return Math.round(units * factorFor(currency))
}

export function formatCents(cents: Cents, currency = 'EUR', locale = activeLocale): string {
  const d = decimalsFor(currency)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(cents / factorFor(currency))
  } catch {
    return `${(cents / factorFor(currency)).toFixed(d)} ${currency}`
  }
}

/** Sen símbolo de moeda: para inputs e táboas. */
export function formatPlain(cents: Cents, currency = 'EUR', locale = activeLocale): string {
  const d = decimalsFor(currency)
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(cents / factorFor(currency))
}

/** Nome da moeda no idioma activo, vía Intl. Se non se pode, o propio código. */
export function currencyName(code: string, locale = activeLocale): string {
  try {
    const dn = new Intl.DisplayNames([locale], { type: 'currency' })
    return dn.of(code) ?? code
  } catch {
    return code
  }
}

/**
 * Avalía o que o usuario escribe no campo de importe.
 * Acepta coma ou punto decimal e aritmética simple: "12,50 + 3*2 - 1".
 * Devolve null se a expresión non é válida. Non usa eval().
 */
export function parseAmountExpression(input: string, currency = 'EUR'): Cents | null {
  const raw = input.trim()
  if (!raw) return null
  const normalized = raw.replace(/\s+/g, '').replace(/,/g, '.')
  if (!/^[0-9.+\-*/()]+$/.test(normalized)) return null
  let value: number
  try {
    value = evaluate(normalized)
  } catch {
    return null
  }
  if (!Number.isFinite(value)) return null
  return Math.round(value * factorFor(currency))
}

/* ---- Mini avaliador de expresións aritméticas (descenso recursivo) ---- */

function evaluate(src: string): number {
  let pos = 0

  function peek(): string | undefined {
    return src[pos]
  }
  function expr(): number {
    let v = term()
    for (;;) {
      const c = peek()
      if (c === '+') { pos++; v += term() }
      else if (c === '-') { pos++; v -= term() }
      else return v
    }
  }
  function term(): number {
    let v = unary()
    for (;;) {
      const c = peek()
      if (c === '*') { pos++; v *= unary() }
      else if (c === '/') { pos++; const d = unary(); if (d === 0) throw new Error('div0'); v /= d }
      else return v
    }
  }
  function unary(): number {
    if (peek() === '-') { pos++; return -unary() }
    if (peek() === '+') { pos++; return unary() }
    return atom()
  }
  function atom(): number {
    if (peek() === '(') {
      pos++
      const v = expr()
      if (peek() !== ')') throw new Error('unbalanced parenthesis')
      pos++
      return v
    }
    const start = pos
    while (pos < src.length && /[0-9.]/.test(src[pos])) pos++
    if (pos === start) throw new Error('number expected')
    const n = Number(src.slice(start, pos))
    if (Number.isNaN(n)) throw new Error('invalid number')
    return n
  }

  const result = expr()
  if (pos !== src.length) throw new Error('trailing input')
  return result
}
