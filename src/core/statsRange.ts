import { addMonths } from './recurrence'

export type RangeId = 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3M' | 'LAST_12M' | 'THIS_YEAR'

export const RANGES: RangeId[] = ['ALL', 'THIS_MONTH', 'LAST_MONTH', 'LAST_3M', 'LAST_12M', 'THIS_YEAR']

export interface DateRange {
  /** ISO YYYY-MM-DD inclusive, ou null para «sen límite». */
  from: string | null
  to: string | null
}

function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`
}

function lastOfMonth(date: string): string {
  const [y, m] = date.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${date.slice(0, 7)}-${String(last).padStart(2, '0')}`
}

/** Traduce un rango a datas concretas, tomando `today` como referencia. */
export function rangeFor(id: RangeId, today: string): DateRange {
  switch (id) {
    case 'ALL':
      return { from: null, to: null }
    case 'THIS_MONTH':
      return { from: firstOfMonth(today), to: lastOfMonth(today) }
    case 'LAST_MONTH': {
      const prev = addMonths(firstOfMonth(today), -1)
      return { from: prev, to: lastOfMonth(prev) }
    }
    case 'LAST_3M':
      return { from: firstOfMonth(addMonths(today, -2)), to: lastOfMonth(today) }
    case 'LAST_12M':
      return { from: firstOfMonth(addMonths(today, -11)), to: lastOfMonth(today) }
    case 'THIS_YEAR':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` }
  }
}

export function inRange(date: string, range: DateRange): boolean {
  if (range.from && date < range.from) return false
  if (range.to && date > range.to) return false
  return true
}

/** Lista de meses «YYYY-MM» que cobre o rango, para o gráfico temporal. */
export function monthsIn(range: DateRange, fallbackFrom: string, fallbackTo: string): string[] {
  const from = (range.from ?? fallbackFrom).slice(0, 7)
  const to = (range.to ?? fallbackTo).slice(0, 7)
  if (from > to) return []
  const out: string[] = []
  let cursor = `${from}-01`
  const limit = `${to}-01`
  while (cursor <= limit && out.length < 240) {
    out.push(cursor.slice(0, 7))
    cursor = addMonths(cursor, 1)
  }
  return out
}
