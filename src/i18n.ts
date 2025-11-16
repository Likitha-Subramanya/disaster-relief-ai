import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  en: { translation: {
    app_name: 'Relief.AI',
    home_need_help: 'I need help',
    home_can_help: 'I can help (register)',
    dashboard: 'Dashboard',
    victim: 'Victim',
    register_aid: 'Register Aid',
    language: 'Language'
  } },
  hi: { translation: {
    app_name: 'Relief.AI',
    home_need_help: 'मुझे मदद चाहिए',
    home_can_help: 'मैं मदद कर सकता/सकती हूँ (पंजीकरण)',
    dashboard: 'डैशबोर्ड',
    victim: 'जरूरतमंद',
    register_aid: 'सहायता पंजीकरण',
    language: 'भाषा'
  } },
  kn: { translation: {
    app_name: 'Relief.AI',
    home_need_help: 'ನನಗೆ ಸಹಾಯ ಬೇಕು',
    home_can_help: 'ನಾನು ಸಹಾಯ ಮಾಡಬಹುದು (ನೋಂದಣಿ)',
    dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    victim: 'ಪೀಡಿತ',
    register_aid: 'ಸಹಾಯ ನೋಂದಣಿ',
    language: 'ಭಾಷೆ'
  } }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: typeof window !== 'undefined' ? (localStorage.getItem('lng') || 'en') : 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  })

export default i18n
