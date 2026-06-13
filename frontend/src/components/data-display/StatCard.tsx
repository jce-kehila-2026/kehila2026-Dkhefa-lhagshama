import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'

interface StatCardProps {
  num: number
  suffix?: string
  delay?: number
}

export default function StatCard({ num, suffix = '', delay = 0 }: StatCardProps) {
  const [displayed, setDisplayed] = useState(0)
  const ref = useRef<HTMLDivElement | null>(null)
  const started = useRef(false)
  // Honor prefers-reduced-motion (project hard constraint): when set, the
  // count-up is skipped and the final value renders instantly, matching how
  // Reveal/MagneticButton gate their motion.
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Reduced motion: show the final value immediately, no observer/interval.
    if (reduce) {
      setDisplayed(num)
      return
    }
    // Capture both timer ids so the cleanup can clear a count-up that is still
    // running when the home page unmounts mid-animation — otherwise the
    // interval keeps calling setDisplayed on an unmounted component (React
    // state-update-after-unmount warning + a small timer leak per navigation).
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let intervalId: ReturnType<typeof setInterval> | undefined
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        timeoutId = setTimeout(() => {
          const duration = 1400
          const steps = 50
          const increment = num / steps
          let current = 0
          intervalId = setInterval(() => {
            current = Math.min(current + increment, num)
            setDisplayed(Math.round(current))
            if (current >= num && intervalId) clearInterval(intervalId)
          }, duration / steps)
        }, delay)
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => {
      obs.disconnect()
      if (timeoutId) clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [num, delay, reduce])

  return (
    <div ref={ref} style={{ textAlign:'center' }}>
      <span style={{
        fontFamily:'Frank Ruhl Libre, Georgia, serif',
        fontSize:'clamp(28px, 4vw, 42px)',
        fontWeight:400,
        color:'var(--ink)',
        display:'block',
        lineHeight:1,
      }}>
        {displayed.toLocaleString()}{suffix}
      </span>
    </div>
  )
}