import { useEffect, useState } from 'react'
import NavBar from '../components/NavBar'
import { useScrollVisibility } from '../hooks/useScrollVisibility'
import { Code, Database, Server, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function CGIProjectsPage() {
  const { t } = useTranslation()
  
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  
  // Enable scroll-triggered visibility animations
  useScrollVisibility()

  // Project carousel state
  const [projectIndex, setProjectIndex] = useState(0)

  // Sample CGI projects data - you can replace this with your actual projects
  const projects = [
    {
      id: 1,
      title: t('cgiProjects.unityControl.title'),
      description: t('cgiProjects.unityControl.description'),
      technologies: ["Polymer", "C#", "Kubernetes", "Azure"],
      category: t('cgiProjects.unityControl.category'),
      duration: t('cgiProjects.unityControl.duration'),
      teamSize: t('cgiProjects.unityControl.teamSize'),
      features: t('cgiProjects.unityControl.features', { returnObjects: true }),
      challenges: t('cgiProjects.unityControl.challenge'),
      impact: t('cgiProjects.unityControl.impact')
    },
    {
      id: 2,
      title: t('cgiProjects.aiChatbot.title'),
      description: t('cgiProjects.aiChatbot.description'),
      technologies: ["Python", "Azure", "Streamlit", "AI Foundry", "Knowledge Graphs"],
      category: t('cgiProjects.aiChatbot.category'),
      duration: t('cgiProjects.aiChatbot.duration'), 
      teamSize: t('cgiProjects.aiChatbot.teamSize'),
      features: t('cgiProjects.aiChatbot.features', { returnObjects: true }),
      challenges: t('cgiProjects.aiChatbot.challenge'),
      impact: t('cgiProjects.aiChatbot.impact')
    },
    {
      id: 3,
      title: t('cgiProjects.smartStore.title'),
      description: t('cgiProjects.smartStore.description'),
      technologies: ["C#", "Azure IoT", "Arduino", "Web Development", "REST APIs"],
      category: t('cgiProjects.smartStore.category'),
      duration: t('cgiProjects.smartStore.duration'),
      teamSize: t('cgiProjects.smartStore.teamSize'),
      features: t('cgiProjects.smartStore.features', { returnObjects: true }),
      challenges: t('cgiProjects.smartStore.challenge'),
      impact: t('cgiProjects.smartStore.impact')
    }
  ]

  const currentProject = projects[projectIndex]

  return (
    <div className="min-h-screen pt-0 relative z-10 bg-gradient-to-b from-gray-900 to-gray-950">
      <NavBar />
      
      {/* Hero Section */}
      <div className="w-full py-20 pt-32 header-gradient-cgi relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1
            id="cgi-hero-title"
            data-scroll-section
            className="text-5xl md:text-7xl font-bold text-white mb-6 scroll-fade-in"
          >
            {t('cgiProjects.hero.title')}
          </h1>
          <p
            id="cgi-hero-subtitle"
            data-scroll-section
            className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto scroll-fade-in-delayed"
          >
            {t('cgiProjects.hero.subtitle')}
          </p>
        </div>
      </div>

      {/* Projects Carousel Section */}
      <section className="py-20 pt-16 bg-gradient-to-b from-gray-800 to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Project Carousel */}
          <div
            id="project-carousel"
            data-scroll-section
            className="relative rounded-2xl p-4 lg:p-8 shadow-2xl scroll-fade-in-delayed border border-accent"
            style={{ backgroundColor: '#36393F' }}
          >
            {/* Project Tabs */}
            <div className="flex justify-center mb-8">
              <div className="flex bg-gray-700/50 rounded-lg p-1 backdrop-blur-sm">
                {projects.map((project, idx) => (
                  <button
                    key={project.id}
                    onClick={() => setProjectIndex(idx)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                      idx === projectIndex
                        ? 'text-white shadow-sm'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                    style={idx === projectIndex ? { backgroundColor: '#00ADB5' } : {}}
                    aria-label={`View ${project.title}`}
                  >
                    Project {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Project Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start h-full">
              {/* Project Info */}
              <div className="space-y-6 h-full flex flex-col">
                <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  {currentProject.title}
                </h3>
                
                <p className="text-lg text-gray-300 leading-relaxed mb-4">
                  {currentProject.description}
                </p>

                {/* Technologies */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Code className="h-5 w-5 text-blue-400" />
                    {t('cgiProjects.technologiesUsed')}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {currentProject.technologies.map((tech, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-gray-700/50 text-gray-300 rounded-lg text-sm border border-gray-600"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Key Features */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Server className="h-5 w-5 text-green-400" />
                    {t('cgiProjects.keyFeatures')}
                  </h4>
                  <ul className="space-y-2">
                    {(currentProject.features as string[]).map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-300">
                        <span className="text-green-400 mt-1">•</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Project Details */}
              <div className="space-y-6 h-full flex flex-col justify-start">
                {/* Challenge */}
                <div className="rounded-xl p-6 border border-accent" style={{ backgroundColor: '#36393F' }}>
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Database className="h-5 w-5 text-yellow-400" />
                    {t('cgiProjects.challenge')}
                  </h4>
                  <p className="text-gray-300">{currentProject.challenges}</p>
                </div>

                {/* Impact */}
                <div className="rounded-xl p-6 border border-accent" style={{ backgroundColor: '#36393F' }}>
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-purple-400" />
                    {t('cgiProjects.impact')}
                  </h4>
                  <p className="text-gray-300">{currentProject.impact}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

    </div>
  )
}
