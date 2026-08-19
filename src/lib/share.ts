import { PUBLIC_URL, QR_MAX_CHARS, hasPublicUrl, isPrivateOrigin } from '../config/app'
import type { Group } from '../core/types'

/**
 * Códec de compartición: un grupo entero cabe en una URL.
 * Comprime con gzip (CompressionStream, nativo del navegador) y codifica en
 * base64url. Sin servidor, sin dependencias.
 *
 * Es una *capability URL*: quien tiene el enlace, tiene los datos.
 */

const GZIP = 'g1.'
const RAW = 'r1.'

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Uint8Array<ArrayBufferLike> no encaja con BlobPart en el lib de TS 5.7+. */
function blobOf(bytes: Uint8Array): Blob {
  return new Blob([bytes as unknown as BlobPart])
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip')
  const stream = blobOf(bytes).stream().pipeThrough(cs)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip')
  const stream = blobOf(bytes).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function encodeGroup(group: Group): Promise<string> {
  const json = JSON.stringify(group)
  const bytes = new TextEncoder().encode(json)
  if (typeof CompressionStream === 'undefined') return RAW + bytesToBase64Url(bytes)
  try {
    return GZIP + bytesToBase64Url(await gzip(bytes))
  } catch {
    return RAW + bytesToBase64Url(bytes)
  }
}

export async function decodeGroup(payload: string): Promise<Group> {
  const trimmed = payload.trim()
  let bytes: Uint8Array
  if (trimmed.startsWith(GZIP)) {
    bytes = await gunzip(base64UrlToBytes(trimmed.slice(GZIP.length)))
  } else if (trimmed.startsWith(RAW)) {
    bytes = base64UrlToBytes(trimmed.slice(RAW.length))
  } else {
    throw new Error('Formato de enlace no reconocido')
  }
  const group = JSON.parse(new TextDecoder().decode(bytes)) as Group
  if (!group?.id || !Array.isArray(group.participants) || !Array.isArray(group.entries)) {
    throw new Error('El enlace no contiene un grupo válido')
  }
  return group
}

/**
 * A que enderezo apuntan as ligazóns que xeramos.
 * Se non hai enderezo público e estamos dentro do APK, non hai a onde apuntar:
 * daquela compártese un código en vez dunha ligazón.
 */
function appBase(): string | null {
  if (hasPublicUrl()) return PUBLIC_URL.endsWith('/') ? PUBLIC_URL : `${PUBLIC_URL}/`
  if (isPrivateOrigin()) return null
  return location.origin + location.pathname
}

export interface ShareTarget {
  /** 'link' = unha URL que se abre soa · 'code' = un texto que se pega. */
  kind: 'link' | 'code'
  /** O que se copia ou se envía. */
  value: string
  /** O que vai dentro do QR, ou null se non cabe. */
  qr: string | null
}

/**
 * Que compartimos deste grupo.
 *
 *  · Grupo EN LIÑA: abonda co token, que é curto e sempre entra nun QR.
 *  · Grupo LOCAL: vai o grupo enteiro comprimido. Entra no QR só se é pequeno.
 */
export async function shareTargetFor(group: Group): Promise<ShareTarget> {
  const base = appBase()

  if (group.sync === 'ONLINE') {
    const value = base ? `${base}#/t/${group.shareToken}` : group.shareToken
    return { kind: base ? 'link' : 'code', value, qr: value }
  }

  const payload = await encodeGroup(group)
  const value = base ? `${base}#/join/${payload}` : payload
  return {
    kind: base ? 'link' : 'code',
    value,
    qr: value.length <= QR_MAX_CHARS ? value : null,
  }
}

/** Compatibilidade: a ligazón longa, cando hai a onde apuntar. */
export async function shareUrlFor(group: Group): Promise<string | null> {
  const target = await shareTargetFor(group)
  return target.kind === 'link' ? target.value : null
}

export function tokenFromText(text: string): string | null {
  const m = text.match(/#\/t\/([A-Za-z0-9_-]{8,})/)
  if (m) return m[1]
  const t = text.trim()
  return /^[A-Za-z0-9_-]{16,40}$/.test(t) ? t : null
}

/** Extrae el payload de una URL o de un texto pegado por el usuario. */
export function payloadFromText(text: string): string | null {
  const m = text.match(/#\/join\/([A-Za-z0-9_.-]+)/)
  if (m) return m[1]
  const t = text.trim()
  if (t.startsWith(GZIP) || t.startsWith(RAW)) return t
  return null
}
