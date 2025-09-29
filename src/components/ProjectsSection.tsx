import palmTreeImage from '../assets/palmtree.png'
import cityImage from '../assets/city.png'

type Props = {
  emojiPositions: number[]
}

export default function ProjectsSection({ emojiPositions }: Props) {
  return (
    <div className="pt-8 pb-20 relative z-10 bg-section-overlay">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 scroll-fade-in`} data-scroll-section id="projects-header">
          <h2 className="text-4xl font-bold mb-4 text-on-dark">Things I have worked on</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <a href="/university-app" className="block" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/university-app'); window.dispatchEvent(new PopStateEvent('popstate')); }}>
            <div className={`group bg-opacity-20 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden transition-all duration-500 hover:scale-105 relative scroll-fade-in cursor-pointer`} data-scroll-section id="project-1" style={{ border: '1px solid rgba(0, 173, 181, 0.2)', backgroundColor: 'rgba(57, 62, 70, 0.3)' }}>
            <div className="h-48 flex items-center justify-center transition-all duration-500 group-hover:opacity-0 card-header-gradient-1">
              <span className="text-2xl font-bold text-on-dark">University App</span>
            </div>
            <div className="absolute inset-0 h-48 flex items-center justify-center transition-all duration-500 opacity-0 group-hover:opacity-100 overflow-hidden header-gradient-brazil">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -left-56 -top-48 transform transition-all duration-300 group-hover:-left-16 group-hover:-top-8 group-hover:rotate-6">
                  <img src={palmTreeImage} alt="Palm Tree" className="w-64 h-64 object-contain" />
                </div>
                <div className="absolute -right-56 -top-48 transform transition-all duration-300 group-hover:-right-16 group-hover:-top-8 group-hover:-rotate-6">
                  <img src={palmTreeImage} alt="Palm Tree" className="w-64 h-64 object-contain" style={{ transform: 'scaleX(-1)' }} />
                </div>
              </div>
              <div className="text-center relative z-10">
                <span className="text-2xl font-bold block text-white text-shadow-strong">Universidade App</span>
              </div>
            </div>
            <div className="p-6 transition-all duration-500 group-hover:bg-opacity-30 flex flex-col bg-card-dark">
              <h3 className="text-xl font-semibold mb-2 transition-colors duration-500 group-hover:text-yellow-300 text-on-dark">University Management System</h3>
              <p className="mb-4 transition-colors duration-500 group-hover:text-green-100 h-24 text-on-dark">A comprehensive React application for Inteli (a university in São Paulo, Brazil), for managing projects with partners from different companies.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 rounded-full text-sm transition-all duration-500 group-hover:!bg-yellow-400 group-hover:!text-green-800 bg-chip text-accent">React</span>
                <span className="px-3 py-1 rounded-full text-sm transition-all duration-500 group-hover:!bg-green-500 group-hover:!text-white bg-chip text-accent">JavaScript</span>
                <span className="px-3 py-1 rounded-full text-sm transition-all duration-500 group-hover:!bg-blue-600 group-hover:!text-yellow-300 bg-chip text-accent">CSS</span>
              </div>
              <div className="mt-auto">
                <span className="font-medium transition-colors text-accent group-hover:text-yellow-300">Learn More →</span>
              </div>
            </div>
            </div>
          </a>

          <div className={`group bg-opacity-20 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden transition-all duration-500 hover:scale-105 scroll-fade-in-delayed`} data-scroll-section id="project-2" style={{ border: '1px solid rgba(0, 173, 181, 0.2)', backgroundColor: 'rgba(57, 62, 70, 0.3)' }}>
            <div className="h-48 flex items-center justify-center transition-all duration-500 group-hover:opacity-0 card-header-gradient-2">
              <span className="text-2xl font-bold text-on-dark">CGI Projects</span>
            </div>
            <div className="absolute inset-0 h-48 flex items-center justify-center transition-all duration-500 opacity-0 group-hover:opacity-100 overflow-hidden header-gradient-cgi">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -bottom-16 left-0 right-0 transition-all duration-500 group-hover:bottom-0 group-hover:scale-110">
                  <img src={cityImage} alt="City Skyline" className="w-full h-48 object-bottom object-cover" />
                </div>
              </div>
              <div className="text-center relative z-10">
                <span className="text-2xl font-bold text-white text-shadow-strong">CGI Projects</span>
              </div>
            </div>
            <div className="p-6 transition-all duration-500 group-hover:bg-opacity-30 flex flex-col bg-card-dark">
              <h3 className="text-xl font-semibold mb-2 transition-colors duration-500 group-hover:text-red-300 text-on-dark">Enterprise Software Solutions</h3>
              <p className="mb-4 transition-colors duration-500 group-hover:text-purple-100 h-24 text-on-dark">Projects I worked on at my time at CGI for clients across different industries.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 rounded-full text-sm transition-all duration-500 group-hover:!bg-red-400 group-hover:!text-white bg-chip text-accent">C#</span>
                <span className="px-3 py-1 rounded-full text-sm transition-all duration-500 group-hover:!bg-purple-500 group-hover:!text-white bg-chip text-accent">Azure</span>
                <span className="px-3 py-1 rounded-full text-sm transition-all duration-500 group-hover:!bg-red-500 group-hover:!text-white bg-chip text-accent">SQL</span>
              </div>
              <div className="mt-auto">
                <a href="#" className="font-medium transition-colors hover:opacity-80 text-accent group-hover:text-red-300">Learn More</a>
              </div>
            </div>
          </div>

          <div className={`group bg-opacity-20 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden transition-all duration-500 hover:scale-105 scroll-fade-in-delayed`} data-scroll-section id="project-3" style={{ border: '1px solid rgba(0, 173, 181, 0.2)', backgroundColor: 'rgba(57, 62, 70, 0.3)' }}>
            <div className="h-48 flex items-center justify-center transition-all duration-500 group-hover:opacity-0 group-hover:scale-110 group-hover:blur-sm card-header-gradient-3">
              <span className="text-2xl font-bold text-on-dark">Hobby Projects</span>
            </div>
            <div className="absolute inset-0 h-48 flex items-center justify-center transition-all duration-500 opacity-0 group-hover:opacity-100 overflow-hidden header-gradient-hobby">
              <div className="absolute inset-0 pointer-events-none">
                {emojiPositions.length > 0 && (
                  <>
                    <div className="absolute -top-8" style={{ left: `${emojiPositions[0]}%`, animation: 'fallDown 3s linear infinite', animationDelay: '0s' }}><span className="text-4xl">🤖</span></div>
                    <div className="absolute -top-8" style={{ left: `${emojiPositions[1]}%`, animation: 'fallDown 2.5s linear infinite', animationDelay: '1s' }}><span className="text-4xl">🤖</span></div>
                    <div className="absolute -top-8" style={{ left: `${emojiPositions[2]}%`, animation: 'fallDown 3.5s linear infinite', animationDelay: '2s' }}><span className="text-4xl">🤖</span></div>
                    <div className="absolute -top-8" style={{ left: `${emojiPositions[3]}%`, animation: 'fallDown 2.8s linear infinite', animationDelay: '0.5s' }}><span className="text-4xl">👕</span></div>
                    <div className="absolute -top-8" style={{ left: `${emojiPositions[4]}%`, animation: 'fallDown 3.2s linear infinite', animationDelay: '1.5s' }}><span className="text-4xl">👕</span></div>
                    <div className="absolute -top-8" style={{ left: `${emojiPositions[5]}%`, animation: 'fallDown 2.2s linear infinite', animationDelay: '0.8s' }}><span className="text-4xl">🍞</span></div>
                    <div className="absolute -top-8" style={{ left: `${emojiPositions[6]}%`, animation: 'fallDown 2.9s linear infinite', animationDelay: '1.8s' }}><span className="text-4xl">🍞</span></div>
                    <div className="absolute -top-8" style={{ left: `${emojiPositions[7]}%`, animation: 'fallDown 2.7s linear infinite', animationDelay: '0.3s' }}><span className="text-4xl">📅</span></div>
                    <div className="absolute -top-8" style={{ left: `${emojiPositions[8]}%`, animation: 'fallDown 3.1s linear infinite', animationDelay: '1.2s' }}><span className="text-4xl">📅</span></div>
                    <div className="absolute -top-8" style={{ left: `${emojiPositions[9]}%`, animation: 'fallDown 2.4s linear infinite', animationDelay: '0.7s' }}><span className="text-4xl">📚</span></div>
                    <div className="absolute -top-8" style={{ left: `${emojiPositions[10]}%`, animation: 'fallDown 2.6s linear infinite', animationDelay: '1.7s' }}><span className="text-4xl">📚</span></div>
                    <div className="absolute -top-8" style={{ left: `${emojiPositions[11]}%`, animation: 'fallDown 3.3s linear infinite', animationDelay: '0.4s' }}><span className="text-4xl">🏫</span></div>
                    <div className="absolute -top-8" style={{ left: `${emojiPositions[12]}%`, animation: 'fallDown 2.8s linear infinite', animationDelay: '1.3s' }}><span className="text-4xl">🏫</span></div>
                  </>
                )}
              </div>
              <div className="text-center relative z-10">
                <span className="text-2xl font-bold text-white text-shadow-strong">Hobby Projects</span>
              </div>
            </div>
            <div className="p-6 transition-all duration-500 group-hover:bg-opacity-30 flex flex-col bg-card-dark">
              <h3 className="text-xl font-semibold mb-2 transition-colors duration-500 group-hover:text-yellow-300 text-on-dark">Personal Side Projects</h3>
              <p className="mb-4 transition-colors duration-500 group-hover:text-orange-100 h-24 text-on-dark">Various personal projects and experiments I work on in my free time to explore new technologies and ideas.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 rounded-full text-sm transition-all duration-500 group-hover:!bg-yellow-400 group-hover:!text-orange-800 bg-chip text-accent">React</span>
                <span className="px-3 py-1 rounded-full text-sm transition-all duration-500 group-hover:!bg-orange-500 group-hover:!text-white bg-chip text-accent">Python</span>
                <span className="px-3 py-1 rounded-full text-sm transition-all duration-500 group-hover:!bg-yellow-500 group-hover:!text-orange-800 bg-chip text-accent">AI/ML</span>
              </div>
              <div className="mt-auto">
                <a href="#" className="font-medium transition-colors hover:opacity-80 text-accent group-hover:text-yellow-300">Learn More</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


