import type { AppState, Entry, Group } from '../core/types'

const KEY = 'split-pay/v1'
/** Clave anterior, de cando a app se chamaba «Purchase split». */
const LEGACY_KEY = 'purchase-split/v1'
export const STATE_VERSION = 2

export const EMPTY_STATE: AppState = {
  version: STATE_VERSION,
  groups: [],
  lastGroupId: null,
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return EMPTY_STATE
    const parsed = JSON.parse(raw) as AppState
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.groups)) return EMPTY_STATE
    return migrate(parsed)
  } catch {
    return EMPTY_STATE
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (err) {
    // Cota chea ou modo privado: non rompemos a sesión en curso.
    console.warn('could not persist state', err)
  }
}

/**
 * Punto único das migracións. Todas son tolerantes: un estado gardado por unha
 * versión anterior ábrese sen perder nada, e os campos novos toman o valor que
 * tiñan implicitamente.
 */
function migrate(state: AppState): AppState {
  return {
    ...state,
    version: STATE_VERSION,
    groups: (state.groups ?? []).map(migrateGroup),
  }
}

function migrateGroup(g: Group): Group {
  return {
    ...g,
    sync: g.sync ?? 'LOCAL',
    description: g.description ?? '',
    activities: g.activities ?? [],
    favorite: g.favorite ?? false,
    ratesUpdatedAt: g.ratesUpdatedAt ?? null,
    entries: (g.entries ?? []).map(migrateEntry),
  }
}

function migrateEntry(e: Entry): Entry {
  return {
    ...e,
    documents: e.documents ?? [],
    recurrence: e.recurrence ?? 'NONE',
    recurrenceNextAt: e.recurrenceNextAt ?? null,
    recurrenceParentId: e.recurrenceParentId ?? null,
  }
}

export function exportBackup(state: AppState): string {
  return JSON.stringify(state, null, 2)
}
