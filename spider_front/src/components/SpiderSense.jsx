import { Zap, Sparkles } from 'lucide-react'

export default function SpiderSense({ suggestions, onSelect }) {
  if (!suggestions || suggestions.length === 0) return null

  return (
    <div className="glass-card p-4 mb-4 animate-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
        <span className="text-sm font-medium text-white">蜘蛛感应预测</span>
        <Sparkles className="w-4 h-4 text-yellow-400" />
      </div>
      
      <div className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion)}
            className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-yellow-400/30 hover:border-yellow-400/50 transition-all text-white/80 hover:text-white text-sm"
          >
            <span className="text-yellow-400 mr-2">→</span>
            {suggestion}
          </button>
        ))}
      </div>
      
      <p className="mt-3 text-xs text-white/40">
        点击建议快速填充，或继续输入
      </p>
    </div>
  )
}
