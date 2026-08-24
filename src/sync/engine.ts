import { useSyncExternalStore } from 'react'
import { mergeGroups, serializeForSync } from '../core/merge'
import type { Group, UUID } from '../core/types'
import { applyRemoteGroup, getState, subscribeStore } from '../store/store'
import { fetchGroup, parsePayload, pushGroup, subscribeGroup } from './firebase'
import { isFirebaseConfigured } from '../store/settings'

export type SyncStatus = 'off' | 'connecting' | 'live' | 'error'

export interface SyncState {
  status: SyncStatus
  lastSync: string | null
}

/* ------------------------- estado observable da UI ------------------------ */

let statuses: Record<UUID, SyncState> = {}
const statusListeners = new Set<() => void>()

function setStatus(groupId: UUID, status: SyncStatus, lastSync?: string) {
  const prev = statuses[groupId]
  const next: SyncState = { status, lastSync: lastSync ?? prev?.lastSync ?? null }
  if (prev && prev.status === next.status && prev.lastSync === next.lastSync) return
  statuses = { ...statuses, [groupId]: next }
  statusListeners.forEach((l) => l())
}

function subscribeStatus(l: () => void) {
  statusListeners.add(l)
  return () => statusListeners.delete(l)
}

function getStatuses() {
  return statuses
}

export function useSyncStatus(groupId: UUID | null): SyncState {
  const all = useSyncExternalStore(subscribeStatus, getStatuses, getStatuses)
  return (groupId && all[groupId]) || { status: 'off', lastSync: null }
}

/* ----------------------------- conexións vivas ---------------------------- */

interface Conn {
  token: string
  unsub: (() => void) | null
  closed: boolean
  /** Último contido que sabemos que hai no servidor, en JSON canónico. */
  lastRemote: string | null
  /** Último contido que enviamos, para non reenviar o mesmo. */
  lastPushed: string | null
  timer: ReturnType<typeof setTimeout> | null
}

const conns = new Map<UUID, Conn>()
let started = false

let storeUnsub: (() => void) | null = null

/** Arranca o motor. Non fai nada mentres non haxa Firebase configurado. */
export function startSyncEngine() {
  if (started || !isFirebaseConfigured()) return
  started = true
  storeUnsub = subscribeStore(reconcile)
  reconcile()
}

/**
 * Pecha todo e volve arrancar. Chámase ao gardar credenciais novas: as
 * conexións vivas apuntan á configuración vella e hai que refacelas.
 */
export function resetSyncEngine() {
  for (const [id, conn] of conns) {
    conn.closed = true
    conn.unsub?.()
    if (conn.timer) clearTimeout(conn.timer)
    conns.delete(id)
    setStatus(id, 'off')
  }
  storeUnsub?.()
  storeUnsub = null
  started = false
  startSyncEngine()
}

function reconcile() {
  const groups = getState().groups
  const online = new Map(groups.filter((g) => g.sync === 'ONLINE').map((g) => [g.id, g]))

  // Pechar as conexións que xa non tocan.
  for (const [id, conn] of conns) {
    if (!online.has(id)) {
      conn.closed = true
      conn.unsub?.()
      if (conn.timer) clearTimeout(conn.timer)
      conns.delete(id)
      setStatus(id, 'off')
    }
  }

  for (const group of online.values()) open(group)
}

function open(group: Group) {
  let conn = conns.get(group.id)
  if (!conn) {
    conn = { token: group.shareToken, unsub: null, closed: false, lastRemote: null, lastPushed: null, timer: null }
    conns.set(group.id, conn)
    setStatus(group.id, 'connecting')

    subscribeGroup(
      group.shareToken,
      (doc) => onRemote(group.id, doc),
      () => setStatus(group.id, 'error'),
    )
      .then((unsub) => {
        const c = conns.get(group.id)
        if (!c || c.closed) {
          unsub()
          return
        }
        c.unsub = unsub
        setStatus(group.id, 'live')
      })
      .catch(() => setStatus(group.id, 'error'))
  }
  schedulePush(group.id)
}

function onRemote(groupId: UUID, doc: { payload: string } | null) {
  const conn = conns.get(groupId)
  const local = getState().groups.find((g) => g.id === groupId)
  if (!conn || !local) return

  if (!doc) {
    // Aínda non existe no servidor: subimos o que temos.
    conn.lastRemote = null
    schedulePush(groupId, 0)
    return
  }

  let remote: Group
  try {
    remote = {
      ...parsePayload(doc.payload),
      id: local.id,
      meParticipantId: local.meParticipantId,
      sync: 'ONLINE',
      favorite: local.favorite,
    }
  } catch {
    setStatus(groupId, 'error')
    return
  }

  conn.lastRemote = serializeForSync(remote)

  const merged = mergeGroups(local, remote)
  if (serializeForSync(merged) !== serializeForSync(local)) {
    applyRemoteGroup(merged)
  }
  setStatus(groupId, 'live', new Date().toISOString())
  schedulePush(groupId)
}

/** Envía o grupo se difire do que hai arriba. Agrupa rajadas de cambios. */
function schedulePush(groupId: UUID, delay = 700) {
  const conn = conns.get(groupId)
  if (!conn) return
  if (conn.timer) clearTimeout(conn.timer)
  conn.timer = setTimeout(() => {
    conn.timer = null
    const group = getState().groups.find((g) => g.id === groupId)
    if (!group || group.sync !== 'ONLINE') return
    const payload = serializeForSync(group)
    if (payload === conn.lastRemote || payload === conn.lastPushed) return
    conn.lastPushed = payload
    pushGroup(group.shareToken, payload, group.updatedAt)
      .then(() => setStatus(groupId, 'live', new Date().toISOString()))
      .catch(() => {
        conn.lastPushed = null
        setStatus(groupId, 'error')
      })
  }, delay)
}

/**
 * Antes de pasar un grupo a en liña: se xa existe no servidor (porque outra
 * persoa o creou co mesmo token), fusionamos en vez de pisalo.
 */
export async function claimRemote(group: Group): Promise<Group> {
  const doc = await fetchGroup(group.shareToken)
  if (!doc) return group
  const remote: Group = {
    ...parsePayload(doc.payload),
    id: group.id,
    meParticipantId: group.meParticipantId,
    sync: 'ONLINE',
    favorite: group.favorite,
  }
  return mergeGroups(group, remote)
}
