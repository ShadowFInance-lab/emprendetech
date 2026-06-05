'use client'

import { useEffect, useState, useRef } from 'react'
import { Globe, ChevronDown } from 'lucide-react'

/**
 * Selector de idioma en el header.
 * Usa el widget de Google Translate (traduce toda la página al vuelo,
 * sin necesidad de traducir manualmente cada texto). Funciona para
 * clientes de otros países (EN, PT, FR, etc.).
 */
const LANGS = [
  { code: 'es', label: 'Español', flag: '🇲🇽' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
]

declare global {
  interface Window {
    googleTranslateElementInit?: () => void
    google?: { translate: { TranslateElement: new (opts: object, el: string) => void } }
  }
}

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('es')
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    // Inicializador global que Google Translate llama al cargar
    window.googleTranslateElementInit = () => {
      if (window.google?.translate) {
        new window.google.translate.TranslateElement(
          { pageLanguage: 'es', includedLanguages: 'en,pt,fr,it,de,zh-CN,es', autoDisplay: false },
          'google_translate_element'
        )
      }
    }

    // Cargar el script una sola vez
    if (!document.getElementById('google-translate-script')) {
      const s = document.createElement('script')
      s.id = 'google-translate-script'
      s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
      document.body.appendChild(s)
    }
  }, [])

  function changeLanguage(code: string) {
    setCurrent(code)
    setOpen(false)
    // El widget de Google Translate usa un <select.goog-te-combo>; lo disparamos.
    const trySet = (attempt = 0) => {
      const combo = document.querySelector<HTMLSelectElement>('select.goog-te-combo')
      if (combo) {
        combo.value = code
        combo.dispatchEvent(new Event('change'))
      } else if (attempt < 10) {
        setTimeout(() => trySet(attempt + 1), 300)
      }
    }
    trySet()
  }

  const activeLang = LANGS.find(l => l.code === current) ?? LANGS[0]

  return (
    <div className="relative">
      {/* Contenedor oculto requerido por Google Translate */}
      <div id="google_translate_element" className="hidden" />

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 text-gray-600 text-sm transition-colors"
        aria-label="Cambiar idioma"
      >
        <Globe size={16} />
        <span className="hidden sm:inline">{activeLang.flag}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg ring-1 ring-black/5 py-1.5 z-40">
            {LANGS.map(lang => (
              <button
                key={lang.code}
                type="button"
                onClick={() => changeLanguage(lang.code)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  current === lang.code ? 'text-blue-600 font-medium' : 'text-gray-700'
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                {lang.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
