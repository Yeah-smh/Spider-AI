import { X, Plus, MessageSquare, Settings, Database, Trash2 } from 'lucide-react'
import { useState } from 'react'

export default function Sidebar({ open, onClose, currentSession, onSessionChange }) {
  const [sessions, setSessions] = useState([
    { id: 1, name: '代码优化讨论', timestamp: '2小时前', messages: 12 },
    { id: 2, name: '文档分析', timestamp: '昨天', messages: 8 },
    { id: 3, name: '数据处理方案', timestamp: '3天前', messages: 25 },
  ])

  const handleNewSession = () => {
    const newSession = {
      id: Date.now(),
      name: `新会话 ${sessions.length + 1}`,
      timestamp: '刚刚',
      messages: 0
    }
    setSessions([newSession, ...sessions])
    onSessionChange(newSession)
  }

  const handleDeleteSession = (id, e) => {
    e.stopPropagation()
    setSessions(sessions.filter(s => s.id !== id))
    if (currentSession?.id === id) {
      onSessionChange(null)
    }
  }

  return (
    <>
      {/* 遮罩层 */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* 侧边栏 */}
      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          w-80 glass-card m-4 rounded-xl
          transform transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col
        `}
      >
        {/* 头部 */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">会话历史</h2>
            <button
              onClick={onClose}
              className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          
          {/* 新建会话按钮 */}
          <button
            onClick={handleNewSession}
            className="w-full flex items-center justify-center gap-2 p-3 bg-spider-blue hover:bg-spider-blue/80 rounded-lg transition-colors text-white"
          >
            <Plus className="w-5 h-5" />
            <span>新建会话</span>
          </button>
        </div>
        
        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSessionChange(session)}
              className={`
                w-full p-3 rounded-lg text-left transition-all
                hover:bg-white/10
                ${currentSession?.id === session.id ? 'bg-white/20 border border-spider-blue' : 'border border-transparent'}
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-spider-blue flex-shrink-0" />
                    <h3 className="text-white font-medium truncate">
                      {session.name}
                    </h3>
                  </div>
                  <p className="text-xs text-white/50">
                    {session.messages} 条消息 · {session.timestamp}
                  </p>
                </div>
                
                <button
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  className="p-1 hover:bg-red-500/20 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </button>
          ))}
        </div>
        
        {/* 底部操作 */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <button className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white">
            <Database className="w-5 h-5" />
            <span>记忆管理</span>
          </button>
          
          <button className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white">
            <Settings className="w-5 h-5" />
            <span>系统设置</span>
          </button>
        </div>
      </aside>
    </>
  )
}
