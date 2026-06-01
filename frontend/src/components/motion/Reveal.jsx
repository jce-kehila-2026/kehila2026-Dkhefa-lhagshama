/**
 * Reveal.
 *
 * Scroll-reveal wrapper — content performs an energetic enter as it meets the
 * viewport. A generous negative bottom margin means the reveal fires a bit
 * BEFORE the element is fully in view, so nothing stays blank on fast scroll
 * or full-page capture. Under `prefers-reduced-motion` we skip the offset
 * entirely and render fully visible (no whileInView dependency at all).
 *
 * Usage:
 *   <Reveal>...</Reveal>
 *   <Reveal delay={0.1} y={32} className="card">...</Reveal>
 */
import { motion, useReducedMotion } from 'motion/react'

export default function Reveal({ children, delay = 0, y = 24, className, style }) {
  const reduce = useReducedMotion()
  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
