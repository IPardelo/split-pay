import { convert, rateFor } from './fx'
import { nowIso, uid } from './ids'
import { nextOccurrence } from './recurrence'
import { allocate, resolveSplit } from './split'
import type {
  Allocation,
  Attachment,
  Cents,
  Entry,
  EntryType,
  Group,
  RecurrenceRule,
  SplitSpec,
  UUID,
} from './types'

export interface EntryDraft {
  id?: UUID
  type: EntryType
  title: string
  category: string
  date: string
  currency: string
  /** Magnitude positiva, na unidade mínima de `currency`. */
  amountOriginal: Cents
  /** Quen puxo o diñeiro, na unidade mínima de `currency`. Debe sumar amountOriginal. */
  payers: Allocation[]
  split: SplitSpec
  note: string
  documents?: Attachment[]
  recurrence?: RecurrenceRule
}

/**
 * Converte un borrador nun movemento pechado e consistente.
 *
 * Conxela: o tipo de cambio, o importe en moeda base, o reparto por pagador e o
 * reparto por beneficiario. A partir de aquí, os números do movemento non
 * cambian aínda que cambien os tipos ou o algoritmo.
 */
export function buildEntry(group: Group, draft: EntryDraft, previous?: Entry): Entry {
  const base = group.baseCurrency
  const rate =
    previous && previous.currency === draft.currency && previous.amountOriginal === draft.amountOriginal
      ? previous.fxRate
      : rateFor(group.rates, draft.currency, base)

  const magnitudeBase = convert(draft.amountOriginal, draft.currency, base, rate)
  const sign = draft.type === 'INCOME' ? -1 : 1
  const signedBase = magnitudeBase * sign

  // Os pagadores repártense o importe base co mesmo criterio de redondeo, para
  // que sum(payers) === amountBase exactamente.
  const payerWeights = draft.payers.map((p) => p.amount)
  const payerAmounts = allocate(signedBase, payerWeights.length ? payerWeights : [1])
  const payers: Allocation[] = draft.payers.map((p, i) => ({
    participantId: p.participantId,
    amount: payerAmounts[i],
  }))

  const shares = resolveSplit(signedBase, draft.split)
  const recurrence = draft.recurrence ?? previous?.recurrence ?? 'NONE'

  const now = nowIso()
  return {
    id: draft.id ?? previous?.id ?? uid(),
    type: draft.type,
    title: draft.title.trim() || defaultTitle(draft.type),
    category: draft.category,
    date: draft.date,
    currency: draft.currency,
    amountOriginal: draft.amountOriginal,
    fxRate: rate,
    amountBase: signedBase,
    payers,
    split: draft.split,
    shares,
    note: draft.note,
    documents: draft.documents ?? previous?.documents ?? [],
    recurrence,
    recurrenceNextAt:
      recurrence === 'NONE'
        ? null
        : // Se xa era o último da cadea mantemos a súa data; se non, calculámola.
          previous?.recurrenceNextAt && previous.recurrence === recurrence && previous.date === draft.date
          ? previous.recurrenceNextAt
          : nextOccurrence(draft.date, recurrence),
    recurrenceParentId: previous?.recurrenceParentId ?? null,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
  }
}

function defaultTitle(type: EntryType): string {
  return type === 'TRANSFER' ? '↔' : type === 'INCOME' ? '+' : '—'
}

/** Movemento de tipo transferencia: un reembolso de A a B. */
export function buildTransfer(
  group: Group,
  from: UUID,
  to: UUID,
  amountBase: Cents,
  date: string,
  title: string,
): Entry {
  return buildEntry(group, {
    type: 'TRANSFER',
    title,
    category: 'general',
    date,
    currency: group.baseCurrency,
    amountOriginal: amountBase,
    payers: [{ participantId: from, amount: amountBase }],
    split: { mode: 'EXACT', entries: [{ participantId: to, value: amountBase }] },
    note: '',
  })
}

export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )
}
