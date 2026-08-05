import { useRef, useState } from 'react'
import { navigate } from '../App'
import type { FirebaseConfig } from '../config/firebase'
import type { AiConfig } from '../config/openai'
import type { AppState } from '../core/types'
import { t, useLang, type Key } from '../i18n'
import { downloadText, groupFromJson } from '../lib/csv'
import { importGroup, replaceState, useAppState } from '../store/store'
import {
  aiSettings,
  clearAi,
  clearFirebase,
  firebaseSettings,
  isAiConfigured,
  isFirebaseConfigured,
  updateAi,
  updateFirebase,
  useSettings,
} from '../store/settings'
import { resetSyncEngine } from '../sync/engine'
import { Field, LanguageSwitcher, Sheet, toast } from './kit'

const FIREBASE_FIELDS: (keyof FirebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
]

/**
 * Axustes do dispositivo: idioma e credenciais dos servizos.
 * Todo o que se escribe aquí queda neste teléfono; non viaxa nos grupos nin na
 * sincronización.
 */
export default function AppSettings({ onClose }: { onClose: () => void }) {
  useLang()
  useSettings()

  const [fb, setFb] = useState<FirebaseConfig>(() => ({ ...firebaseSettings() }))
  const [ai, setAi] = useState<AiConfig>(() => ({ ...aiSettings() }))

  function saveFirebase() {
    updateFirebase(fb)
    resetSyncEngine()
    toast(t('appset.saved'))
  }

  function saveAi() {
    updateAi(ai)
    toast(t('appset.saved'))
  }

  return (
    <Sheet title={t('appset.title')} onClose={onClose}>
      <Field label={t('appset.language')}>
        <LanguageSwitcher />
      </Field>

      <p className="small muted" style={{ margin: 0 }}>
        {t('appset.storedHere')}
      </p>

      <DataCard onClose={onClose} />

      <div className="card">
        <div className="card-title">
          <span>{t('appset.firebase')}</span>
          <span className={`badge ${isFirebaseConfigured() ? 'live' : ''}`}>
            {isFirebaseConfigured() ? t('appset.on') : t('appset.off')}
          </span>
        </div>
        <div className="card-pad small muted">{t('appset.firebase.hint')}</div>
        <div className="card-pad" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FIREBASE_FIELDS.map((field) => (
            <Field key={field} label={t(`fb.${field}` as Key)}>
              <input
                className="input"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={fb[field]}
                onChange={(e) => setFb({ ...fb, [field]: e.target.value })}
              />
            </Field>
          ))}
          <div className="btn-row">
            <button className="btn primary sm" onClick={saveFirebase}>
              {t('appset.save')}
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                clearFirebase()
                setFb({
                  apiKey: '',
                  authDomain: '',
                  projectId: '',
                  storageBucket: '',
                  messagingSenderId: '',
                  appId: '',
                })
                resetSyncEngine()
                toast(t('appset.cleared'))
              }}
            >
              {t('appset.clear')}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span>{t('appset.ai')}</span>
          <span className={`badge ${isAiConfigured() ? 'live' : ''}`}>
            {isAiConfigured() ? t('appset.on') : t('appset.off')}
          </span>
        </div>
        <div className="card-pad small muted">{t('appset.ai.hint')}</div>
        <div className="card-pad" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label={t('ai.apiKey')}>
            <input
              className="input"
              type="password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={ai.apiKey}
              onChange={(e) => setAi({ ...ai, apiKey: e.target.value })}
            />
          </Field>
          <Field label={t('ai.baseUrl')}>
            <input
              className="input"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={ai.baseUrl}
              onChange={(e) => setAi({ ...ai, baseUrl: e.target.value })}
            />
          </Field>
          <div className="grid2">
            <Field label={t('ai.receiptModel')}>
              <input
                className="input"
                autoCapitalize="none"
                spellCheck={false}
                value={ai.receiptModel}
                onChange={(e) => setAi({ ...ai, receiptModel: e.target.value })}
              />
            </Field>
            <Field label={t('ai.categoryModel')}>
              <input
                className="input"
                autoCapitalize="none"
                spellCheck={false}
                value={ai.categoryModel}
                onChange={(e) => setAi({ ...ai, categoryModel: e.target.value })}
              />
            </Field>
          </div>
          <p className="small" style={{ color: 'var(--neg)', margin: 0 }}>
            ⚠️ {t('ai.keyWarning')}
          </p>
          <div className="btn-row">
            <button className="btn primary sm" onClick={saveAi}>
              {t('appset.save')}
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                clearAi()
                setAi({ ...ai, apiKey: '' })
                toast(t('appset.cleared'))
              }}
            >
              {t('appset.clear')}
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}

/**
 * Copias de seguranza e importación. Vivía na portada, pero alí só estorbaba:
 * é algo que se toca de tarde en tarde, e este é o sitio das cousas do
 * dispositivo.
 */
function DataCard({ onClose }: { onClose: () => void }) {
  const state = useAppState()
  const backupRef = useRef<HTMLInputElement>(null)
  const groupRef = useRef<HTMLInputElement>(null)

  function onBackupFile(file: File) {
    file
      .text()
      .then((txt) => {
        const parsed = JSON.parse(txt) as AppState
        if (!Array.isArray(parsed.groups)) throw new Error('format')
        replaceState(parsed)
        toast(t('home.backup.restored'))
      })
      .catch(() => toast(t('home.backup.invalid')))
  }

  function onGroupFile(file: File) {
    file
      .text()
      .then((txt) => {
        const group = groupFromJson(txt)
        if (!group) throw new Error('format')
        const imported = importGroup(group)
        toast(t('home.importedJson'))
        // Pechamos os axustes: se non, o grupo novo ábrese detrás da folla.
        onClose()
        navigate(`/g/${imported.id}`)
      })
      .catch(() => toast(t('home.importFailed')))
  }

  return (
    <div className="card">
      <div className="card-title">{t('home.data')}</div>
      <div className="card-pad small muted">{t('home.data.hint')}</div>
      <div className="card-pad btn-row" style={{ paddingTop: 0 }}>
        <button
          className="btn sm"
          onClick={() => {
            downloadText(
              `split-pay-backup-${new Date().toISOString().slice(0, 10)}.json`,
              JSON.stringify(state, null, 2),
              'application/json',
            )
            toast(t('home.backup.done'))
          }}
        >
          {t('home.backup.export')}
        </button>
        <button className="btn sm" onClick={() => backupRef.current?.click()}>
          {t('home.backup.import')}
        </button>
        <button className="btn sm" onClick={() => groupRef.current?.click()}>
          {t('home.importJson')}
        </button>
        <input
          ref={backupRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onBackupFile(f)
            e.target.value = ''
          }}
        />
        <input
          ref={groupRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onGroupFile(f)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
