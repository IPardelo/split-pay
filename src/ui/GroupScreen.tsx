import { useEffect, useMemo, useState } from 'react'
import { navigate } from '../App'
import { activeEntries, participantById } from '../core/balances'
import { sortEntries } from '../core/entries'
import { formatCents } from '../core/money'
import { filterEntries } from '../core/search'
import { CATEGORY_BY_ID, type Entry, type Group } from '../core/types'
import { monthLabel, plural, t, useLang } from '../i18n'
import { deleteEntry, restoreEntry, runRecurrences, useGroup } from '../store/store'
import { useSyncStatus } from '../sync/engine'
import ActivityTab from './ActivityTab'
import BalancesTab from './BalancesTab'
import EntryEditor from './EntryEditor'
import GroupSettings from './GroupSettings'
import StatsTab from './StatsTab'
import { Empty, Money, SearchBar, toast } from './kit'

type Tab = 'entries' | 'balances' | 'stats' | 'activity'

const PAGE = 40

export default function GroupScreen({ id }: { id: string }) {
  useLang()
  const group = useGroup(id)
  const [tab, setTab] = useState<Tab>('entries')
  const [editing, setEditing] = useState<Entry | null | 'new'>(null)
  const [settings, setSettings] = useState(false)
  const sync = useSyncStatus(group?.sync === 'ONLINE' ? id : null)

  // As repeticións vencidas xéranse ao abrir o grupo.
  useEffect(() => {
    const n = runRecurrences(id)
    if (n > 0) toast(plural(n, 'rec.generated.one', 'rec.generated.many'))
  }, [id])

  if (!group) {
    return (
      <>
        <header className="topbar">
          <button className="btn ghost sm" onClick={() => navigate('/')} aria-label={t('action.back')}>
            ←
          </button>
          <h1 className="grow">{t('group.notFound')}</h1>
        </header>
        <div className="content">
          <Empty icon="🫥" title={t('group.notFound.title')} />
        </div>
      </>
    )
  }

  const me = group.meParticipantId ? participantById(group, group.meParticipantId) : undefined
  const people = group.participants.filter((p) => !p.deletedAt).length

  return (
    <>
      <header className="topbar">
        <button className="btn ghost sm" onClick={() => navigate('/')} aria-label={t('action.back')}>
          ←
        </button>
        <div className="grow">
          <h1>
            {group.title}
            {group.sync === 'ONLINE' && (
              <span className={`sync-dot ${sync.status}`} title={t(`sync.status.${sync.status}`)} />
            )}
          </h1>
          <div className="sub">
            {t('home.people', { n: people })} · {group.baseCurrency} ·{' '}
            {me ? t('group.youAre', { name: me.name }) : t('group.youUnset')}
          </div>
        </div>
        <button className="btn ghost sm" onClick={() => setSettings(true)} aria-label={t('action.settings')}>
          ⚙︎
        </button>
      </header>

      <div className="content">
        <div className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={tab === 'entries'} onClick={() => setTab('entries')}>
            {t('group.tab.entries')}
          </button>
          <button className="tab" role="tab" aria-selected={tab === 'balances'} onClick={() => setTab('balances')}>
            {t('group.tab.balances')}
          </button>
          <button className="tab" role="tab" aria-selected={tab === 'stats'} onClick={() => setTab('stats')}>
            {t('group.tab.stats')}
          </button>
          <button className="tab" role="tab" aria-selected={tab === 'activity'} onClick={() => setTab('activity')}>
            {t('activity.title')}
          </button>
        </div>

        {tab === 'entries' && <EntriesTab group={group} onEdit={setEditing} />}
        {tab === 'balances' && <BalancesTab group={group} />}
        {tab === 'stats' && <StatsTab group={group} />}
        {tab === 'activity' && <ActivityTab group={group} />}
      </div>

      <button className="btn primary fab" onClick={() => setEditing('new')}>
        {t('group.addExpense')}
      </button>

      {editing && (
        <EntryEditor
          group={group}
          entry={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {settings && <GroupSettings group={group} onClose={() => setSettings(false)} />}
    </>
  )
}

function EntriesTab({ group, onEdit }: { group: Group; onEdit: (e: Entry) => void }) {
  const [showDeleted, setShowDeleted] = useState(false)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const all = useMemo(
    () => sortEntries(showDeleted ? group.entries : activeEntries(group)),
    [group, showDeleted],
  )
  const matched = useMemo(() => filterEntries(group, all, query), [group, all, query])
  const visible = matched.slice(0, limit)

  const byMonth = useMemo(() => {
    const m = new Map<string, Entry[]>()
    for (const e of visible) {
      const key = e.date.slice(0, 7)
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(e)
    }
    return [...m.entries()]
  }, [visible])

  if (all.length === 0) {
    return <Empty icon="🧾" title={t('entries.empty.title')} hint={t('entries.empty.hint')} />
  }

  return (
    <>
      <SearchBar
        value={query}
        onChange={(v) => {
          setQuery(v)
          setLimit(PAGE)
        }}
        placeholder={t('search.placeholder')}
      />

      {query && (
        <div className="small muted">{t('search.results', { n: matched.length, total: all.length })}</div>
      )}

      {matched.length === 0 ? (
        <Empty icon="🔍" title={t('search.none')} hint={t('search.noneHint')} />
      ) : (
        byMonth.map(([month, list]) => (
          <div className="card" key={month}>
            <div className="card-title">
              <span>{monthLabel(month)}</span>
              <span>
                {formatCents(
                  list.filter((e) => !e.deletedAt && e.type === 'EXPENSE').reduce((a, e) => a + e.amountBase, 0),
                  group.baseCurrency,
                )}
              </span>
            </div>
            {list.map((e) => (
              <EntryRow key={e.id} group={group} entry={e} onEdit={onEdit} />
            ))}
          </div>
        ))
      )}

      {matched.length > visible.length && (
        <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>
          {t('entries.more')} ({visible.length}/{matched.length})
        </button>
      )}

      <button className="btn ghost sm" onClick={() => setShowDeleted(!showDeleted)}>
        {showDeleted ? t('entries.hideDeleted') : t('entries.showDeleted')}
      </button>
    </>
  )
}

function EntryRow({
  group,
  entry,
  onEdit,
}: {
  group: Group
  entry: Entry
  onEdit: (e: Entry) => void
}) {
  const cat = CATEGORY_BY_ID[entry.category]
  const payerNames = entry.payers
    .map((p) => participantById(group, p.participantId)?.name ?? '?')
    .join(' + ')
  const mine = group.meParticipantId
    ? entry.shares.find((s) => s.participantId === group.meParticipantId)?.amount ?? 0
    : null

  const isTransfer = entry.type === 'TRANSFER'
  const toName = isTransfer
    ? participantById(group, entry.shares[0]?.participantId)?.name ?? '?'
    : null
  const recurring = entry.recurrence !== 'NONE' || !!entry.recurrenceParentId

  return (
    <div className={`row ${entry.deletedAt ? 'deleted' : ''}`} style={{ cursor: 'default' }}>
      <span className="cat-icon">
        {isTransfer ? '🔁' : entry.type === 'INCOME' ? '💰' : cat?.icon ?? '🧾'}
      </span>
      <button
        className="grow"
        style={{ background: 'none', border: 0, textAlign: 'left', padding: 0, cursor: 'pointer' }}
        onClick={() => onEdit(entry)}
      >
        <div className="title">
          {entry.title}
          {recurring && <span title={t('rec.badge')}> {t('entries.recurringBadge')}</span>}
          {entry.documents.length > 0 && <span title={t('att.title')}> 📎</span>}
        </div>
        <div className="sub">
          {isTransfer
            ? `${payerNames} → ${toName}`
            : `${payerNames} · ${plural(entry.shares.length, 'entries.persons.one', 'entries.persons.many')}`}
          {entry.currency !== group.baseCurrency &&
            ` · ${formatCents(entry.amountOriginal, entry.currency)}`}
        </div>
      </button>
      <span style={{ textAlign: 'right' }}>
        <Money cents={entry.amountBase} currency={group.baseCurrency} />
        {mine !== null && !isTransfer && (
          <div className="small muted">
            {t('entries.you')} {formatCents(mine, group.baseCurrency)}
          </div>
        )}
      </span>
      <button
        className="btn ghost sm"
        aria-label={entry.deletedAt ? t('action.restore') : t('action.delete')}
        onClick={() => {
          if (entry.deletedAt) {
            restoreEntry(group.id, entry.id)
            toast(t('entries.restored'))
          } else {
            deleteEntry(group.id, entry.id)
            toast(t('entries.deleted'))
          }
        }}
      >
        {entry.deletedAt ? '↺' : '🗑'}
      </button>
    </div>
  )
}
