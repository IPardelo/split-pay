import { nowIso, uid } from '../core/ids'
import type { Attachment } from '../core/types'
import { isRemoteStorageConfigured } from '../store/settings'
import { getFirebaseApp } from '../sync/app'

/**
 * Fotos dos gastos.
 *
 * Dous almacéns, e escóllese só:
 *  · Firebase Storage, se `storageBucket` está configurado. A foto ten URL e
 *    véna todo o grupo.
 *  · IndexedDB deste dispositivo, se non. A foto queda aquí, non viaxa na
 *    ligazón nin na sincronización, e a URL gárdase como `idb:<id>`.
 *
 * As imaxes redimensiónanse antes de gardalas: un ticket lexible non precisa
 * 12 megapíxeles, e o IndexedDB agradéceo.
 */

const DB_NAME = 'split-pay-attachments'
const STORE = 'files'
const MAX_SIDE = 1600
const JPEG_QUALITY = 0.82

/* ------------------------------- IndexedDB ------------------------------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(id: string, blob: Blob): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function idbGet(id: string): Promise<Blob | null> {
  const db = await openDb()
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as Blob) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return blob
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/* ------------------------------ redimensionar ---------------------------- */

export interface PreparedImage {
  blob: Blob
  width: number
  height: number
  dataUrl: string
}

/** Le, xira se fai falta e reduce a imaxe a un tamaño razoable. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new Error('could not encode image')

  return { blob, width, height, dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY) }
}

/* -------------------------------- gardar --------------------------------- */

export async function saveAttachment(file: File): Promise<Attachment> {
  const prepared = await prepareImage(file)
  const id = uid()

  let url: string
  if (isRemoteStorageConfigured()) {
    url = await uploadToStorage(id, prepared.blob)
  } else {
    await idbPut(id, prepared.blob)
    url = `idb:${id}`
  }

  return {
    id,
    url,
    name: file.name || 'foto.jpg',
    mime: 'image/jpeg',
    width: prepared.width,
    height: prepared.height,
    size: prepared.blob.size,
    createdAt: nowIso(),
  }
}

async function uploadToStorage(id: string, blob: Blob): Promise<string> {
  const app = await getFirebaseApp()
  const storageMod: any = await import('firebase/storage')
  const storage = storageMod.getStorage(app)
  const ref = storageMod.ref(storage, `split-pay/${id}.jpg`)
  await storageMod.uploadBytes(ref, blob, { contentType: 'image/jpeg' })
  return await storageMod.getDownloadURL(ref)
}

export async function deleteAttachment(att: Attachment): Promise<void> {
  if (att.url.startsWith('idb:')) {
    await idbDelete(att.url.slice(4)).catch(() => {})
    revokeUrl(att)
    return
  }
  if (!isRemoteStorageConfigured()) return
  try {
    const app = await getFirebaseApp()
    const storageMod: any = await import('firebase/storage')
    const ref = storageMod.ref(storageMod.getStorage(app), `split-pay/${att.id}.jpg`)
    await storageMod.deleteObject(ref)
  } catch {
    // Se xa non está, tanto ten.
  }
}

/* -------------------------------- amosar --------------------------------- */

const objectUrls = new Map<string, string>()

/** Devolve unha URL que pode ir nun <img src>. */
export async function resolveUrl(att: Attachment): Promise<string | null> {
  if (!att.url.startsWith('idb:')) return att.url
  const cached = objectUrls.get(att.id)
  if (cached) return cached
  const blob = await idbGet(att.url.slice(4))
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  objectUrls.set(att.id, url)
  return url
}

export function revokeUrl(att: Attachment) {
  const url = objectUrls.get(att.id)
  if (url) {
    URL.revokeObjectURL(url)
    objectUrls.delete(att.id)
  }
}

/** ¿Esta foto só existe neste dispositivo? Serve para avisar ao usuario. */
export function isLocalOnly(att: Attachment): boolean {
  return att.url.startsWith('idb:')
}
