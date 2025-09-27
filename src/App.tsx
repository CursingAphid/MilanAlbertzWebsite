import { useState, useEffect, useRef } from 'react'
import AboutSection from './components/AboutSection'
import HeroSection from './components/HeroSection.tsx'
import NavBar from './components/NavBar'
import ProjectsSection from './components/ProjectsSection'
import WorkExperienceSection from './components/WorkExperienceSection'
import aboutMeImage from './assets/AboutMe.jpeg'
import aboutMe2 from './assets/aboutme2.jpeg'
import aboutMe3 from './assets/aboutme3.jpeg'
import { useScrollVisibility } from './hooks/useScrollVisibility'

function App() {
  const [currentSkill, setCurrentSkill] = useState(0)
  // const [currentAnimation, setCurrentAnimation] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [emojiPositions, setEmojiPositions] = useState<number[]>([])
  useScrollVisibility()
  const [ringCurrentImage, setRingCurrentImage] = useState(0)
  const [swiperInstance, setSwiperInstance] = useState<any>(null)
  const [lineAngle, setLineAngle] = useState(0)
  // const [isTransitioning, setIsTransitioning] = useState(false)
  const lastRealIndexRef = useRef<number | null>(null)
  const lineRef = useRef<HTMLDivElement | null>(null)
  const lineAngleRef = useRef<number>(0)
  const rotationAnimRef = useRef<Animation | null>(null)
  
  // Array of all images for the carousel - ordered clockwise starting from top
  const carouselImages = [
    aboutMeImage,  // 0 - Top
    aboutMe2,      // 1 - Top Right  
    aboutMe3,      // 2 - Right
    aboutMeImage,  // 3 - Bottom Right
    aboutMe2,      // 4 - Bottom
    aboutMe3,      // 5 - Bottom Left
    aboutMeImage,  // 6 - Left
    aboutMe2       // 7 - Top Left
  ]
  
  const skills = [
    'Web Development',
    'UI/UX Design', 
    'Mobile Apps',
    'Data Science',
    'AI/ML',
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
    "Node.js"
  ]

  // const animations = ['glowPulse']

  // Generate random positions for emojis
  const generateRandomPositions = () => {
    const positions: number[] = []
    for (let i = 0; i < 13; i++) {
      positions.push(Math.random() * 100) // Random percentage from 0 to 100
    }
    setEmojiPositions(positions)
  }

  useEffect(() => {
    generateRandomPositions()
  }, [])

  // Sync ring images with Swiper and animate line
  useEffect(() => {
    if (!swiperInstance) return

    // Initialize last real index when swiper becomes available
    lastRealIndexRef.current = swiperInstance.realIndex

    const handleRealIndexChange = () => {
      const newIndex = swiperInstance.realIndex
      // Skip if same index reported again
      if (lastRealIndexRef.current === newIndex) return
      lastRealIndexRef.current = newIndex
      setRingCurrentImage(newIndex)

      const startAngle = lineAngleRef.current
      const endAngle = startAngle + 45

      if (lineRef.current) {
        // Cancel any in-progress rotation to avoid compounding
        if (rotationAnimRef.current) {
          rotationAnimRef.current.cancel()
          rotationAnimRef.current = null
        }

        rotationAnimRef.current = lineRef.current.animate([
          { transform: `translate(-50%, -100%) rotate(${startAngle}deg)` },
          { transform: `translate(-50%, -100%) rotate(${endAngle}deg)` }
        ], {
          duration: 1000,
          easing: 'ease-in-out',
          fill: 'forwards'
        })
      }

      setLineAngle(endAngle)
    }

    swiperInstance.on('realIndexChange', handleRealIndexChange)

    return () => {
      swiperInstance.off('realIndexChange', handleRealIndexChange)
    }
  }, [swiperInstance])

  // Keep ref in sync with state
  useEffect(() => {
    lineAngleRef.current = lineAngle
  }, [lineAngle])

  

  // Intersection visibility handled in useScrollVisibility hook

  useEffect(() => {
    if (isHovered) return // Stop cycling when hovered
    
    const skillInterval = setInterval(() => {
      setCurrentSkill((prev) => (prev + 1) % skills.length)
    }, 2000)
    
    return () => clearInterval(skillInterval)
  }, [skills.length, isHovered])

  return (
    <div className="min-h-screen relative overflow-hidden bg-app-gradient">
      


      <NavBar />

      <HeroSection skills={skills} currentSkill={currentSkill} isHovered={isHovered} setIsHovered={setIsHovered} />

      <ProjectsSection emojiPositions={emojiPositions} />

      <AboutSection
        lineRef={lineRef}
        lineAngle={lineAngle}
        setSwiperInstance={setSwiperInstance}
        ringCurrentImage={ringCurrentImage}
        carouselImages={carouselImages}
      />

      <WorkExperienceSection />

    </div>
  )
}

export default App

