import { useMemo } from 'react'
import { sortedActivities } from '../core/activity'
import { participantById } from '../core/balances'
import type { Activity, Group } from '../core/types'
import { locale, t, useLang, type Key } from '../i18n'
import { Avatar, Empty } from './kit'

const ICONS: Record<Activity['type'], string> = {
  CREATE_GROUP: '👥',
  UPDATE_GROUP: '⚙️',
  CREATE_ENTRY: '➕',
  UPDATE_ENTRY: '✏️',
  DELETE_ENTRY: '🗑',
  RESTORE_ENTRY: '↺',
  ADD_PARTICIPANT: '🙋',
  REMOVE_PARTICIPANT: '👋',
  SETTLE: '🤝',
  RECURRING: '🔁',
}

export default function ActivityTab({ group }: { group: Group }) {
  useLang()
  const items = useMemo(() => sortedActivities(group), [group])

  if (items.length === 0) {
    return <Empty icon="🗒️" title={t('activity.empty.title')} hint={t('activity.empty.hint')} />
  }

  const byDay = new Map<string, Activity[]>()
  for (const a of items) {
    const day = a.at.slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(a)
  }

  return (
    <>
      {[...byDay.entries()].map(([day, list]) => (
        <div className="card" key={day}>
          <div className="card-title">{formatDay(day)}</div>
          {list.map((a) => {
            const who = a.participantId ? participantById(group, a.participantId) : undefined
            return (
              <div className="row static" key={a.id}>
                <span className="cat-icon">{ICONS[a.type] ?? '•'}</span>
                <span className="grow">
                  <div className="title" style={{ whiteSpace: 'normal' }}>
                    {t(`act.${a.type}` as Key, {
                      who: who?.name ?? t('act.someone'),
                      what: a.data,
                    })}
                  </div>
                  <div className="sub">{formatTime(a.at)}</div>
                </span>
                {who && <Avatar p={who} size="sm" />}
              </div>
            )
          })}
        </div>
      ))}
    </>
  )
}

function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const s = date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso.slice(11, 16)
  }
}
