import { describe, expect, it } from 'vitest'
import { balanceMap, entriesInRange, recurringSpend, totalSpent } from './balances'
import { buildEntry } from './entries'
import { defaultRatesFor } from './fx'
import { addDays, addMonths, materializeRecurrences, nextOccurrence, pendingOccurrences } from './recurrence'
import { filterEntries, matchesQuery, normalize } from './search'
import { equalSpec } from './split'
import { inRange, monthsIn, rangeFor } from './statsRange'
import type { Group } from './types'

function group(): Group {
  return {
    id: 'g',
    shareToken: 't',
    sync: 'LOCAL',
    title: 'Piso',
    description: '',
    baseCurrency: 'EUR',
    participants: [
      { id: 'p0', name: 'Anxo', color: '#000', deletedAt: null },
      { id: 'p1', name: 'Uxía', color: '#111', deletedAt: null },
    ],
    entries: [],
    activities: [],
    rates: defaultRatesFor('EUR'),
    ratesUpdatedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    archivedAt: null,
    favorite: false,
    meParticipantId: 'p0',
  }
}

function expense(g: Group, opts: Partial<Parameters<typeof buildEntry>[1]> = {}) {
  return buildEntry(g, {
    type: 'EXPENSE',
    title: 'Aluguer',
    category: 'rent',
    date: '2026-01-05',
    currency: 'EUR',
    amountOriginal: 60000,
    payers: [{ participantId: 'p0', amount: 60000 }],
    split: equalSpec(['p0', 'p1']),
    note: '',
    ...opts,
  })
}

/* ------------------------------ datas ------------------------------ */

describe('aritmética de datas', () => {
  it('suma días atravesando meses e anos', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('suma meses respectando o fin de mes', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29') // bisesto
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  })

  it('o 31 non se perde ao volver a un mes longo', () => {
    // Coma en calquera app de calendario: 31 → 28 → e a seguinte parte do 28.
    expect(addMonths(addMonths('2026-01-31', 1), 1)).toBe('2026-03-28')
  })
})

/* --------------------------- recorrencias --------------------------- */

describe('recorrencias', () => {
  it('calcula a seguinte data por regra', () => {
    expect(nextOccurrence('2026-01-05', 'DAILY')).toBe('2026-01-06')
    expect(nextOccurrence('2026-01-05', 'WEEKLY')).toBe('2026-01-12')
    expect(nextOccurrence('2026-01-05', 'MONTHLY')).toBe('2026-02-05')
    expect(nextOccurrence('2026-01-05', 'NONE')).toBe(null)
  })

  it('lista as repeticións vencidas', () => {
    expect(pendingOccurrences('2026-01-05', 'MONTHLY', '2026-04-10')).toEqual([
      '2026-02-05',
      '2026-03-05',
      '2026-04-05',
    ])
  })

  it('xera as repeticións que venceron e move a cabeza da cadea', () => {
    const g = group()
    const head = { ...expense(g), id: 'head', recurrence: 'MONTHLY' as const, recurrenceNextAt: '2026-02-05' }
    const { entries, created } = materializeRecurrences([head], '2026-04-10')

    expect(created).toHaveLength(3)
    expect(created.map((e) => e.date)).toEqual(['2026-02-05', '2026-03-05', '2026-04-05'])

    // Só o último segue xerando.
    const heads = entries.filter((e) => e.recurrenceNextAt !== null)
    expect(heads).toHaveLength(1)
    expect(heads[0].date).toBe('2026-04-05')
    expect(heads[0].recurrenceNextAt).toBe('2026-05-05')
  })

  it('é idempotente: correr dúas veces o mesmo día non duplica nada', () => {
    const g = group()
    const head = { ...expense(g), id: 'head', recurrence: 'WEEKLY' as const, recurrenceNextAt: '2026-01-12' }
    const first = materializeRecurrences([head], '2026-02-02')
    const second = materializeRecurrences(first.entries, '2026-02-02')
    expect(second.created).toHaveLength(0)
    expect(second.entries).toHaveLength(first.entries.length)
  })

  it('non xera nada se aínda non venceu', () => {
    const g = group()
    const head = { ...expense(g), recurrence: 'MONTHLY' as const, recurrenceNextAt: '2026-06-05' }
    expect(materializeRecurrences([head], '2026-05-01').created).toHaveLength(0)
  })

  it('un movemento borrado deixa de xerar', () => {
    const g = group()
    const head = {
      ...expense(g),
      recurrence: 'DAILY' as const,
      recurrenceNextAt: '2026-01-06',
      deletedAt: '2026-01-06T00:00:00Z',
    }
    expect(materializeRecurrences([head], '2026-03-01').created).toHaveLength(0)
  })

  it('as repeticións manteñen o reparto e os saldos cadran', () => {
    const g = group()
    const head = { ...expense(g), id: 'head', recurrence: 'MONTHLY' as const, recurrenceNextAt: '2026-02-05' }
    const { entries } = materializeRecurrences([head], '2026-03-10')
    const g2 = { ...g, entries }
    expect(totalSpent(g2)).toBe(60000 * 3)
    expect(Object.values(balanceMap(g2)).reduce((a, b) => a + b, 0)).toBe(0)
    for (const e of entries) {
      expect(e.shares.reduce((a, s) => a + s.amount, 0)).toBe(e.amountBase)
    }
  })

  it('as fotos non se copian nas repeticións', () => {
    const g = group()
    const head = {
      ...expense(g),
      recurrence: 'MONTHLY' as const,
      recurrenceNextAt: '2026-02-05',
      documents: [
        { id: 'a', url: 'idb:a', name: 'x.jpg', mime: 'image/jpeg', width: 10, height: 10, size: 1, createdAt: '' },
      ],
    }
    const { created } = materializeRecurrences([head], '2026-02-10')
    expect(created[0].documents).toEqual([])
  })

  it('o límite evita xerar centos de golpe', () => {
    const g = group()
    const head = { ...expense(g), recurrence: 'DAILY' as const, recurrenceNextAt: '2020-01-02' }
    const { created } = materializeRecurrences([head], '2026-01-01', 10)
    expect(created).toHaveLength(10)
  })

  it('recurringSpend conta o que vén de repeticións', () => {
    const g = group()
    const head = { ...expense(g), id: 'head', recurrence: 'MONTHLY' as const, recurrenceNextAt: '2026-02-05' }
    const oneOff = { ...expense(g, { title: 'Cea', category: 'food', amountOriginal: 5000, date: '2026-02-07' }), id: 'x' }
    const { entries } = materializeRecurrences([head, oneOff], '2026-02-10')
    const g2 = { ...g, entries }
    expect(recurringSpend(g2)).toBe(60000 * 2)
    expect(totalSpent(g2)).toBe(60000 * 2 + 5000)
  })
})

/* ------------------------------ busca ------------------------------ */

describe('busca', () => {
  it('normaliza acentos e maiúsculas', () => {
    expect(normalize('Ceá NA Coruña')).toBe('cea na coruna')
  })

  it('atopa por concepto, persoa, categoría e importe', () => {
    const g = group()
    const e = expense(g, { title: 'Cea no Ribeiro', category: 'food', amountOriginal: 4550 })
    expect(matchesQuery(g, e, 'cea')).toBe(true)
    expect(matchesQuery(g, e, 'RIBEIRO')).toBe(true)
    expect(matchesQuery(g, e, 'anxo')).toBe(true)
    expect(matchesQuery(g, e, 'uxia')).toBe(true)
    expect(matchesQuery(g, e, '45.50')).toBe(true)
    expect(matchesQuery(g, e, 'hotel')).toBe(false)
  })

  it('varias palabras teñen que aparecer todas', () => {
    const g = group()
    const e = expense(g, { title: 'Cea no Ribeiro' })
    expect(matchesQuery(g, e, 'cea ribeiro')).toBe(true)
    expect(matchesQuery(g, e, 'cea hotel')).toBe(false)
  })

  it('unha busca baleira devolve todo', () => {
    const g = group()
    const list = [expense(g), expense(g, { title: 'Luz' })]
    expect(filterEntries(g, list, '   ')).toHaveLength(2)
  })
})

/* --------------------------- rangos de datas ------------------------ */

describe('rangos de datas', () => {
  it('«este mes» vai do 1 ao último día', () => {
    expect(rangeFor('THIS_MONTH', '2026-02-17')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(rangeFor('THIS_MONTH', '2028-02-17')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('«mes pasado» retrocede un mes enteiro', () => {
    expect(rangeFor('LAST_MONTH', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })

  it('«3 meses» inclúe o actual', () => {
    expect(rangeFor('LAST_3M', '2026-05-20')).toEqual({ from: '2026-03-01', to: '2026-05-31' })
  })

  it('«todo» non filtra nada', () => {
    const r = rangeFor('ALL', '2026-05-20')
    expect(inRange('1999-01-01', r)).toBe(true)
    expect(inRange('2099-01-01', r)).toBe(true)
  })

  it('inRange respecta os extremos', () => {
    const r = rangeFor('THIS_MONTH', '2026-02-17')
    expect(inRange('2026-02-01', r)).toBe(true)
    expect(inRange('2026-02-28', r)).toBe(true)
    expect(inRange('2026-01-31', r)).toBe(false)
    expect(inRange('2026-03-01', r)).toBe(false)
  })

  it('monthsIn devolve a serie de meses do rango', () => {
    expect(monthsIn(rangeFor('LAST_3M', '2026-05-20'), '2020-01-01', '2026-05-20')).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
    ])
  })

  it('filtra os movementos polo rango', () => {
    const g = group()
    const g2 = {
      ...g,
      entries: [
        expense(g, { date: '2026-01-05' }),
        expense(g, { date: '2026-02-05' }),
        expense(g, { date: '2026-03-05' }),
      ],
    }
    expect(entriesInRange(g2, rangeFor('THIS_MONTH', '2026-02-10'))).toHaveLength(1)
    expect(entriesInRange(g2, rangeFor('ALL', '2026-02-10'))).toHaveLength(3)
    expect(totalSpent(g2, rangeFor('THIS_MONTH', '2026-02-10'))).toBe(60000)
  })
})
