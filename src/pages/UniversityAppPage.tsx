import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay } from 'swiper/modules'
import 'swiper/css'
import spBgImage from '../assets/IMG_5728.JPEG'
import inteliLogo from '../assets/inteli_logo.png'
import { useEffect } from 'react'

export default function UniversityAppPage() {
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  const carouselImages = Object.values(
    // Load all images from the brasil_carousel_images folder
    import.meta.glob('../assets/brasil_carousel_images/*.{png,jpg,jpeg,webp,gif,svg}', { eager: true, as: 'url' })
  ) as string[]

  return (
    <div className="min-h-screen pt-0 pb-16 relative z-10">
      <NavBar />
      
      {/* Full-screen background section */}
      <div className="w-full h-screen relative overflow-hidden">
        <img 
          src={spBgImage} 
          alt="São Paulo Background" 
          className="absolute inset-0 w-full h-full object-cover object-bottom"
        />
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 h-full flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white text-center drop-shadow-2xl mb-4 animate-fade-in-up-delayed">
              Graduation Project in
            </h1>
            <h2 className="text-6xl md:text-8xl font-bold text-center drop-shadow-2xl animate-fade-in-up-delayed-2">
              <span className="relative inline-block">
                <span className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 blur-lg opacity-60 scale-110"></span>
                <span className="relative text-white">São Paulo</span>
              </span>
            </h2>
          </div>
        </div>
      </div>

      {/* The City That Never Sleeps section */}
      <div className="w-full py-16 bg-gradient-to-b from-gray-800 to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text content */}
            <div>
              <h2 className="text-5xl md:text-6xl font-bold text-white mb-8">
                The City That Never Sleeps
              </h2>
              <p className="text-xl text-gray-300 leading-relaxed">
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
            
            {/* Image content */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-md">
                <img 
                  src={spBgImage} 
                  alt="São Paulo Skyline" 
                  className="w-full h-80 object-cover rounded-lg shadow-2xl"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project at Inteli section */}
      <div className="w-full py-16" style={{ backgroundColor: '#343041' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
              <h2 className="text-5xl md:text-6xl font-thin text-white mb-12 flex items-center justify-center gap-4">
              Project at 
              <img 
                src={inteliLogo} 
                alt="Inteli Logo" 
                className="h-16 md:h-20 w-auto"
                style={{ marginTop: '-35px' }}
              />
            </h2>
            
            {/* Content section with image left, text right */}
            <div className="flex flex-col md:flex-row items-center gap-8 mt-16">
              <div className="flex-shrink-0">
                <img 
                  src={spBgImage} 
                  alt="São Paulo Skyline" 
                  className="w-full max-w-md h-64 object-cover rounded-lg shadow-lg"
                />
              </div>
              <div className="text-center md:text-left">
                <p className="text-lg text-gray-300 leading-relaxed">
                  This graduation project represents a culmination of my studies at Inteli, 
                  where I developed innovative solutions for São Paulo's urban challenges. 
                  Working in Brazil's economic center provided unique insights into 
                  large-scale system design and user experience optimization.
                  <br />
                  <br />
                  The project is a University Management System for Inteli, a university in São Paulo, Brazil.
                  It is a comprehensive system for managing projects with partners from different companies.
                  It is a comprehensive system for managing projects with partners from different companies.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image carousel section */}
      {carouselImages.length > 0 ? (
        <div className="w-full">
          <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen mt-0 mb-8">
            <Swiper
              modules={[Autoplay]}
              autoplay={{ delay: 0, disableOnInteraction: false }}
              speed={8000}
              loop={true}
              allowTouchMove={false}
              spaceBetween={0}
              slidesPerView={'auto'}
              className="linear-autoplay h-[200px] overflow-hidden border-y border-accent"
            >
              {carouselImages.map((src, idx) => (
                <SwiperSlide key={idx} className="!w-[200px] !h-[200px] flex items-center justify-center">
                  <img src={src} alt={`Brasil Carousel ${idx + 1}`} className="w-[200px] h-[200px] object-cover" />
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen mt-0 mb-8 h-[150px] overflow-hidden border-y border-accent flex items-center justify-center text-on-dark bg-card-dark">
            <span>Add images to src/assets/brasil_carousel_images to populate the carousel.</span>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link to="/" className="text-accent hover:opacity-80">← Back to Home</Link>
        </div>

        <h1 className="text-4xl font-bold mb-6 text-on-dark">University App</h1>
        <p className="text-lg leading-relaxed text-muted-on-dark mb-6">
          This page will showcase details about the University Management System project: goals, features,
          tech stack, screenshots, and a link to the repository or live demo.
        </p>

        <div className="space-y-4 text-on-dark">
          <h2 className="text-2xl font-semibold">Highlights</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Project overview and problem statement</li>
            <li>Key features and user flows</li>
            <li>Tech stack and architecture</li>
            <li>Learnings and outcomes</li>
          </ul>
        </div>
      </div>
    </div>
  )
}


