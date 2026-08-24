import { FIRESTORE_COLLECTION } from '../config/firebase'
import type { Group } from '../core/types'
import { firebaseSettings, isFirebaseConfigured } from '../store/settings'
import { getFirebaseApp } from './app'

/**
 * GL · Adaptador de Firestore. O SDK cárgase de xeito perezoso: se non hai
 *      configuración, este módulo non importa nada e a app funciona igual,
 *      100% local.
 * ES · Adaptador de Firestore. El SDK se carga de forma perezosa: si no hay
 *      configuración, este módulo no importa nada y la app funciona igual.
 * EN · Firestore adapter. The SDK is lazy-loaded: with no configuration this
 *      module imports nothing and the app still works, fully local.
 *
 * O documento gárdase como unha soa cadea JSON (`payload`) porque Firestore
 * non admite arrays aniñados, e un movemento leva `payers[]` e `shares[]`
 * dentro de `entries[]`.
 */

export interface RemoteDoc {
  payload: string
  updatedAt: string
}

interface FirestoreApi {
  doc: (db: any, path: string, id: string) => any
  onSnapshot: (ref: any, next: (snap: any) => void, error: (e: unknown) => void) => () => void
  setDoc: (ref: any, data: unknown) => Promise<void>
  getDoc: (ref: any) => Promise<any>
}

let cached: { key: string; db: unknown; api: FirestoreApi } | null = null

async function firestore(): Promise<{ db: any; api: FirestoreApi }> {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured')
  const key = JSON.stringify(firebaseSettings())
  if (cached?.key === key) return { db: cached.db, api: cached.api }

  const app = await getFirebaseApp()
  const mod: any = await import('firebase/firestore')
  const api: FirestoreApi = {
    doc: mod.doc,
    onSnapshot: mod.onSnapshot,
    setDoc: mod.setDoc,
    getDoc: mod.getDoc,
  }
  const db = mod.getFirestore(app)
  cached = { key, db, api }
  return { db, api }
}

/** Escribe (ou reescribe) o grupo enteiro no documento do seu token. */
export async function pushGroup(token: string, payload: string, updatedAt: string): Promise<void> {
  const { db, api } = await firestore()
  await api.setDoc(api.doc(db, FIRESTORE_COLLECTION, token), { payload, updatedAt })
}

/** Lectura puntual, para comprobar se o grupo xa existe no servidor. */
export async function fetchGroup(token: string): Promise<RemoteDoc | null> {
  const { db, api } = await firestore()
  const snap = await api.getDoc(api.doc(db, FIRESTORE_COLLECTION, token))
  if (!snap?.exists?.()) return null
  const data = snap.data()
  if (!data?.payload) return null
  return { payload: String(data.payload), updatedAt: String(data.updatedAt ?? '') }
}

/**
 * Subscrición en tempo real. Devolve a función para cancelala.
 * `onError` recibe tanto os fallos de rede como o de carga do SDK.
 */
export async function subscribeGroup(
  token: string,
  onDoc: (doc: RemoteDoc | null) => void,
  onError: (err: unknown) => void,
): Promise<() => void> {
  const { db, api } = await firestore()
  return api.onSnapshot(
    api.doc(db, FIRESTORE_COLLECTION, token),
    (snap: any) => {
      if (!snap?.exists?.()) {
        onDoc(null)
        return
      }
      const data = snap.data()
      if (!data?.payload) {
        onDoc(null)
        return
      }
      onDoc({ payload: String(data.payload), updatedAt: String(data.updatedAt ?? '') })
    },
    onError,
  )
}

/** Reconstrúe un grupo a partir do payload remoto. Lanza se está corrompido. */
export function parsePayload(
  payload: string,
): Omit<Group, 'id' | 'meParticipantId' | 'sync' | 'favorite'> {
  const parsed = JSON.parse(payload)
  if (!parsed || !Array.isArray(parsed.participants) || !Array.isArray(parsed.entries)) {
    throw new Error('invalid remote payload')
  }
  return parsed
}
