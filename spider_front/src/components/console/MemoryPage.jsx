import { useState, useEffect } from 'react'
import { 
  Brain, 
  Database, 
  Search, 
  Trash2, 
  Clock, 
  Plus, 
  X,
  Star,
  Tag,
  Filter,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react'
import { useConsoleTheme } from '../../contexts/ConsoleThemeContext'
import { getMemories, searchMemories, addMemory, deleteMemory } from '../../api/chat'

// 类型配置
const typeConfig = {
  preference: { label: '偏好', color: 'blue', bgColor: 'bg-blue-500', lightBg: 'bg-blue-50', textColor: 'text-blue-700', lightBorder: 'border-blue-100' },
  knowledge: { label: '知识', color: 'green', bgColor: 'bg-green-500', lightBg: 'bg-green-50', textColor: 'text-green-700', lightBorder: 'border-green-100' },
  decision: { label: '决策', color: 'purple', bgColor: 'bg-purple-500', lightBg: 'bg-purple-50', textColor: 'text-purple-700', lightBorder: 'border-purple-100' },
  experience: { label: '经验', color: 'orange', bgColor: 'bg-orange-500', lightBg: 'bg-orange-50', textColor: 'text-orange-700', lightBorder: 'border-orange-100' }
}

// 来源配置
const sourceConfig = {
  auto: { label: '自动', icon: Sparkles },
  user: { label: '用户', icon: Tag },
  system: { label: '系统', icon: Database }
}

// 筛选 tabs
const filterTabs = [
  { id: 'all', label: '全部' },
  { id: 'preference', label: '偏好' },
  { id: 'knowledge', label: '知识' },
  { id: 'decision', label: '决策' },
  { id: 'experience', label: '经验' }
]

export default function MemoryPage() {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ title: '', content: '', type: 'knowledge' })
  const [isAdding, setIsAdding] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  
  const { isDark } = useConsoleTheme()

  // 加载记忆列表
  useEffect(() => {
    loadMemories()
  }, [])

  const loadMemories = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getMemories()
      setMemories(res.data?.data || [])
    } catch (err) {
      console.error('Failed to load memories:', err)
      setError(err.message || '加载记忆失败')
    } finally {
      setLoading(false)
    }
  }

  // 搜索记忆
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadMemories()
      return
    }
    
    try {
      setIsSearching(true)
      setError(null)
      const res = await searchMemories(searchTerm.trim())
      setMemories(res.data?.data || [])
    } catch (err) {
      console.error('Failed to search memories:', err)
      setError(err.message || '搜索失败')
    } finally {
      setIsSearching(false)
    }
  }

  // 清空搜索
  const clearSearch = () => {
    setSearchTerm('')
    loadMemories()
  }

  // 添加记忆
  const handleAddMemory = async () => {
    if (!addForm.title.trim() || !addForm.content.trim()) {
      alert('请填写标题和内容')
      return
    }

    try {
      setIsAdding(true)
      const res = await addMemory({
        title: addForm.title.trim(),
        content: addForm.content.trim(),
        type: addForm.type
      })
      setMemories(prev => [res.data?.data, ...prev])
      setShowAddModal(false)
      setAddForm({ title: '', content: '', type: 'knowledge' })
    } catch (err) {
      console.error('Failed to add memory:', err)
      alert('添加失败: ' + err.message)
    } finally {
      setIsAdding(false)
    }
  }

  // 删除记忆
  const handleDelete = async (id) => {
    if (!window.confirm('确定要删除这条记忆吗？')) return
    
    try {
      setDeletingId(id)
      await deleteMemory(id)
      setMemories(prev => prev.filter(m => m.id !== id))
    } catch (err) {
      console.error('Failed to delete memory:', err)
      alert('删除失败: ' + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  // 筛选记忆
  const filteredMemories = activeFilter === 'all' 
    ? memories 
    : memories.filter(m => m.type === activeFilter)

  // 截断内容
  const truncateContent = (content, maxLength = 100) => {
    if (!content) return ''
    return content.length > maxLength ? content.slice(0, maxLength) + '...' : content
  }

  // 格式化时间
  const formatTime = (isoString) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 渲染重要性星星
  const renderImportance = (importance) => {
    const level = importance || 0
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star 
            key={i} 
            className={`w-3 h-3 ${i <= level ? 'text-yellow-400 fill-yellow-400' : isDark ? 'text-gray-600' : 'text-gray-300'}`}
          />
        ))}
      </div>
    )
  }

  // Loading 状态
  if (loading) {
    return (
      <div className={`p-8 min-h-full flex items-center justify-center ${isDark ? 'bg-[#0d1117]' : 'bg-gray-50'}`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>加载记忆中...</span>
        </div>
      </div>
    )
  }

  // Error 状态
  if (error && memories.length === 0) {
    return (
      <div className={`p-8 min-h-full flex items-center justify-center ${isDark ? 'bg-[#0d1117]' : 'bg-gray-50'}`}>
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className={`w-8 h-8 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{error}</span>
          <button 
            onClick={loadMemories}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-8 min-h-full ${isDark ? 'bg-[#0d1117]' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            长期记忆
          </h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            AI 对你的持久认知 · 共 {memories.length} 条
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          添加记忆
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="搜索记忆（语义搜索）..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className={`w-full pl-12 pr-10 py-3 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isDark 
                ? 'bg-[#161b22] border-white/[0.06] text-white placeholder-gray-500' 
                : 'bg-white border-gray-200'
            }`}
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 ${
                isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className={`px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${
            isSearching 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          搜索
        </button>
      </div>

      {/* Filter Tabs */}
      <div className={`rounded-xl shadow-sm border mb-6 overflow-x-auto ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
        <div className="flex p-1 min-w-max">
          {filterTabs.map((tab) => {
            const config = tab.id !== 'all' ? typeConfig[tab.id] : null
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                  activeFilter === tab.id
                    ? isDark 
                      ? 'bg-white/10 text-white' 
                      : 'bg-gray-100 text-gray-900'
                    : isDark 
                      ? 'text-gray-400 hover:text-gray-300' 
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {config && (
                  <span className={`w-2 h-2 rounded-full ${config.bgColor}`} />
                )}
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Memory Cards */}
      {filteredMemories.length === 0 ? (
        // 空状态
        <div className={`rounded-xl border p-12 text-center ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${isDark ? 'bg-[#1c2432]' : 'bg-gray-100'}`}>
            <Brain className={`w-8 h-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
            暂无记忆
          </h3>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            与 AI 对话后会自动积累记忆，或点击上方"添加记忆"手动创建
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMemories.map((memory) => {
            const typeCfg = typeConfig[memory.type] || typeConfig.knowledge
            const sourceCfg = sourceConfig[memory.source] || sourceConfig.auto
            const SourceIcon = sourceCfg.icon

            return (
              <div
                key={memory.id}
                className={`rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-all ${
                  isDark 
                    ? 'bg-[#161b22] border-white/[0.06]' 
                    : 'bg-white border-gray-100'
                }`}
              >
                {/* Card Header */}
                <div className={`p-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {memory.title || '无标题'}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        {/* Type Tag */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeCfg.lightBg} ${typeCfg.textColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${typeCfg.bgColor}`} />
                          {typeCfg.label}
                        </span>
                        {/* Source Tag */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                          isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <SourceIcon className="w-3 h-3" />
                          {sourceCfg.label}
                        </span>
                      </div>
                    </div>
                    {/* Importance */}
                    <div className="flex-shrink-0">
                      {renderImportance(memory.importance)}
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4">
                  <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {truncateContent(memory.content, 100)}
                  </p>
                </div>

                {/* Card Footer */}
                <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
                  <div className={`flex items-center gap-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(memory.created_at)}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(memory.id)}
                    disabled={deletingId === memory.id}
                    className={`p-2 rounded-lg transition-colors ${
                      deletingId === memory.id
                        ? 'opacity-50 cursor-not-allowed'
                        : isDark 
                          ? 'text-gray-500 hover:text-red-400 hover:bg-red-900/20' 
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                    }`}
                    title="删除记忆"
                  >
                    {deletingId === memory.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className={`w-full max-w-lg rounded-xl shadow-2xl ${isDark ? 'bg-[#161b22]' : 'bg-white'}`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}`}>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                添加记忆
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  标题
                </label>
                <input
                  type="text"
                  value={addForm.title}
                  onChange={(e) => setAddForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="例如：喜欢简洁的代码风格"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark 
                      ? 'bg-[#1c2432] border-white/[0.06] text-white placeholder-gray-500' 
                      : 'bg-white border-gray-200 placeholder-gray-400'
                  }`}
                />
              </div>

              {/* Type */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  类型
                </label>
                <div className="flex flex-wrap gap-2">
                  {['preference', 'knowledge', 'decision', 'experience'].map((type) => {
                    const config = typeConfig[type]
                    return (
                      <button
                        key={type}
                        onClick={() => setAddForm(prev => ({ ...prev, type }))}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                          addForm.type === type
                            ? `${config.lightBg} ${config.textColor} ${config.lightBorder} border`
                            : isDark 
                              ? 'border-white/[0.06] text-gray-400 hover:border-gray-500' 
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${config.bgColor}`} />
                        {config.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Content */}
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  内容
                </label>
                <textarea
                  value={addForm.content}
                  onChange={(e) => setAddForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="详细描述这条记忆..."
                  rows={4}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                    isDark 
                      ? 'bg-[#1c2432] border-white/[0.06] text-white placeholder-gray-500' 
                      : 'bg-white border-gray-200 placeholder-gray-400'
                  }`}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`flex items-center justify-end gap-3 p-4 border-t ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}`}>
              <button
                onClick={() => setShowAddModal(false)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDark 
                    ? 'text-gray-400 hover:text-white hover:bg-white/10' 
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                取消
              </button>
              <button
                onClick={handleAddMemory}
                disabled={isAdding}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  isAdding 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
                {isAdding ? '添加中...' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
