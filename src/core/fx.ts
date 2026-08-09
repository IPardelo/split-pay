import { currencyName, factorFor } from './money'
import type { Cents } from './types'

/**
 * Códigos ISO 4217 activos. Non gardamos os nomes: pídellos a `Intl`, que xa
 * os ten traducidos en galego, castelán, inglés e no que faga falta.
 */
export const CURRENCY_CODES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
  'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR',
  'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF',
  'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD',
  'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR',
  'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD',
  'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON',
  'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP',
  'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS',
  'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD',
  'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF',
  'YER', 'ZAR', 'ZMW', 'ZWG',
]

/** As que aparecen arriba no selector, por ser as máis usadas aquí. */
export const COMMON_CURRENCIES = [
  'EUR', 'USD', 'GBP', 'CHF', 'JPY', 'MXN', 'ARS', 'COP', 'BRL', 'CAD',
  'MAD', 'TRY', 'THB', 'SEK', 'NOK', 'PLN',
]

export interface CurrencyOption {
  code: string
  name: string
}

/** Lista para o selector: primeiro as comúns, logo o resto por orde alfabética. */
export function currencyOptions(): CurrencyOption[] {
  const common = COMMON_CURRENCIES.map((code) => ({ code, name: currencyName(code) }))
  const rest = CURRENCY_CODES.filter((c) => !COMMON_CURRENCIES.includes(c))
    .map((code) => ({ code, name: currencyName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return [...common, ...rest]
}

/**
 * Tipos orientativos por defecto (unidades de EUR por 1 unidade da moeda).
 * Son un punto de partida editable, e a app pode actualizalos desde unha API
 * pública. O tipo queda CONXELADO en cada gasto para que os saldos non cambien
 * sós.
 */
export const DEFAULT_RATES_EUR: Record<string, number> = {
  EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.05, JPY: 0.0061, MXN: 0.05,
  ARS: 0.001, COP: 0.00023, BRL: 0.17, CAD: 0.68, MAD: 0.092, TRY: 0.027,
  THB: 0.026, SEK: 0.088, NOK: 0.086, PLN: 0.23, DKK: 0.134, CZK: 0.04,
  HUF: 0.0026, RON: 0.2, BGN: 0.511, AUD: 0.6, NZD: 0.56, CNY: 0.13,
  INR: 0.011, KRW: 0.00069, SGD: 0.69, HKD: 0.118, ZAR: 0.05, ILS: 0.25,
  PHP: 0.016, IDR: 0.000058, MYR: 0.2, ISK: 0.0067,
}

/** Táboa inicial de tipos para un grupo coa moeda base dada. */
export function defaultRatesFor(base: string): Record<string, number> {
  const baseInEur = DEFAULT_RATES_EUR[base] ?? 1
  const out: Record<string, number> = {}
  for (const [code, eur] of Object.entries(DEFAULT_RATES_EUR)) {
    out[code] = code === base ? 1 : Number((eur / baseInEur).toPrecision(8))
  }
  return out
}

export function rateFor(rates: Record<string, number>, currency: string, base: string): number {
  if (currency === base) return 1
  return rates[currency] ?? 1
}

/** Converte a unidade mínima de `currency` á de `base` co tipo dado. */
export function convert(amount: Cents, currency: string, base: string, rate: number): Cents {
  if (currency === base) return Math.round(amount)
  const units = amount / factorFor(currency)
  return Math.round(units * rate * factorFor(base))
}
