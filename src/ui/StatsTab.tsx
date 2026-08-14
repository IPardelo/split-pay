import { useMemo, useState } from 'react'
import {
  dateSpan,
  entriesInRange,
  paidBy,
  participantById,
  recurringSpend,
  shareByParticipant,
  shareOf,
  spentByCategory,
  spentByMonth,
  totalSpent,
} from '../core/balances'
import { sortEntries } from '../core/entries'
import { today } from '../core/ids'
import { formatCents } from '../core/money'
import { RANGES, monthsIn, rangeFor, type RangeId } from '../core/statsRange'
import { CATEGORY_BY_ID, type Group } from '../core/types'
import { monthLabel, t, useLang, type Key } from '../i18n'
import { downloadText, groupToCsv, groupToJson } from '../lib/csv'
import { Avatar, Empty, Money, Sheet, toast } from './kit'

export default function StatsTab({ group }: { group: Group }) {
  useLang()
  const [rangeId, setRangeId] = useState<RangeId>('ALL')
  const [detail, setDetail] = useState<string | null>(null)

  const range = useMemo(() => rangeFor(rangeId, today()), [rangeId])
  const entries = useMemo(() => entriesInRange(group, range), [group, range])
  const expenses = entries.filter((e) => e.type === 'EXPENSE')

  const total = totalSpent(group, range)
  const cats = useMemo(() => spentByCategory(group, range), [group, range])
  const months = useMemo(() => spentByMonth(group, range), [group, range])
  const perPerson = useMemo(
    () => shareByParticipant(group, range).sort((a, b) => b.amount - a.amount),
    [group, range],
  )
  const recurring = recurringSpend(group, range)
  const me = group.meParticipantId
  const myPaid = me ? paidBy(group, me, range) : null
  const myShare = me ? shareOf(group, me, range) : null

  const span = dateSpan(group)
  const timeline = useMemo(() => {
    if (!span) return []
    const list = monthsIn(range, span.from, span.to).slice(-24)
    const byMonth = new Map(months.map((m) => [m.month, m.amount]))
    return list.map((month) => ({ month, amount: byMonth.get(month) ?? 0 }))
  }, [range, months, span])

  const people = group.participants.filter((p) => !p.deletedAt).length || 1
  const maxCat = Math.max(1, ...cats.map((c) => c.amount))
  const maxPerson = Math.max(1, ...perPerson.map((p) => p.amount))
  const maxMonth = Math.max(1, ...timeline.map((m) => m.amount))

  return (
    <>
      <div className="chips">
        {RANGES.map((r) => (
          <button key={r} className="chip" aria-pressed={rangeId === r} onClick={() => setRangeId(r)}>
            {t(`stats.range.${r}` as Key)}
          </button>
        ))}
      </div>

      {expenses.length === 0 ? (
        <Empty icon="📊" title={t('stats.noneInRange')} hint={t('stats.empty.hint')} />
      ) : (
        <>
          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="stat">
              <span className="k">{t('stats.total')}</span>
              <span className="v">{formatCents(total, group.baseCurrency)}</span>
            </div>
            <div className="stat">
              <span className="k">{t('stats.perPerson')}</span>
              <span className="v">{formatCents(Math.round(total / people), group.baseCurrency)}</span>
            </div>
            <div className="stat">
              <span className="k">{t('stats.expenses')}</span>
              <span className="v">{expenses.length}</span>
            </div>
          </div>

          {me && myPaid !== null && myShare !== null && (
            <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat">
                <span className="k">{t('stats.yourSpending')}</span>
                <span className="v">{formatCents(myPaid, group.baseCurrency)}</span>
              </div>
              <div className="stat">
                <span className="k">{t('stats.yourShare')}</span>
                <span className="v">{formatCents(myShare, group.baseCurrency)}</span>
              </div>
            </div>
          )}

          {timeline.length > 1 && (
            <div className="card">
              <div className="card-title">{t('stats.overTime')}</div>
              <div className="chart">
                {timeline.map((m) => (
                  <div className="chart-col" key={m.month} title={`${monthLabel(m.month)} · ${formatCents(m.amount, group.baseCurrency)}`}>
                    <div className="chart-bar-wrap">
                      <div
                        className="chart-bar"
                        style={{ height: `${Math.max(2, (m.amount / maxMonth) * 100)}%` }}
                      />
                    </div>
                    <span className="chart-label">{m.month.slice(5)}</span>
                  </div>
                ))}
              </div>
              <div className="card-pad small muted" style={{ borderTop: '1px solid var(--border)' }}>
                {monthLabel(timeline[0].month)} — {monthLabel(timeline[timeline.length - 1].month)}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-title">{t('stats.byCategory')}</div>
            {cats.map((c) => (
              <button
                className="card-pad cat-row"
                key={c.category}
                onClick={() => setDetail(c.category)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span>
                    {CATEGORY_BY_ID[c.category]?.icon ?? '🧾'} {t(`cat.${c.category}` as Key)}
                  </span>
                  <span className="amount">{formatCents(c.amount, group.baseCurrency)}</span>
                </div>
                <div className="bar">
                  <span style={{ width: `${(c.amount / maxCat) * 100}%` }} />
                </div>
              </button>
            ))}
          </div>

          <div className="card">
            <div className="card-title">{t('stats.byPerson')}</div>
            {perPerson.map((p) => (
              <div className="card-pad" key={p.participantId} style={{ paddingBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <Avatar p={participantById(group, p.participantId)} size="sm" />
                  <span style={{ flex: 1 }}>{participantById(group, p.participantId)?.name}</span>
                  <span className="amount">{formatCents(p.amount, group.baseCurrency)}</span>
                </div>
                <div className="bar">
                  <span
                    style={{
                      width: `${(p.amount / maxPerson) * 100}%`,
                      background: participantById(group, p.participantId)?.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {recurring !== 0 && (
            <div className="card">
              <div className="card-title">{t('stats.recurring')}</div>
              <div className="card-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span className="small muted">{t('stats.recurringHint')}</span>
                  <span className="amount">{formatCents(recurring, group.baseCurrency)}</span>
                </div>
                <div className="bar">
                  <span style={{ width: `${Math.min(100, (recurring / Math.max(1, total)) * 100)}%` }} />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="btn-row">
        <button
          className="btn"
          onClick={() => {
            downloadText(`${slug(group.title)}.csv`, groupToCsv(group))
            toast(t('stats.csvDone'))
          }}
        >
          {t('stats.exportCsv')}
        </button>
        <button
          className="btn"
          onClick={() => {
            downloadText(`${slug(group.title)}.json`, groupToJson(group), 'application/json')
            toast(t('stats.jsonDone'))
          }}
        >
          {t('stats.exportJson')}
        </button>
      </div>

      {detail && (
        <CategoryDetail
          group={group}
          category={detail}
          entries={sortEntries(expenses.filter((e) => e.category === detail))}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  )
}

function CategoryDetail({
  group,
  category,
  entries,
  onClose,
}: {
  group: Group
  category: string
  entries: ReturnType<typeof sortEntries>
  onClose: () => void
}) {
  return (
    <Sheet
      title={t('stats.categoryDetail', { category: t(`cat.${category}` as Key) })}
      onClose={onClose}
    >
      <div className="card">
        {entries.map((e) => (
          <div className="row static" key={e.id}>
            <span className="cat-icon">{CATEGORY_BY_ID[e.category]?.icon ?? '🧾'}</span>
            <span className="grow">
              <div className="title">{e.title}</div>
              <div className="sub">{e.date}</div>
            </span>
            <Money cents={e.amountBase} currency={group.baseCurrency} />
          </div>
        ))}
      </div>
    </Sheet>
  )
}

function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'group'
  )
}
