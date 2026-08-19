import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { Group } from '../core/types'
import { t, useLang } from '../i18n'
import { shareTargetFor, type ShareTarget } from '../lib/share'
import { Sheet, Spinner, toast } from './kit'

/** Código QR para unirse a un grupo: leva a ligazón, ou o código se non hai dominio. */
export function QrDialog({ group, onClose }: { group: Group; onClose: () => void }) {
  useLang()
  const [target, setTarget] = useState<ShareTarget | null>(null)

  useEffect(() => {
    let alive = true
    shareTargetFor(group)
      .then((tg) => alive && setTarget(tg))
      .catch(() => alive && setTarget(null))
    return () => {
      alive = false
    }
  }, [group])

  return (
    <Sheet title={t('qr.title')} onClose={onClose}>
      {!target ? (
        <Spinner />
      ) : target.qr ? (
        <>
          <div className="qr-frame">
            <QRCodeSVG value={target.qr} size={240} level="M" marginSize={2} />
          </div>
          <p className="small muted center" style={{ margin: 0 }}>
            {t('qr.hint')}
          </p>
          <div className="field">
            <label>{target.kind === 'link' ? t('qr.shortLink') : t('share.code')}</label>
            <code className="token">{target.value}</code>
          </div>
          <button
            className="btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(target.value)
                toast(target.kind === 'link' ? t('settings.linkCopied') : t('share.codeCopied'))
              } catch {
                toast(t('settings.copyManually'))
              }
            }}
          >
            {target.kind === 'link' ? t('settings.copyLink') : t('share.copyCode')}
          </button>
        </>
      ) : (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            {t('qr.tooBig')}
          </p>
          <div className="field">
            <label>{t('share.code')}</label>
            <code className="token">{target.value}</code>
          </div>
          <button
            className="btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(target.value)
                toast(t('share.codeCopied'))
              } catch {
                toast(t('settings.copyManually'))
              }
            }}
          >
            {t('share.copyCode')}
          </button>
        </>
      )}
    </Sheet>
  )
}

/**
 * Escáner de códigos QR coa cámara.
 * Usa `BarcodeDetector`, que xa traen Chrome e o WebView de Android. Se non
 * está, dicímolo en vez de arrastrar unha librería de descodificación enteira.
 */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  useLang()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [supported] = useState(() => typeof (globalThis as any).BarcodeDetector === 'function')

  useEffect(() => {
    if (!supported) return
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        const Detector = (globalThis as any).BarcodeDetector
        const detector = new Detector({ formats: ['qr_code'] })

        const tick = async () => {
          if (stopped) return
          try {
            const codes = await detector.detect(video)
            const value = codes?.[0]?.rawValue
            if (value) {
              stopped = true
              onResult(String(value))
              return
            }
          } catch {
            // Un fotograma ilexible non é un erro: seguimos.
          }
          raf = requestAnimationFrame(() => void tick())
        }
        void tick()
      } catch {
        setError(t('qr.failed'))
      }
    }
    void start()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [supported, onResult])

  return (
    <Sheet title={t('qr.scan')} onClose={onClose}>
      {!supported ? (
        <p className="small muted" style={{ margin: 0 }}>
          {t('qr.unsupported')}
        </p>
      ) : error ? (
        <p className="small" style={{ color: 'var(--neg)', margin: 0 }}>
          {error}
        </p>
      ) : (
        <>
          <div className="qr-video">
            <video ref={videoRef} playsInline muted />
          </div>
          <p className="small muted center" style={{ margin: 0 }}>
            {t('qr.scanning')}
          </p>
        </>
      )}
    </Sheet>
  )
}
