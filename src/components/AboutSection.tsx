import { Swiper, SwiperSlide } from 'swiper/react'
import { EffectFade, Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-fade'
import { type RefObject, useState, useEffect } from 'react'

type Props = {
  lineRef: RefObject<HTMLDivElement | null>
  lineAngle: number
  setSwiperInstance: (instance: any) => void
  ringCurrentImage: number
  carouselImages: string[]
}

export default function AboutSection({ lineRef, lineAngle, setSwiperInstance, ringCurrentImage, carouselImages }: Props) {
  // Responsive ring radius - smaller on mobile/tablet, larger on desktop
  const getRingRadius = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 1280) return 250; // xl and up
      if (window.innerWidth >= 1024) return 230; // lg
      if (window.innerWidth >= 768) return 200;  // md
      return 180; // mobile
    }
    return 200; // default
  };

  const [ringRadius, setRingRadius] = useState(200);
  const [stars, setStars] = useState<Array<{
    id: number;
    top: number;
    left: number;
    size: number;
    delay: number;
    duration: number;
    opacity: number;
  }>>([]);

  // Generate stars once on mount
  useEffect(() => {
    const generateStars = () => {
      const newStars = Array.from({ length: 200 }, (_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() > 0.8 ? 2 : 1,
        delay: Math.random() * 3,
        duration: 1.5 + Math.random() * 2,
        opacity: 0.3 + Math.random() * 0.7
      }));
      setStars(newStars);
    };

    generateStars();
  }, []);

  useEffect(() => {
    const updateRadius = () => setRingRadius(getRingRadius());
    updateRadius();
    window.addEventListener('resize', updateRadius);
    return () => window.removeEventListener('resize', updateRadius);
  }, []);

  return (
    <div className="py-20 relative z-10 bg-gradient-to-b from-purple-900 via-blue-900 to-black overflow-hidden">
      {/* Space background with stars */}
      <div className="absolute inset-0 bg-black">
        <div className="absolute inset-0 opacity-40">
          {/* Render stars with fixed positions */}
          {stars.map((star) => (
            <div
              key={`star-${star.id}`}
              className="absolute bg-white rounded-full animate-pulse"
              style={{
                width: `${star.size}px`,
                height: `${star.size}px`,
                top: `${star.top}%`,
                left: `${star.left}%`,
                animationDelay: `${star.delay}s`,
                animationDuration: `${star.duration}s`,
                opacity: star.opacity
              }}
            ></div>
          ))}
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className={`text-center mb-16 md:mb-32 scroll-fade-in`} data-scroll-section id="about-header">
          <h2 className="text-4xl font-bold mb-4 text-on-dark">About Me</h2>
        </div>

        <div className={`flex flex-col lg:grid lg:grid-cols-5 gap-8 md:gap-0 lg:gap-[14rem] xl:gap-[16rem] items-center scroll-fade-in-delayed`} data-scroll-section id="about-content">
          <div className="relative lg:col-span-2 xl:col-span-2 h-[500px] md:h-[400px] flex items-center justify-center mx-auto order-1 lg:order-none md:pt-0">
            {/* Mobile/Tablet: Normal horizontal carousel */}
            <div className="block lg:hidden w-full max-w-sm mx-auto">
              <Swiper
                modules={[Autoplay]}
                autoplay={{ delay: 3000, disableOnInteraction: false }}
                speed={1000}
                loop={true}
                className="w-full h-80 rounded-lg overflow-hidden shadow-2xl"
                onSwiper={setSwiperInstance}
              >
                {carouselImages.map((image, index) => (
                  <SwiperSlide key={index}>
                    <img src={image} alt="About Milan" className="w-full h-full object-cover" />
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>

            {/* Desktop: Circular carousel with ring */}
            <div className="hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 relative w-[500px] h-[500px] lg:scale-[0.75] xl:scale-[0.85] origin-center">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 lg:w-64 lg:h-64 xl:w-80 xl:h-80 rounded-full overflow-hidden shadow-2xl z-20 border-4 border-accent">
              <Swiper
                modules={[EffectFade, Autoplay]}
                effect="fade"
                autoplay={{ delay: 3000, disableOnInteraction: false }}
                speed={1000}
                loop={true}
                className="w-full h-full"
                onSwiper={setSwiperInstance}
              >
                {carouselImages.map((image, index) => (
                  <SwiperSlide key={index}>
                    <img 
                      src={image} 
                      alt="About Milan" 
                      className="w-full h-full object-cover" 
                      style={{ 
                        objectPosition: index === 1 ? 'top right' : index === 7 ? 'left center' : 'center' 
                      }}
                    />
                  </SwiperSlide>
                ))}
              </Swiper>
              </div>

              <div ref={lineRef} className="absolute w-1 origin-bottom z-10" style={{ top: '50%', left: '50%', height: `${ringRadius}px`, transform: `translate(-50%, -100%) rotate(${lineAngle}deg)`, willChange: 'transform', backgroundColor: '#00ADB5' }}></div>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent" style={{ width: `${ringRadius * 2}px`, height: `${ringRadius * 2}px` }}></div>
                {Array.from({ length: 8 }).map((_, i) => {
                  const angle = (i * 45) - 90
                  const isActive = ringCurrentImage === i
                  return (
                    <div
                      key={i}
                      className="absolute w-20 h-20 rounded-lg overflow-hidden shadow-lg transition-all duration-1000 ease-in-out"
                      style={{
                        top: '50%',
                        left: '50%',
                        transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${ringRadius}px) rotate(${-angle}deg)${isActive ? ' scale(1.1)' : ''}`,
                        border: '2px solid #00ADB5',
                        opacity: 1,
                      }}
                    >
                      <img src={carouselImages[i]} alt="About Milan" className="w-full h-full object-cover" style={{ filter: 'grayscale(100%)' }} />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 order-2 lg:order-none relative flex items-center h-auto min-h-[420px] md:min-h-[400px] mt-4 md:mt-0">
            {/* Spaceship window frame */}
            <div className="absolute inset-0 border-2 rounded-lg bg-black/20 backdrop-blur-sm pointer-events-none" style={{borderColor: '#00ADB5'}}>
              {/* Corner decorations */}
              <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2" style={{borderColor: '#00ADB5'}}></div>
              <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2" style={{borderColor: '#00ADB5'}}></div>
              <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2" style={{borderColor: '#00ADB5'}}></div>
              <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2" style={{borderColor: '#00ADB5'}}></div>
              
              {/* Side frame lines */}
              <div className="absolute top-0 left-8 right-8 h-px" style={{background: 'linear-gradient(to right, transparent, #00ADB5, transparent)'}}></div>
              <div className="absolute bottom-0 left-8 right-8 h-px" style={{background: 'linear-gradient(to right, transparent, #00ADB5, transparent)'}}></div>
              <div className="absolute left-0 top-8 bottom-8 w-px" style={{background: 'linear-gradient(to bottom, transparent, #00ADB5, transparent)'}}></div>
              <div className="absolute right-0 top-8 bottom-8 w-px" style={{background: 'linear-gradient(to bottom, transparent, #00ADB5, transparent)'}}></div>
            </div>
            
            {/* Text content with padding for frame */}
            <div className="relative z-10 p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 break-words">
            <p className="text-lg leading-relaxed text-muted-on-dark">
              I'm a passionate software engineer and consultant from Kerkrade, Netherlands, who started my professional journey at just 18 years old.
              What drives me is the intersection of technology and real-world impact - whether that's building smart city
              solutions for governments or diving into the immersive world of virtual reality.
            </p>
            <p className="text-lg leading-relaxed text-muted-on-dark">
              When I'm not coding, you'll find me lost in music, planning my next adventure to eat desserts around the world, 
              or dancing at funk parties. I'm always excited to collaborate on projects that blend technology with creativity 
              and make a real difference in people's lives.
            </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


