import { firebaseSettings } from '../store/settings'

/**
 * A instancia de Firebase, compartida entre a sincronización e as fotos.
 *
 * Cárgase de xeito perezoso (sen configuración non se importa nada) e
 * recréase soa se cambian as credenciais na pantalla de axustes: cada
 * configuración ten o seu propio nome de app, así que non chocan entre elas.
 */

let cached: { key: string; app: unknown } | null = null

function nameFor(key: string): string {
  let h = 5381
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0
  return `split-pay-${(h >>> 0).toString(36)}`
}

export async function getFirebaseApp(): Promise<any> {
  const config = firebaseSettings()
  const key = JSON.stringify(config)
  if (cached?.key === key) return cached.app

  const mod: any = await import('firebase/app')
  const name = nameFor(key)
  const existing = mod.getApps().find((a: any) => a.name === name)
  const app = existing ?? mod.initializeApp(config, name)
  cached = { key, app }
  return app
}
