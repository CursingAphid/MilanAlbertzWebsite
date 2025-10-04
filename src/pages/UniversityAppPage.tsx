import NavBar from '../components/NavBar'
import spBgImage from '../assets/brazil.png'
import inteliClassroom from '../assets/inteli_classroom.jpg'
import rioImage from '../assets/rio_de_janeiro.webp'
import beloHorizonteImage from '../assets/belo_horizonte.webp'
import salvadorImage from '../assets/salvador.jpg'
// São Paulo carousel images
import itaimBibiImage from '../assets/sp_carousel_images/Itaim_Bibi.jpeg'
import ibirapueraImage from '../assets/sp_carousel_images/ibirapuera park.jpg'
import paulistaAvenueImage from '../assets/sp_carousel_images/paulista avenue.jpg'
import libertadeImage from '../assets/sp_carousel_images/libertade.jpg'
import saoPauloImage from '../assets/sp_carousel_images/Sao_paulo.jpg'
import { useEffect, useState, useRef } from 'react'
import { useScrollVisibility } from '../hooks/useScrollVisibility'
import confetti from 'canvas-confetti'
import { Plane, ChevronLeft, ChevronRight } from 'lucide-react'

export default function UniversityAppPage() {
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  // Enable scroll-triggered visibility animations
  useScrollVisibility()
  // Travels carousel state
  const travelCities = ['Rio de Janeiro', 'Belo Horizonte', 'Salvador']
  const [travelIndex, setTravelIndex] = useState(0)
  const goNextTravel = () => setTravelIndex((prev) => (prev + 1) % travelCities.length)
  const goPrevTravel = () => setTravelIndex((prev) => (prev - 1 + travelCities.length) % travelCities.length)
  
  // São Paulo carousel state
  const spImages = [saoPauloImage, itaimBibiImage, ibirapueraImage, paulistaAvenueImage, libertadeImage]
  const spImageNames = ['São Paulo Skyline', 'Itaim Bibi', 'Ibirapuera Park', 'Paulista Avenue', 'Liberdade']
  const [spIndex, setSpIndex] = useState(0)
  const spContainerRef = useRef<HTMLDivElement | null>(null)
  const spTouchStartXRef = useRef<number | null>(null)
  const [spDragPx, setSpDragPx] = useState(0)
  const goNextSP = () => setSpIndex((prev) => Math.min(prev + 1, spImages.length - 1))
  const goPrevSP = () => setSpIndex((prev) => Math.max(prev - 1, 0))
  // Percent kept for potential easing/animation future use; currently rely on exact dot centering
  // const planePercent = (travelIndex / (travelCities.length - 1)) * 100
  const routeRef = useRef<HTMLDivElement | null>(null)
  const dotRefs = useRef<HTMLDivElement[]>([])
  const [planeLeft, setPlaneLeft] = useState<number>(0)
  const brazilRef = useRef<HTMLSpanElement | null>(null)
  const [confettiFired, setConfettiFired] = useState(false)

  // Preload Brazil hero image to improve LCP
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = spBgImage
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  const handleBrazilAnimationEnd = () => {
    if (confettiFired) return
    setConfettiFired(true)
    
    // Delay confetti to shoot a bit later during the animation
     setTimeout(() => {
       if (!brazilRef.current) {
         confetti({ particleCount: 80, spread: 70, startVelocity: 35, colors: ['#009639', '#FEDD00', '#FFFFFF', '#002776'] })
         return
       }
       const rect = brazilRef.current.getBoundingClientRect()
       const x = (rect.left + rect.width / 2) / window.innerWidth
       const y = (rect.top + rect.height / 2) / window.innerHeight
       confetti({ particleCount: 80, spread: 120, startVelocity: 35, origin: { x, y }, colors: ['#009639', '#FEDD00', '#FFFFFF', '#002776'] })
       setTimeout(() => {
         confetti({ particleCount: 50, spread: 100, startVelocity: 25, origin: { x, y }, colors: ['#009639', '#FEDD00', '#002776'] })
       }, 150)
       setTimeout(() => {
         confetti({ particleCount: 40, spread: 140, startVelocity: 20, origin: { x, y }, colors: ['#FFFFFF', '#FEDD00', '#002776'] })
       }, 300)
     }, 500) // 200ms delay from animation start
  }

  useEffect(() => {
    const updatePlanePosition = () => {
      if (!routeRef.current || !dotRefs.current[travelIndex]) return
      const containerRect = routeRef.current.getBoundingClientRect()
      const dotRect = dotRefs.current[travelIndex].getBoundingClientRect()
      setPlaneLeft(dotRect.left - containerRect.left + dotRect.width / 2)
    }
    updatePlanePosition()
    window.addEventListener('resize', updatePlanePosition)
    return () => window.removeEventListener('resize', updatePlanePosition)
  }, [travelIndex])
  

  return (
    <div className="min-h-screen pt-0 relative z-10">
      <NavBar />
      
      {/* Full-screen background section */}
      <div className="w-full h-screen relative overflow-hidden">
        <img 
          src={spBgImage} 
          alt="São Paulo Background" 
          className="absolute inset-0 w-full h-full object-cover object-bottom"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 h-full flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white text-center drop-shadow-2xl mb-4 animate-fade-in-up">
              Graduation Project in
            </h1>
            <h2 className="text-6xl md:text-8xl font-bold text-center drop-shadow-2xl animate-fade-in-up-delayed" onAnimationStart={handleBrazilAnimationEnd}>
              <span className="relative inline-block">
                <span className="absolute inset-0 bg-gradient-to-r from-green-500 to-yellow-400 blur-lg opacity-60 scale-110"></span>
                <span className="relative text-white" ref={brazilRef}>Brazil</span>
              </span>
            </h2>
          </div>
        </div>
      </div>

      {/* The City That Never Sleeps section */}
      <div className="w-full py-16 bg-gradient-to-b from-gray-800 to-gray-900" style={{ contentVisibility: 'auto', containIntrinsicSize: '1200px' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text content */}
            <div>
              <h2
                id="city-never-sleeps-title"
                data-scroll-section
                className="text-5xl md:text-6xl font-bold text-white mb-8 scroll-fade-in"
              >
                The City That Never Sleeps
              </h2>
              <p
                id="city-never-sleeps-text"
                data-scroll-section
                className="text-xl text-gray-300 leading-relaxed scroll-fade-in-delayed"
              >
                For my graduation project, I decided to travel to São Paulo,
                one of the world's largest metropolises and Brazil's economic center.
                It offers a blend of culture, food, vibrant nightlife, and of course, amazing weather. 
                <br />
                <br />
                I stayed in São Paulo for 5 months and during my stay, I fell in love with the city and the people. 
                I made so many friends and had so many amazing experiences. I loved using Uber to get around the city and
                ordering food from Ifood, as well as visiting so many cool restaurants and bars.
                No matter what time of day it is, there's always something to do. truly a city that never sleeps. 
                <br />
                <br />
                In the image carousel, you can see some of my favourite places in São Paulo. I really recommend visiting them if you ever get the chance.
              </p>
            </div>
            
            {/* Image carousel */}
            <div className="flex justify-center lg:justify-end">
              <div
                id="city-never-sleeps-image"
                data-scroll-section
                className="relative w-full max-w-md scroll-fade-in-delayed"
              >
                {/* Carousel container */}
                <div className="relative overflow-hidden rounded-lg shadow-2xl">
                  <div 
                    ref={spContainerRef}
                    className="flex touch-pan-y"
                    style={(() => {
                      const width = spContainerRef.current?.clientWidth || 1
                      const dragPercent = (spDragPx / width) * 100
                      return {
                        transform: `translateX(calc(-${spIndex * 100}% + ${dragPercent}%))`,
                        transition: spTouchStartXRef.current !== null ? 'none' : 'transform 500ms ease-in-out'
                      } as React.CSSProperties
                    })()}
                    onTouchStart={(e) => {
                      spTouchStartXRef.current = e.touches[0].clientX
                      setSpDragPx(0)
                    }}
                    onTouchMove={(e) => {
                      if (spTouchStartXRef.current == null) return
                      const deltaX = e.touches[0].clientX - spTouchStartXRef.current
                      // Prevent dragging beyond first/last
                      if (spIndex === 0 && deltaX > 0) {
                        setSpDragPx(0)
                      } else if (spIndex === spImages.length - 1 && deltaX < 0) {
                        setSpDragPx(0)
                      } else {
                        setSpDragPx(deltaX)
                      }
                    }}
                    onTouchEnd={(e) => {
                      if (spTouchStartXRef.current == null) return
                      const deltaX = e.changedTouches[0].clientX - spTouchStartXRef.current
                      const width = spContainerRef.current?.clientWidth || window.innerWidth
                      const threshold = Math.max(40, width * 0.15)
                      if (deltaX <= -threshold && spIndex < spImages.length - 1) {
                        goNextSP()
                      } else if (deltaX >= threshold && spIndex > 0) {
                        goPrevSP()
                      }
                      spTouchStartXRef.current = null
                      setSpDragPx(0)
                    }}
                  >
                    {spImages.map((image, idx) => (
                      <div key={idx} className="w-full flex-shrink-0">
                        <img 
                          src={image} 
                          alt={spImageNames[idx]} 
                          className="w-full h-80 object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ))}
                  </div>
                  
                  {/* Navigation arrows */}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      goPrevSP()
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center bg-black/50 hover:bg-black/70 text-white transition-all duration-300 z-10 cursor-pointer"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      goNextSP()
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center bg-black/50 hover:bg-black/70 text-white transition-all duration-300 z-10 cursor-pointer"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  
                  {/* Image indicators */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {spImages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSpIndex(idx)}
                        className={`h-2 w-2 rounded-full transition-all duration-300 ${
                          idx === spIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                        aria-label={`Go to ${spImageNames[idx]}`}
                      />
                    ))}
                  </div>
                  
                  {/* Image name overlay */}
                  <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-lg backdrop-blur-sm pointer-events-none">
                    <span className="text-white text-sm font-medium">{spImageNames[spIndex]}</span>
                  </div>
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-lg pointer-events-none"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project at Inteli section */}
      <div className="w-full py-16 bg-inteli-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
              <h2
                id="inteli-title"
                data-scroll-section
                className="text-5xl md:text-6xl font-bold text-white mb-12 scroll-fade-in"
              >
              Project at Inteli
            </h2>
            
            {/* Content section with image left, text right */}
            <div className="flex flex-col md:flex-row items-center gap-8 mt-16">
              <div
                id="inteli-image"
                data-scroll-section
                className="flex-shrink-0 scroll-fade-in-delayed"
              >
                <img 
                  src={inteliClassroom} 
                  alt="Inteli Classroom" 
                  className="w-full max-w-md h-64 object-cover rounded-lg shadow-lg"
                />
              </div>
              <div
                id="inteli-text"
                data-scroll-section
                className="text-left scroll-fade-in-delayed"
              >
                <p className="text-lg text-gray-300 leading-relaxed">
                  I successfully completed my graduation project at Inteli, an IT and business university in São Paulo, Brazil. 
                  A non-profit tech-focused college that offers project-based undergraduate programs in computer engineering,
                  software engineering, computer science, and information systems. Its campus is located in the Butantã neighborhood,
                  within University City, and is recognized for its hands-on methodology, direct connection to companies, and mission
                  to train leaders who will transform Brazil through technology.
                  <br />
                  <br />
                  I created a system that allows the employees working at the project management office to manage the projects and the partners.
                  The system is a web application with a backend in Node.js and a frontend in React.
                  <br />
                  <br />
                  <a 
                    href="https://www.inteli.edu.br/en/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center px-6 py-3 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-300 ease-in-out"
                    style={{ backgroundColor: '#40A0A0' }}
                  >
                    <span>Visit Inteli</span>
                    <svg 
                      className="ml-2 w-4 h-4" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                      />
                    </svg>
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Travels section - carousel with changing backgrounds */}
      <section className="relative w-full h-[80vh] overflow-hidden" style={{ contentVisibility: 'auto', containIntrinsicSize: '800px' }}>
        {/* Background slides */}
        <div
          className="flex h-full transition-transform duration-1000 ease-in-out"
          style={{ transform: `translateX(-${travelIndex * 100}%)` }}
        >
          {travelCities.map((city, idx) => {
            const cityImages = [rioImage, beloHorizonteImage, salvadorImage]
            return (
              <div key={city} className="w-full flex-shrink-0 h-full relative">
                <img 
                  src={cityImages[idx]} 
                  alt={city} 
                  className="absolute inset-0 w-full h-full object-cover" 
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-black/50" />
              </div>
            )
          })}
        </div>

        {/* Leaves divider */}
        <div className="absolute top-0 left-0 w-full leaves-top-divider z-10"></div>

        {/* Content overlay */}
        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">

            {/* Header */}
            <div className="text-center mb-8">
              <h2
                id="travels-title"
                data-scroll-section
                className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-2xl scroll-fade-in"
                style={{ textShadow: '0 0 8px rgba(0, 0, 0, 0.8)' }}
              >
                Places I Visited
              </h2>
            </div>

            {/* Airplane route indicator */}
            <div
              id="travels-route"
              data-scroll-section
              className="relative max-w-2xl mx-auto mb-8 scroll-fade-in-delayed"
              ref={routeRef}
            >
              {/* Left arrow */}
              <button
                aria-label="Previous city"
                onClick={goPrevTravel}
                className="absolute -left-16 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 text-white transition-all duration-300 backdrop-blur-sm border border-white/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              {/* Right arrow */}
              <button
                aria-label="Next city"
                onClick={goNextTravel}
                className="absolute -right-16 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 text-white transition-all duration-300 backdrop-blur-sm border border-white/20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>

              {/* Route line */}
              <div className="h-1 w-full border-t-4 border-dashed border-white/80 rounded-full"></div>
              
              {/* City dots */}
              <div className="absolute inset-0 -translate-y-1/2 flex justify-between items-center">
                {travelCities.map((city, idx) => (
                  <div key={city} className="flex flex-col items-center">
                    {idx !== travelIndex && (
                      <div 
                        ref={(el) => { if (el) dotRefs.current[idx] = el }} 
                        className="h-4 w-4 rounded-full border-2 border-white shadow-lg bg-white" 
                      />
                    )}
                    {idx === travelIndex && (
                      <div 
                        ref={(el) => { if (el) dotRefs.current[idx] = el }} 
                        className="h-4 w-4" 
                      />
                    )}
                  </div>
                ))}
              </div>
              
              {/* Airplane */}
              <div
                className="absolute transition-all duration-700 ease-in-out flex items-center justify-center"
                style={{ left: `${planeLeft}px`, top: '50%', transform: 'translate(-50%, -50%)' }}
                aria-hidden="true"
              >
                <Plane className="h-10 w-10 text-white rotate-45" 
                  style={{ 
                    filter: 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 16px rgba(0, 0, 0, 0.4))'
                  }} 
                />
              </div>
            </div>

            {/* Current city name */}
            <div className="text-center mb-8">
              <h3
                id="travels-city"
                data-scroll-section
                className="text-2xl md:text-3xl font-normal text-white mb-6 drop-shadow-lg scroll-fade-in-delayed"
                style={{ textShadow: '0 0 6px rgba(0, 0, 0, 0.8)' }}
              >
                {travelCities[travelIndex]}
              </h3>
            </div>

            {/* City content */}
            <div
              id="travels-description"
              data-scroll-section
              className="text-center scroll-fade-in-delayed"
            >
              {travelIndex === 0 ? (
                <p className="text-xl md:text-2xl text-gray-200 max-w-4xl mx-auto leading-relaxed drop-shadow-lg" style={{ textShadow: '0 0 6px rgba(0, 0, 0, 0.8)' }}>
                  The vibrant coastal city known for its stunning beaches, iconic Christ the Redeemer statue, and lively Carnival celebrations.
                </p>
              ) : travelIndex === 1 ? (
                <p className="text-xl md:text-2xl text-gray-200 max-w-4xl mx-auto leading-relaxed drop-shadow-lg" style={{ textShadow: '0 0 6px rgba(0, 0, 0, 0.8)' }}>
                  Brazil's third-largest city, famous for its rich cultural heritage, delicious cuisine, and beautiful colonial architecture.
                </p>
              ) : (
                <p className="text-xl md:text-2xl text-gray-200 max-w-4xl mx-auto leading-relaxed drop-shadow-lg" style={{ textShadow: '0 0 6px rgba(0, 0, 0, 0.8)' }}>
                  The historic capital of Bahia, known for its Afro-Brazilian culture, colorful colonial buildings, and vibrant music scene.
                </p>
              )}
            </div>
          </div>

        </div>
      </section>
    </div>
  )
}


