/**
 * GL · Configuración da propia aplicación.
 * ES · Configuración de la propia aplicación.
 * EN · The application's own configuration.
 */

/**
 * GL · Enderezo público da app, se algún día a colgas nun dominio.
 *      BALEIRO = a app é só para móbil: non se xeran ligazóns (apuntarían ao
 *      localhost do teléfono e non lle servirían a ninguén) e compártese cun
 *      CÓDIGO que a outra persoa pega en «Unirse».
 *
 * ES · Dirección pública de la app, si algún día la cuelgas en un dominio.
 *      VACÍO = la app es solo para móvil: no se generan enlaces (apuntarían al
 *      localhost del teléfono y no le servirían a nadie) y se comparte con un
 *      CÓDIGO que la otra persona pega en «Unirse».
 *
 * EN · The app's public address, if you ever host it on a domain.
 *      EMPTY = mobile-only: no links are generated (they would point at the
 *      phone's own localhost and be useless to anyone else) and sharing uses a
 *      CODE that the other person pastes into "Join".
 *
 * ex.: 'https://gastos.example.com/'
 */
export const PUBLIC_URL = ''

/**
 * GL · Máximo de caracteres que metemos nun código QR. Por riba diso o código
 *      sae tan denso que ningunha cámara o le, e é mellor dicilo que xerar un
 *      QR inútil.
 * ES · Máximo de caracteres que metemos en un código QR. Por encima de eso el
 *      código sale tan denso que ninguna cámara lo lee, y es mejor decirlo que
 *      generar un QR inútil.
 * EN · Maximum number of characters we put in a QR code. Above that the code
 *      gets so dense no camera reads it, and saying so beats producing a
 *      useless QR.
 */
export const QR_MAX_CHARS = 1100

/** Hai un enderezo público configurado? */
export function hasPublicUrl(): boolean {
  return PUBLIC_URL.trim().length > 0
}

/**
 * GL · Estamos dentro do APK (ou nun servidor local)? Daquela o `location` non
 *      é un enderezo que lle sirva a ninguén de fóra.
 * ES · ¿Estamos dentro del APK (o en un servidor local)? Entonces el `location`
 *      no es una dirección que le sirva a nadie de fuera.
 * EN · Are we inside the APK (or on a local server)? Then `location` is not an
 *      address that is any use to anyone else.
 */
export function isPrivateOrigin(): boolean {
  if (typeof location === 'undefined') return true
  const { protocol, hostname } = location
  if (protocol !== 'http:' && protocol !== 'https:') return true
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '10.0.2.2'
}
