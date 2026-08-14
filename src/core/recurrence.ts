import { nowIso, uid } from './ids'
import type { Entry, Group, RecurrenceRule } from './types'

/**
 * Gastos recorrentes.
 *
 * Modelo: o último movemento da cadea leva `recurrenceNextAt`, a data na que
 * toca xerar o seguinte. Cando se xera, o novo pasa a ser o último da cadea e o
 * vello queda con `recurrenceNextAt: null`. Así non hai «plantillas» invisibles:
 * o que ves no historial é exactamente o que conta.
 */

/** Suma días a unha data ISO (YYYY-MM-DD) sen tocar fusos horarios. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/**
 * Suma meses respectando o fin de mes: 31 de xaneiro + 1 mes = 28 (ou 29) de
 * febreiro, e non o 3 de marzo.
 */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

export function nextOccurrence(date: string, rule: RecurrenceRule): string | null {
  switch (rule) {
    case 'DAILY':
      return addDays(date, 1)
    case 'WEEKLY':
      return addDays(date, 7)
    case 'MONTHLY':
      return addMonths(date, 1)
    case 'NONE':
      return null
  }
}

/** Cantas repeticións tocan entre `from` (exclusive) e `today` (inclusive). */
export function pendingOccurrences(
  from: string,
  rule: RecurrenceRule,
  today: string,
  max = 400,
): string[] {
  if (rule === 'NONE') return []
  const out: string[] = []
  let cursor = from
  while (out.length < max) {
    const next = nextOccurrence(cursor, rule)
    if (!next || next > today) break
    out.push(next)
    cursor = next
  }
  return out
}

export interface MaterializeResult {
  entries: Entry[]
  created: Entry[]
}

/**
 * Xera as repeticións que xa venceron. Función PURA: devolve a nova lista de
 * movementos e os que se crearon, sen tocar nada.
 *
 * `max` limita cantas se xeran dunha vez, para que un grupo abandonado durante
 * dous anos non cree centos de movementos ao abrilo.
 */
export function materializeRecurrences(
  entries: Entry[],
  today: string,
  max = 60,
): MaterializeResult {
  const created: Entry[] = []
  const out = entries.map((e) => e)

  for (let i = 0; i < out.length; i++) {
    const head = out[i]
    if (head.deletedAt) continue
    if (head.recurrence === 'NONE' || !head.recurrenceNextAt) continue

    let current = head
    // `max` é un orzamento GLOBAL da pasada, non por cadea: se non, a última
    // repetición xerada volvería entrar polo bucle de fóra e seguiría creando.
    while (current.recurrenceNextAt && current.recurrenceNextAt <= today && created.length < max) {
      const date = current.recurrenceNextAt
      const now = nowIso()
      const child: Entry = {
        ...current,
        id: uid(),
        date,
        documents: [], // as fotos non se copian: son do ticket orixinal
        recurrenceNextAt: nextOccurrence(date, current.recurrence),
        recurrenceParentId: current.id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      // O anterior deixa de ser o último da cadea.
      const closed: Entry = { ...current, recurrenceNextAt: null, updatedAt: now }
      const idx = out.findIndex((e) => e.id === current.id)
      if (idx >= 0) out[idx] = closed
      out.push(child)
      created.push(child)
      current = child
    }
  }

  return { entries: out, created }
}

/** ¿Este grupo ten algo pendente de xerar hoxe? Barato, para non recalcular. */
export function hasPendingRecurrences(group: Group, today: string): boolean {
  return group.entries.some(
    (e) => !e.deletedAt && e.recurrence !== 'NONE' && !!e.recurrenceNextAt && e.recurrenceNextAt <= today,
  )
}

/** Gasto recorrente vivo: o que segue xerando repeticións. */
export function activeRecurring(group: Group): Entry[] {
  return group.entries.filter((e) => !e.deletedAt && e.recurrence !== 'NONE' && !!e.recurrenceNextAt)
}
