import { Menu, Brain, Zap, Shield } from 'lucide-react'
import SpiderLogo from './SpiderLogo'

export default function Header({ onMenuClick, sessionName }) {
  return (
    <header className="glass-card m-4 p-4 flex items-center justify-between">
      {/* 左侧 - 菜单和会话名 */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5 text-white" />
        </button>
        
        <div className="flex items-center gap-3">
          <SpiderLogo size={40} />
          <div>
            <h1 className="text-lg font-bold text-white">Spider AI</h1>
            <p className="text-xs text-white/60">
              {sessionName || '好邻居助手'}
            </p>
          </div>
        </div>
      </div>
      
      {/* 右侧 - 状态指示器 */}
      <div className="flex items-center gap-4">
        {/* 思维融合状态 */}
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Brain className="w-4 h-4 text-purple-400" />
          <span>思维融合</span>
        </div>
        
        {/* 蜘蛛感应状态 */}
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
          <span>感应活跃</span>
        </div>
        
        {/* 好邻居指数 */}
        <div className="glass-card px-3 py-1 text-sm">
          <span className="text-white/60">指数: </span>
          <span className="text-green-400 font-bold">92</span>
        </div>
      </div>
    </header>
  )
}
