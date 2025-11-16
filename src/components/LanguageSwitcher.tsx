import { useTranslation } from 'react-i18next'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const langs = [
    { code: 'en', label: 'EN' },
    { code: 'hi', label: 'HI' },
    { code: 'kn', label: 'KN' },
  ]
  return (
    <div className="flex items-center gap-2">
      {langs.map(l => (
        <button
          key={l.code}
          className={`px-2 py-1 rounded-md text-xs border border-white/10 ${i18n.resolvedLanguage===l.code? 'bg-white/10' : 'hover:bg-white/5'}`}
          onClick={()=> { i18n.changeLanguage(l.code); try { localStorage.setItem('lng', l.code) } catch {} }}
        >{l.label}</button>
      ))}
    </div>
  )
}
