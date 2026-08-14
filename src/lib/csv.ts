import { activeEntries, computeBalances, participantName } from '../core/balances'
import { sortEntries } from '../core/entries'
import { toUnits } from '../core/money'
import { CATEGORY_BY_ID, type Group } from '../core/types'
import { t, type Key } from '../i18n'

function cell(v: string | number): string {
  const s = String(v)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function row(cells: (string | number)[]): string {
  return cells.map(cell).join(';')
}

/** O CSV sae no idioma activo da aplicación. */
export function groupToCsv(group: Group): string {
  const people = group.participants
  const base = group.baseCurrency
  const lines: string[] = []

  lines.push(row([t('csv.group'), group.title]))
  lines.push(row([t('csv.baseCurrency'), base]))
  lines.push('')

  lines.push(
    row([
      t('csv.date'),
      t('csv.type'),
      t('csv.concept'),
      t('csv.category'),
      t('csv.currency'),
      t('csv.amountOriginal'),
      t('csv.rate'),
      t('csv.amountBase', { code: base }),
      t('csv.paidBy'),
      ...people.map((p) => t('csv.share', { name: p.name })),
    ]),
  )

  for (const e of sortEntries(activeEntries(group))) {
    const shareOf = new Map(e.shares.map((s) => [s.participantId, s.amount]))
    const payers = e.payers
      .map((p) => `${participantName(group, p.participantId)} (${toUnits(p.amount, base).toFixed(2)})`)
      .join(' + ')
    lines.push(
      row([
        e.date,
        t(`type.${e.type}` as Key),
        e.title,
        t(`cat.${CATEGORY_BY_ID[e.category]?.id ?? 'other'}` as Key),
        e.currency,
        toUnits(e.amountOriginal, e.currency).toFixed(2),
        e.fxRate,
        toUnits(e.amountBase, base).toFixed(2),
        payers,
        ...people.map((p) => toUnits(shareOf.get(p.id) ?? 0, base).toFixed(2)),
      ]),
    )
  }

  lines.push('')
  lines.push(row([t('csv.balances')]))
  lines.push(row([t('csv.participant'), t('csv.paid'), t('csv.owed'), t('csv.balance')]))
  for (const b of computeBalances(group)) {
    lines.push(
      row([
        participantName(group, b.participantId),
        toUnits(b.paid, base).toFixed(2),
        toUnits(b.owed, base).toFixed(2),
        toUnits(b.balance, base).toFixed(2),
      ]),
    )
  }

  return '﻿' + lines.join('\n')
}

/**
 * Export en JSON: o grupo enteiro, lexible por outra ferramenta e reimportable
 * por esta mesma app.
 */
export function groupToJson(group: Group): string {
  return JSON.stringify({ format: 'split-pay/group@1', group }, null, 2)
}

/** Le un JSON exportado e devolve o grupo, ou null se non encaixa. */
export function groupFromJson(text: string): Group | null {
  try {
    const parsed = JSON.parse(text) as { group?: Group } & Partial<Group>
    const group = parsed.group ?? (parsed as Group)
    if (!group?.id || !Array.isArray(group.participants) || !Array.isArray(group.entries)) return null
    return group
  } catch {
    return null
  }
}

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
