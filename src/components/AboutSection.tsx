import { Swiper, SwiperSlide } from 'swiper/react'
import { EffectFade, Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-fade'
import { RefObject, useState, useEffect } from 'react'

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

  useEffect(() => {
    const updateRadius = () => setRingRadius(getRingRadius());
    updateRadius();
    window.addEventListener('resize', updateRadius);
    return () => window.removeEventListener('resize', updateRadius);
  }, []);

  return (
    <div className="py-20 relative z-10 bg-section-overlay-light">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 scroll-fade-in`} data-scroll-section id="about-header">
          <h2 className="text-4xl font-bold mb-4 text-on-dark">About Me</h2>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-24 lg:gap-40 xl:gap-48 items-center scroll-fade-in-delayed`} data-scroll-section id="about-content">
          <div className="relative md:col-span-2 lg:col-span-2 xl:col-span-2 h-[500px] flex items-center justify-center mx-auto">
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
                    <img src={image} alt="About Milan" className="w-full h-full object-cover" />
                  </SwiperSlide>
                ))}
              </Swiper>
              </div>

              <div ref={lineRef} className="absolute w-1 origin-bottom z-10" style={{ top: '50%', left: '50%', height: `${ringRadius + 20}px`, transform: `translate(-50%, -100%) rotate(${lineAngle}deg)`, willChange: 'transform', backgroundColor: '#00ADB5' }}></div>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent" style={{ width: `${ringRadius * 2}px`, height: `${ringRadius * 2}px` }}></div>
                {Array.from({ length: 8 }).map((_, i) => {
                  const angle = i * 45
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

          <div className="space-y-6 md:col-span-3">
            <p className="text-lg leading-relaxed text-muted-on-dark">
              I'm a passionate software engineer and consultant who started my professional journey at just 18 years old.
              What drives me is the intersection of technology and real-world impact - whether that's building smart city
              solutions for governments or creating innovative projects that solve everyday problems.
            </p>
            <p className="text-lg leading-relaxed text-muted-on-dark">
              My experience spans from working on enterprise-level solutions at CGI to developing graduation projects
              at leading technology institutes. I believe in continuous learning and staying at the forefront of
              technological innovation, always looking for new ways to apply my skills to meaningful challenges.
            </p>
            <p className="text-lg leading-relaxed text-muted-on-dark">
              When I'm not coding, you'll find me exploring new technologies, working on personal projects, or
              contributing to the tech community. I'm always excited to collaborate on projects that make a
              real difference in people's lives.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


