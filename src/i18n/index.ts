import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from '../locales/en.json'

// The site is English-only. i18next stays as the string table behind t(),
// but there is no language detection and no other locale to switch to.
i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  debug: false,

  interpolation: {
    escapeValue: false
  }
})

export default i18n
