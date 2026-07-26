import { useSyncExternalStore } from 'react'
import { makeActivity, pushActivity } from '../core/activity'
import { buildEntry, buildTransfer, type EntryDraft } from '../core/entries'
import { defaultRatesFor } from '../core/fx'
import { nowIso, shareToken, today, uid } from '../core/ids'
import { materializeRecurrences } from '../core/recurrence'
import {
  PALETTE,
  type Activity,
  type AppState,
  type Cents,
  type Entry,
  type Group,
  type SyncMode,
  type UUID,
} from '../core/types'
import { t } from '../i18n'
import { EMPTY_STATE, STATE_VERSION, loadState, saveState } from './storage'

let state: AppState = typeof localStorage === 'undefined' ? EMPTY_STATE : loadState()
const listeners = new Set<() => void>()

function commit(next: AppState) {
  state = next
  saveState(state)
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Subscrición para módulos que non son compoñentes (p. ex. o motor de sync). */
export function subscribeStore(l: () => void): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function getState(): AppState {
  return state
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState)
}

export function useGroup(id: UUID | null): Group | undefined {
  const s = useAppState()
  return id ? s.groups.find((g) => g.id === id) : undefined
}

function patchGroup(id: UUID, fn: (g: Group) => Group) {
  commit({
    ...state,
    groups: state.groups.map((g) => (g.id === id ? { ...fn(g), updatedAt: nowIso() } : g)),
  })
}

/** Quen son eu neste grupo, para asinar o rexistro de actividade. */
function me(group: Group): UUID | null {
  return group.meParticipantId
}

/* ------------------------------- Grupos ---------------------------------- */

export function createGroup(input: {
  title: string
  description?: string
  baseCurrency: string
  participantNames: string[]
  sync?: SyncMode
}): Group {
  const participants = input.participantNames
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name, i) => ({ id: uid(), name, color: PALETTE[i % PALETTE.length], deletedAt: null }))

  const group: Group = {
    id: uid(),
    shareToken: shareToken(),
    sync: input.sync ?? 'LOCAL',
    title: input.title.trim() || '—',
    description: input.description?.trim() ?? '',
    baseCurrency: input.baseCurrency,
    participants,
    entries: [],
    activities: [],
    rates: defaultRatesFor(input.baseCurrency),
    ratesUpdatedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    archivedAt: null,
    favorite: false,
    meParticipantId: participants[0]?.id ?? null,
  }
  group.activities = [
    makeActivity('CREATE_GROUP', { participantId: group.meParticipantId, data: group.title }),
  ]
  commit({ ...state, groups: [group, ...state.groups], lastGroupId: group.id })
  return group
}

export function updateGroupMeta(
  id: UUID,
  patch: Partial<
    Pick<Group, 'title' | 'description' | 'baseCurrency' | 'meParticipantId' | 'archivedAt' | 'favorite'>
  >,
  log = false,
) {
  patchGroup(id, (g) => {
    const next = { ...g, ...patch }
    return log
      ? { ...next, activities: pushActivity(g, makeActivity('UPDATE_GROUP', { participantId: me(g), data: next.title })) }
      : next
  })
}

export function toggleFavorite(id: UUID) {
  patchGroup(id, (g) => ({ ...g, favorite: !g.favorite }))
}

export function deleteGroup(id: UUID) {
  commit({
    ...state,
    groups: state.groups.filter((g) => g.id !== id),
    lastGroupId: state.lastGroupId === id ? null : state.lastGroupId,
  })
}

export function setRate(id: UUID, currency: string, rate: number) {
  patchGroup(id, (g) => ({ ...g, rates: { ...g.rates, [currency]: rate } }))
}

/** Substitúe a táboa enteira cos tipos descargados da API. */
export function setRates(id: UUID, rates: Record<string, number>, date: string) {
  patchGroup(id, (g) => ({ ...g, rates: { ...g.rates, ...rates }, ratesUpdatedAt: date }))
}

export function importGroup(group: Group): Group {
  const exists = state.groups.some((g) => g.id === group.id)
  const incoming: Group = exists
    ? { ...group, id: uid(), shareToken: shareToken(), sync: 'LOCAL' }
    : { ...group, sync: group.sync ?? 'LOCAL' }
  commit({ ...state, groups: [incoming, ...state.groups], lastGroupId: incoming.id })
  return incoming
}

/** Cambia entre grupo local e grupo sincronizado con Firebase. */
export function setGroupSync(id: UUID, sync: SyncMode) {
  patchGroup(id, (g) => ({ ...g, sync }))
}

/**
 * Escribe unha versión do grupo que vén da fusión co servidor.
 * A diferenza das demais mutacións, NON toca `updatedAt`: a marca de tempo é
 * parte do contido que se está sincronizando.
 */
export function applyRemoteGroup(group: Group) {
  commit({ ...state, groups: state.groups.map((g) => (g.id === group.id ? group : g)) })
}

export function replaceState(next: AppState) {
  commit({ ...next, version: STATE_VERSION })
}

export function setLastGroup(id: UUID | null) {
  commit({ ...state, lastGroupId: id })
}

/* --------------------------- Participantes ------------------------------- */

export function addParticipant(groupId: UUID, name: string) {
  patchGroup(groupId, (g) => {
    const participant = {
      id: uid(),
      name: name.trim() || `#${g.participants.length + 1}`,
      color: PALETTE[g.participants.length % PALETTE.length],
      deletedAt: null,
    }
    return {
      ...g,
      participants: [...g.participants, participant],
      activities: pushActivity(g, makeActivity('ADD_PARTICIPANT', { participantId: me(g), data: participant.name })),
    }
  })
}

export function renameParticipant(groupId: UUID, participantId: UUID, name: string) {
  patchGroup(groupId, (g) => ({
    ...g,
    participants: g.participants.map((p) => (p.id === participantId ? { ...p, name } : p)),
  }))
}

/** Borrado físico só se non ten movementos; se os ten, desactívase. */
export function removeParticipant(groupId: UUID, participantId: UUID, hard: boolean) {
  patchGroup(groupId, (g) => {
    const gone = g.participants.find((p) => p.id === participantId)
    return {
      ...g,
      participants: hard
        ? g.participants.filter((p) => p.id !== participantId)
        : g.participants.map((p) => (p.id === participantId ? { ...p, deletedAt: nowIso() } : p)),
      meParticipantId: g.meParticipantId === participantId ? null : g.meParticipantId,
      activities: pushActivity(
        g,
        makeActivity('REMOVE_PARTICIPANT', { participantId: me(g), data: gone?.name ?? '' }),
      ),
    }
  })
}

export function restoreParticipant(groupId: UUID, participantId: UUID) {
  patchGroup(groupId, (g) => ({
    ...g,
    participants: g.participants.map((p) => (p.id === participantId ? { ...p, deletedAt: null } : p)),
  }))
}

/* ----------------------------- Movementos -------------------------------- */

export function addEntry(groupId: UUID, draft: EntryDraft): Entry | null {
  const group = state.groups.find((g) => g.id === groupId)
  if (!group) return null
  const entry = buildEntry(group, draft)
  patchGroup(groupId, (g) => ({
    ...g,
    entries: [entry, ...g.entries],
    activities: pushActivity(
      g,
      makeActivity('CREATE_ENTRY', { participantId: me(g), entryId: entry.id, data: entry.title }),
    ),
  }))
  return entry
}

export function updateEntry(groupId: UUID, entryId: UUID, draft: EntryDraft): Entry | null {
  const group = state.groups.find((g) => g.id === groupId)
  const previous = group?.entries.find((e) => e.id === entryId)
  if (!group || !previous) return null
  const entry = buildEntry(group, { ...draft, id: entryId }, previous)
  patchGroup(groupId, (g) => ({
    ...g,
    entries: g.entries.map((e) => (e.id === entryId ? entry : e)),
    activities: pushActivity(
      g,
      makeActivity('UPDATE_ENTRY', { participantId: me(g), entryId, data: entry.title }),
    ),
  }))
  return entry
}

/** Soft delete: o movemento segue no historial, pero deixa de contar. */
export function deleteEntry(groupId: UUID, entryId: UUID) {
  patchGroup(groupId, (g) => {
    const gone = g.entries.find((e) => e.id === entryId)
    return {
      ...g,
      entries: g.entries.map((e) => (e.id === entryId ? { ...e, deletedAt: nowIso(), updatedAt: nowIso() } : e)),
      activities: pushActivity(
        g,
        makeActivity('DELETE_ENTRY', { participantId: me(g), entryId, data: gone?.title ?? '' }),
      ),
    }
  })
}

export function restoreEntry(groupId: UUID, entryId: UUID) {
  patchGroup(groupId, (g) => {
    const back = g.entries.find((e) => e.id === entryId)
    return {
      ...g,
      entries: g.entries.map((e) => (e.id === entryId ? { ...e, deletedAt: null, updatedAt: nowIso() } : e)),
      activities: pushActivity(
        g,
        makeActivity('RESTORE_ENTRY', { participantId: me(g), entryId, data: back?.title ?? '' }),
      ),
    }
  })
}

export function purgeDeleted(groupId: UUID) {
  patchGroup(groupId, (g) => ({ ...g, entries: g.entries.filter((e) => !e.deletedAt) }))
}

export function registerSettlement(groupId: UUID, from: UUID, to: UUID, amount: Cents) {
  const group = state.groups.find((g) => g.id === groupId)
  if (!group) return
  const entry = buildTransfer(group, from, to, amount, today(), t('type.TRANSFER'))
  patchGroup(groupId, (g) => ({
    ...g,
    entries: [entry, ...g.entries],
    activities: pushActivity(
      g,
      makeActivity('SETTLE', { participantId: me(g), entryId: entry.id, data: entry.title }),
    ),
  }))
}

/* ---------------------------- Recorrencias ------------------------------- */

/**
 * Xera as repeticións vencidas dun grupo. Chámase ao abrir a app e ao abrir o
 * grupo; se non hai nada pendente non toca o estado (e así non dispara unha
 * escritura de sincronización sen motivo).
 */
export function runRecurrences(groupId: UUID, day = today()): number {
  const group = state.groups.find((g) => g.id === groupId)
  if (!group) return 0
  const { entries, created } = materializeRecurrences(group.entries, day)
  if (created.length === 0) return 0

  const activities: Activity[] = created.map((e) =>
    makeActivity('RECURRING', { participantId: group.meParticipantId, entryId: e.id, data: e.title }),
  )
  patchGroup(groupId, (g) => ({
    ...g,
    entries,
    activities: [...activities, ...g.activities].slice(0, 500),
  }))
  return created.length
}

export function runAllRecurrences(day = today()): number {
  let total = 0
  for (const g of [...state.groups]) total += runRecurrences(g.id, day)
  return total
}
