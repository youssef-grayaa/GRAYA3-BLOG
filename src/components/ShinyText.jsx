import { useEffect, useRef } from 'react'

export default function ShinyText({ text, className = '' }) {
  const textRef = useRef(null)

  useEffect(() => {
    const element = textRef.current
    if (!element) return

    const handleMouseMove = (e) => {
      const rect = element.getBoundingClientRect()
      const x = e.clientX - rect.left
      element.style.setProperty('--x', `${x}px`)
    }

    element.addEventListener('mousemove', handleMouseMove)
    return () => element.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <h1 ref={textRef} className={`shiny-text ${className}`}>
      {text}
    </h1>
  )
}
