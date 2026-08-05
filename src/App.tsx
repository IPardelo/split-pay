import { useEffect, useState } from 'react'

import { uid } from './core/ids'
import { plural, t, useLang } from './i18n'
import { startBackButton } from './lib/back'
import { decodeGroup } from './lib/share'
import { importGroup, runAllRecurrences, useAppState } from './store/store'
import { isFirebaseConfigured, subscribeSettings } from './store/settings'
import { startSyncEngine } from './sync/engine'
import { fetchGroup, parsePayload } from './sync/firebase'
import GroupScreen from './ui/GroupScreen'
import Home from './ui/Home'
import { ToastHost, toast } from './ui/kit'

type Route =
  | { name: 'home' }
  | { name: 'group'; id: string }
  | { name: 'join'; payload: string }
  | { name: 'token'; token: string }

function parseHash(): Route {
  const h = location.hash.replace(/^#/, '')
  const join = h.match(/^\/join\/(.+)$/)
  if (join) return { name: 'join', payload: join[1] }
  const token = h.match(/^\/t\/([A-Za-z0-9_-]+)$/)
  if (token) return { name: 'token', token: token[1] }
  const group = h.match(/^\/g\/([^/]+)$/)
  if (group) return { name: 'group', id: group[1] }
  return { name: 'home' }
}

export function navigate(to: string) {
  location.hash = to
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash)
  const state = useAppState()
  const lang = useLang()
  const [offline, setOffline] = useState(() =>
    typeof navigator === 'undefined' ? false : !navigator.onLine,
  )

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Se se configura Firebase desde os axustes, o motor arranca sen reiniciar.
  useEffect(() => subscribeSettings(() => startSyncEngine()), [])

  useEffect(() => {
    startSyncEngine()
    const created = runAllRecurrences()
    if (created > 0) toast(plural(created, 'rec.generated.one', 'rec.generated.many'))
  }, [])

  // Botón atrás de Android: pecha o que estea aberto, logo volve á portada, e
  // só sae da app cando xa non hai a onde volver.
  useEffect(() => startBackButton(), [])

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Ligazón longa: o grupo vén dentro da URL.
  useEffect(() => {
    if (route.name !== 'join') return
    let cancelled = false
    decodeGroup(route.payload)
      .then((group) => {
        if (cancelled) return
        const existing = state.groups.find((g) => g.shareToken === group.shareToken)
        const target = existing ?? importGroup(group)
        toast(existing ? t('join.already') : t('join.imported', { title: group.title }))
        navigate(`/g/${target.id}`)
      })
      .catch(() => {
        if (cancelled) return
        toast(t('join.invalid'))
        navigate('/')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route])

  // Ligazón curta: só o token, e o grupo baixa de Firebase.
  useEffect(() => {
    if (route.name !== 'token') return
    let cancelled = false

    const existing = state.groups.find((g) => g.shareToken === route.token)
    if (existing) {
      navigate(`/g/${existing.id}`)
      return
    }
    if (!isFirebaseConfigured()) {
      toast(t('join.needsFirebase'))
      navigate('/')
      return
    }

    fetchGroup(route.token)
      .then((doc) => {
        if (cancelled) return
        if (!doc) {
          toast(t('join.notFound'))
          navigate('/')
          return
        }
        const shared = parsePayload(doc.payload)
        const imported = importGroup({
          ...shared,
          id: uid(),
          meParticipantId: null,
          sync: 'ONLINE',
          favorite: false,
        })
        toast(t('join.imported', { title: imported.title }))
        navigate(`/g/${imported.id}`)
      })
      .catch(() => {
        if (cancelled) return
        toast(t('join.notFound'))
        navigate('/')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route])

  return (
    <div className="app">
      {offline && <div className="banner">{t('pwa.offline')}</div>}

      {route.name === 'group' ? (
        <GroupScreen id={route.id} />
      ) : route.name === 'join' ? (
        <div className="content">
          <p className="muted center">{t('join.importing')}</p>
        </div>
      ) : route.name === 'token' ? (
        <div className="content">
          <p className="muted center">{t('join.fetching')}</p>
        </div>
      ) : (
        <Home />
      )}
      <ToastHost />
    </div>
  )
}
