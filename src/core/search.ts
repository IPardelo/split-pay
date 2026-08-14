import { toUnits } from './money'
import type { Entry, Group } from './types'

/** Minúsculas e sen acentos, para que «cea» atope «Cea» e «Ceá». */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Busca nun movemento: concepto, nota, categoría, moeda, data, nomes dos
 * pagadores e dos beneficiarios, e o importe.
 * Varias palabras = todas teñen que aparecer (AND), coma calquera buscador.
 */
export function matchesQuery(group: Group, entry: Entry, query: string): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const names = new Map(group.participants.map((p) => [p.id, normalize(p.name)]))
  const haystack = [
    normalize(entry.title),
    normalize(entry.note),
    normalize(entry.category),
    normalize(entry.currency),
    entry.date,
    ...entry.payers.map((p) => names.get(p.participantId) ?? ''),
    ...entry.shares.map((s) => names.get(s.participantId) ?? ''),
    toUnits(Math.abs(entry.amountBase), group.baseCurrency).toFixed(2),
    toUnits(Math.abs(entry.amountOriginal), entry.currency).toFixed(2),
  ].join(' ')

  return terms.every((term) => haystack.includes(term))
}

export function filterEntries(group: Group, entries: Entry[], query: string): Entry[] {
  if (!query.trim()) return entries
  return entries.filter((e) => matchesQuery(group, e, query))
}
