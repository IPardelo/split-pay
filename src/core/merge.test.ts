import { describe, expect, it } from 'vitest'
import { balanceMap } from './balances'
import { buildEntry } from './entries'
import { defaultRatesFor } from './fx'
import { canonicalJson, mergeGroups, sameSyncedState, serializeForSync } from './merge'
import { equalSpec } from './split'
import type { Group } from './types'

function base(): Group {
  return {
    id: 'local-id',
    shareToken: 'tok',
    sync: 'ONLINE',
    title: 'Viaxe',
    description: '',
    baseCurrency: 'EUR',
    participants: [
      { id: 'p0', name: 'Ana', color: '#0ea5e9', deletedAt: null },
      { id: 'p1', name: 'Brais', color: '#f43f5e', deletedAt: null },
    ],
    entries: [],
    activities: [],
    rates: defaultRatesFor('EUR'),
    ratesUpdatedAt: null,
    favorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
    meParticipantId: 'p0',
  }
}

function expense(g: Group, id: string, amount: number, at: string): Group['entries'][number] {
  const e = buildEntry(g, {
    type: 'EXPENSE',
    title: id,
    category: 'general',
    date: at.slice(0, 10),
    currency: 'EUR',
    amountOriginal: amount,
    payers: [{ participantId: 'p0', amount }],
    split: equalSpec(['p0', 'p1']),
    note: '',
  })
  return { ...e, id, createdAt: at, updatedAt: at }
}

describe('canonicalJson', () => {
  it('non depende da orde das claves', () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }))
  })

  it('respecta a orde dos arrays', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]))
  })

  it('serializa un grupo igual véñalle de onde lle veña', () => {
    const g = base()
    const reordered = JSON.parse(JSON.stringify(g)) as Group
    expect(serializeForSync(g)).toBe(serializeForSync(reordered))
  })
})

describe('mergeGroups', () => {
  it('xunta movementos que só ten cada lado', () => {
    const g = base()
    const local: Group = { ...g, entries: [expense(g, 'a', 1000, '2026-02-01T10:00:00.000Z')] }
    const remote: Group = {
      ...g,
      id: 'other',
      entries: [expense(g, 'b', 2000, '2026-02-01T11:00:00.000Z')],
      updatedAt: '2026-02-01T11:00:00.000Z',
    }
    const merged = mergeGroups(local, remote)
    expect(merged.entries.map((e) => e.id).sort()).toEqual(['a', 'b'])
  })

  it('para o mesmo movemento gaña o updatedAt máis recente', () => {
    const g = base()
    const mine = expense(g, 'x', 1000, '2026-02-01T10:00:00.000Z')
    const theirs = { ...expense(g, 'x', 5000, '2026-02-01T12:00:00.000Z') }
    const merged = mergeGroups({ ...g, entries: [mine] }, { ...g, entries: [theirs] })
    expect(merged.entries[0].amountBase).toBe(5000)
  })

  it('non resucita un movemento borrado no outro lado', () => {
    const g = base()
    const mine = expense(g, 'x', 1000, '2026-02-01T10:00:00.000Z')
    const deletedThere = {
      ...mine,
      deletedAt: '2026-02-02T09:00:00.000Z',
      updatedAt: '2026-02-02T09:00:00.000Z',
    }
    const merged = mergeGroups({ ...g, entries: [mine] }, { ...g, entries: [deletedThere] })
    expect(merged.entries[0].deletedAt).not.toBe(null)
  })

  it('conserva a identidade local', () => {
    const g = base()
    const remote: Group = { ...g, id: 'remote-id', meParticipantId: 'p1', sync: 'LOCAL' }
    const merged = mergeGroups(g, remote)
    expect(merged.id).toBe('local-id')
    expect(merged.meParticipantId).toBe('p0')
    expect(merged.sync).toBe('ONLINE')
  })

  it('os metadatos veñen do lado tocado máis tarde', () => {
    const g = base()
    const remote: Group = { ...g, title: 'Novo nome', updatedAt: '2026-03-01T00:00:00.000Z' }
    expect(mergeGroups(g, remote).title).toBe('Novo nome')
    const older: Group = { ...g, title: 'Vello', updatedAt: '2025-01-01T00:00:00.000Z' }
    expect(mergeGroups(g, older).title).toBe('Viaxe')
  })

  it('xunta participantes novos dos dous lados', () => {
    const g = base()
    const remote: Group = {
      ...g,
      participants: [...g.participants, { id: 'p2', name: 'Uxía', color: '#22c55e', deletedAt: null }],
      updatedAt: '2026-03-01T00:00:00.000Z',
    }
    const merged = mergeGroups(g, remote)
    expect(merged.participants.map((p) => p.id).sort()).toEqual(['p0', 'p1', 'p2'])
  })

  it('é idempotente: fusionar dúas veces non cambia nada', () => {
    const g = base()
    const local: Group = { ...g, entries: [expense(g, 'a', 1000, '2026-02-01T10:00:00.000Z')] }
    const remote: Group = {
      ...g,
      entries: [expense(g, 'b', 2000, '2026-02-01T11:00:00.000Z')],
      updatedAt: '2026-02-01T11:00:00.000Z',
    }
    const once = mergeGroups(local, remote)
    const twice = mergeGroups(once, remote)
    expect(serializeForSync(twice)).toBe(serializeForSync(once))
    // E fusionar co resultado tampouco: isto é o que evita o bucle de escrituras.
    expect(sameSyncedState(mergeGroups(once, once), once)).toBe(true)
  })

  it('é conmutativo no contido', () => {
    const g = base()
    const a: Group = { ...g, entries: [expense(g, 'a', 1000, '2026-02-01T10:00:00.000Z')] }
    const b: Group = {
      ...g,
      entries: [expense(g, 'b', 2000, '2026-02-01T11:00:00.000Z')],
      updatedAt: '2026-02-01T11:00:00.000Z',
    }
    const ab = mergeGroups(a, b)
    const ba = mergeGroups(b, a)
    expect(ab.entries.map((e) => e.id).sort()).toEqual(ba.entries.map((e) => e.id).sort())
  })

  it('os saldos seguen cadrando despois de fusionar', () => {
    const g = base()
    const local: Group = { ...g, entries: [expense(g, 'a', 3333, '2026-02-01T10:00:00.000Z')] }
    const remote: Group = {
      ...g,
      entries: [expense(g, 'b', 7777, '2026-02-01T11:00:00.000Z')],
      updatedAt: '2026-02-01T11:00:00.000Z',
    }
    const merged = mergeGroups(local, remote)
    const balances = balanceMap(merged)
    expect(Object.values(balances).reduce((x, y) => x + y, 0)).toBe(0)
  })
})
