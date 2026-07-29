import { useSyncExternalStore } from 'react'
import { setMoneyLocale } from '../core/money'
import { en } from './en'
import { gl, type Dict, type Key } from './gl'
import { es } from './es'

export type Lang = 'gl' | 'es' | 'en'

export const LANGS: Lang[] = ['gl', 'es', 'en']

const DICTS: Record<Lang, Dict> = { gl, es, en }

/** Locale de Intl para cada idioma: formato de moedas, datas e números. */
export const LOCALES: Record<Lang, string> = {
  gl: 'gl-ES',
  es: 'es-ES',
  en: 'en-GB',
}

const KEY = 'split-pay/lang'
/** Clave anterior, de cando a app se chamaba «Purchase split». */
const LEGACY_KEY = 'purchase-split/lang'

/** Galego por defecto; se o navegador está en castelán ou inglés, respéctase. */
function detect(): Lang {
  try {
    const saved = (localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)) as Lang | null
    if (saved && LANGS.includes(saved)) return saved
  } catch {
    /* almacenamento non dispoñible */
  }
  try {
    for (const nav of navigator.languages ?? [navigator.language]) {
      const code = nav.slice(0, 2).toLowerCase()
      if (code === 'gl') return 'gl'
      if (code === 'es') return 'es'
      if (code === 'en') return 'en'
    }
  } catch {
    /* sen navigator */
  }
  return 'gl'
}

let current: Lang = typeof localStorage === 'undefined' ? 'gl' : detect()
const listeners = new Set<() => void>()

setMoneyLocale(LOCALES[current])

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang) {
  current = lang
  setMoneyLocale(LOCALES[lang])
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    /* ignorámolo */
  }
  try {
    document.documentElement.lang = lang
  } catch {
    /* sen DOM */
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang)
}

export function locale(): string {
  return LOCALES[current]
}

/** Traduce unha chave, substituíndo {variables}. */
export function t(key: Key, vars?: Record<string, string | number>): string {
  const raw = DICTS[current][key] ?? DICTS.gl[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m,
  )
}

/** Singular/plural sinxelo: só o necesitamos para contas de elementos. */
export function plural(n: number, one: Key, many: Key): string {
  return n === 1 ? t(one, { n }) : t(many, { n })
}

/** Nome do mes a partir de "YYYY-MM", no idioma activo. */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, (m || 1) - 1, 1)
  const s = d.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export type { Key }
