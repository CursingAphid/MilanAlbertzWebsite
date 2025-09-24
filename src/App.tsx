import { useState, useEffect } from 'react'
import milanImage from './assets/milan_albertz.png'
import palmTreeImage from './assets/palmtree.png'

function App() {
  const [currentSkill, setCurrentSkill] = useState(0)
  const [currentAnimation, setCurrentAnimation] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  
  const skills = [
    'Web Development',
    'UI/UX Design', 
    'Mobile Apps',
    'Data Science',
    'Machine Learning',
    'DevOps',
    'API Development',
    "LLM",
    "Azure",
    "Docker",
    "Git",
    "CI/CD",
    "Testing",
    "Agile",
    "React",
    "JavaScript",
    "HTML",
    "CSS",
    "C#",
    "SQL",
    "Python",
    "Node.js",
    "Agentic AI",
  ]

  const animations = [
    'glowPulse'
  ]


  useEffect(() => {
    if (isHovered) return // Stop cycling when hovered
    
    const skillInterval = setInterval(() => {
      setCurrentSkill((prev) => (prev + 1) % skills.length)
    }, 2000)
    
    return () => clearInterval(skillInterval)
  }, [skills.length, isHovered])

  return (
    <div className="min-h-screen bg-gradient-to-br relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #222831 0%, #393E46 100%)' }}>


      <nav className="backdrop-blur-sm shadow-sm sticky top-0 z-50" style={{ backgroundColor: 'rgba(34, 40, 49, 0.8)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold" style={{ color: '#00ADB5' }}>Milan</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a href="#hero" className="px-3 py-2 rounded-md text-sm font-medium transition-colors" style={{ color: '#EEEEEE' }}>Home</a>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-32 relative z-10">
        {/* Floating geometric shapes - only in first section */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-16 h-16 rounded-full animate-float-slow" style={{ backgroundColor: '#00ADB5', opacity: 0.2 }}></div>
          <div className="absolute top-40 right-20 w-12 h-12 rounded-lg rotate-45 animate-float-reverse" style={{ backgroundColor: '#393E46', opacity: 0.3 }}></div>
          <div className="absolute bottom-40 left-20 w-20 h-20 rounded-full animate-float-slow" style={{ backgroundColor: '#00ADB5', opacity: 0.15 }}></div>
          <div className="absolute bottom-20 right-10 w-14 h-14 rounded-lg animate-float-reverse" style={{ backgroundColor: '#EEEEEE', opacity: 0.1 }}></div>
          <div className="absolute top-1/2 left-1/4 w-8 h-8 rounded-full animate-float-slow" style={{ backgroundColor: '#393E46', opacity: 0.2 }}></div>
          <div className="absolute top-1/3 right-1/3 w-10 h-10 rounded-lg rotate-12 animate-float-reverse" style={{ backgroundColor: '#00ADB5', opacity: 0.25 }}></div>
        </div>
        
        <div className="text-center">
          {/* Image above text */}
          <div className="flex justify-center mb-8">
            <div className="w-32 h-32 backdrop-blur-sm rounded-full shadow-xl overflow-hidden" style={{ backgroundColor: 'rgba(57, 62, 70, 0.8)', border: '4px solid rgba(0, 173, 181, 0.5)' }}>
              <img 
                src={milanImage} 
                alt="Milan Albertz" 
                className="w-full h-full object-cover"
                style={{ objectPosition: '80% 30%' }}
              />
            </div>
          </div>

          {/* Text content */}
          <h1 className="text-4xl md:text-6xl font-bold mb-6" style={{ color: '#EEEEEE' }}>
            Hi, I'm <span style={{ 
              background: 'linear-gradient(135deg, #00ADB5 0%, #EEEEEE 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>Milan</span>
          </h1>
          
          <div className="text-xl mb-8 max-w-2xl mx-auto" style={{ color: '#EEEEEE' }}>
            <p className="mb-2">Experience with among others:</p>
            <div className="h-12 flex items-center justify-center relative">
              <span 
                key={currentSkill}
                className="text-2xl font-semibold cursor-pointer transition-all duration-300 hover:scale-110"
                style={{
                  background: 'linear-gradient(135deg, #00ADB5 0%, #EEEEEE 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: isHovered ? 'none' : 'glowPulse 2s ease-in-out'
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                {skills[currentSkill]}
              </span>
              
              {/* Horizontal skills on hover */}
              {isHovered && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 flex flex-wrap justify-center items-center gap-x-8 gap-y-2 pointer-events-none w-full max-w-4xl">
                  {skills
                    .filter((_, index) => index !== currentSkill)
                    .map((skill, index) => (
                    <span
                      key={skill}
                      className="text-base font-semibold opacity-0 animate-fade-in-up whitespace-nowrap"
                      style={{
                        background: 'linear-gradient(135deg, #00ADB5 0%, #EEEEEE 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        animationDelay: `${index * 0.08}s`
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="pt-8 pb-20 relative z-10" style={{ backgroundColor: 'rgba(34, 40, 49, 0.8)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" style={{ color: '#EEEEEE' }}>
              Featured Projects
            </h2>
            <p className="text-xl" style={{ color: '#EEEEEE' }}>Some of my coolest work</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Project 1 - Brazil Theme */}
            <div className="group bg-opacity-20 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden transition-all duration-500 hover:scale-105 relative" style={{ backgroundColor: 'rgba(57, 62, 70, 0.3)', border: '1px solid rgba(0, 173, 181, 0.2)' }}>
              {/* Default state */}
              <div className="h-48 flex items-center justify-center transition-all duration-500 group-hover:opacity-0" style={{ background: 'linear-gradient(135deg, #00ADB5 0%, #393E46 100%)' }}>
                <span className="text-2xl font-bold" style={{ color: '#EEEEEE' }}>University App</span>
              </div>
              
              {/* Brazil theme on hover */}
              <div className="absolute inset-0 h-48 flex items-center justify-center transition-all duration-500 opacity-0 group-hover:opacity-100 overflow-hidden" style={{ background: 'linear-gradient(135deg, #009639 0%, #FEDD00 50%, #002776 100%)' }}>
                {/* Palm trees - only in header area */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Left palm tree */}
                  <div className="absolute -left-56 -top-48 transform transition-all duration-300 group-hover:-left-16 group-hover:-top-8 group-hover:rotate-6">
                    <img 
                      src={palmTreeImage} 
                      alt="Palm Tree" 
                      className="w-64 h-64 object-contain"
                    />
                  </div>
                  {/* Right palm tree */}
                  <div className="absolute -right-56 -top-48 transform transition-all duration-300 group-hover:-right-16 group-hover:-top-8 group-hover:-rotate-6">
                    <img 
                      src={palmTreeImage} 
                      alt="Palm Tree" 
                      className="w-64 h-64 object-contain"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  </div>
                </div>
                
                {/* Text above trees */}
                <div className="text-center relative z-10">
                  <span className="text-2xl font-bold block text-white" style={{ 
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 10px rgba(255, 255, 255, 0.9), 0 0 20px rgba(255, 255, 255, 0.7), 0 0 30px rgba(255, 255, 255, 0.5)',
                    filter: 'drop-shadow(0 0 12px rgba(255, 255, 255, 0.8))',
                    letterSpacing: '1px'
                  }}>Universidade App</span>
                </div>
              </div>
              
              <div className="p-6 transition-all duration-500 group-hover:bg-opacity-30" style={{ backgroundColor: 'rgba(57, 62, 70, 0.3)' }}>
                <h3 className="text-xl font-semibold mb-2 transition-colors duration-500 group-hover:text-yellow-300" style={{ color: '#EEEEEE' }}>University Management System</h3>
                <p className="mb-4 transition-colors duration-500 group-hover:text-green-100" style={{ color: '#EEEEEE' }}>A comprehensive React application for Inteli (a university in São Paulo, Brazil), for managing projects with partners from different companies.</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-3 py-1 rounded-full text-sm transition-all duration-500 group-hover:!bg-yellow-400 group-hover:!text-green-800" style={{ backgroundColor: 'rgba(0, 173, 181, 0.2)', color: '#00ADB5' }}>React</span>
                  <span className="px-3 py-1 rounded-full text-sm transition-all duration-500 group-hover:!bg-green-500 group-hover:!text-white" style={{ backgroundColor: 'rgba(0, 173, 181, 0.2)', color: '#00ADB5' }}>JavaScript</span>
                  <span className="px-3 py-1 rounded-full text-sm transition-all duration-500 group-hover:!bg-blue-600 group-hover:!text-yellow-300" style={{ backgroundColor: 'rgba(0, 173, 181, 0.2)', color: '#00ADB5' }}>CSS</span>
                </div>
                <div className="flex space-x-4">
                  <a href="#" className="font-medium transition-colors hover:opacity-80 group-hover:text-yellow-300" style={{ color: '#00ADB5' }}>Live Demo</a>
                  <a href="#" className="font-medium transition-colors hover:opacity-80 group-hover:text-green-200" style={{ color: '#EEEEEE' }}>GitHub</a>
                </div>
              </div>
            </div>

            {/* Project 2 */}
            <div className="group bg-opacity-20 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:scale-105" style={{ backgroundColor: 'rgba(57, 62, 70, 0.3)', border: '1px solid rgba(0, 173, 181, 0.2)' }}>
              <div className="h-48 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #393E46 0%, #00ADB5 100%)' }}>
                <span className="text-2xl font-bold" style={{ color: '#EEEEEE' }}>E-Commerce</span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#EEEEEE' }}>Full-Stack E-Commerce Platform</h3>
                <p className="mb-4" style={{ color: '#EEEEEE' }}>Complete e-commerce solution with payment integration, inventory management, and admin dashboard.</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: 'rgba(0, 173, 181, 0.2)', color: '#00ADB5' }}>Next.js</span>
                  <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: 'rgba(0, 173, 181, 0.2)', color: '#00ADB5' }}>PostgreSQL</span>
                  <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: 'rgba(0, 173, 181, 0.2)', color: '#00ADB5' }}>Stripe</span>
                </div>
                <div className="flex space-x-4">
                  <a href="#" className="font-medium transition-colors hover:opacity-80" style={{ color: '#00ADB5' }}>Live Demo</a>
                  <a href="#" className="font-medium transition-colors hover:opacity-80" style={{ color: '#EEEEEE' }}>GitHub</a>
                </div>
              </div>
            </div>

            {/* Project 3 */}
            <div className="group bg-opacity-20 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:scale-105" style={{ backgroundColor: 'rgba(57, 62, 70, 0.3)', border: '1px solid rgba(0, 173, 181, 0.2)' }}>
              <div className="h-48 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00ADB5 0%, #EEEEEE 20%, #00ADB5 100%)' }}>
                <span className="text-2xl font-bold" style={{ color: '#222831' }}>Data Viz</span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#EEEEEE' }}>Interactive Data Visualization</h3>
                <p className="mb-4" style={{ color: '#EEEEEE' }}>Dynamic data visualization tool with real-time charts and interactive dashboards.</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: 'rgba(0, 173, 181, 0.2)', color: '#00ADB5' }}>D3.js</span>
                  <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: 'rgba(0, 173, 181, 0.2)', color: '#00ADB5' }}>Python</span>
                  <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: 'rgba(0, 173, 181, 0.2)', color: '#00ADB5' }}>API</span>
                </div>
                <div className="flex space-x-4">
                  <a href="#" className="font-medium transition-colors hover:opacity-80" style={{ color: '#00ADB5' }}>Live Demo</a>
                  <a href="#" className="font-medium transition-colors hover:opacity-80" style={{ color: '#EEEEEE' }}>GitHub</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

export default App
