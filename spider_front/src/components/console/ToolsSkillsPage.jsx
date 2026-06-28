import { useState, useEffect } from 'react'
import { 
  Wrench, 
  Puzzle, 
  Server, 
  ChevronDown, 
  ChevronRight,
  Zap,
  FileText,
  BarChart3,
  Languages,
  Image,
  Calendar,
  Loader2,
  AlertCircle,
  Trash2,
  X,
  Info
} from 'lucide-react'
import { useConsoleTheme } from '../../contexts/ConsoleThemeContext'
import { getMcpServers, deleteMcpServer, getSkills, getSkillDetail, deleteSkill } from '../../api/chat'

const skillIcons = {
  Zap: Zap,
  FileText: FileText,
  BarChart3: BarChart3,
  Languages: Languages,
  Image: Image,
  Calendar: Calendar
}

export default function ToolsSkillsPage() {
  const [expandedServers, setExpandedServers] = useState({})
  const [servers, setServers] = useState([])
  const [skills, setSkills] = useState([])
  const [loadingServers, setLoadingServers] = useState(true)
  const [loadingSkills, setLoadingSkills] = useState(true)
  const [errorServers, setErrorServers] = useState(null)
  const [errorSkills, setErrorSkills] = useState(null)
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [skillDetailLoading, setSkillDetailLoading] = useState(false)
  const [showSkillModal, setShowSkillModal] = useState(false)
  const { isDark } = useConsoleTheme()

  // 加载 MCP Servers
  useEffect(() => {
    loadMcpServers()
  }, [])

  // 加载 Skills
  useEffect(() => {
    loadSkills()
  }, [])

  const loadMcpServers = async () => {
    try {
      setLoadingServers(true)
      setErrorServers(null)
      const data = await getMcpServers()
      setServers(data?.data || data || [])
    } catch (err) {
      console.error('Failed to load MCP servers:', err)
      setErrorServers('加载 MCP Servers 失败')
    } finally {
      setLoadingServers(false)
    }
  }

  const loadSkills = async () => {
    try {
      setLoadingSkills(true)
      setErrorSkills(null)
      const data = await getSkills()
      setSkills(data?.data?.data || data?.data || [])
    } catch (err) {
      console.error('Failed to load skills:', err)
      setErrorSkills('加载 Skills 失败')
    } finally {
      setLoadingSkills(false)
    }
  }

  const toggleServer = (serverId) => {
    setExpandedServers(prev => ({
      ...prev,
      [serverId]: !prev[serverId]
    }))
  }

  const handleDeleteServer = async (serverId, e) => {
    e.stopPropagation()
    if (!confirm('确定要删除这个 MCP Server 吗？')) return
    
    try {
      await deleteMcpServer(serverId)
      setServers(prev => prev.filter(s => s.id !== serverId))
    } catch (err) {
      console.error('Failed to delete MCP server:', err)
      alert('删除失败: ' + err.message)
    }
  }

  const handleDeleteSkill = async (skillId) => {
    if (!confirm('确定要删除这个 Skill 吗？')) return
    
    try {
      await deleteSkill(skillId)
      setSkills(prev => prev.filter(s => s.id !== skillId))
      if (selectedSkill?.id === skillId) {
        setShowSkillModal(false)
        setSelectedSkill(null)
      }
    } catch (err) {
      console.error('Failed to delete skill:', err)
      alert('删除失败: ' + err.message)
    }
  }

  const handleViewSkillDetail = async (skill) => {
    try {
      setSkillDetailLoading(true)
      const detail = await getSkillDetail(skill.id)
      setSelectedSkill(detail?.data?.data || detail?.data || detail)
      setShowSkillModal(true)
    } catch (err) {
      console.error('Failed to load skill detail:', err)
      // 如果获取详情失败，至少显示列表中的基本信息
      setSelectedSkill(skill)
      setShowSkillModal(true)
    } finally {
      setSkillDetailLoading(false)
    }
  }

  const closeSkillModal = () => {
    setShowSkillModal(false)
    setSelectedSkill(null)
  }

  // 计算统计数据
  const connectedServers = servers.filter(s => s.is_enabled).length
  // 累加所有 MCP server 的 tools 数量
  const totalTools = servers.reduce((sum, s) => sum + (s.tools?.length || 0), 0)
  const activeSkills = skills.length

  return (
    <div className={`p-8 min-h-full ${isDark ? 'bg-[#0d1117]' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Tools & Skills</h1>
        <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Manage your MCP tools and installed skills</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl shadow-sm border p-4 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Server className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Connected Servers</p>
              <p className="text-2xl font-bold text-green-600">{connectedServers}</p>
            </div>
          </div>
        </div>
        <div className={`rounded-xl shadow-sm border p-4 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wrench className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Available Tools</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{totalTools}</p>
            </div>
          </div>
        </div>
        <div className={`rounded-xl shadow-sm border p-4 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Puzzle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Active Skills</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{activeSkills}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left Column: MCP Tools */}
        <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
          <div className="mb-4">
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>MCP Servers</h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Connected tool servers</p>
          </div>
          
          {/* Loading State */}
          {loadingServers && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-500' : 'text-blue-600'}`} />
              <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>加载中...</span>
            </div>
          )}
          
          {/* Error State */}
          {errorServers && !loadingServers && (
            <div className={`flex items-center justify-center py-12 rounded-lg ${isDark ? 'bg-red-900/20' : 'bg-red-50'}`}>
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-500">{errorServers}</span>
            </div>
          )}
          
          {/* Empty State */}
          {!loadingServers && !errorServers && servers.length === 0 && (
            <div className={`flex flex-col items-center justify-center py-12 rounded-lg ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
              <Server className={`w-12 h-12 mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>暂无 MCP Servers</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>您可以在项目中添加 MCP Server</p>
            </div>
          )}
          
          {/* Servers List */}
          {!loadingServers && !errorServers && servers.length > 0 && (
            <div className="space-y-3">
              {servers.map((server) => (
                <div key={server.id} className={`border rounded-lg ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}`}>
                  <div 
                    className={`flex items-center justify-between p-4 cursor-pointer ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                    onClick={() => toggleServer(server.id)}
                  >
                    <div className="flex items-center gap-3">
                      <button className="p-1">
                        {expandedServers[server.id] ? (
                          <ChevronDown className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        ) : (
                          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        )}
                      </button>
                      <Server className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                      <div>
                        <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>
                          {server.display_name || server.name}
                        </span>
                        {server.description && (
                          <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {server.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${server.is_enabled ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className={`text-sm ${server.is_enabled ? 'text-green-500' : 'text-red-500'}`}>
                          {server.is_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-[#1c2432] text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                        {server.transport || 'stdio'}
                      </span>
                      <button
                        onClick={(e) => handleDeleteServer(server.id, e)}
                        className={`p-1 rounded hover:bg-red-100 hover:text-red-600 transition-colors ${isDark ? 'text-gray-500 hover:bg-red-900/30' : 'text-gray-400'}`}
                        title="删除 MCP Server"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {expandedServers[server.id] && server.tools && server.tools.length > 0 && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="ml-10 flex flex-wrap gap-2">
                        {server.tools.map((tool, index) => (
                          <span 
                            key={index}
                            className={`px-3 py-1 text-sm rounded-full ${isDark ? 'bg-[#1c2432] text-gray-400' : 'bg-gray-100 text-gray-600'}`}
                          >
                            {typeof tool === 'string' ? tool : tool.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Skills */}
        <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
          <div className="mb-4">
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Installed Skills</h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Your AI capabilities</p>
          </div>
          
          {/* Loading State */}
          {loadingSkills && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-500' : 'text-blue-600'}`} />
              <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>加载中...</span>
            </div>
          )}
          
          {/* Error State */}
          {errorSkills && !loadingSkills && (
            <div className={`flex items-center justify-center py-12 rounded-lg ${isDark ? 'bg-red-900/20' : 'bg-red-50'}`}>
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-500">{errorSkills}</span>
            </div>
          )}
          
          {/* Empty State */}
          {!loadingSkills && !errorSkills && skills.length === 0 && (
            <div className={`flex flex-col items-center justify-center py-12 rounded-lg ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
              <Puzzle className={`w-12 h-12 mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>暂无 Skills</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>您可以在项目中添加 Skills</p>
            </div>
          )}
          
          {/* Skills List */}
          {!loadingSkills && !errorSkills && skills.length > 0 && (
            <div className="space-y-3">
              {skills.map((skill) => {
                const IconComponent = skillIcons[skill.icon] || Zap
                return (
                  <div 
                    key={skill.id} 
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${isDark ? 'border-white/[0.06] hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'}`}
                    onClick={() => handleViewSkillDetail(skill)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-[#1c2432]' : 'bg-gray-100'}`}>
                          <IconComponent className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{skill.name}</h3>
                          <p className={`text-sm mt-1 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {skill.description || '暂无描述'}
                          </p>
                          {skill.project_name && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                {skill.project_name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Info className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Usage Statistics */}
      <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-2 mb-4">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Usage Statistics</h2>
        </div>
        
        {/* 空状态提示 - 暂无使用统计数据 */}
        <div className={`flex flex-col items-center justify-center py-16 rounded-lg ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
          <BarChart3 className={`w-12 h-12 mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>暂无使用统计数据</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            工具和技能的调用统计功能即将上线
          </p>
        </div>
      </div>

      {/* Skill Detail Modal */}
      {showSkillModal && selectedSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className={`w-full max-w-lg rounded-xl shadow-xl ${isDark ? 'bg-[#161b22] border border-white/[0.06]' : 'bg-white border border-gray-200'}`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-[#1c2432]' : 'bg-gray-100'}`}>
                  {(() => {
                    const IconComponent = skillIcons[selectedSkill.icon] || Zap
                    return <IconComponent className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  })()}
                </div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                  {selectedSkill.name}
                </h3>
              </div>
              <button
                onClick={closeSkillModal}
                className={`p-1 rounded hover:bg-gray-100 ${isDark ? 'hover:bg-white/10 text-gray-400' : 'text-gray-500'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-4">
              {skillDetailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-blue-500' : 'text-blue-600'}`} />
                  <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>加载详情...</span>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <h4 className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>描述</h4>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedSkill.description || '暂无描述'}
                    </p>
                  </div>
                  
                  {selectedSkill.project_name && (
                    <div className="mb-4">
                      <h4 className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>所属项目</h4>
                      <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        {selectedSkill.project_name}
                      </span>
                    </div>
                  )}
                  
                  {selectedSkill.content && (
                    <div className="mb-4">
                      <h4 className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>内容</h4>
                      <pre className={`p-3 rounded-lg text-xs overflow-auto max-h-48 ${isDark ? 'bg-[#0d1117] text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
                        {selectedSkill.content}
                      </pre>
                    </div>
                  )}
                  
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    ID: {selectedSkill.id}
                  </div>
                </>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className={`flex justify-end gap-2 p-4 border-t ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
              <button
                onClick={closeSkillModal}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                关闭
              </button>
              <button
                onClick={() => handleDeleteSkill(selectedSkill.id)}
                className="flex items-center gap-1 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
