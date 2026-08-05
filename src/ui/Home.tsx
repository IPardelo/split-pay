import { useMemo, useState } from 'react'
import { navigate } from '../App'

import { activeEntries, balanceMap, totalSpent } from '../core/balances'
import { currencyOptions } from '../core/fx'
import { formatCents } from '../core/money'
import type { AppState, Cents, Group, SyncMode } from '../core/types'
import { plural, t, useLang } from '../i18n'
import { decodeGroup, payloadFromText, tokenFromText } from '../lib/share'
import { isFirebaseConfigured } from '../store/settings'
import { createGroup, importGroup, toggleFavorite, useAppState } from '../store/store'
import AppSettings from './AppSettings'
import { QrScanner } from './QrDialog'
import { Empty, Field, Money, QrIcon, Sheet, toast } from './kit'

/**
 * Abre o que che pasaron, sexa o que sexa: unha ligazón, o código dun grupo
 * local, ou o token dun grupo en liña (que é o que leva o QR cando non hai
 * dominio). Devolve false se non recoñece o texto.
 */
async function openSharedText(text: string): Promise<boolean> {
  const trimmed = text.trim()

  if (trimmed.includes('#/')) {
    navigate(trimmed.slice(trimmed.indexOf('#/') + 1))
    return true
  }

  const payload = payloadFromText(trimmed)
  if (payload) {
    const group = await decodeGroup(payload)
    const imported = importGroup(group)
    navigate(`/g/${imported.id}`)
    toast(t('join.imported', { title: group.title }))
    return true
  }

  const token = tokenFromText(trimmed)
  if (token) {
    navigate(`/t/${token}`)
    return true
  }

  return false
}

export default function Home() {
  useLang()
  const state = useAppState()
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [appSettings, setAppSettings] = useState(false)

  const live = state.groups.filter((g) => !g.archivedAt)
  const favorites = live.filter((g) => g.favorite)
  const groups = live.filter((g) => !g.favorite)
  const archived = state.groups.filter((g) => g.archivedAt)

  return (
    <>
      <header className="topbar">
        <div className="grow">
          <h1>{t('app.name')}</h1>
          <div className="sub">{t('app.tagline')}</div>
        </div>
        <button
          className="btn ghost sm"
          aria-label={t('appset.open')}
          title={t('appset.title')}
          onClick={() => setAppSettings(true)}
        >
          ⚙︎
        </button>
      </header>

      <div className="content">
        <GlobalBalance state={state} />

        {live.length === 0 && archived.length === 0 ? (
          <Empty icon="🧮" title={t('home.empty.title')} hint={t('home.empty.hint')} />
        ) : (
          <>
            {favorites.length > 0 && (
              <div className="card">
                <div className="card-title">{t('home.favorites')}</div>
                {favorites.map((g) => (
                  <GroupRow key={g.id} group={g} />
                ))}
              </div>
            )}
            {groups.length > 0 && (
              <div className="card">
                <div className="card-title">{t('home.groups')}</div>
                {groups.map((g) => (
                  <GroupRow key={g.id} group={g} />
                ))}
              </div>
            )}
            {live.length === 0 && <div className="empty small">{t('home.allArchived')}</div>}
          </>
        )}

        {archived.length > 0 && (
          <div className="card">
            <div className="card-title">{t('home.archived')}</div>
            {archived.map((g) => (
              <GroupRow key={g.id} group={g} />
            ))}
          </div>
        )}

        <div className="btn-row">
          <button className="btn primary" onClick={() => setCreating(true)}>
            {t('home.new')}
          </button>
          <button className="btn" onClick={() => setJoining(true)}>
            {t('home.join')}
          </button>
          <button
            className="btn icon"
            aria-label={t('qr.scan')}
            title={t('qr.scan')}
            onClick={() => setScanning(true)}
          >
            <QrIcon />
          </button>
        </div>

      </div>

      {appSettings && <AppSettings onClose={() => setAppSettings(false)} />}
      {creating && <CreateGroupSheet onClose={() => setCreating(false)} />}
      {joining && <JoinSheet onClose={() => setJoining(false)} />}
      {scanning && (
        <QrScanner
          onClose={() => setScanning(false)}
          onResult={(text) => {
            setScanning(false)
            openSharedText(text)
              .then((ok) => {
                if (!ok) toast(t('join.notRecognised'))
              })
              .catch(() => toast(t('join.corrupt')))
          }}
        />
      )}
    </>
  )
}

/** Saldo global: o que che deben ou debes sumando todos os grupos, por moeda. */
function GlobalBalance({ state }: { state: AppState }) {
  const totals = useMemo(() => {
    const m = new Map<string, Cents>()
    for (const g of state.groups) {
      if (g.archivedAt || !g.meParticipantId) continue
      const mine = balanceMap(g)[g.meParticipantId] ?? 0
      if (mine === 0) continue
      m.set(g.baseCurrency, (m.get(g.baseCurrency) ?? 0) + mine)
    }
    return [...m.entries()].filter(([, v]) => v !== 0)
  }, [state])

  if (totals.length === 0) return null

  return (
    <div className="card">
      <div className="card-title">{t('home.globalBalance')}</div>
      {totals.map(([currency, amount]) => (
        <div className="row static" key={currency}>
          <span className="cat-icon">{amount > 0 ? '🟢' : '🔴'}</span>
          <span className="grow">
            <div className="title">{amount > 0 ? t('home.owedToYou') : t('home.youOwe')}</div>
            <div className="sub">{currency}</div>
          </span>
          <Money cents={amount} currency={currency} sign />
        </div>
      ))}
      <div className="card-pad small muted" style={{ borderTop: '1px solid var(--border)' }}>
        {t('home.globalHint')}
      </div>
    </div>
  )
}

function GroupRow({ group }: { group: Group }) {
  const balances = balanceMap(group)
  const mine = group.meParticipantId ? balances[group.meParticipantId] ?? 0 : null
  const count = activeEntries(group).length

  return (
    <div className="row" style={{ cursor: 'default' }}>
      <button
        className="grow"
        style={{
          background: 'none',
          border: 0,
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          minWidth: 0,
        }}
        onClick={() => navigate(`/g/${group.id}`)}
      >
        <span className="cat-icon">
          {group.archivedAt ? '📦' : group.sync === 'ONLINE' ? '☁️' : '👥'}
        </span>
        <span className="grow" style={{ minWidth: 0 }}>
          <div className="title">{group.title}</div>
          <div className="sub">
            {t('home.people', { n: group.participants.filter((p) => !p.deletedAt).length })} ·{' '}
            {plural(count, 'home.entries.one', 'home.entries.many')} ·{' '}
            {formatCents(totalSpent(group), group.baseCurrency)}
          </div>
        </span>
      </button>
      {mine !== null && mine !== 0 ? (
        <Money cents={mine} currency={group.baseCurrency} sign />
      ) : (
        <span className="badge">{t('home.upToDate')}</span>
      )}
      <button
        className="btn ghost sm"
        aria-label={group.favorite ? t('home.unfavorite') : t('home.favorite')}
        title={group.favorite ? t('home.unfavorite') : t('home.favorite')}
        onClick={() => toggleFavorite(group.id)}
      >
        {group.favorite ? '★' : '☆'}
      </button>
    </div>
  )
}

function CreateGroupSheet({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [names, setNames] = useState<string[]>(['', ''])
  const [sync, setSync] = useState<SyncMode>('LOCAL')
  const currencies = useMemo(() => currencyOptions(), [])

  const canChooseSync = isFirebaseConfigured()
  const valid = title.trim().length > 0 && names.filter((n) => n.trim()).length >= 2

  function submit() {
    if (!valid) return
    const g = createGroup({
      title,
      baseCurrency: currency,
      participantNames: names,
      sync: canChooseSync ? sync : 'LOCAL',
    })
    onClose()
    navigate(`/g/${g.id}`)
  }

  return (
    <Sheet
      title={t('create.title')}
      onClose={onClose}
      footer={
        <>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>
            {t('action.cancel')}
          </button>
          <button className="btn primary" style={{ flex: 2 }} disabled={!valid} onClick={submit}>
            {t('create.submit')}
          </button>
        </>
      }
    >
      <Field label={t('create.name')}>
        <input
          className="input"
          autoFocus
          placeholder={t('create.name.ph')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      <Field label={t('create.currency')}>
        <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
      </Field>

      {canChooseSync ? (
        <Field label={t('create.mode')}>
          <div className="choice">
            <button
              className="choice-item"
              aria-pressed={sync === 'LOCAL'}
              onClick={() => setSync('LOCAL')}
            >
              <span className="choice-icon">📱</span>
              <span>
                <strong>{t('create.mode.local')}</strong>
                <span className="small muted">{t('create.mode.local.hint')}</span>
              </span>
            </button>
            <button
              className="choice-item"
              aria-pressed={sync === 'ONLINE'}
              onClick={() => setSync('ONLINE')}
            >
              <span className="choice-icon">☁️</span>
              <span>
                <strong>{t('create.mode.online')}</strong>
                <span className="small muted">{t('create.mode.online.hint')}</span>
              </span>
            </button>
          </div>
        </Field>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          {t('create.mode.disabled')}
        </p>
      )}

      <Field label={t('create.participants')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {names.map((n, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder={i === 0 ? t('create.you') : t('create.person', { n: i + 1 })}
                value={n}
                onChange={(e) => setNames(names.map((v, j) => (j === i ? e.target.value : v)))}
              />
              {names.length > 2 && (
                <button
                  className="btn ghost"
                  aria-label={t('action.remove')}
                  onClick={() => setNames(names.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button className="btn sm" onClick={() => setNames([...names, ''])}>
            {t('create.addPerson')}
          </button>
        </div>
      </Field>
      <p className="small muted" style={{ margin: 0 }}>
        {t('create.firstIsYou')}
      </p>
    </Sheet>
  )
}

function JoinSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    try {
      const ok = await openSharedText(text)
      if (!ok) {
        setError(t('join.notRecognised'))
        return
      }
      onClose()
    } catch {
      setError(t('join.corrupt'))
    }
  }

  return (
    <Sheet
      title={t('join.title')}
      onClose={onClose}
      footer={
        <>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>
            {t('action.cancel')}
          </button>
          <button className="btn primary" style={{ flex: 2 }} onClick={submit}>
            {t('join.action')}
          </button>
        </>
      }
    >
      <Field label={t('join.paste')}>
        <textarea
          className="input"
          rows={4}
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          placeholder="g1.H4sIA…"
        />
      </Field>
      {error && <p className="small" style={{ color: 'var(--neg)', margin: 0 }}>{error}</p>}
      <p className="small muted" style={{ margin: 0 }}>
        {t('join.hint')}
      </p>
    </Sheet>
  )
}
