import { nowIso, uid } from './ids'
import type { Activity, ActivityType, Group, UUID } from './types'

/** Rexistro de actividade do grupo: quen fixo que e cando. */
export function makeActivity(
  type: ActivityType,
  opts: { participantId?: UUID | null; entryId?: UUID | null; data?: string } = {},
): Activity {
  return {
    id: uid(),
    at: nowIso(),
    type,
    participantId: opts.participantId ?? null,
    entryId: opts.entryId ?? null,
    data: opts.data ?? '',
  }
}

/** Engade unha entrada ao rexistro, mantendo un tope razoable de tamaño. */
export function pushActivity(group: Group, activity: Activity, limit = 500): Activity[] {
  return [activity, ...group.activities].slice(0, limit)
}

export function sortedActivities(group: Group): Activity[] {
  return [...group.activities].sort((a, b) => b.at.localeCompare(a.at))
}
