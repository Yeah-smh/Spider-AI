import { useState, useEffect } from 'react'
import { 
  Bot, 
  Trash2, 
  Clock, 
  ArrowRight,
  Zap,
  Search,
  FileText,
  Brain,
  Loader2,
  AlertCircle,
  FolderOpen,
  Code,
  Layers
} from 'lucide-react'
import { useConsoleTheme } from '../../contexts/ConsoleThemeContext'
import { getSubAgents, getProjects, deleteSubAgent } from '../../api/chat'

export default function AgentsPage() {
  const [subAgents, setSubAgents] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const { isDark } = useConsoleTheme()

  // 加载数据
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        const [agentsRes, projectsRes] = await Promise.all([
          getSubAgents(), // 不传 projectId，获取所有子代理
          getProjects()
        ])
        setSubAgents(agentsRes.data || [])
        setProjects(projectsRes.data || [])
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError(err.message || '加载数据失败')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // 删除子代理
  const handleDelete = async (agentId) => {
    if (!window.confirm('确定要删除这个子代理吗？')) return
    
    try {
      setDeletingId(agentId)
      await deleteSubAgent(agentId)
      setSubAgents(prev => prev.filter(a => a.id !== agentId))
    } catch (err) {
      console.error('Failed to delete sub-agent:', err)
      alert('删除失败: ' + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  // 获取项目名称
  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    return project?.name || '未关联项目'
  }

  // 按项目分组
  const agentsByProject = subAgents.reduce((acc, agent) => {
    const key = agent.project_id || 'no-project'
    if (!acc[key]) acc[key] = []
    acc[key].push(agent)
    return acc
  }, {})

  // 截取 system_prompt 摘要
  const truncatePrompt = (prompt, maxLength = 80) => {
    if (!prompt) return '暂无描述'
    return prompt.length > maxLength ? prompt.slice(0, maxLength) + '...' : prompt
  }

  // 格式化时间
  const formatTime = (isoString) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 获取代理图标
  const getAgentIcon = (name) => {
    if (!name) return <Bot className="w-5 h-5" />
    const lowerName = name.toLowerCase()
    if (lowerName.includes('web') || lowerName.includes('search')) return <Search className="w-5 h-5" />
    if (lowerName.includes('code') || lowerName.includes('代码')) return <Code className="w-5 h-5" />
    if (lowerName.includes('document') || lowerName.includes('文件') || lowerName.includes('doc')) return <FileText className="w-5 h-5" />
    if (lowerName.includes('memory') || lowerName.includes('记忆')) return <Brain className="w-5 h-5" />
    return <Bot className="w-5 h-5" />
  }

  // 按创建时间排序的最近子代理
  const recentAgents = [...subAgents]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  // 加载状态
  if (loading) {
    return (
      <div className={`p-8 min-h-full flex items-center justify-center ${isDark ? 'bg-[#0d1117]' : 'bg-gray-50'}`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>加载中...</span>
        </div>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className={`p-8 min-h-full flex items-center justify-center ${isDark ? 'bg-[#0d1117]' : 'bg-gray-50'}`}>
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className={`w-8 h-8 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{error}</span>
          <button 
            onClick={() => window.location.reload()}
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
      <div className="mb-8">
        <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>子代理管理</h1>
        <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          管理您的 AI 子代理 · 共 {subAgents.length} 个
        </p>
      </div>

      {/* Agent Cards - 按项目分组 */}
      {subAgents.length === 0 ? (
        // 空状态
        <div className={`rounded-xl border p-12 text-center ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${isDark ? 'bg-[#1c2432]' : 'bg-gray-100'}`}>
            <Bot className={`w-8 h-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>暂无子代理</h3>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            在项目对话中创建子代理来执行特定任务
          </p>
        </div>
      ) : (
        <div className="space-y-8 mb-12">
          {Object.entries(agentsByProject).map(([projectId, agents]) => (
            <div key={projectId}>
              {/* 项目标题 */}
              <div className="flex items-center gap-2 mb-4">
                <FolderOpen className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                  {projectId === 'no-project' ? '未关联项目' : getProjectName(parseInt(projectId))}
                </h2>
                <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  ({agents.length})
                </span>
              </div>
              
              {/* 卡片网格 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <div 
                    key={agent.id}
                    className={`rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-[#1c2432] text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                          {getAgentIcon(agent.name || agent.display_name)}
                        </div>
                        <div className="min-w-0">
                          <h3 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {agent.display_name || agent.name}
                          </h3>
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${isDark ? 'bg-[#1c2432] text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                            子代理
                          </span>
                        </div>
                      </div>
                      {/* 状态指示 */}
                      {agent.is_enabled !== false && (
                        <span className="flex items-center gap-1.5 text-xs text-green-500">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          启用
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className={`text-sm mb-4 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {truncatePrompt(agent.description || agent.system_prompt)}
                    </p>

                    {/* 创建时间 */}
                    <div className={`rounded-lg p-3 mb-4 ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
                      <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <Clock className="w-3 h-3" />
                        <span>创建于 {formatTime(agent.created_at)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(agent.id)}
                        disabled={deletingId === agent.id}
                        className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          deletingId === agent.id
                            ? 'opacity-50 cursor-not-allowed'
                            : isDark 
                              ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' 
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        {deletingId === agent.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Orchestration Flow - 静态架构说明 */}
      <div className="mb-12">
        <h2 className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-gray-800'}`}>
          Agent 调度架构
        </h2>
        <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            {/* 主 Agent */}
            <div className="text-center">
              <div className="bg-blue-50 border-2 border-[#3182ce] rounded-xl px-6 py-4 inline-flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Bot className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">主 Agent</h4>
                  <span className="text-xs text-blue-600 font-medium">纯调度 · 不执行任务</span>
                </div>
              </div>
              <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                接收用户请求，分析意图
              </p>
            </div>

            {/* 箭头 */}
            <ArrowRight className={`w-8 h-8 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />

            {/* 子代理 */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className={`text-center px-4 py-3 rounded-xl border ${isDark ? 'bg-[#1c2432] border-white/[0.06]' : 'bg-gray-50 border-gray-200'}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 ${isDark ? 'bg-white/10' : 'bg-white'}`}>
                  <FileText className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                </div>
                <h5 className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>文件操作</h5>
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>读写、搜索</span>
              </div>

              <div className={`text-center px-4 py-3 rounded-xl border ${isDark ? 'bg-[#1c2432] border-white/[0.06]' : 'bg-gray-50 border-gray-200'}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 ${isDark ? 'bg-white/10' : 'bg-white'}`}>
                  <Layers className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                </div>
                <h5 className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>业务工具</h5>
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>MCP 工具</span>
              </div>
            </div>
          </div>

          {/* 说明文字 */}
          <div className={`mt-6 p-4 rounded-lg ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <Zap className="w-4 h-4 inline mr-1" />
              主 Agent 负责理解用户意图并调度子代理。子代理在对话中动态创建，执行完毕后自动销毁。
            </p>
          </div>
        </div>
      </div>

      {/* Recent Created Agents */}
      <div>
        <h2 className={`text-lg font-semibold mb-6 ${isDark ? 'text-white' : 'text-gray-800'}`}>
          最近创建
        </h2>
        <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
          {recentAgents.length === 0 ? (
            <p className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              暂无子代理记录
            </p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className={`absolute left-[7px] top-2 bottom-2 w-0.5 ${isDark ? 'bg-white/[0.06]' : 'bg-gray-200'}`}></div>

              {/* Timeline items */}
              <div className="space-y-4">
                {recentAgents.map((agent) => (
                  <div key={agent.id} className="relative flex gap-4">
                    {/* Timeline dot */}
                    <div className="relative z-10">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${isDark ? 'bg-[#1c2432]' : 'bg-gray-100'}`}>
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className={`flex-1 rounded-lg p-3 -mt-1 ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {agent.display_name || agent.name}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {formatTime(agent.created_at)}
                        </span>
                      </div>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {getProjectName(agent.project_id)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
