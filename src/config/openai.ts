/**
 * GL · Conexión cun modelo de IA, para dúas funcións opcionais: crear un gasto
 *      a partir da foto dun ticket, e adiviñar a categoría a partir do título.
 *      Mentres `apiKey` estea baleira, as dúas funcións NON aparecen na app.
 *
 * ES · Conexión con un modelo de IA, para dos funciones opcionales: crear un
 *      gasto a partir de la foto de un ticket, y deducir la categoría a partir
 *      del título. Mientras `apiKey` esté vacía, las dos funciones NO aparecen.
 *
 * EN · Connection to an AI model, for two optional features: creating an
 *      expense from a photo of a receipt, and guessing the category from the
 *      title. While `apiKey` is empty, neither feature shows up.
 *
 * ---------------------------------------------------------------------------
 * ⚠️  GL · A CHAVE VIAXA AO NAVEGADOR. Esta app non ten servidor, así que a
 *          chamada faise desde o cliente e calquera que abra a páxina pode ler
 *          a chave. Úsaa só en local, ou apunta `baseUrl` a un proxy teu que
 *          garde a chave de verdade (por exemplo un Ollama local ou unha
 *          función de Firebase).
 * ⚠️  ES · LA CLAVE VIAJA AL NAVEGADOR. Esta app no tiene servidor, así que la
 *          llamada se hace desde el cliente y cualquiera que abra la página
 *          puede leer la clave. Úsala solo en local, o apunta `baseUrl` a un
 *          proxy tuyo que guarde la clave de verdad.
 * ⚠️  EN · THE KEY SHIPS TO THE BROWSER. This app has no server, so the call is
 *          made client-side and anyone opening the page can read the key. Use
 *          it locally only, or point `baseUrl` at your own proxy that holds the
 *          real key.
 * ---------------------------------------------------------------------------
 */

export interface AiConfig {
  /** Chave da API. Baleira = as funcións de IA quedan desactivadas. */
  apiKey: string
  /** Calquera endpoint compatible con OpenAI (Ollama, LM Studio, un proxy…). */
  baseUrl: string
  /** Modelo con visión, para ler tickets. */
  receiptModel: string
  /** Modelo de texto, para adiviñar a categoría. */
  categoryModel: string
}

export const aiConfig: AiConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  receiptModel: 'gpt-5-nano',
  categoryModel: 'gpt-5-nano',
}

/**
 * GL · Isto é só o punto de partida: en Axustes → Servizos pódese escribir a
 *      chave sen tocar código, e o que se escriba alí manda.
 * ES · Esto es solo el punto de partida: en Ajustes → Servicios se puede
 *      escribir la clave sin tocar código, y lo que se escriba allí manda.
 * EN · Only the starting point: the key can be typed under Settings → Services
 *      without touching code, and what is typed there wins.
 */

/**
 * GL · De onde saen os tipos de cambio en vivo. Frankfurter é público, gratuíto
 *      e sen rexistro; usa datos do Banco Central Europeo.
 * ES · De dónde salen los tipos de cambio en vivo. Frankfurter es público,
 *      gratuito y sin registro; usa datos del Banco Central Europeo.
 * EN · Where live exchange rates come from. Frankfurter is public, free and
 *      key-less; it serves European Central Bank data.
 */
export const FX_API_URL = 'https://api.frankfurter.app'
