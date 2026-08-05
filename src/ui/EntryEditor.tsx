import { useEffect, useMemo, useRef, useState } from 'react'

import type { EntryDraft } from '../core/entries'
import { convert, currencyOptions, rateFor } from '../core/fx'
import { today } from '../core/ids'
import { formatCents, formatPlain, parseAmountExpression } from '../core/money'
import { resolveSplit, validateSplit, type SplitValidation } from '../core/split'
import {
  CATEGORIES,
  CATEGORY_GROUPS,
  type Attachment,
  type Entry,
  type EntryType,
  type Group,
  type RecurrenceRule,
  type SplitMode,
  type SplitSpec,
  type UUID,
} from '../core/types'
import { t, useLang, type Key } from '../i18n'
import { extractReceipt, suggestCategory } from '../lib/ai'
import {
  deleteAttachment,
  isLocalOnly,
  prepareImage,
  resolveUrl,
  saveAttachment,
} from '../lib/attachments'
import { isAiConfigured, isRemoteStorageConfigured } from '../store/settings'
import { addEntry, deleteEntry, updateEntry } from '../store/store'
import { Avatar, Field, Sheet, Spinner, toast } from './kit'

const MODES: SplitMode[] = ['EQUAL', 'SHARES', 'EXACT', 'PERCENT']
const RECURRENCES: RecurrenceRule[] = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']

export default function EntryEditor({
  group,
  entry,
  onClose,
}: {
  group: Group
  entry: Entry | null
  onClose: () => void
}) {
  useLang()
  const base = group.baseCurrency
  const people = group.participants.filter(
    (p) => !p.deletedAt || entry?.shares.some((s) => s.participantId === p.id),
  )
  const currencies = useMemo(() => currencyOptions(), [])

  const [type, setType] = useState<EntryType>(entry?.type ?? 'EXPENSE')
  const [title, setTitle] = useState(entry?.title ?? '')
  const [category, setCategory] = useState(entry?.category ?? 'general')
  const [date, setDate] = useState(entry?.date ?? today())
  const [currency, setCurrency] = useState(entry?.currency ?? base)
  const [note, setNote] = useState(entry?.note ?? '')
  const [documents, setDocuments] = useState<Attachment[]>(entry?.documents ?? [])
  const [recurrence, setRecurrence] = useState<RecurrenceRule>(entry?.recurrence ?? 'NONE')
  const [amountText, setAmountText] = useState(
    entry ? formatPlain(entry.amountOriginal, entry.currency) : '',
  )

  const [busy, setBusy] = useState<'photo' | 'scan' | 'category' | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const scanRef = useRef<HTMLInputElement>(null)

  const [multiPayer, setMultiPayer] = useState((entry?.payers.length ?? 1) > 1)
  const [payer, setPayer] = useState<UUID>(
    entry?.payers[0]?.participantId ?? group.meParticipantId ?? people[0]?.id ?? '',
  )
  const [payerAmounts, setPayerAmounts] = useState<Record<UUID, string>>(() => {
    const out: Record<UUID, string> = {}
    for (const p of entry?.payers ?? []) out[p.participantId] = formatPlain(p.amount, base)
    return out
  })

  const [recipient, setRecipient] = useState<UUID>(
    entry?.type === 'TRANSFER'
      ? entry.shares[0]?.participantId ?? ''
      : people.find((p) => p.id !== (group.meParticipantId ?? people[0]?.id))?.id ?? '',
  )

  const [mode, setMode] = useState<SplitMode>(entry?.split.mode ?? 'EQUAL')
  const [included, setIncluded] = useState<Set<UUID>>(
    () =>
      new Set(
        entry && entry.type !== 'TRANSFER'
          ? entry.split.entries.map((e) => e.participantId)
          : people.filter((p) => !p.deletedAt).map((p) => p.id),
      ),
  )
  const [values, setValues] = useState<Record<UUID, string>>(() => {
    const out: Record<UUID, string> = {}
    for (const e of entry?.split.entries ?? []) {
      out[e.participantId] =
        entry!.split.mode === 'EXACT' ? formatPlain(Math.abs(e.value), base) : String(e.value)
    }
    return out
  })

  const amountOriginal = parseAmountExpression(amountText, currency) ?? 0
  const rate = rateFor(group.rates, currency, base)
  const magnitudeBase = convert(Math.abs(amountOriginal), currency, base, rate)
  const sign = type === 'INCOME' ? -1 : 1

  const includedIds = people.filter((p) => included.has(p.id)).map((p) => p.id)

  const spec: SplitSpec = useMemo(() => {
    if (type === 'TRANSFER') {
      return { mode: 'EXACT', entries: [{ participantId: recipient, value: magnitudeBase }] }
    }
    return {
      mode,
      entries: includedIds.map((id) => ({
        participantId: id,
        value:
          mode === 'EQUAL'
            ? 1
            : mode === 'EXACT'
              ? (parseAmountExpression(values[id] ?? '', base) ?? 0) * sign
              : Number(String(values[id] ?? '1').replace(',', '.')) || 0,
      })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, mode, values, includedIds.join(','), magnitudeBase, recipient, sign])

  const validation = useMemo<SplitValidation>(
    () =>
      type === 'TRANSFER'
        ? { ok: !!recipient && recipient !== payer }
        : validateSplit(magnitudeBase * sign, spec),
    [type, spec, magnitudeBase, sign, recipient, payer],
  )

  const preview = useMemo(() => {
    if (!validation.ok || amountOriginal <= 0) return null
    try {
      return resolveSplit(magnitudeBase * sign, spec)
    } catch {
      return null
    }
  }, [validation.ok, spec, magnitudeBase, sign, amountOriginal])

  const payerList = useMemo(() => {
    if (type === 'TRANSFER' || !multiPayer) {
      return [{ participantId: payer, amount: Math.abs(amountOriginal) }]
    }
    return people
      .map((p) => ({
        participantId: p.id,
        amount: parseAmountExpression(payerAmounts[p.id] ?? '', currency) ?? 0,
      }))
      .filter((p) => p.amount > 0)
  }, [type, multiPayer, payer, payerAmounts, people, amountOriginal, currency])

  const payerSum = payerList.reduce((a, p) => a + p.amount, 0)
  const payersOk = payerList.length > 0 && (!multiPayer || payerSum === Math.abs(amountOriginal))
  const canSave = amountOriginal > 0 && validation.ok && payersOk && !!payer

  function save() {
    if (!canSave) return
    const draft: EntryDraft = {
      type,
      title,
      category,
      date,
      currency,
      amountOriginal: Math.abs(amountOriginal),
      payers: payerList,
      split: spec,
      note,
      documents,
      recurrence: type === 'TRANSFER' ? 'NONE' : recurrence,
    }
    if (entry) {
      updateEntry(group.id, entry.id, draft)
      toast(t('editor.updated'))
    } else {
      addEntry(group.id, draft)
      toast(t('editor.added'))
    }
    onClose()
  }

  function switchMode(next: SplitMode) {
    if (next === 'EXACT' || next === 'PERCENT') {
      const n = includedIds.length || 1
      const out: Record<UUID, string> = {}
      if (next === 'EXACT') {
        const each = Math.floor(magnitudeBase / n)
        let rest = magnitudeBase - each * n
        includedIds.forEach((id) => {
          out[id] = formatPlain(each + (rest-- > 0 ? 1 : 0), base)
        })
      } else {
        const each = Math.floor(10000 / n) / 100
        includedIds.forEach((id, i) => {
          out[id] = String(i === 0 ? Number((100 - each * (n - 1)).toFixed(2)) : each)
        })
      }
      setValues(out)
    } else if (next === 'SHARES') {
      const out: Record<UUID, string> = {}
      includedIds.forEach((id) => (out[id] = '1'))
      setValues(out)
    }
    setMode(next)
  }

  /* --------------------------- fotos e IA --------------------------- */

  async function onPhoto(file: File) {
    setBusy('photo')
    try {
      const att = await saveAttachment(file)
      setDocuments((d) => [...d, att])
    } catch {
      toast(t('att.failed'))
    } finally {
      setBusy(null)
    }
  }

  async function removePhoto(att: Attachment) {
    setDocuments((d) => d.filter((x) => x.id !== att.id))
    // Só borramos o ficheiro se o movemento aínda non o tiña gardado.
    if (!entry?.documents.some((x) => x.id === att.id)) await deleteAttachment(att)
  }

  async function onScan(file: File) {
    setBusy('scan')
    try {
      const prepared = await prepareImage(file)
      const data = await extractReceipt(prepared.dataUrl, { currency, today: today() })
      let filled = false
      if (data.amount !== null) {
        setAmountText(String(data.amount).replace('.', ','))
        filled = true
      }
      if (data.currency) setCurrency(data.currency)
      if (data.date) setDate(data.date)
      if (data.title) {
        setTitle(data.title)
        filled = true
      }
      if (data.category) setCategory(data.category)
      toast(filled ? t('ai.scanDone') : t('ai.scanNothing'))

      // A foto que acabamos de ler queda adxunta: é o xustificante.
      const att = await saveAttachment(file).catch(() => null)
      if (att) setDocuments((d) => [...d, att])
    } catch {
      toast(t('ai.scanFailed'))
    } finally {
      setBusy(null)
    }
  }

  async function onSuggestCategory() {
    setBusy('category')
    try {
      const guess = await suggestCategory(title)
      if (guess) setCategory(guess)
      else toast(t('ai.suggestFailed'))
    } catch {
      toast(t('ai.suggestFailed'))
    } finally {
      setBusy(null)
    }
  }

  const errorText = validation.ok
    ? null
    : validation.code === 'percent'
      ? t('split.err.percent', { sum: (validation.sum ?? 0).toFixed(2) })
      : t(`split.err.${validation.code ?? 'noParticipants'}` as Key)

  return (
    <Sheet
      title={entry ? t('editor.edit') : t('editor.new')}
      onClose={onClose}
      footer={
        <>
          {entry && (
            <button
              className="btn danger"
              onClick={() => {
                deleteEntry(group.id, entry.id)
                toast(t('entries.deleted'))
                onClose()
              }}
            >
              {t('action.delete')}
            </button>
          )}
          <button className="btn primary" style={{ flex: 1 }} disabled={!canSave} onClick={save}>
            {entry ? t('action.save') : t('action.add')}
          </button>
        </>
      }
    >
      <div className="tabs">
        {(['EXPENSE', 'INCOME', 'TRANSFER'] as EntryType[]).map((ty) => (
          <button key={ty} className="tab" aria-selected={type === ty} onClick={() => setType(ty)}>
            {t(`type.${ty}` as Key)}
          </button>
        ))}
      </div>

      {type !== 'TRANSFER' && isAiConfigured() && (
        <>
          <button
            className="btn"
            disabled={busy !== null}
            onClick={() => scanRef.current?.click()}
          >
            {busy === 'scan' ? <Spinner label={t('ai.scanning')} /> : t('ai.scan')}
          </button>
          <input
            ref={scanRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onScan(f)
              e.target.value = ''
            }}
          />
        </>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>{t('editor.amount')}</label>
          <input
            className="input big"
            inputMode="decimal"
            autoFocus
            placeholder="0,00"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
          />
        </div>
        <div className="field" style={{ width: 120 }}>
          <label>{t('editor.currency')}</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      {amountText.trim() && amountOriginal <= 0 && (
        <p className="small" style={{ color: 'var(--neg)', margin: 0 }}>
          {t('editor.badAmount')}
        </p>
      )}
      {currency !== base && amountOriginal > 0 && (
        <p className="small muted" style={{ margin: 0 }}>
          {t('editor.converted', {
            base: formatCents(magnitudeBase, base),
            rate,
            baseCode: base,
            code: currency,
          })}
        </p>
      )}

      {type !== 'TRANSFER' && (
        <Field label={t('editor.concept')}>
          <input
            className="input"
            placeholder={t('editor.concept.ph')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
      )}

      <div className="grid2">
        <Field label={t('editor.date')}>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={type === 'TRANSFER' ? t('editor.whoPays') : t('editor.paidBy')}>
          <select className="input" value={payer} onChange={(e) => setPayer(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {type === 'TRANSFER' ? (
        <Field label={t('editor.whoReceives')}>
          <select className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)}>
            {people
              .filter((p) => p.id !== payer)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
      ) : (
        <>
          {!multiPayer ? (
            <button className="btn ghost sm" onClick={() => setMultiPayer(true)}>
              {t('editor.multiPayer')}
            </button>
          ) : (
            <div className="card">
              <div className="card-title">
                <span>{t('editor.whoPaid')}</span>
                <button className="btn ghost sm" onClick={() => setMultiPayer(false)}>
                  {t('editor.singlePayer')}
                </button>
              </div>
              {people.map((p) => (
                <div className="split-row" key={p.id}>
                  <Avatar p={p} size="sm" />
                  <span className="grow">{p.name}</span>
                  <input
                    className="input mini"
                    inputMode="decimal"
                    placeholder="0"
                    value={payerAmounts[p.id] ?? ''}
                    onChange={(e) => setPayerAmounts({ ...payerAmounts, [p.id]: e.target.value })}
                  />
                </div>
              ))}
              <div className="card-pad small" style={{ borderTop: '1px solid var(--border)' }}>
                {payerSum === Math.abs(amountOriginal) ? (
                  <span className="muted">{t('editor.payersMatch')}</span>
                ) : (
                  <span style={{ color: 'var(--neg)' }}>
                    {t('editor.payersMissing', {
                      amount: formatCents(Math.abs(amountOriginal) - payerSum, currency),
                    })}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="field">
            <label>
              {t('editor.category')}
              {isAiConfigured() && (
                <button
                  className="btn ghost sm"
                  style={{ float: 'right', marginTop: -4 }}
                  disabled={busy !== null || !title.trim()}
                  onClick={() => void onSuggestCategory()}
                >
                  {busy === 'category' ? <Spinner label={t('ai.suggesting')} /> : t('ai.suggest')}
                </button>
              )}
            </label>
            {CATEGORY_GROUPS.map((groupId) => {
              const items = CATEGORIES.filter((c) => c.group === groupId)
              if (items.length === 0) return null
              return (
                <div key={groupId} style={{ marginBottom: 6 }}>
                  <div className="small muted" style={{ marginBottom: 4 }}>
                    {t(`catgroup.${groupId}` as Key)}
                  </div>
                  <div className="chips">
                    {items.map((c) => (
                      <button
                        key={c.id}
                        className="chip"
                        aria-pressed={category === c.id}
                        onClick={() => setCategory(c.id)}
                      >
                        {c.icon} {t(`cat.${c.id}` as Key)}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <Field label={t('rec.label')}>
            <select
              className="input"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as RecurrenceRule)}
            >
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {t(`rec.${r}` as Key)}
                </option>
              ))}
            </select>
            {recurrence !== 'NONE' && (
              <span className="small muted">{t('rec.hint')}</span>
            )}
          </Field>

          <div className="card">
            <div className="card-title">
              <span>{t('editor.split')}</span>
              <span>
                <button
                  className="btn ghost sm"
                  onClick={() => setIncluded(new Set(people.filter((p) => !p.deletedAt).map((p) => p.id)))}
                >
                  {t('editor.selectAll')}
                </button>
                <button className="btn ghost sm" onClick={() => setIncluded(new Set())}>
                  {t('editor.selectNone')}
                </button>
              </span>
            </div>
            <div className="card-pad" style={{ paddingBottom: 8 }}>
              <div className="tabs">
                {MODES.map((m) => (
                  <button key={m} className="tab" aria-selected={mode === m} onClick={() => switchMode(m)}>
                    {t(`editor.mode.${m}` as Key)}
                  </button>
                ))}
              </div>
            </div>

            {people.map((p) => {
              const on = included.has(p.id)
              const share = preview?.find((s) => s.participantId === p.id)?.amount
              return (
                <div className="split-row" key={p.id}>
                  <input
                    type="checkbox"
                    checked={on}
                    aria-label={p.name}
                    onChange={() => {
                      const next = new Set(included)
                      if (on) next.delete(p.id)
                      else next.add(p.id)
                      setIncluded(next)
                    }}
                  />
                  <Avatar p={p} size="sm" />
                  <span className="grow">
                    <div className="title">{p.name}</div>
                    {on && share !== undefined && (
                      <div className="sub">{formatCents(Math.abs(share), base)}</div>
                    )}
                  </span>
                  {on && mode !== 'EQUAL' && (
                    <input
                      className="input mini"
                      inputMode="decimal"
                      value={values[p.id] ?? ''}
                      placeholder={mode === 'SHARES' ? '1' : '0'}
                      onChange={(e) => setValues({ ...values, [p.id]: e.target.value })}
                    />
                  )}
                  {on && mode === 'PERCENT' && <span className="muted">%</span>}
                  {on && mode === 'SHARES' && <span className="muted small">{t('editor.shares')}</span>}
                </div>
              )
            })}

            <div className="card-pad small" style={{ borderTop: '1px solid var(--border)' }}>
              {validation.ok ? (
                <span className="muted">
                  {mode === 'EXACT'
                    ? t('editor.exactOver', { amount: formatCents(magnitudeBase, base) })
                    : t('editor.splitOk')}
                </span>
              ) : (
                <span style={{ color: 'var(--neg)' }}>
                  {errorText}
                  {validation.code === 'exact' &&
                    validation.diff !== undefined &&
                    ` · ${t('editor.missingBase', { amount: formatCents(validation.diff, base) })}`}
                </span>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span>{t('att.title')}</span>
              <span>{documents.length > 0 && t('att.count', { n: documents.length })}</span>
            </div>
            {documents.length > 0 && (
              <div className="thumbs">
                {documents.map((att) => (
                  <AttachmentThumb key={att.id} att={att} onRemove={() => void removePhoto(att)} />
                ))}
              </div>
            )}
            <div className="card-pad" style={{ paddingTop: documents.length ? 0 : 12 }}>
              <button
                className="btn sm"
                disabled={busy !== null}
                onClick={() => photoRef.current?.click()}
              >
                {busy === 'photo' ? <Spinner label={t('att.uploading')} /> : t('att.add')}
              </button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onPhoto(f)
                  e.target.value = ''
                }}
              />
              {!isRemoteStorageConfigured() && (
                <p className="small muted" style={{ marginBottom: 0 }}>
                  {t('att.localHint')}
                </p>
              )}
            </div>
          </div>

          <Field label={t('editor.note')}>
            <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </>
      )}
    </Sheet>
  )
}

/** Miniatura dunha foto: as locais viven no IndexedDB e hai que resolvelas. */
export function AttachmentThumb({
  att,
  onRemove,
  onOpen,
}: {
  att: Attachment
  onRemove?: () => void
  onOpen?: (src: string) => void
}) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    resolveUrl(att)
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null))
    return () => {
      alive = false
    }
  }, [att])

  return (
    <div className="thumb">
      {src ? (
        <img
          src={src}
          alt={att.name}
          onClick={() => src && onOpen?.(src)}
          style={{ cursor: onOpen ? 'zoom-in' : 'default' }}
        />
      ) : (
        <div className="thumb-empty" />
      )}
      {isLocalOnly(att) && <span className="thumb-badge">{t('att.localOnly')}</span>}
      {onRemove && (
        <button className="thumb-remove" aria-label={t('att.remove')} onClick={onRemove}>
          ✕
        </button>
      )}
    </div>
  )
}
