import { useTranslation } from 'react-i18next'

export default function WorkExperienceSection() {
  const { t } = useTranslation()
  
  return (
    <div className="py-20 relative z-10 bg-section-overlay-strong">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 scroll-fade-in`} data-scroll-section id="work-experience-header">
          <h2 className="text-4xl font-bold mb-4 text-on-dark">{t('workExperience.title')}</h2>
        </div>

        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5" style={{ background: 'linear-gradient(180deg, #00ADB5 0%, #393E46 100%)' }}></div>

          <div className="space-y-12">
            <div className={`relative flex items-start scroll-fade-in`} data-scroll-section id="timeline-cgi">
              <div className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center relative z-10" style={{ background: 'linear-gradient(135deg, #00ADB5 0%, #393E46 100%)', boxShadow: '0 4px 15px rgba(0, 173, 181, 0.4)' }}>
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#EEEEEE' }}></div>
              </div>
              <div className="ml-8 flex-1">
                <div className="bg-opacity-20 backdrop-blur-sm rounded-2xl p-6 shadow-xl" style={{ backgroundColor: 'rgba(238, 238, 238, 0.1)', border: '1px solid rgba(238, 238, 238, 0.2)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-on-dark">{t('workExperience.cgi.title')}</h3>
                    <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'rgba(238, 238, 238, 0.2)', color: '#EEEEEE' }}>{t('workExperience.cgi.period')}</span>
                  </div>
                  <p className="text-lg font-semibold mb-2 text-muted-on-dark">{t('workExperience.cgi.position')}</p>
                  <p className="mb-4 text-muted-on-dark">{t('workExperience.cgi.description')}</p>
                  <div className="flex flex-wrap gap-2">
                    {(t('workExperience.cgi.skills', { returnObjects: true }) as string[]).map((skill: string, index: number) => (
                      <span key={index} className="px-3 py-1 rounded-full text-sm bg-chip text-accent">{skill}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={`relative flex items-start scroll-fade-in-delayed`} data-scroll-section id="timeline-inteli">
              <div className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center relative z-10" style={{ background: 'linear-gradient(135deg, #00ADB5 0%, #393E46 100%)', boxShadow: '0 4px 15px rgba(0, 173, 181, 0.4)' }}>
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#EEEEEE' }}></div>
              </div>
              <div className="ml-8 flex-1">
                <div className="bg-opacity-20 backdrop-blur-sm rounded-2xl p-6 shadow-xl" style={{ backgroundColor: 'rgba(238, 238, 238, 0.1)', border: '1px solid rgba(238, 238, 238, 0.2)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-on-dark">{t('workExperience.inteli.title')}</h3>
                    <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'rgba(238, 238, 238, 0.2)', color: '#EEEEEE' }}>{t('workExperience.inteli.period')}</span>
                  </div>
                  <p className="text-lg font-semibold mb-2 text-muted-on-dark">{t('workExperience.inteli.position')}</p>
                  <p className="mb-4 text-muted-on-dark">{t('workExperience.inteli.description')}</p>
                  <div className="flex flex-wrap gap-2">
                    {(t('workExperience.inteli.skills', { returnObjects: true }) as string[]).map((skill: string, index: number) => (
                      <span key={index} className="px-3 py-1 rounded-full text-sm bg-chip text-accent">{skill}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={`relative flex items-start scroll-fade-in-delayed`} data-scroll-section id="timeline-zuyd">
              <div className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center relative z-10" style={{ background: 'linear-gradient(135deg, #00ADB5 0%, #393E46 100%)', boxShadow: '0 4px 15px rgba(0, 173, 181, 0.4)' }}>
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: '#EEEEEE' }}></div>
              </div>
              <div className="ml-8 flex-1">
                <div className="bg-opacity-20 backdrop-blur-sm rounded-2xl p-6 shadow-xl" style={{ backgroundColor: 'rgba(238, 238, 238, 0.1)', border: '1px solid rgba(238, 238, 238, 0.2)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-on-dark">{t('workExperience.zuyd.title')}</h3>
                    <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'rgba(238, 238, 238, 0.2)', color: '#EEEEEE' }}>{t('workExperience.zuyd.period')}</span>
                  </div>
                  <p className="text-lg font-semibold mb-2 text-muted-on-dark">{t('workExperience.zuyd.position')}</p>
                  <p className="mb-4 text-muted-on-dark">{t('workExperience.zuyd.description')}</p>
                  <div className="flex flex-wrap gap-2">
                    {(t('workExperience.zuyd.skills', { returnObjects: true }) as string[]).map((skill: string, index: number) => (
                      <span key={index} className="px-3 py-1 rounded-full text-sm bg-chip text-accent">{skill}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}


