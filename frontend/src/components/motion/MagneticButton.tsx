/**
 * MagneticButton.
 *
 * Pointer-reactive magnetic button — the element translates toward the cursor
 * while hovered, driven imperatively via a ref (outside React state) so the
 * motion stays cheap. Collapses to a plain, static button under
 * `prefers-reduced-motion`.
 *
 * Usage:
 *   <MagneticButton className="btn" onClick={handle}>Send</MagneticButton>
 *   <MagneticButton type="submit" className="btn">Submit</MagneticButton>
 */
import { useRef } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import styles from './MagneticButton.module.css'

interface MagneticButtonProps {
  className?: string
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  children?: ReactNode
  type?: 'button' | 'submit' | 'reset'
}

export default function MagneticButton({ className, onClick, children, type = 'button' }: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotion()

  const handleMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = e.clientX - (r.left + r.width / 2)
    const y = e.clientY - (r.top + r.height / 2)
    ref.current.style.transform = `translate(${x * 0.22}px, ${y * 0.3}px)`
  }
  const reset = () => {
    if (ref.current) ref.current.style.transform = 'translate(0px, 0px)'
  }

  return (
    <button
      ref={ref}
      type={type}
      className={className ? `${className} ${styles.magnetic}` : styles.magnetic}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={reset}
    >
      {children}
    </button>
  )
}
