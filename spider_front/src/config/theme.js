export const SPIDER_THEME = {
  colors: {
    red: '#E62429',      // 蜘蛛侠红
    blue: '#2B3E8F',     // 蜘蛛侠蓝
    dark: '#0a0a0a',     // 深黑背景
    gold: '#FFD700',     // 金色高光
  },
  
  animations: {
    float: '6s ease-in-out infinite',
    shimmer: '3s linear infinite',
    particleFloat: '20s linear infinite',
    particleDrift: '15s ease-in-out infinite',
    pulseGlow: '2s ease-in-out infinite',
  },
  
  effects: {
    glassCard: 'bg-white/5 backdrop-blur-lg border border-white/10',
    textGradient: 'spider-text-gradient',
  }
}

// 首次访问检测
export const isFirstVisit = () => {
  return !localStorage.getItem('spider_ai_visited')
}

// 标记已访问
export const markAsVisited = () => {
  localStorage.setItem('spider_ai_visited', 'true')
}

// 重置首次访问（用于测试）
export const resetFirstVisit = () => {
  localStorage.removeItem('spider_ai_visited')
}
