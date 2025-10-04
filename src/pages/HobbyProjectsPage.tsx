import { useEffect, useRef, useState } from 'react'
import NavBar from '../components/NavBar'
import { useScrollVisibility } from '../hooks/useScrollVisibility'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import aldibreadImage from '../assets/aldibread.png'
import breadImage from '../assets/bread.jpg'
import copperSSImage from '../assets/copperSS.png'
import copperSSbossImage from '../assets/copperSSboss.gif'
import stylemateImage from '../assets/Stylemate.png'

export default function HobbyProjectsPage() {
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  
  // Enable scroll-triggered visibility animations
  useScrollVisibility()

  // Hobby projects data
  const hobbyProjects = [
    {
      id: 1,
      title: "Bread Waste Tracker",
      description: "Working in a supermarket, I noticed that too much bread was being thrown away and employees had to manually count everything, creating no reliable dataset. I wanted to digitalize the way the bread serving was noted by creating a web app using C# backend with HTML, CSS, and JavaScript frontend to track and reduce food waste. This was one of the first web development projects I did that made me fall in love with programming.",
      images: [
        aldibreadImage,
        breadImage
      ],
      technologies: ["C#", "HTML", "CSS", "JavaScript"]
    },
    {
      id: 2,
      title: "Terraria Modding",
      description: "I created lots of fun mods for Terraria, but my best work was the Copper Shortsword mod. This mod added various new content including new enemies, biomes, weapons, armor, and even a boss - all based around the copper shortsword, the very first weapon you use in the game. It was a comprehensive expansion that breathed new life into the starting weapon.",
      images: [
        copperSSImage,
        copperSSbossImage
      ],
      technologies: ["C#", "tModLoader", "Game Development", "Modding", "Aseprite"]
    },
    {
      id: 3,
      title: "StyleMate",
      description: "A mobile shopping app that revolutionizes how people discover clothing. Like Tinder for fashion, users swipe through clothing pieces they like, and if they want to buy an item, they get redirected to the product page. Built with a React frontend and C# backend, StyleMate makes shopping more engaging and personalized.",
      images: [
        stylemateImage
      ],
      technologies: ["React", "C#", "Mobile Development", "Web Development"]
    }
  ]

  // Carousel state for each project
  const [currentImages, setCurrentImages] = useState<{[key: number]: number}>({})
  
  // Touch swipe tracking per project
  const touchStartXRef = useRef<{ [key: number]: number | null }>({})
  const swipeThreshold = 40
  const containerRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})
  const [dragOffsetByProject, setDragOffsetByProject] = useState<{ [key: number]: number }>({})
  const [isDraggingByProject, setIsDraggingByProject] = useState<{ [key: number]: boolean }>({})
  
  // Initialize carousel states
  useEffect(() => {
    const initialStates: {[key: number]: number} = {}
    hobbyProjects.forEach(project => {
      initialStates[project.id] = 0
    })
    setCurrentImages(initialStates)
  }, [])

  const goNextImage = (projectId: number) => {
    setCurrentImages(prev => ({
      ...prev,
      [projectId]: (prev[projectId] + 1) % hobbyProjects.find(p => p.id === projectId)!.images.length
    }))
  }

  const goPrevImage = (projectId: number) => {
    const project = hobbyProjects.find(p => p.id === projectId)!
    setCurrentImages(prev => ({
      ...prev,
      [projectId]: (prev[projectId] - 1 + project.images.length) % project.images.length
    }))
  }

  const handleTouchStart = (projectId: number) => (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0]
    touchStartXRef.current[projectId] = touch.clientX
    setIsDraggingByProject(prev => ({ ...prev, [projectId]: true }))
    setDragOffsetByProject(prev => ({ ...prev, [projectId]: 0 }))
  }

  const handleTouchEnd = (projectId: number) => (e: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current[projectId]
    if (startX == null) return
    const endX = e.changedTouches[0].clientX
    const deltaX = endX - startX
    const width = containerRefs.current[projectId]?.clientWidth || window.innerWidth
    const dynamicThreshold = Math.max(swipeThreshold, width * 0.15)
    if (deltaX <= -dynamicThreshold) {
      goNextImage(projectId)
    } else if (deltaX >= dynamicThreshold) {
      goPrevImage(projectId)
    }
    touchStartXRef.current[projectId] = null
    setIsDraggingByProject(prev => ({ ...prev, [projectId]: false }))
    // snap back offset; transition handled by images when not dragging
    setDragOffsetByProject(prev => ({ ...prev, [projectId]: 0 }))
  }

  const handleTouchMove = (projectId: number) => (e: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current[projectId]
    if (startX == null) return
    const currentX = e.touches[0].clientX
    const deltaX = currentX - startX
    setDragOffsetByProject(prev => ({ ...prev, [projectId]: deltaX }))
  }

  return (
    <div className="min-h-screen pt-0 relative z-10 bg-gradient-to-b from-gray-900 to-gray-950">
      <NavBar />
      
      {/* Hero Section */}
      <div className="w-full py-20 pt-32 header-gradient-hobby relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Hobby Projects
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
            Personal projects where creativity meets technology
          </p>
        </div>
      </div>

      {/* Projects Sections */}
      {hobbyProjects.map((project, index) => (
        <section key={project.id} className={`py-20 ${index % 2 === 0 ? 'bg-gradient-to-b from-gray-800 to-gray-900' : 'bg-gray-700'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''}`}>
              
              {/* Image Carousel */}
              <div className={`${index % 2 === 1 ? 'lg:col-start-2' : ''}`}>
                <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                  <div
                    className="relative h-80 overflow-hidden"
                    ref={(el) => { containerRefs.current[project.id] = el }}
                    onTouchStart={project.images.length > 1 ? handleTouchStart(project.id) : undefined}
                    onTouchMove={project.images.length > 1 ? handleTouchMove(project.id) : undefined}
                    onTouchEnd={project.images.length > 1 ? handleTouchEnd(project.id) : undefined}
                  >
                    {project.images.map((image, idx) => (
                      <img 
                        key={idx}
                        src={image} 
                        alt={`${project.title} ${idx + 1}`}
                        className={`absolute inset-0 w-full h-full object-cover`}
                        style={(() => {
                          const current = currentImages[project.id] || 0
                          const width = containerRefs.current[project.id]?.clientWidth || 1
                          const dragPx = dragOffsetByProject[project.id] || 0
                          const dragPercent = (dragPx / width) * 100
                          const basePercent = (idx - current) * 100
                          return {
                            transform: `translateX(calc(${basePercent}% + ${dragPercent}%))`,
                            transition: isDraggingByProject[project.id] ? 'none' : 'transform 500ms ease-in-out'
                          } as React.CSSProperties
                        })()}
                      />
                    ))}
                    
                    {/* Navigation Arrows */}
                    {project.images.length > 1 && (
                      <>
                        <button
                          onClick={() => goPrevImage(project.id)}
                          className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full flex items-center justify-center bg-black/50 hover:bg-black/70 text-white transition-all duration-300"
                          aria-label="Previous image"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => goNextImage(project.id)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full flex items-center justify-center bg-black/50 hover:bg-black/70 text-white transition-all duration-300"
                          aria-label="Next image"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    
                    {/* Image Indicators */}
                    {project.images.length > 1 && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {project.images.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentImages(prev => ({...prev, [project.id]: idx}))}
                            className={`h-2 w-2 rounded-full transition-all duration-300 ${
                              idx === (currentImages[project.id] || 0) ? 'bg-white' : 'bg-white/50'
                            }`}
                            aria-label={`Go to image ${idx + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Text Content */}
              <div className={`${index % 2 === 1 ? 'lg:col-start-1' : ''}`}>
                <div className="space-y-6">
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                    {project.title}
                  </h2>
                  
                  <p className="text-lg text-gray-300 leading-relaxed mb-6">
                    {project.description}
                  </p>

                  {/* Technologies */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Technologies Used</h3>
                    <div className="flex flex-wrap gap-2">
                      {project.technologies.map((tech, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-gray-700/50 text-gray-300 rounded-lg text-sm border border-gray-600"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
