import { useEffect, useState } from 'react'

interface Star {
  id: number
  top: number
  left: number
  size: number
  delay: number
  duration: number
  max: number // peak opacity of the twinkle
  color: string
  glow: boolean
}

// Space backdrop based on the home page's About section, but denser and
// brighter: 450 twinkling stars, a few of them larger, glowing or subtly
// tinted. Position inside a `relative` container, before the content.
export default function SpaceBackground() {
  const [stars, setStars] = useState<Star[]>([])
  const [meteor, setMeteor] = useState<{
    id: number
    top: number
    left: number
    angle: number
  } | null>(null)

  // Generate stars once on mount
  useEffect(() => {
    setStars(
      Array.from({ length: 450 }, (_, i) => {
        const roll = Math.random()
        const size = roll > 0.95 ? 3 : roll > 0.78 ? 2 : 1
        const tint = Math.random()
        return {
          id: i,
          top: Math.random() * 100,
          left: Math.random() * 100,
          size,
          delay: Math.random() * 4,
          duration: 1.5 + Math.random() * 2.5,
          max: 0.5 + Math.random() * 0.5,
          color: tint < 0.08 ? '#9fe6f2' : tint < 0.14 ? '#ffe9c8' : '#ffffff',
          glow: size >= 3 || Math.random() > 0.93,
        }
      })
    )
  }, [])

  // A shooting star streaks across every 15–30 seconds
  useEffect(() => {
    let show: number
    let hide: number
    const schedule = () => {
      show = window.setTimeout(() => {
        setMeteor({
          id: Date.now(),
          top: 5 + Math.random() * 55,
          left: 5 + Math.random() * 60,
          angle: 15 + Math.random() * 50,
        })
        hide = window.setTimeout(() => {
          setMeteor(null)
          schedule()
        }, 1600)
      }, 15000 + Math.random() * 15000)
    }
    schedule()
    return () => {
      clearTimeout(show)
      clearTimeout(hide)
    }
  }, [])

  return (
    <div className="absolute inset-0 bg-black">
      {/* Moon: CSS-shaded disc with craters and a soft halo */}
      <div className="space-moon" aria-hidden="true">
        <div className="space-moon-crater" style={{ top: '22%', left: '28%', width: '18%', height: '18%' }}></div>
        <div className="space-moon-crater" style={{ top: '55%', left: '18%', width: '12%', height: '12%' }}></div>
        <div className="space-moon-crater" style={{ top: '40%', left: '58%', width: '22%', height: '22%' }}></div>
        <div className="space-moon-crater" style={{ top: '68%', left: '52%', width: '10%', height: '10%' }}></div>
        <div className="space-moon-crater" style={{ top: '15%', left: '62%', width: '9%', height: '9%' }}></div>
      </div>
      {meteor && (
        <div
          key={meteor.id}
          className="absolute"
          style={{
            top: `${meteor.top}%`,
            left: `${meteor.left}%`,
            transform: `rotate(${meteor.angle}deg)`,
          }}
        >
          <div className="meteor-streak"></div>
        </div>
      )}
      <div className="absolute inset-0 opacity-75">
        {stars.map((star) => (
          <div
            key={`star-${star.id}`}
            className="absolute rounded-full"
            style={
              {
                width: `${star.size}px`,
                height: `${star.size}px`,
                top: `${star.top}%`,
                left: `${star.left}%`,
                backgroundColor: star.color,
                boxShadow: star.glow
                  ? `0 0 ${star.size * 3}px ${star.size * 0.8}px rgba(190, 233, 245, 0.45)`
                  : undefined,
                animation: `star-twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
                '--star-max': star.max,
              } as React.CSSProperties
            }
          ></div>
        ))}
      </div>
    </div>
  )
}
