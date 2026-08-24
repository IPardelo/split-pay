/**
 * GL · Conexión con Google Firebase.
 *    Pega aquí a configuración do teu proxecto (Firebase → Configuración do
 *    proxecto → As túas aplicacións → Web). Mentres estes campos estean baleiros,
 *    TODOS os grupos son locais e a app nin sequera pregunta local/en liña.
 *
 * ES · Conexión con Google Firebase.
 *    Pega aquí la configuración de tu proyecto (Firebase → Configuración del
 *    proyecto → Tus aplicaciones → Web). Mientras estos campos estén vacíos,
 *    TODOS los grupos son locales y la app ni siquiera pregunta local/en línea.
 *
 * EN · Google Firebase connection.
 *    Paste your project's config here (Firebase → Project settings → Your apps →
 *    Web). While these fields are empty, ALL groups are local and the app does
 *    not even ask local/online.
 *
 * ---------------------------------------------------------------------------
 * GL · Necesitas Cloud Firestore activado. Regras mínimas para probar:
 * ES · Necesitas Cloud Firestore activado. Reglas mínimas para probar:
 * EN · You need Cloud Firestore enabled. Minimal rules to try it out:
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /split-pay-groups/{token} {
 *         allow read, write: if true;
 *       }
 *     }
 *   }
 *
 * GL · Ollo: esas regras son abertas. Quen adiviñe un token le e escribe.
 *      Os tokens son aleatorios de 22 caracteres, así que na práctica ninguén
 *      dá con eles, pero para uso serio engade autenticación.
 * ES · Ojo: esas reglas son abiertas. Quien adivine un token lee y escribe.
 *      Los tokens son aleatorios de 22 caracteres, así que en la práctica nadie
 *      da con ellos, pero para uso serio añade autenticación.
 * EN · Careful: those rules are wide open. Anyone who guesses a token can read
 *      and write. Tokens are random 22-character strings, so in practice nobody
 *      does, but add authentication before any serious use.
 */

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
}

/**
 * GL · Colección de Firestore onde viven os grupos en liña.
 * ES · Colección de Firestore donde viven los grupos en línea.
 * EN · Firestore collection holding the online groups.
 */
export const FIRESTORE_COLLECTION = 'split-pay-groups'

/**
 * GL · Estes valores son só o PUNTO DE PARTIDA. Dentro da app, en Axustes →
 *      Servizos, pódense escribir sen tocar código, e o que se escriba alí
 *      manda sobre isto (gárdase no propio dispositivo). Ver src/store/settings.ts.
 * ES · Estos valores son solo el PUNTO DE PARTIDA. Dentro de la app, en Ajustes →
 *      Servicios, pueden escribirse sin tocar código, y lo que se escriba allí
 *      manda sobre esto (se guarda en el propio dispositivo).
 * EN · These values are only the STARTING POINT. Inside the app, under Settings →
 *      Services, they can be typed without touching code, and what is typed
 *      there wins (stored on the device itself).
 */
