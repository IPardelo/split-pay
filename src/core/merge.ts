import type { Activity, Entry, Group, Participant } from './types'

/**
 * GL · Fusión de dúas versións do mesmo grupo (a local e a que chega de
 *      Firebase). Non se sobrescribe o grupo enteiro: cada movemento é unha
 *      entidade independente e gaña o que teña o `updatedAt` máis recente
 *      (last-write-wins por movemento). Así dúas persoas poden engadir gastos
 *      á vez sen pisarse.
 * ES · Fusión de dos versiones del mismo grupo (la local y la que llega de
 *      Firebase). No se sobrescribe el grupo entero: cada movimiento es una
 *      entidad independiente y gana el que tenga el `updatedAt` más reciente.
 * EN · Merge of two versions of the same group (local and the one from
 *      Firebase), entry by entry, most recent `updatedAt` wins.
 */
export function mergeGroups(local: Group, remote: Group): Group {
  const remoteIsNewer = remote.updatedAt > local.updatedAt
  const newer = remoteIsNewer ? remote : local

  return {
    // A identidade local mándase soa: o id, quen son eu e o favorito son deste
    // dispositivo.
    id: local.id,
    shareToken: local.shareToken,
    meParticipantId: local.meParticipantId,
    sync: local.sync,
    favorite: local.favorite,

    // Os metadatos veñen do lado que se tocou máis tarde.
    title: newer.title,
    description: newer.description,
    baseCurrency: newer.baseCurrency,
    rates: newer.rates,
    ratesUpdatedAt: newer.ratesUpdatedAt,
    archivedAt: newer.archivedAt,
    createdAt: local.createdAt < remote.createdAt ? local.createdAt : remote.createdAt,
    updatedAt: local.updatedAt > remote.updatedAt ? local.updatedAt : remote.updatedAt,

    participants: mergeParticipants(local.participants, remote.participants, remoteIsNewer),
    entries: mergeEntries(local.entries, remote.entries),
    activities: mergeActivities(local.activities, remote.activities),
  }
}

function mergeParticipants(
  local: Participant[],
  remote: Participant[],
  preferRemote: boolean,
): Participant[] {
  const preferred = preferRemote ? remote : local
  const other = preferRemote ? local : remote

  const byId = new Map<string, Participant>()
  for (const p of other) byId.set(p.id, p)
  for (const p of preferred) byId.set(p.id, p) // o lado preferido escribe o último

  const ordered: Participant[] = []
  const seen = new Set<string>()
  for (const p of preferred) {
    ordered.push(byId.get(p.id)!)
    seen.add(p.id)
  }
  for (const p of other) {
    if (!seen.has(p.id)) {
      ordered.push(byId.get(p.id)!)
      seen.add(p.id)
    }
  }
  return ordered
}

function mergeEntries(local: Entry[], remote: Entry[]): Entry[] {
  const byId = new Map<string, Entry>()
  for (const e of local) byId.set(e.id, e)
  for (const e of remote) {
    const mine = byId.get(e.id)
    if (!mine || e.updatedAt > mine.updatedAt) byId.set(e.id, e)
  }
  return [...byId.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )
}

/** O rexistro de actividade só medra: unión por id, e tope de tamaño. */
function mergeActivities(local: Activity[], remote: Activity[], limit = 500): Activity[] {
  const byId = new Map<string, Activity>()
  for (const a of remote) byId.set(a.id, a)
  for (const a of local) byId.set(a.id, a)
  return [...byId.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

/** Dous grupos representan exactamente o mesmo estado sincronizable? */
export function sameSyncedState(a: Group, b: Group): boolean {
  return serializeForSync(a) === serializeForSync(b)
}

/**
 * Representación que viaxa a Firebase: sen os campos que son deste dispositivo
 * (o id local, o participante que son eu, o modo de sincronización e o
 * favorito).
 *
 * É JSON CANÓNICO — claves ordenadas — para que dous dispositivos que teñan o
 * mesmo contido produzan exactamente a mesma cadea. Sen iso, unha diferenza de
 * orde de claves faría que cada lado crese que o outro cambiou algo, e os dous
 * se escribirían en bucle.
 */
export function serializeForSync(group: Group): string {
  const {
    id: _id,
    meParticipantId: _me,
    sync: _sync,
    favorite: _favorite,
    ...shared
  } = group
  return canonicalJson(shared)
}

/** JSON estable: os obxectos serialízanse coas claves ordenadas. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`
}
