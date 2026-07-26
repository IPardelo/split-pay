import { useSyncExternalStore } from 'react'
import { firebaseConfig as firebaseDefaults, type FirebaseConfig } from '../config/firebase'
import { aiConfig as aiDefaults, type AiConfig } from '../config/openai'
import type { SettleMode } from '../core/types'

/**
 * GL · Axustes do dispositivo: credenciais de Firebase e da IA.
 *      Os ficheiros de `src/config/` seguen valendo como valores por defecto
 *      (útiles se compilas ti a app), pero o que se escriba na pantalla de
 *      axustes mándalles por riba e gárdase neste teléfono.
 * ES · Ajustes del dispositivo: credenciales de Firebase y de la IA.
 *      Los archivos de `src/config/` siguen valiendo como valores por defecto,
 *      pero lo que se escriba en la pantalla de ajustes manda sobre ellos y se
 *      guarda en este teléfono.
 * EN · Device settings: Firebase and AI credentials.
 *      The files in `src/config/` still act as defaults, but whatever is typed
 *      in the settings screen overrides them and is stored on this phone.
 */

const KEY = 'split-pay/settings'
/** Clave anterior, de cando a app se chamaba «Purchase split». */
const LEGACY_KEY = 'purchase-split/settings'

export interface Settings {
  firebase: FirebaseConfig
  ai: AiConfig
  /** Como se propoñen os pagos na pestana de saldos: bote ou festa. */
  settleMode: SettleMode
}

function defaults(): Settings {
  return { firebase: { ...firebaseDefaults }, ai: { ...aiDefaults }, settleMode: 'POOL' }
}

function load(): Settings {
  const base = defaults()
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<Settings>
    return {
      firebase: { ...base.firebase, ...(saved.firebase ?? {}) },
      ai: { ...base.ai, ...(saved.ai ?? {}) },
      settleMode: saved.settleMode === 'PARTY' ? 'PARTY' : base.settleMode,
    }
  } catch {
    return base
  }
}

let settings: Settings = typeof localStorage === 'undefined' ? defaults() : load()
const listeners = new Set<() => void>()

function commit(next: Settings) {
  settings = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* cota chea ou modo privado */
  }
  listeners.forEach((l) => l())
}

export function subscribeSettings(l: () => void): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function getSettings(): Settings {
  return settings
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings)
}

export function firebaseSettings(): FirebaseConfig {
  return settings.firebase
}

export function aiSettings(): AiConfig {
  return settings.ai
}

export function settleMode(): SettleMode {
  return settings.settleMode
}

export function setSettleMode(mode: SettleMode) {
  if (mode === settings.settleMode) return
  commit({ ...settings, settleMode: mode })
}

/** Garda os campos que se cambiaron, xa recortados de espazos. */
export function updateFirebase(patch: Partial<FirebaseConfig>) {
  const clean = Object.fromEntries(
    Object.entries(patch).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
  ) as Partial<FirebaseConfig>
  commit({ ...settings, firebase: { ...settings.firebase, ...clean } })
}

export function updateAi(patch: Partial<AiConfig>) {
  const clean = Object.fromEntries(
    Object.entries(patch).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
  ) as Partial<AiConfig>
  commit({ ...settings, ai: { ...settings.ai, ...clean } })
}

export function clearFirebase() {
  commit({
    ...settings,
    firebase: { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' },
  })
}

export function clearAi() {
  commit({ ...settings, ai: { ...settings.ai, apiKey: '' } })
}

/* ------------------------- de que hai e de que non ------------------------ */

export function isFirebaseConfigured(): boolean {
  const f = settings.firebase
  return (
    f.apiKey.trim().length > 0 && f.projectId.trim().length > 0 && f.appId.trim().length > 0
  )
}

/** As fotos van á nube só se, ademais, hai bucket de Storage. */
export function isRemoteStorageConfigured(): boolean {
  return isFirebaseConfigured() && settings.firebase.storageBucket.trim().length > 0
}

export function isAiConfigured(): boolean {
  return settings.ai.apiKey.trim().length > 0 && settings.ai.baseUrl.trim().length > 0
}
