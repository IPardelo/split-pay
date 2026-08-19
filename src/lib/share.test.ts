import { describe, expect, it } from 'vitest'
import { defaultRatesFor } from '../core/fx'
import type { Group } from '../core/types'
import { decodeGroup, encodeGroup, payloadFromText, shareTargetFor } from './share'

function sampleGroup(): Group {
  return {
    id: 'g1',
    shareToken: 'tok',
    sync: 'LOCAL',
    title: 'Viaxe a Lisboa',
    description: 'Fin de semana',
    baseCurrency: 'EUR',
    participants: [
      { id: 'p0', name: 'Ana', color: '#0ea5e9', deletedAt: null },
      { id: 'p1', name: 'Bea', color: '#f43f5e', deletedAt: null },
    ],
    entries: [
      {
        id: 'e1',
        type: 'EXPENSE',
        title: 'Cea · pastéis de nata 🍮',
        category: 'food',
        date: '2026-04-10',
        currency: 'EUR',
        amountOriginal: 4550,
        fxRate: 1,
        amountBase: 4550,
        payers: [{ participantId: 'p0', amount: 4550 }],
        split: { mode: 'EQUAL', entries: [{ participantId: 'p0', value: 1 }, { participantId: 'p1', value: 1 }] },
        shares: [{ participantId: 'p0', amount: 2275 }, { participantId: 'p1', amount: 2275 }],
        note: '',
        documents: [],
        recurrence: 'NONE',
        recurrenceNextAt: null,
        recurrenceParentId: null,
        createdAt: '2026-04-10T20:00:00Z',
        updatedAt: '2026-04-10T20:00:00Z',
        deletedAt: null,
      },
    ],
    activities: [],
    rates: defaultRatesFor('EUR'),
    ratesUpdatedAt: null,
    favorite: false,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-10T20:00:00Z',
    archivedAt: null,
    meParticipantId: 'p0',
  }
}

describe('códec de compartición', () => {
  it('un grupo sobrevive á viaxe de ida e volta', async () => {
    const g = sampleGroup()
    const payload = await encodeGroup(g)
    const back = await decodeGroup(payload)
    expect(JSON.stringify(back)).toBe(JSON.stringify(g))
  })

  it('o payload é seguro para unha URL', async () => {
    const payload = await encodeGroup(sampleGroup())
    expect(/^[A-Za-z0-9_.-]+$/.test(payload)).toBe(true)
  })

  it('comprime de verdade', async () => {
    const g = sampleGroup()
    const payload = await encodeGroup(g)
    expect(payload.length < JSON.stringify(g).length).toBe(true)
  })

  it('recoñece o payload dentro dunha URL pegada', () => {
    const url = 'https://ejemplo.com/app/#/join/g1.AbC-_123'
    expect(payloadFromText(url)).toBe('g1.AbC-_123')
    expect(payloadFromText('hola')).toBeNull()
  })

  it('rexeita unha ligazón corrompida', async () => {
    let failed = false
    try {
      await decodeGroup('g1.no-es-gzip')
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
  })

  it('sen dominio compártese un código, non unha ligazón', async () => {
    const target = await shareTargetFor(sampleGroup())
    expect(target.kind).toBe('code')
    // O código é exactamente o payload: pégase en «Unirse» e funciona.
    expect(payloadFromText(target.value)).toBe(target.value)
    const back = await decodeGroup(target.value)
    expect(back.title).toBe('Viaxe a Lisboa')
  })

  it('un grupo pequeno cabe no QR', async () => {
    const target = await shareTargetFor(sampleGroup())
    expect(target.qr).toBe(target.value)
  })

  it('un grupo en liña comparte só o token, que sempre cabe no QR', async () => {
    const target = await shareTargetFor({ ...sampleGroup(), sync: 'ONLINE' })
    expect(target.value).toBe('tok')
    expect(target.qr).toBe('tok')
  })

  it('rexeita un formato descoñecido', async () => {
    let failed = false
    try {
      await decodeGroup('lo-que-sea')
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
  })
})
