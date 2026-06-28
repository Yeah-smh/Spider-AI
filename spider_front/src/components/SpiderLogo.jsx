import { useEffect, useRef } from 'react'

export default function SpiderLogo({ size = 120, animated = false, className = '' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!animated) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationFrame
    let rotation = 0

    const drawLogo = () => {
      ctx.clearRect(0, 0, size, size)
      
      const centerX = size / 2
      const centerY = size / 2
      
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(rotation)
      ctx.translate(-centerX, -centerY)

      // 外圈光环
      const gradient = ctx.createRadialGradient(centerX, centerY, size * 0.2, centerX, centerY, size * 0.5)
      gradient.addColorStop(0, 'rgba(230, 36, 41, 0.8)')
      gradient.addColorStop(0.5, 'rgba(43, 62, 143, 0.6)')
      gradient.addColorStop(1, 'rgba(230, 36, 41, 0)')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(centerX, centerY, size * 0.45, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()

      // 蜘蛛图案
      ctx.save()
      ctx.translate(centerX, centerY)

      // 蜘蛛身体
      ctx.fillStyle = '#E62429'
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.15, 0, Math.PI * 2)
      ctx.fill()

      // 蜘蛛腿（8条）
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4
        
        ctx.strokeStyle = '#E62429'
        ctx.lineWidth = size * 0.02
        ctx.lineCap = 'round'
        
        ctx.beginPath()
        ctx.moveTo(0, 0)
        
        // 第一段
        const x1 = Math.cos(angle) * size * 0.2
        const y1 = Math.sin(angle) * size * 0.2
        ctx.lineTo(x1, y1)
        
        // 第二段（弯曲）
        const x2 = Math.cos(angle + 0.3) * size * 0.35
        const y2 = Math.sin(angle + 0.3) * size * 0.35
        ctx.lineTo(x2, y2)
        
        ctx.stroke()
      }

      // 蜘蛛眼睛（白色发光）
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur = size * 0.05
      
      // 左眼
      ctx.beginPath()
      ctx.arc(-size * 0.05, -size * 0.03, size * 0.025, 0, Math.PI * 2)
      ctx.fill()
      
      // 右眼
      ctx.beginPath()
      ctx.arc(size * 0.05, -size * 0.03, size * 0.025, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()

      rotation += 0.01
      animationFrame = requestAnimationFrame(drawLogo)
    }

    drawLogo()

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [size, animated])

  if (!animated) {
    // 静态 SVG 版本
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 120 120" 
        className={className}
      >
        {/* 外圈光环 */}
        <defs>
          <radialGradient id="logoGlow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#E62429" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#2B3E8F" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#E62429" stopOpacity="0" />
          </radialGradient>
        </defs>
        
        <circle cx="60" cy="60" r="54" fill="url(#logoGlow)" />
        
        {/* 蜘蛛身体 */}
        <circle cx="60" cy="60" r="18" fill="#E62429" />
        
        {/* 蜘蛛腿 */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
          const angle = (i * Math.PI) / 4
          const x1 = 60 + Math.cos(angle) * 24
          const y1 = 60 + Math.sin(angle) * 24
          const x2 = 60 + Math.cos(angle + 0.3) * 42
          const y2 = 60 + Math.sin(angle + 0.3) * 42
          
          return (
            <g key={i}>
              <line 
                x1="60" y1="60" 
                x2={x1} y2={y1} 
                stroke="#E62429" 
                strokeWidth="2.4" 
                strokeLinecap="round" 
              />
              <line 
                x1={x1} y1={y1} 
                x2={x2} y2={y2} 
                stroke="#E62429" 
                strokeWidth="2.4" 
                strokeLinecap="round" 
              />
            </g>
          )
        })}
        
        {/* 蜘蛛眼睛 */}
        <circle cx="54" cy="57" r="3" fill="#ffffff">
          <animate 
            attributeName="opacity" 
            values="1;0.3;1" 
            dur="2s" 
            repeatCount="indefinite" 
          />
        </circle>
        <circle cx="66" cy="57" r="3" fill="#ffffff">
          <animate 
            attributeName="opacity" 
            values="1;0.3;1" 
            dur="2s" 
            repeatCount="indefinite" 
          />
        </circle>
      </svg>
    )
  }

  return (
    <canvas 
      ref={canvasRef} 
      width={size} 
      height={size} 
      className={className}
    />
  )
}
