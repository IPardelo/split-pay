import { inRange, type DateRange } from './statsRange'
import type { Cents, Entry, Group, Participant, UUID } from './types'

export interface Balance {
  participantId: UUID
  /** O que puxo do seu peto. */
  paid: Cents
  /** O que lle corresponde asumir. */
  owed: Cents
  /** paid − owed. Positivo = débenlle. */
  balance: Cents
}

export function activeEntries(group: Group): Entry[] {
  return group.entries.filter((e) => !e.deletedAt)
}

/** Movementos vivos dentro dun rango de datas. */
export function entriesInRange(group: Group, range?: DateRange): Entry[] {
  const live = activeEntries(group)
  return range ? live.filter((e) => inRange(e.date, range)) : live
}

/**
 * Saldos do grupo.
 * Invariante: a suma de todos os `balance` é exactamente 0.
 */
export function computeBalances(group: Group): Balance[] {
  const paid = new Map<UUID, Cents>()
  const owed = new Map<UUID, Cents>()
  const touch = (m: Map<UUID, Cents>, id: UUID, v: Cents) => m.set(id, (m.get(id) ?? 0) + v)

  for (const p of group.participants) {
    paid.set(p.id, 0)
    owed.set(p.id, 0)
  }

  for (const e of activeEntries(group)) {
    // INCOME é un gasto co signo invertido: o importe base xa vén negativo.
    for (const a of e.payers) touch(paid, a.participantId, a.amount)
    for (const s of e.shares) touch(owed, s.participantId, s.amount)
  }

  const ids = new Set<UUID>([...paid.keys(), ...owed.keys()])
  return [...ids].map((participantId) => {
    const p = paid.get(participantId) ?? 0
    const o = owed.get(participantId) ?? 0
    return { participantId, paid: p, owed: o, balance: p - o }
  })
}

export function balanceMap(group: Group): Record<UUID, Cents> {
  const out: Record<UUID, Cents> = {}
  for (const b of computeBalances(group)) out[b.participantId] = b.balance
  return out
}

/** Gasto total do grupo (sen contar transferencias internas nin ingresos). */
export function totalSpent(group: Group, range?: DateRange): Cents {
  return entriesInRange(group, range)
    .filter((e) => e.type === 'EXPENSE')
    .reduce((a, e) => a + e.amountBase, 0)
}

/** O que lle corresponde a un participante (o seu consumo) no rango. */
export function shareOf(group: Group, participantId: UUID, range?: DateRange): Cents {
  return entriesInRange(group, range)
    .filter((e) => e.type === 'EXPENSE')
    .reduce((a, e) => a + (e.shares.find((s) => s.participantId === participantId)?.amount ?? 0), 0)
}

/** O que adiantou de verdade un participante no rango. */
export function paidBy(group: Group, participantId: UUID, range?: DateRange): Cents {
  return entriesInRange(group, range)
    .filter((e) => e.type === 'EXPENSE')
    .reduce((a, e) => a + (e.payers.find((p) => p.participantId === participantId)?.amount ?? 0), 0)
}

export function spentByCategory(group: Group, range?: DateRange): { category: string; amount: Cents }[] {
  const m = new Map<string, Cents>()
  for (const e of entriesInRange(group, range)) {
    if (e.type !== 'EXPENSE') continue
    m.set(e.category, (m.get(e.category) ?? 0) + e.amountBase)
  }
  return [...m.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export function spentByMonth(group: Group, range?: DateRange): { month: string; amount: Cents }[] {
  const m = new Map<string, Cents>()
  for (const e of entriesInRange(group, range)) {
    if (e.type !== 'EXPENSE') continue
    const month = e.date.slice(0, 7)
    m.set(month, (m.get(month) ?? 0) + e.amountBase)
  }
  return [...m.entries()]
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

/** Canto lle corresponde a cada participante en total (o seu consumo). */
export function shareByParticipant(
  group: Group,
  range?: DateRange,
): { participantId: UUID; amount: Cents }[] {
  const m = new Map<UUID, Cents>()
  for (const p of group.participants) m.set(p.id, 0)
  for (const e of entriesInRange(group, range)) {
    if (e.type !== 'EXPENSE') continue
    for (const s of e.shares) m.set(s.participantId, (m.get(s.participantId) ?? 0) + s.amount)
  }
  return [...m.entries()].map(([participantId, amount]) => ({ participantId, amount }))
}

/** Gasto que vén de movementos recorrentes, para saber canto é «fixo». */
export function recurringSpend(group: Group, range?: DateRange): Cents {
  return entriesInRange(group, range)
    .filter((e) => e.type === 'EXPENSE' && (e.recurrence !== 'NONE' || e.recurrenceParentId))
    .reduce((a, e) => a + e.amountBase, 0)
}

export function participantById(group: Group, id: UUID): Participant | undefined {
  return group.participants.find((p) => p.id === id)
}

export function participantName(group: Group, id: UUID): string {
  return participantById(group, id)?.name ?? '—'
}

/** ¿Pódese borrar de verdade? Só se non aparece en ningún movemento vivo. */
export function participantIsUsed(group: Group, id: UUID): boolean {
  return activeEntries(group).some(
    (e) => e.payers.some((a) => a.participantId === id) || e.shares.some((s) => s.participantId === id),
  )
}

/** Primeira e última data con movementos, para acoutar os gráficos. */
export function dateSpan(group: Group): { from: string; to: string } | null {
  const dates = activeEntries(group).map((e) => e.date).sort()
  if (dates.length === 0) return null
  return { from: dates[0], to: dates[dates.length - 1] }
}
