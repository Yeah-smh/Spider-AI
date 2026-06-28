import { useState } from 'react'
import { 
  Settings, 
  Cpu, 
  Cloud, 
  Shield, 
  Key, 
  Eye, 
  EyeOff, 
  Trash2, 
  Copy, 
  Plus,
  Globe,
  Moon,
  Sun,
  Bell,
  Zap,
  Lock,
  AlertTriangle,
  Check
} from 'lucide-react'
import { useConsoleTheme } from '../../contexts/ConsoleThemeContext'

// Mock API Keys data
const mockApiKeys = [
  { id: 1, name: 'OpenAI API Key', key: 'sk-****...7a2f', created: 'Mar 1, 2026', status: 'Active' },
  { id: 2, name: 'DeepSeek API Key', key: 'ds-****...b3c1', created: 'Feb 15, 2026', status: 'Active' },
  { id: 3, name: 'Custom MCP Server', key: 'mcp-****...d4e5', created: 'Mar 10, 2026', status: 'Active' }
]

const tabs = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'apikeys', label: 'API Keys', icon: Key }
]

// Toggle Switch Component
function Toggle({ enabled, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-blue-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general')
  
  const { theme: consoleTheme, toggleTheme, isDark } = useConsoleTheme()
  
  // General settings state
  const [displayName, setDisplayName] = useState('Spider User')
  const [language, setLanguage] = useState('en')
  const [notifications, setNotifications] = useState({
    taskCompletion: true,
    memoryUpdates: true,
    systemAlerts: true
  })
  
  // Models settings state
  const [routingMode, setRoutingMode] = useState('smart')
  const [complexityThreshold, setComplexityThreshold] = useState(50)
  const [sensitiveDataDetection, setSensitiveDataDetection] = useState(true)
  
  // Privacy settings state
  const [sensoryMemoryLifetime, setSensoryMemoryLifetime] = useState('30min')
  const [workingMemory, setWorkingMemory] = useState('session')
  const [dataScope, setDataScope] = useState({
    fileContent: true,
    browsingHistory: false,
    codeRepository: true
  })
  const [cloudAuth, setCloudAuth] = useState({
    nonSensitiveData: true,
    code: true,
    personalInfo: false
  })
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  
  // API Keys state
  const [apiKeys, setApiKeys] = useState(mockApiKeys)
  const [showKeyValue, setShowKeyValue] = useState({})

  const handleSave = (section) => {
    console.log(`Saving ${section} settings...`)
    // Mock save operation
  }

  const handleClearMemories = () => {
    console.log('Clearing all memories...')
    setShowClearConfirm(false)
  }

  const handleCopyKey = (key) => {
    navigator.clipboard.writeText(key)
    console.log('Key copied to clipboard')
  }

  const handleRevokeKey = (id) => {
    setApiKeys(apiKeys.filter(k => k.id !== id))
  }

  return (
    <div className={`p-8 max-w-5xl mx-auto min-h-screen ${isDark ? 'bg-[#0d1117]' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="mb-8">
        <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Settings</h1>
        <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Customize your Spider AI experience</p>
      </div>

      {/* Tab Navigation */}
      <div className={`border-b mb-6 ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#3182ce] text-[#3182ce]'
                    : isDark ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="transition-all duration-200">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
            <div className="space-y-6">
              {/* Display Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#3182ce] focus:border-[#3182ce] outline-none ${isDark ? 'bg-[#1c2432] border-white/10 text-white' : 'border-gray-300'}`}
                  placeholder="Enter your display name"
                />
              </div>
              
              {/* Language */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Globe className="w-4 h-4 inline mr-2" />
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#3182ce] focus:border-[#3182ce] outline-none ${isDark ? 'bg-[#1c2432] border-white/10 text-white' : 'border-gray-300'}`}
                >
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                  <option value="ja">日本語</option>
                </select>
              </div>
              
              {/* Theme */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Theme</label>
                <div className="flex gap-3">
                  {[
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'dark', label: 'Dark', icon: Moon },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => toggleTheme(id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                        consoleTheme === id
                          ? 'border-[#3182ce] bg-blue-50 text-[#3182ce]'
                          : isDark ? 'border-white/10 text-gray-400 hover:border-white/20' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Notification Preferences */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Bell className="w-4 h-4 inline mr-2" />
                  Notification Preferences
                </label>
                <div className={`space-y-3 rounded-lg p-4 ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Agent task completion</span>
                    <Toggle 
                      enabled={notifications.taskCompletion} 
                      onChange={(v) => setNotifications({...notifications, taskCompletion: v})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Memory updates</span>
                    <Toggle 
                      enabled={notifications.memoryUpdates} 
                      onChange={(v) => setNotifications({...notifications, memoryUpdates: v})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>System alerts</span>
                    <Toggle 
                      enabled={notifications.systemAlerts} 
                      onChange={(v) => setNotifications({...notifications, systemAlerts: v})}
                    />
                  </div>
                </div>
              </div>
              
              {/* Save Button */}
              <div className={`pt-4 border-t ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
                <button
                  onClick={() => handleSave('general')}
                  className="bg-[#3182ce] hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Models Tab */}
        {activeTab === 'models' && (
          <div className="space-y-6">
            {/* Routing Strategy */}
            <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
              <div className="mb-4">
                <h3 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                  <Zap className="w-5 h-5 text-[#3182ce]" />
                  Routing Strategy
                </h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Configure how Spider AI routes between local and cloud models</p>
              </div>
              
              {/* Default Mode */}
              <div className="mb-6">
                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Default Mode</label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'local', label: 'Local First', desc: '优先本地，隐私最大化', icon: Cpu },
                    { id: 'cloud', label: 'Cloud First', desc: '优先云端，能力最大化', icon: Cloud },
                    { id: 'smart', label: 'Smart Route', desc: '智能路由，推荐', icon: Zap, recommended: true }
                  ].map(({ id, label, desc, icon: Icon, recommended }) => (
                    <button
                      key={id}
                      onClick={() => setRoutingMode(id)}
                      className={`relative p-4 rounded-lg border-2 text-left transition-all ${
                        routingMode === id
                          ? 'border-[#3182ce] bg-blue-50'
                          : isDark ? 'border-white/10 hover:border-white/20' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {recommended && (
                        <span className="absolute -top-2 right-2 bg-[#3182ce] text-white text-xs px-2 py-0.5 rounded-full">
                          Recommended
                        </span>
                      )}
                      <Icon className={`w-6 h-6 mb-2 ${routingMode === id ? 'text-[#3182ce]' : 'text-gray-400'}`} />
                      <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{label}</div>
                      <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Model Cards */}
            <div className="grid grid-cols-2 gap-6">
              {/* Local Model */}
              <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Cpu className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Local Model</h4>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-sm text-green-600">Online</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>当前模型</span>
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>Qwen3-0.6B</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>响应延迟</span>
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>~120ms</span>
                  </div>
                  <div className={`pt-3 border-t ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}`}>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>适用场景</span>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>日常对话、简单任务、隐私敏感数据</p>
                  </div>
                </div>
              </div>

              {/* Cloud Expert Model */}
              <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Cloud className="w-5 h-5 text-[#3182ce]" />
                  </div>
                  <div>
                    <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Cloud Expert Model</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-green-600">Available</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>当前模型</span>
                    <div className="flex gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>GPT-4o</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>DeepSeek-V3</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>状态</span>
                    <span className="font-medium text-green-600">Available</span>
                  </div>
                  <div className={`pt-3 border-t ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}`}>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>适用场景</span>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>复杂推理、代码生成、专业分析</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-switch Rules */}
            <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
              <h4 className={`font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>Auto-switch Rules</h4>
              
              {/* Complexity Threshold Slider */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>复杂度阈值（超过阈值自动切换到云端）</span>
                  <span className="font-medium text-[#3182ce]">{complexityThreshold}%</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Low</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={complexityThreshold}
                    onChange={(e) => setComplexityThreshold(Number(e.target.value))}
                    className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-[#3182ce] ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}
                  />
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>High</span>
                </div>
              </div>
              
              {/* Sensitive Data Detection */}
              <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
                <div>
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>敏感数据检测</span>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>检测到敏感数据时强制使用本地模型</p>
                </div>
                <Toggle enabled={sensitiveDataDetection} onChange={setSensitiveDataDetection} />
              </div>

              {/* Save Button */}
              <div className={`pt-6 border-t mt-6 ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
                <button
                  onClick={() => handleSave('models')}
                  className="bg-[#3182ce] hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Privacy Tab */}
        {activeTab === 'privacy' && (
          <div className="space-y-6">
            {/* Memory Retention */}
            <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
              <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                <Shield className="w-5 h-5 text-[#3182ce]" />
                Memory Retention
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Sensory memory lifetime</label>
                    <select
                      value={sensoryMemoryLifetime}
                      onChange={(e) => setSensoryMemoryLifetime(e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#3182ce] focus:border-[#3182ce] outline-none ${isDark ? 'bg-[#1c2432] border-white/10 text-white' : 'border-gray-300'}`}
                    >
                      <option value="15min">15 min</option>
                      <option value="30min">30 min</option>
                      <option value="1hour">1 hour</option>
                      <option value="2hours">2 hours</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Working memory</label>
                    <select
                      value={workingMemory}
                      onChange={(e) => setWorkingMemory(e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#3182ce] focus:border-[#3182ce] outline-none ${isDark ? 'bg-[#1c2432] border-white/10 text-white' : 'border-gray-300'}`}
                    >
                      <option value="session">Session only</option>
                      <option value="24hours">24 hours</option>
                      <option value="7days">7 days</option>
                    </select>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Long-term memory</span>
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Persists until you delete it manually</p>
                </div>
              </div>
            </div>

            {/* Data Scope Control */}
            <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
              <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                <Eye className="w-5 h-5 text-[#3182ce]" />
                Data Scope Control
              </h3>
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Allow file content analysis</span>
                  <Toggle 
                    enabled={dataScope.fileContent} 
                    onChange={(v) => setDataScope({...dataScope, fileContent: v})}
                  />
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Allow web browsing history</span>
                  <Toggle 
                    enabled={dataScope.browsingHistory} 
                    onChange={(v) => setDataScope({...dataScope, browsingHistory: v})}
                  />
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Allow code repository access</span>
                  <Toggle 
                    enabled={dataScope.codeRepository} 
                    onChange={(v) => setDataScope({...dataScope, codeRepository: v})}
                  />
                </div>
              </div>
            </div>

            {/* Cloud Authorization */}
            <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
              <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                <Lock className="w-5 h-5 text-[#3182ce]" />
                Cloud Authorization
              </h3>
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Allow cloud model for non-sensitive data</span>
                  <Toggle 
                    enabled={cloudAuth.nonSensitiveData} 
                    onChange={(v) => setCloudAuth({...cloudAuth, nonSensitiveData: v})}
                  />
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Allow cloud model for code</span>
                  <Toggle 
                    enabled={cloudAuth.code} 
                    onChange={(v) => setCloudAuth({...cloudAuth, code: v})}
                  />
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg border border-red-200 ${isDark ? 'bg-[#1c2432]' : 'bg-gray-50'}`}>
                  <div>
                    <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Allow cloud model for personal info</span>
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Personal data will only be processed locally
                    </p>
                  </div>
                  <Toggle 
                    enabled={cloudAuth.personalInfo} 
                    onChange={(v) => setCloudAuth({...cloudAuth, personalInfo: v})}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <div>
                  {!showClearConfirm ? (
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear All Memories
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-red-600 font-medium">Are you sure? This cannot be undone.</span>
                      <button
                        onClick={handleClearMemories}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${isDark ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleSave('privacy')}
                  className="bg-[#3182ce] hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'apikeys' && (
          <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
                    <th className={`text-left py-3 px-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Name</th>
                    <th className={`text-left py-3 px-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Key</th>
                    <th className={`text-left py-3 px-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Created</th>
                    <th className={`text-left py-3 px-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</th>
                    <th className={`text-right py-3 px-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((apiKey) => (
                    <tr key={apiKey.id} className={`border-b ${isDark ? 'border-white/[0.06] hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'}`}>
                      <td className={`py-4 px-4 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{apiKey.name}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-mono ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {showKeyValue[apiKey.id] ? apiKey.key.replace('****', '1234abcd') : apiKey.key}
                          </span>
                          <button 
                            onClick={() => setShowKeyValue({...showKeyValue, [apiKey.id]: !showKeyValue[apiKey.id]})}
                            className={`p-1 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                          >
                            {showKeyValue[apiKey.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                      <td className={`py-4 px-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{apiKey.created}</td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <Check className="w-3 h-3" />
                          {apiKey.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleCopyKey(apiKey.key)}
                            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-[#3182ce] hover:bg-white/5' : 'text-gray-600 hover:text-[#3182ce] hover:bg-blue-50'}`}
                          >
                            <Copy className="w-4 h-4" />
                            Copy
                          </button>
                          <button 
                            onClick={() => handleRevokeKey(apiKey.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Generate New Key Button */}
            <div className={`mt-6 pt-6 border-t ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
              <button className="flex items-center gap-2 bg-[#3182ce] hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                <Plus className="w-4 h-4" />
                Generate New Key
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
