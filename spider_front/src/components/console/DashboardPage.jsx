import { useState, useEffect } from 'react'
import { MessageSquare, Zap, Bot, Wrench, GraduationCap, Brain } from 'lucide-react'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { useConsoleTheme } from '../../contexts/ConsoleThemeContext'
import { getDashboardStats } from '../../api/chat'



export default function DashboardPage() {
  const { isDark } = useConsoleTheme()
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(7)  // 默认 7 天
  const timeLabel = { 1: 'today', 7: 'past 7 days', 30: 'past 30 days' }

  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true)
      try {
        const res = await getDashboardStats(timeRange)
        setStats(res.data)
      } catch (err) {
        console.error('Dashboard stats error:', err)
      } finally {
        setStatsLoading(false)
      }
    }
    fetchStats()
  }, [timeRange])  // timeRange 变化时重新请求
  
  return (
    <div className={`${isDark ? 'bg-[#0d1117]' : 'bg-[#f8f9fa]'} p-5 h-full flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Dashboard</h1>
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Your Spider AI at a glance</p>
        </div>
        {/* Time range selector */}
        <div className={`flex items-center gap-1 rounded-lg p-1 border ${
          isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-gray-100 border-gray-200'
        }`}>
          {[
            { label: 'Today', value: 1 },
            { label: '7 Days', value: 7 },
            { label: '30 Days', value: 30 },
          ].map(item => (
            <button
              key={item.value}
              onClick={() => setTimeRange(item.value)}
              className={`px-3 py-1.5 text-xs rounded-md ${
                timeRange === item.value
                  ? 'bg-blue-600 text-white font-medium'
                  : (isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900')
              } transition`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid gap-4 flex-1 min-h-0" style={{
        gridTemplateColumns: '1.8fr 1fr 1fr',
        gridTemplateRows: '1.2fr 1fr'
      }}>
        
        {/* Card 1: Token Usage - Large card */}
        <div 
          className={`rounded-2xl border p-5 flex flex-col overflow-hidden transition-colors ${
            isDark 
              ? 'bg-[#161b22] border-white/[0.06] hover:border-white/[0.12]' 
              : 'bg-white border-gray-100 shadow-sm hover:border-gray-200'
          }`}
          style={{ gridColumn: '1 / 2', gridRow: '1 / 2' }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Token Usage</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats?.token_usage?.total?.toLocaleString() || '0'}</span>
              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>input: {stats?.token_usage?.input?.toLocaleString() || '0'} / output: {stats?.token_usage?.output?.toLocaleString() || '0'}</span>
            </div>
          </div>
          
          {/* Chart area */}
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.token_usage?.daily || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#ffffff08' : '#e5e7eb'} vertical={false} />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDark ? '#1c2432' : '#fff', 
                    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb', 
                    borderRadius: '8px', 
                    color: isDark ? '#e5e7eb' : '#374151'
                  }}
                  formatter={(value) => [`${value.toLocaleString()} tokens`, 'Usage']}
                />
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#tokenGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          {/* Bottom text */}
          <p className={`text-xs mt-2 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {timeRange === 1 
              ? `Total: ${(stats?.token_usage?.total || 0).toLocaleString()} tokens · ${timeLabel[timeRange]}`
              : `Daily avg: ${(stats?.token_usage?.daily_avg || 0).toLocaleString()} tokens · ${timeLabel[timeRange]}`
            }
          </p>
        </div>

        {/* Card 2: Conversations */}
        <div 
          className={`rounded-2xl border p-5 flex flex-col overflow-hidden transition-colors ${
            isDark 
              ? 'bg-[#161b22] border-white/[0.06] hover:border-white/[0.12]' 
              : 'bg-white border-gray-100 shadow-sm hover:border-gray-200'
          }`}
          style={{ gridColumn: '2 / 3', gridRow: '1 / 2' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <span className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Conversations</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats?.conversations?.total_sessions || 0}</span>
            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>sessions</span>
          </div>
          <span className="text-green-400 text-xs mt-1">{`+${stats?.conversations?.week_new || 0} ${timeLabel[timeRange]}`}</span>
          
          <div className="flex-1" />
          
          {/* Mini sparkline bar chart */}
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.conversations?.daily || []} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey="count" fill="#22d3ee" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <p className={`text-xs mt-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{stats?.conversations?.total_messages || 0} messages total</p>
        </div>

        {/* Card 3: Active Agents */}
        <div
          className={`rounded-2xl border p-5 flex flex-col overflow-hidden transition-colors ${
            isDark
              ? 'bg-[#161b22] border-white/[0.06] hover:border-white/[0.12]'
              : 'bg-white border-gray-100 shadow-sm hover:border-gray-200'
          }`}
          style={{ gridColumn: '3 / 4', gridRow: '1 / 2' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-purple-400" />
            <span className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Active Agents</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {stats?.agents_stats?.total_agents || 0}
            </span>
            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
              {stats?.agents_stats?.total_projects || 0} projects
            </span>
          </div>

          {/* Recent Agents list */}
          <div className="mt-auto space-y-2">
            <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Recent Agents</p>
            {stats?.agents_stats?.recent_agents?.slice(0, 4).map((agent, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span className={`text-xs flex-1 truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {agent.name}
                </span>
                <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                  {agent.project_name}
                </span>
              </div>
            ))}
            {(stats?.agents_stats?.recent_agents?.length || 0) > 4 && (
              <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                +{(stats?.agents_stats?.recent_agents?.length || 0) - 4} more
              </p>
            )}
          </div>
        </div>

        {/* Card 4: Learning */}
        <div
          className={`rounded-2xl border p-5 flex flex-col overflow-hidden transition-colors ${
            isDark
              ? 'bg-[#161b22] border-white/[0.06] hover:border-white/[0.12]'
              : 'bg-white border-gray-100 shadow-sm hover:border-gray-200'
          }`}
          style={{ gridColumn: '1 / 2', gridRow: '2 / 3' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-4 h-4 text-orange-400" />
            <span className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Learning</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {stats?.learning_stats?.auto_memories || 0}
            </span>
            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>learned</span>
          </div>

          {/* Learning progress or status */}
          <div className="flex-1 flex items-center justify-center">
            {(() => {
              const totalSessions = stats?.learning_stats?.total_sessions || 0
              const completedSessions = stats?.learning_stats?.completed_sessions || 0
              const lastSession = stats?.learning_stats?.last_session

              if (totalSessions === 0) {
                // 无学习会话时显示空状态
                return (
                  <div className="text-center">
                    <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      No learning sessions yet
                    </div>
                    <div className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      Start learning to generate memories
                    </div>
                  </div>
                )
              }

              // 显示学习完成率
              const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0
              return (
                <svg viewBox="0 0 80 80" className="w-20 h-20">
                  <circle cx="40" cy="40" r="32" fill="none" stroke={isDark ? '#1e293b' : '#e5e7eb'} strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="32"
                    fill="none"
                    stroke="orange"
                    strokeWidth="6"
                    strokeDasharray={`${completionRate * 2.01} ${100 * 2.01}`}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                  />
                  <text x="40" y="40" textAnchor="middle" dominantBaseline="central" fill={isDark ? 'white' : '#111827'} fontSize="14" fontWeight="bold">{completionRate}%</text>
                </svg>
              )
            })()}
          </div>

          <p className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {stats?.learning_stats?.total_sessions || 0} sessions · {stats?.learning_stats?.total_generated || 0} memories generated
          </p>
        </div>

        {/* Card 5: Memory */}
        <div
          className={`rounded-2xl border p-5 flex flex-col overflow-hidden transition-colors ${
            isDark
              ? 'bg-[#161b22] border-white/[0.06] hover:border-white/[0.12]'
              : 'bg-white border-gray-100 shadow-sm hover:border-gray-200'
          }`}
          style={{ gridColumn: '2 / 3', gridRow: '2 / 3' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-pink-400" />
            <span className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Memory</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {stats?.memory_stats?.total_longterm || 0}
            </span>
            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>memories</span>
          </div>

          {/* Memory type stats */}
          <div className="mt-auto space-y-2">
            {(() => {
              const byType = stats?.memory_stats?.by_type || {}
              const typeConfig = {
                preference: { color: 'bg-blue-400', label: '偏好' },
                knowledge: { color: 'bg-green-400', label: '知识' },
                decision: { color: 'bg-purple-400', label: '决策' },
                experience: { color: 'bg-orange-400', label: '经验' }
              }
              const types = Object.keys(byType)
              if (types.length === 0) {
                return <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无记忆</p>
              }
              const total = stats?.memory_stats?.total_longterm || 1
              return types.map(type => {
                const count = byType[type] || 0
                const config = typeConfig[type] || { color: 'bg-gray-400', label: type }
                const percent = Math.round((count / total) * 100)
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className={`text-xs w-10 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{config.label}</span>
                    <div className={`flex-1 h-2 rounded-full ${isDark ? 'bg-[#1e293b]' : 'bg-gray-100'}`}>
                      <div className={`h-2 ${config.color} rounded-full`} style={{ width: `${percent}%` }} />
                    </div>
                    <span className={`text-xs w-6 text-right ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{count}</span>
                  </div>
                )
              })
            })()}
          </div>

          {/* Recent memories list */}
          {(stats?.memory_stats?.recent_memories?.length || 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Recent Memories</p>
              {stats?.memory_stats?.recent_memories?.slice(0, 3).map((memory, i) => (
                <div key={i} className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                  <span className={`text-xs flex-1 truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {memory.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 6: Tools & Skills */}
        <div
          className={`rounded-2xl border p-5 flex flex-col overflow-hidden transition-colors ${
            isDark
              ? 'bg-[#161b22] border-white/[0.06] hover:border-white/[0.12]'
              : 'bg-white border-gray-100 shadow-sm hover:border-gray-200'
          }`}
          style={{ gridColumn: '3 / 4', gridRow: '2 / 3' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-4 h-4 text-indigo-400" />
            <span className={`text-xs uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Tools & Skills</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {(stats?.tools_skills_stats?.total_skills || 0) + (stats?.tools_skills_stats?.enabled_mcp_count || 0)}
            </span>
            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>active</span>
          </div>

          {/* MCP Servers */}
          <div className="mt-4">
            <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              MCP Servers ({stats?.tools_skills_stats?.enabled_mcp_count || 0}/{stats?.tools_skills_stats?.total_mcp_servers || 0})
            </p>
            <div className="flex flex-wrap gap-2">
              {stats?.tools_skills_stats?.mcp_names?.map((name, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div className="mt-auto">
            <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Skills ({stats?.tools_skills_stats?.total_skills || 0})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {stats?.tools_skills_stats?.skill_names?.slice(0, 3).map((name, i) => (
                <span
                  key={i}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}
                >
                  {name}
                </span>
              ))}
              {(stats?.tools_skills_stats?.skill_names?.length || 0) > 3 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                  +{(stats?.tools_skills_stats?.skill_names?.length || 0) - 3}
                </span>
              )}
            </div>
          </div>

          <p className={`text-xs mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {stats?.tools_skills_stats?.total_mcp_servers || 0} servers · {stats?.tools_skills_stats?.total_skills || 0} skills
          </p>
        </div>

      </div>
    </div>
  )
}
