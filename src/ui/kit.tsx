import { useEffect, useRef, useState, type ReactNode } from 'react'
import { formatCents } from '../core/money'
import type { Cents, Participant } from '../core/types'
import { LANGS, setLang, t, useLang, type Lang } from '../i18n'
import { pushBackHandler } from '../lib/back'

export function Avatar({ p, size = 'md' }: { p?: Participant; size?: 'sm' | 'md' | 'lg' }) {
  const initials = (p?.name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
  return (
    <span
      className={`avatar ${size === 'md' ? '' : size} ${p?.deletedAt ? 'ghost' : ''}`}
      style={{ background: p?.color ?? '#94a3b8' }}
      title={p?.name}
    >
      {initials}
    </span>
  )
}

/**
 * Icona de código QR, debuxada a man en SVG para non meter unha dependencia de
 * iconas por unha soa. Vai en `currentColor`, así que segue a cor do botón nos
 * dous temas.
 */
export function QrIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      {/* Os tres cadrados das esquinas */}
      <rect x="2.6" y="2.6" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <rect x="14.4" y="2.6" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <rect x="2.6" y="14.4" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <rect x="5.1" y="5.1" width="2" height="2" fill="currentColor" />
      <rect x="16.9" y="5.1" width="2" height="2" fill="currentColor" />
      <rect x="5.1" y="16.9" width="2" height="2" fill="currentColor" />
      {/* Uns módulos soltos na esquina que queda, para que se lea coma un QR */}
      <rect x="14.4" y="14.4" width="3" height="3" fill="currentColor" />
      <rect x="19" y="14.4" width="2.4" height="2.4" fill="currentColor" />
      <rect x="14.4" y="19" width="2.4" height="2.4" fill="currentColor" />
      <rect x="19" y="19" width="2.4" height="2.4" fill="currentColor" />
    </svg>
  )
}

export function Money({ cents, currency, sign }: { cents: Cents; currency: string; sign?: boolean }) {
  const cls = !sign ? '' : cents > 0 ? 'pos' : cents < 0 ? 'neg' : ''
  const prefix = sign && cents > 0 ? '+' : ''
  return (
    <span className={`amount ${cls}`}>
      {prefix}
      {formatCents(cents, currency)}
    </span>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  // `onClose` adoita ser unha frecha inline, así que cambia de identidade en
  // cada render: gardámola nunha ref para rexistrar o manexador unha soa vez.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // O botón atrás do móbil pecha a folla en vez de saír da app. Se hai varias
  // abertas, a pila de manexadores encárgase de pechar sempre a de máis arriba.
  useEffect(
    () =>
      pushBackHandler(() => {
        closeRef.current()
        return true
      }),
    [],
  )

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label={t('action.close')}>
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <p style={{ fontWeight: 600, margin: '8px 0 4px', color: 'var(--text)' }}>{title}</p>
      {hint && <p className="small" style={{ margin: 0 }}>{hint}</p>}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="spinner-row">
      <span className="spinner" aria-hidden />
      {label && <span className="small muted">{label}</span>}
    </span>
  )
}

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="search">
      <span aria-hidden>🔍</span>
      <input
        className="search-input"
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button className="btn ghost sm" aria-label={t('search.clear')} onClick={() => onChange('')}>
          ✕
        </button>
      )}
    </div>
  )
}

/** Selector de idioma: galego, castelán, inglés. */
export function LanguageSwitcher() {
  const lang = useLang()
  return (
    <div className="lang-switch" role="group" aria-label={t('lang.label')}>
      {LANGS.map((l: Lang) => (
        <button
          key={l}
          className="lang-btn"
          aria-pressed={lang === l}
          title={t(`lang.${l}` as const)}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

/** Toast mínimo, sen dependencias. */
let toastSetter: ((msg: string | null) => void) | null = null
export function toast(msg: string) {
  toastSetter?.(msg)
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    toastSetter = setMsg
    return () => {
      toastSetter = null
    }
  }, [])
  useEffect(() => {
    if (!msg) return
    const timer = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(timer)
  }, [msg])
  if (!msg) return null
  return <div className="toast">{msg}</div>
}
