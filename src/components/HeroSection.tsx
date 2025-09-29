import milanImage from '../assets/milan_albertz.png'

type Props = {
  skills: string[]
  currentSkill: number
  isHovered: boolean
  setIsHovered: (v: boolean) => void
}

export default function HeroSection({ skills, currentSkill, isHovered, setIsHovered }: Props) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-32 relative z-10" id="hero">
      <div className={`text-center scroll-fade-in`} data-scroll-section id="hero-section">
        <div className="flex justify-center mb-8">
          <div className="w-56 h-56 backdrop-blur-sm rounded-full shadow-xl overflow-hidden border-4 border-accent" style={{ backgroundColor: 'rgba(57, 62, 70, 0.8)' }}>
            <img src={milanImage} alt="Milan Albertz" className="w-full h-full object-cover" style={{ objectPosition: '80% 30%' }} />
          </div>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold mb-6 text-on-dark">
          Hi, I'm <span className="text-gradient-accent">Milan</span>
        </h1>

        <div className="text-xl mb-8 max-w-2xl mx-auto text-on-dark">
          <p className="mb-2">Experience with among others:</p>
          <div className="h-12 flex items-center justify-center relative">
            <span
              key={currentSkill}
              className="text-2xl font-semibold cursor-pointer transition-all duration-300 hover:scale-110 text-gradient-accent"
              style={{ animation: isHovered ? 'none' : 'glowPulse 2s ease-in-out' }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {skills[currentSkill]}
            </span>

            {isHovered && (
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 flex flex-wrap justify-center items-center gap-x-8 gap-y-2 pointer-events-none w-full max-w-4xl">
                {skills
                  .filter((_, index) => index !== currentSkill)
                  .map((skill, index) => (
                    <span
                      key={skill}
                      className="text-base font-semibold opacity-0 animate-fade-in-up whitespace-nowrap text-gradient-accent"
                      style={{ animationDelay: `${index * 0.08}s` }}
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
  )
}


