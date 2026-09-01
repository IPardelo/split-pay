import type { CapacitorConfig } from '@capacitor/cli'

/**
 * GL · Configuración de Capacitor: o envoltorio que mete a app dentro dun
 *      proxecto Android nativo.
 * ES · Configuración de Capacitor: el envoltorio que mete la app dentro de un
 *      proyecto Android nativo.
 * EN · Capacitor configuration: the wrapper that puts the app inside a native
 *      Android project.
 *
 * `appId` é o identificador do paquete e NON se pode cambiar despois de
 * publicar. Se vas subila a algures, cámbiao agora por un dominio teu do
 * revés (com.oteudominio.splitpay).
 */
const config: CapacitorConfig = {
  appId: 'com.splitpay.app',
  appName: 'Split Pay',
  webDir: 'dist',
  server: {
    // Serve a app como https://localhost dentro do WebView. Fai falta para que
    // funcionen o portapapeis, a cámara e o IndexedDB (piden contexto seguro).
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
