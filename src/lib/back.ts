import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/**
 * GL · Que fai o botón atrás do móbil.
 *
 * Capacitor, en canto rexistras un listener de `backButton`, desactiva o seu
 * comportamento por defecto (que era saír da app). A partir de aí decidimos
 * nós, e a orde é sempre a mesma:
 *
 *   1. Pechar o que estea aberto por riba: a folla do editor, os axustes, o QR…
 *      Se hai varias abertas, péchase a de máis arriba.
 *   2. Se non hai nada aberto e estamos dentro dun grupo, volver á portada.
 *   3. Se xa estamos na portada, saír da app.
 *
 * A pila é de manexadores, non de entradas do historial: así non hai que
 * inventar entradas falsas nin corremos o risco de que o historial e o que se
 * ve pola pantalla queden desincronizados.
 */

/** Devolve `true` se se deu por aludido e xa fixo o seu (pecharse, normalmente). */
type BackHandler = () => boolean

const handlers: BackHandler[] = []

/**
 * Apila un xeito de «ir atrás». Devolve a función para darse de baixa, pensada
 * para devolvela tal cal desde un `useEffect`.
 */
export function pushBackHandler(handler: BackHandler): () => void {
  handlers.push(handler)
  return () => {
    const i = handlers.lastIndexOf(handler)
    if (i >= 0) handlers.splice(i, 1)
  }
}

/** Corre o primeiro manexador que se dea por aludido, do máis novo ao máis vello. */
export function runBackHandlers(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]()) return true
  }
  return false
}

/** Estamos na portada? (Todo o que non sexa a portada é «unha pantalla dentro».) */
function atHome(): boolean {
  const hash = location.hash.replace(/^#/, '')
  return hash === '' || hash === '/'
}

/**
 * Engancha o botón atrás nativo. No navegador non fai nada: alí xa funcionan a
 * frecha de atrás (polo historial de hash) e a tecla Esc para pechar follas.
 */
let started = false

export function startBackButton(): void {
  if (started || !Capacitor.isNativePlatform()) return
  started = true

  void App.addListener('backButton', () => {
    if (runBackHandlers()) return
    if (!atHome()) {
      // `replace` e non `hash =`: volver á portada non deixa rastro no
      // historial, así que o seguinte atrás sae da app en vez de reentrar.
      location.replace('#/')
      return
    }
    void App.exitApp()
  })
}
