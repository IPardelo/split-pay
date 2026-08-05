import { useEffect, useMemo, useState } from 'react'
import { navigate } from '../App'

import { participantIsUsed } from '../core/balances'
import { currencyOptions } from '../core/fx'
import type { Group } from '../core/types'
import { locale, t, useLang } from '../i18n'
import { fetchRates } from '../lib/fxlive'
import { shareTargetFor, type ShareTarget } from '../lib/share'
import {
  addParticipant,
  applyRemoteGroup,
  deleteGroup,
  removeParticipant,
  renameParticipant,
  restoreParticipant,
  setGroupSync,
  setRate,
  setRates,
  updateGroupMeta,
} from '../store/store'
import { isFirebaseConfigured } from '../store/settings'
import { claimRemote, useSyncStatus } from '../sync/engine'
import { QrDialog } from './QrDialog'
import { Avatar, Field, Sheet, Spinner, toast } from './kit'

export default function GroupSettings({ group, onClose }: { group: Group; onClose: () => void }) {
  useLang()
  const [newName, setNewName] = useState('')
  const [target, setTarget] = useState<ShareTarget | null>(null)
  const [showRates, setShowRates] = useState(false)
  const [fxBusy, setFxBusy] = useState(false)
  const [qr, setQr] = useState(false)
  const sync = useSyncStatus(group.sync === 'ONLINE' ? group.id : null)
  const currencies = useMemo(() => currencyOptions(), [])

  useEffect(() => {
    let alive = true
    shareTargetFor(group)
      .then((tg) => alive && setTarget(tg))
      .catch(() => alive && setTarget(null))
    return () => {
      alive = false
    }
  }, [group])

  const usedCurrencies = [...new Set(group.entries.map((e) => e.currency))].filter(
    (c) => c !== group.baseCurrency,
  )

  async function goOnline() {
    try {
      const merged = await claimRemote({ ...group, sync: 'ONLINE' })
      applyRemoteGroup({ ...merged, sync: 'ONLINE' })
      toast(t('sync.enabled'))
    } catch {
      setGroupSync(group.id, 'ONLINE')
      toast(t('sync.failed'))
    }
  }

  async function updateRates() {
    setFxBusy(true)
    try {
      const { rates, date } = await fetchRates(group.baseCurrency)
      setRates(group.id, rates, date)
      toast(t('fx.done'))
    } catch {
      toast(t('fx.failed'))
    } finally {
      setFxBusy(false)
    }
  }

  return (
    <Sheet title={t('settings.title')} onClose={onClose}>
      <Field label={t('settings.name')}>
        <input
          className="input"
          value={group.title}
          onChange={(e) => updateGroupMeta(group.id, { title: e.target.value })}
        />
      </Field>

      <Field label={t('settings.info')}>
        <textarea
          className="input"
          rows={3}
          placeholder={t('settings.info.ph')}
          value={group.description}
          onChange={(e) => updateGroupMeta(group.id, { description: e.target.value })}
        />
      </Field>

      <Field label={t('settings.whoAreYou')}>
        <select
          className="input"
          value={group.meParticipantId ?? ''}
          onChange={(e) => updateGroupMeta(group.id, { meParticipantId: e.target.value || null })}
        >
          <option value="">{t('settings.unset')}</option>
          {group.participants
            .filter((p) => !p.deletedAt)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </Field>

      <div className="card">
        <div className="card-title">
          <span>{t('sync.title')}</span>
          {group.sync === 'ONLINE' && (
            <span className={`badge ${sync.status}`}>{t(`sync.status.${sync.status}`)}</span>
          )}
        </div>
        <div className="card-pad small muted">
          {group.sync === 'ONLINE' ? t('sync.online.desc') : t('sync.local.desc')}
          {group.sync === 'ONLINE' && sync.lastSync && (
            <>
              <br />
              {t('sync.status.lastSync', {
                time: new Date(sync.lastSync).toLocaleTimeString(locale()),
              })}
            </>
          )}
        </div>
        {isFirebaseConfigured() ? (
          <div className="card-pad btn-row" style={{ paddingTop: 0 }}>
            {group.sync === 'ONLINE' ? (
              <button
                className="btn sm"
                onClick={() => {
                  setGroupSync(group.id, 'LOCAL')
                  toast(t('sync.disabled'))
                }}
              >
                {t('sync.disable')}
              </button>
            ) : (
              <button className="btn sm" onClick={goOnline}>
                ☁️ {t('sync.enable')}
              </button>
            )}
          </div>
        ) : (
          <div className="card-pad small muted" style={{ paddingTop: 0 }}>
            {t('sync.notConfigured')}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">{t('settings.participants')}</div>
        {group.participants.map((p) => {
          const used = participantIsUsed(group, p.id)
          return (
            <div className="split-row" key={p.id}>
              <Avatar p={p} size="sm" />
              <input
                className="input"
                style={{ flex: 1 }}
                value={p.name}
                onChange={(e) => renameParticipant(group.id, p.id, e.target.value)}
                disabled={!!p.deletedAt}
              />
              {p.deletedAt ? (
                <button
                  className="btn ghost sm"
                  aria-label={t('action.restore')}
                  onClick={() => restoreParticipant(group.id, p.id)}
                >
                  ↺
                </button>
              ) : (
                <button
                  className="btn ghost sm"
                  aria-label={t('action.delete')}
                  onClick={() => {
                    if (used) {
                      if (!confirm(t('settings.deactivateConfirm', { name: p.name }))) return
                      removeParticipant(group.id, p.id, false)
                      toast(t('settings.deactivated'))
                    } else {
                      removeParticipant(group.id, p.id, true)
                      toast(t('settings.removed'))
                    }
                  }}
                >
                  🗑
                </button>
              )}
            </div>
          )
        })}
        <div className="split-row">
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder={t('settings.addParticipant')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                addParticipant(group.id, newName)
                setNewName('')
              }
            }}
          />
          <button
            className="btn sm"
            disabled={!newName.trim()}
            onClick={() => {
              addParticipant(group.id, newName)
              setNewName('')
            }}
          >
            {t('action.add')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span>{t('settings.share')}</span>
        </div>
        <div className="card-pad small muted">
          {target?.kind === 'code' ? t('share.codeHint') : t('settings.share.hint')}
        </div>
        <div
          className="card-pad"
          style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {target && <code className="token">{target.value}</code>}
          <div className="btn-row">
            <button
              className="btn sm"
              disabled={!target}
              onClick={async () => {
                if (!target) return
                try {
                  await navigator.clipboard.writeText(target.value)
                  toast(target.kind === 'link' ? t('settings.linkCopied') : t('share.codeCopied'))
                } catch {
                  toast(t('settings.copyManually'))
                }
              }}
            >
              {target?.kind === 'code' ? t('share.copyCode') : t('settings.copyLink')}
            </button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                className="btn sm"
                disabled={!target}
                onClick={() =>
                  target &&
                  navigator
                    .share(
                      target.kind === 'link'
                        ? { title: group.title, url: target.value }
                        : { title: group.title, text: target.value },
                    )
                    .catch(() => {})
                }
              >
                {t('settings.shareLink')}
              </button>
            )}
            <button className="btn sm" onClick={() => setQr(true)}>
              {t('qr.title')}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span>{t('settings.baseCurrency', { code: group.baseCurrency })}</span>
          <button className="btn ghost sm" onClick={() => setShowRates(!showRates)}>
            {showRates ? t('settings.hide') : t('settings.rates')}
          </button>
        </div>
        {group.entries.length === 0 ? (
          <div className="card-pad">
            <select
              className="input"
              value={group.baseCurrency}
              onChange={(e) => updateGroupMeta(group.id, { baseCurrency: e.target.value })}
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="card-pad small muted">{t('settings.cantChangeCurrency')}</div>
        )}
        <div className="card-pad btn-row" style={{ paddingTop: 0, alignItems: 'center' }}>
          <button className="btn sm" disabled={fxBusy} onClick={() => void updateRates()}>
            {fxBusy ? <Spinner label={t('fx.updating')} /> : t('fx.update')}
          </button>
          <span className="small muted">
            {group.ratesUpdatedAt ? t('fx.updated', { date: group.ratesUpdatedAt }) : t('fx.never')}
          </span>
        </div>
        {showRates && (
          <>
            <div className="card-pad small muted" style={{ paddingTop: 0 }}>
              {t('settings.rates.hint', { code: group.baseCurrency })}
            </div>
            {Object.keys(group.rates)
              .filter((code) => code !== group.baseCurrency)
              .sort()
              .map((code) => (
                <div className="split-row" key={code}>
                  <span className="grow">
                    {code}
                    {usedCurrencies.includes(code) && (
                      <span className="badge" style={{ marginLeft: 6 }}>
                        {t('settings.inUse')}
                      </span>
                    )}
                  </span>
                  <input
                    className="input mini"
                    style={{ width: 120 }}
                    inputMode="decimal"
                    value={group.rates[code] ?? ''}
                    onChange={(e) => setRate(group.id, code, Number(e.target.value.replace(',', '.')) || 0)}
                  />
                </div>
              ))}
          </>
        )}
      </div>

      <div className="btn-row">
        <button
          className="btn"
          onClick={() => {
            updateGroupMeta(group.id, {
              archivedAt: group.archivedAt ? null : new Date().toISOString(),
            })
            toast(group.archivedAt ? t('settings.unarchived') : t('settings.archived'))
          }}
        >
          {group.archivedAt ? t('settings.unarchive') : t('settings.archive')}
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (!confirm(t('settings.deleteConfirm', { title: group.title }))) return
            deleteGroup(group.id)
            onClose()
            navigate('/')
            toast(t('settings.deleted'))
          }}
        >
          {t('settings.delete')}
        </button>
      </div>

      {qr && <QrDialog group={group} onClose={() => setQr(false)} />}
    </Sheet>
  )
}
