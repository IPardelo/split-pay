import { useMemo, useState } from 'react'
import { computeBalances, participantById } from '../core/balances'
import { formatCents } from '../core/money'
import { settleTransfers, transfersToText } from '../core/settle'
import type { Group, SettleMode, Transfer } from '../core/types'
import { plural, t, useLang } from '../i18n'
import { setSettleMode, useSettings } from '../store/settings'
import { registerSettlement } from '../store/store'
import { Avatar, Empty, Money, toast } from './kit'

export default function BalancesTab({ group }: { group: Group }) {
  useLang()
  const [onlyMine, setOnlyMine] = useState(false)
  const mode = useSettings().settleMode

  const balances = useMemo(
    () => computeBalances(group).sort((a, b) => b.balance - a.balance),
    [group],
  )
  const transfers = useMemo(() => settleTransfers(group, mode), [group, mode])
  const max = Math.max(1, ...balances.map((b) => Math.abs(b.balance)))

  const me = group.meParticipantId
  const shown = onlyMine && me ? transfers.filter((tr) => tr.from === me || tr.to === me) : transfers
  const allZero = balances.every((b) => b.balance === 0)

  async function share() {
    const body = transfersToText(group, shown)
    if (!body) return
    const text = `${group.title}\n\n${body}`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: group.title, text })
        return
      }
    } catch {
      /* o usuario cancelou, ou o WebView non ten folla de compartir */
    }
    try {
      await navigator.clipboard.writeText(text)
      toast(t('balances.copied'))
    } catch {
      toast(t('settings.copyManually'))
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-title">{t('balances.title')}</div>
        {balances.map((b) => {
          const p = participantById(group, b.participantId)
          const pct = (Math.abs(b.balance) / max) * 50
          return (
            <div className="row static" key={b.participantId}>
              <Avatar p={p} />
              <span className="grow">
                <div className="title">
                  {p?.name ?? '—'}{' '}
                  {b.participantId === me && <span className="badge">{t('balances.you')}</span>}
                </div>
                <div className="sub">
                  {t('balances.paidOwed', {
                    paid: formatCents(b.paid, group.baseCurrency),
                    owed: formatCents(b.owed, group.baseCurrency),
                  })}
                </div>
                <div className="balance-bar" style={{ marginTop: 6 }}>
                  <div className="track">
                    <i
                      style={{
                        left: b.balance >= 0 ? '50%' : `${50 - pct}%`,
                        width: `${pct}%`,
                        background: b.balance >= 0 ? 'var(--pos)' : 'var(--neg)',
                      }}
                    />
                    <i style={{ left: 'calc(50% - 1px)', width: 2, background: 'var(--border)' }} />
                  </div>
                </div>
              </span>
              <Money cents={b.balance} currency={group.baseCurrency} sign />
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-title">
          <span>{t('balances.settle')}</span>
          {me && (
            <button className="btn ghost sm" onClick={() => setOnlyMine(!onlyMine)}>
              {onlyMine ? t('balances.all') : t('balances.onlyMine')}
            </button>
          )}
        </div>

        {!allZero && <ModePicker mode={mode} />}

        {allZero ? (
          <Empty icon="✅" title={t('balances.settled.title')} hint={t('balances.settled.hint')} />
        ) : shown.length === 0 ? (
          <Empty icon="👌" title={t('balances.youOk.title')} hint={t('balances.youOk.hint')} />
        ) : (
          shown.map((tr, i) => <TransferRow key={i} group={group} tr={tr} />)
        )}

        {!allZero && shown.length > 0 && (
          <div className="card-pad" style={{ borderTop: '1px solid var(--border)' }}>
            <button className="btn block" onClick={share}>
              📤 {t('balances.share')}
            </button>
          </div>
        )}

        {!allZero && (
          <div className="card-pad small muted" style={{ borderTop: '1px solid var(--border)' }}>
            {plural(transfers.length, 'balances.footer.one', 'balances.footer.many')}
          </div>
        )}
      </div>
    </>
  )
}

/** Bote (menos pagos) ou festa (cada un paga a quen adiantou o seu). */
function ModePicker({ mode }: { mode: SettleMode }) {
  return (
    <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="seg" role="group" aria-label={t('balances.settle')}>
        <button
          className="seg-btn"
          aria-pressed={mode === 'POOL'}
          onClick={() => setSettleMode('POOL')}
        >
          🫙 {t('balances.mode.pool')}
        </button>
        <button
          className="seg-btn"
          aria-pressed={mode === 'PARTY'}
          onClick={() => setSettleMode('PARTY')}
        >
          🎉 {t('balances.mode.party')}
        </button>
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        {mode === 'POOL' ? t('balances.mode.poolHint') : t('balances.mode.partyHint')}
      </p>
    </div>
  )
}

/**
 * Un pago: só «H → P», o importe e o botón. Os nomes enteiros non collían nun
 * móbil e comían o sitio do importe, así que as iniciais son o que se ve e o
 * texto enteiro sae nun toast ao premer (e no `aria-label`, para os lectores de
 * pantalla). Premer non fai nada máis: rexistrar o pago segue sendo o botón.
 */
function TransferRow({ group, tr }: { group: Group; tr: Transfer }) {
  const from = participantById(group, tr.from)
  const to = participantById(group, tr.to)
  const label = t('balances.owes', {
    from: from?.name ?? '?',
    to: to?.name ?? '?',
    amount: formatCents(tr.amount, group.baseCurrency),
  })
  return (
    <div className="row static">
      <button
        className="grow"
        title={label}
        aria-label={label}
        onClick={() => toast(label)}
        style={{
          background: 'none',
          border: 0,
          padding: 0,
          font: 'inherit',
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        <Avatar p={from} size="sm" />
        <span className="muted" aria-hidden>
          →
        </span>
        <Avatar p={to} size="sm" />
        <span className="grow" />
        <Money cents={tr.amount} currency={group.baseCurrency} />
      </button>
      <button
        className="btn sm"
        onClick={() => {
          registerSettlement(group.id, tr.from, tr.to, tr.amount)
          toast(t('balances.registered'))
        }}
      >
        {t('balances.markPaid')}
      </button>
    </div>
  )
}
