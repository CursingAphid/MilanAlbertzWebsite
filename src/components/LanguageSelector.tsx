import { useTranslation } from 'react-i18next'

export default function LanguageSelector() {
  const { i18n } = useTranslation()

  const toggleLanguage = () => {
    const newLanguage = i18n.language === 'en' ? 'nl' : 'en'
    i18n.changeLanguage(newLanguage)
  }

  const isEnglish = i18n.language === 'en'

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggleLanguage}
        className="relative inline-flex h-8 w-20 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-gray-900 shadow-lg hover:shadow-xl"
        style={{
          backgroundColor: isEnglish ? '#3b82f6' : '#10b981'
        }}
        aria-label="Toggle language"
      >
        {/* Background text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-semibold transition-opacity duration-300 ${
            isEnglish ? 'text-white opacity-100' : 'text-white opacity-0'
          }`}>
            EN
          </span>
          <span className={`text-xs font-semibold transition-opacity duration-300 ${
            !isEnglish ? 'text-white opacity-100' : 'text-white opacity-0'
          }`}>
            NL
          </span>
        </div>
        
        {/* Sliding toggle */}
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
            isEnglish ? 'translate-x-12' : 'translate-x-1'
          }`}
        >
          {/* Flag inside the toggle */}
          <div className="flex items-center justify-center h-full w-full">
            <span className="text-xs">
              {isEnglish ? '🇺🇸' : '🇳🇱'}
            </span>
          </div>
        </span>
      </button>
    </div>
  )
}
