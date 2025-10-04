import { useEffect, useState } from 'react'
import NavBar from '../components/NavBar'
import { useScrollVisibility } from '../hooks/useScrollVisibility'
import { Code, Database, Server, Globe } from 'lucide-react'

export default function CGIProjectsPage() {
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
      title: "CGI UnityControl",
      description: "An innovative solution for a safer and more manageable environment. CGI UnityControl connects all dynamic objects in the outdoor space and provides integrated control over these objects.",
      technologies: ["Polymer", "C#", "Kubernetes", "Azure"],
      category: "Smart City Solutions",
      duration: "6 months",
      teamSize: "8 developers",
      features: [
        "Improved safety and mobility in outdoor spaces",
        "Management of the entire outdoor space in one geographic interface",
        "Extensive display options, from control room to mobile",
        "Control is transferable for collaboration during events",
        "Exact insight into energy consumption with integration to financial systems"
      ],
      challenges: "Integration of different management systems and vendor-independent implementation",
      impact: "Savings in time and money through more efficient maintenance and management, with significant energy savings on street lighting"
    },
    {
      id: 2,
      title: "AI Chatbot Solutions",
      description: "Intelligent chatbot solutions developed for various clients across different industries, designed to help with complex issues, minimize manual labor, enhance security, reduce manual errors, and save time through automated problem-solving.",
      technologies: ["Python", "Azure", "Streamlit", "AI Foundry", "Knowledge Graphs"],
      category: "AI/ML Solutions",
      duration: "4 months", 
      teamSize: "5 developers",
      features: [
        "Automated problem-solving for complex issues",
        "Security enhancement through intelligent monitoring",
        "Reduction of manual errors in critical processes",
        "Integration with existing client systems",
        "Time-saving automation for repetitive tasks"
      ],
      challenges: "Adapting AI models to different client domains and ensuring consistent performance across various use cases",
      impact: "Reduced manual labor, enhanced security monitoring, and minimized manual errors while saving significant time on complex issue resolution"
    },
    {
      id: 3,
      title: "Smart Store Sensor System",
      description: "An intelligent sensor-based solution for retail stores that monitors temperature, power consumption, and environmental factors to optimize energy usage and reduce carbon emissions.",
      technologies: ["C#", "Azure IoT", "Arduino", "Web Development", "REST APIs"],
      category: "IoT Solutions",
      duration: "5 months",
      teamSize: "6 developers",
      features: [
        "Real-time temperature monitoring and control",
        "Power consumption tracking and optimization",
        "Carbon emission reduction through smart automation",
        "Environmental sensor integration",
        "Automated energy management systems"
      ],
      challenges: "Integrating multiple sensor types and ensuring reliable data collection across different store environments",
      impact: "Reduction in carbon emissions and energy costs while maintaining optimal store conditions"
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
            CGI Projects
          </h1>
          <p
            id="cgi-hero-subtitle"
            data-scroll-section
            className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto scroll-fade-in-delayed"
          >
            Enterprise solutions and digital transformation projects I've worked on during my time at CGI
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
                    Technologies Used
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
                    Key Features
                  </h4>
                  <ul className="space-y-2">
                    {currentProject.features.map((feature, idx) => (
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
                    Challenge
                  </h4>
                  <p className="text-gray-300">{currentProject.challenges}</p>
                </div>

                {/* Impact */}
                <div className="rounded-xl p-6 border border-accent" style={{ backgroundColor: '#36393F' }}>
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-purple-400" />
                    Impact
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
