import { useEffect, useRef, useState } from 'react'

export default function StatCard({ num, suffix = '', label, delay = 0 }) {
  const [displayed, setDisplayed] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        setTimeout(() => {
          const duration = 1400
          const steps = 50
          const increment = num / steps
          let current = 0
          const timer = setInterval(() => {
            current = Math.min(current + increment, num)
            setDisplayed(Math.round(current))
            if (current >= num) clearInterval(timer)
          }, duration / steps)
        }, delay)
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [num, delay])

  return (
    <div ref={ref} style={{ textAlign:'center' }}>
      <span style={{
        fontFamily:'Frank Ruhl Libre, serif',
        fontSize:'clamp(28px, 4vw, 42px)',
        fontWeight:900,
        color:'var(--gold-light)',
        display:'block',
        lineHeight:1,
      }}>
        {displayed.toLocaleString()}{suffix}
      </span>
    </div>
  )
}