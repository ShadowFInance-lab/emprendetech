'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, CameraOff, ScanLine, Check } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onDetected: (code: string) => void
}

type Status = 'loading' | 'scanning' | 'error'

/**
 * Escáner de código de barras con la cámara del dispositivo.
 * Usa @zxing/browser (carga dinámica para no pesar en el bundle inicial
 * ni romper el SSR). Incluye fallback manual por si la cámara falla.
 */
export default function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [manual, setManual] = useState('')

  // Mantener callbacks frescos sin reiniciar el efecto en cada render.
  const onDetectedRef = useRef(onDetected)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onDetectedRef.current = onDetected
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setStatus('loading')
    setErrorMsg('')

    ;(async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        const video = videoRef.current
        if (!video) return

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          video,
          (result) => {
            if (result && !cancelled) {
              const code = result.getText()
              // feedback háptico en móviles
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80)
              controlsRef.current?.stop()
              onDetectedRef.current(code)
              onCloseRef.current()
            }
          }
        )

        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        setStatus('scanning')
      } catch (e) {
        if (cancelled) return
        const err = e as { name?: string }
        let msg = 'No se pudo iniciar la cámara. Escribe el código manualmente.'
        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
          msg = 'Diste permiso denegado a la cámara. Actívalo en los ajustes del navegador (icono de candado en la barra de direcciones).'
        } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
          msg = 'No se encontró una cámara en este dispositivo. Escribe el código manualmente.'
        }
        setErrorMsg(msg)
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [open])

  if (!open) return null

  function submitManual() {
    const code = manual.trim()
    if (code) {
      onDetected(code)
      setManual('')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="flex items-center gap-2 font-semibold">
          <ScanLine size={20} /> Escanear código de barras
        </div>
        <button
          type="button"
          onClick={() => {
            controlsRef.current?.stop()
            onClose()
          }}
          className="p-2 rounded-full hover:bg-white/10"
          aria-label="Cerrar"
        >
          <X size={22} />
        </button>
      </div>

      {/* Cámara / estados */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Marco guía */}
        {status === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 max-w-[80%] h-40 rounded-2xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] relative">
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-red-500 animate-pulse" />
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="text-sm">Abriendo cámara…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white px-8 text-center">
            <CameraOff className="h-12 w-12 text-gray-400" />
            <p className="text-sm text-gray-200 max-w-xs">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Pie: instrucción + entrada manual */}
      <div className="bg-black px-4 py-4 space-y-3">
        {status === 'scanning' && (
          <p className="text-center text-sm text-gray-300">
            Apunta al código de barras del producto. Se detecta automáticamente.
          </p>
        )}
        <div className="flex gap-2 max-w-md mx-auto">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitManual()}
            placeholder="…o escribe el código a mano"
            className="flex-1 h-11 rounded-xl bg-white/10 border border-white/20 px-3 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
            inputMode="numeric"
          />
          <button
            type="button"
            onClick={submitManual}
            disabled={!manual.trim()}
            className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center gap-1.5 disabled:opacity-40"
          >
            <Check size={16} /> Usar
          </button>
        </div>
      </div>
    </div>
  )
}
