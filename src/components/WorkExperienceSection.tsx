export default function WorkExperienceSection() {
  return (
    <div className="py-20 relative z-10 bg-section-overlay-strong">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 scroll-fade-in`} data-scroll-section id="work-experience-header">
          <h2 className="text-4xl font-bold mb-4 text-on-dark">Work Experience</h2>
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
                    <h3 className="text-xl font-bold text-on-dark">CGI</h3>
                    <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'rgba(238, 238, 238, 0.2)', color: '#EEEEEE' }}>2023 - Present</span>
                  </div>
                  <p className="text-lg font-semibold mb-2 text-muted-on-dark">Software Engineer & Consultant</p>
                  <p className="mb-4 text-muted-on-dark">At just 18 years old, I started at CGI as the youngest employee, contributing to a project for the <a href="https://www.cgi.com/sites/default/files/2024-09/factsheet_cgi_unitycontrol_ne.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 text-accent">Flemish government</a>. I now work full-time as a software engineer and consultant within <a href="https://www.cgi.com/nl/nl/smartlab" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 text-accent">CGI SmartLab</a>, delivering innovative solutions and providing technical expertise to clients across multiple industries.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full text-sm bg-chip text-accent">Software Engineering</span>
                    <span className="px-3 py-1 rounded-full text-sm bg-chip text-accent">AI/ML</span>
                    <span className="px-3 py-1 rounded-full text-sm bg-chip text-accent">Consulting</span>
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
                    <h3 className="text-xl font-bold text-on-dark">Inteli - Instituto de Tecnologia e Liderança</h3>
                    <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'rgba(238, 238, 238, 0.2)', color: '#EEEEEE' }}>2025</span>
                  </div>
                  <p className="text-lg font-semibold mb-2 text-muted-on-dark">IT Project Intern</p>
                  <p className="mb-4 text-muted-on-dark">I worked on a graduation project at <a href="https://www.inteli.edu.br/en/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 text-accent">Inteli</a>, focusing on software engineering, UI/UX design, and project management.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full text-sm bg-chip text-accent">Project Management</span>
                    <span className="px-3 py-1 rounded-full text-sm bg-chip text-accent">Software Engineering</span>
                    <span className="px-3 py-1 rounded-full text-sm bg-chip text-accent">UI/UX Design</span>
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
                    <h3 className="text-xl font-bold text-on-dark">Zuyd Hogeschool</h3>
                    <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'rgba(238, 238, 238, 0.2)', color: '#EEEEEE' }}>2022 - 2025</span>
                  </div>
                  <p className="text-lg font-semibold mb-2 text-muted-on-dark">Working Student & Student Representative</p>
                  <p className="mb-4 text-muted-on-dark">Worked as a student assistant helping fellow students while serving on both the Student Academic Council and Central Council, representing student interests and contributing to academic governance.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full text-sm bg-chip text-accent">Student Support</span>
                    <span className="px-3 py-1 rounded-full text-sm bg-chip text-accent">Leadership</span>
                    <span className="px-3 py-1 rounded-full text-sm bg-chip text-accent">Academic Governance</span>
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


