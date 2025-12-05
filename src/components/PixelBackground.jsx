import { useEffect, useRef } from 'react'

export default function PixelBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const pixelSize = 4
    const cols = Math.floor(canvas.width / pixelSize)
    const rows = Math.floor(canvas.height / pixelSize)
    let time = 0
    let mouseX = canvas.width / 2
    let mouseY = canvas.height / 2

    const handleMouseMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    window.addEventListener('mousemove', handleMouseMove)

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      time += 0.5 * 0.016

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * pixelSize
          const y = j * pixelSize
          
          // Triangle pattern
          const pattern = ((i + j) % 2) * 2 - 1
          
          // Ripple effect from mouse
          const dx = x - mouseX
          const dy = y - mouseY
          const distance = Math.sqrt(dx * dx + dy * dy)
          const ripple = Math.sin(distance * 0.02 - time * 3) * 0.5 + 0.5
          
          // Edge fade
          const edgeFade = 0.25
          const fadeX = Math.min(x / (canvas.width * edgeFade), (canvas.width - x) / (canvas.width * edgeFade), 1)
          const fadeY = Math.min(y / (canvas.height * edgeFade), (canvas.height - y) / (canvas.height * edgeFade), 1)
          const fade = Math.min(fadeX, fadeY)
          
          const opacity = (pattern * 0.3 + ripple * 0.4) * fade * 0.6
          
          if (opacity > 0.05) {
            ctx.fillStyle = `rgba(147, 51, 234, ${opacity})`
            ctx.fillRect(x, y, pixelSize - 1, pixelSize - 1)
          }
        }
      }
      
      requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return <canvas ref={canvasRef} className="pixel-background" />
}
