import { useState } from 'react'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { LayoutDashboard, Bot, Wrench, GraduationCap, Brain, Settings, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { ConsoleThemeProvider, useConsoleTheme } from '../../contexts/ConsoleThemeContext'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/console' },
  { icon: Bot, label: 'Agents', path: '/console/agents' },
  { icon: Wrench, label: 'Tools & Skills', path: '/console/tools' },
  { icon: GraduationCap, label: 'Learning', path: '/console/learning' },
  { icon: Brain, label: 'Memory', path: '/console/memory' },
  { icon: Settings, label: 'Settings', path: '/console/settings' },
]

function ConsoleLayoutInner() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isDark } = useConsoleTheme()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  const isActive = (path) => {
    if (path === '/console') return location.pathname === '/console'
    return location.pathname.startsWith(path)
  }
  
  return (
    <div className="flex h-screen">
      {/* Sidebar - always dark */}
      <aside 
        className={`flex flex-col bg-[#1a202c] border-r border-white/[0.06] transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* 标题行：Console + 折叠按钮 */}
        <div className={`px-5 py-5 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!sidebarCollapsed && <h1 className="text-xl font-bold text-white">Console</h1>}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg transition-all duration-300 hover:bg-white/10 text-white/60 hover:text-white"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        <nav className={`flex-1 py-2 space-y-1 transition-all duration-300 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              title={sidebarCollapsed ? item.label : undefined}
              className={`flex items-center rounded-md text-sm font-medium transition-all duration-300 ${
                sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <item.icon size={18} className="flex-shrink-0" />
              <span className={`whitespace-nowrap transition-all duration-300 ${
                sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
              }`}>{item.label}</span>
            </Link>
          ))}
        </nav>
        {/* Bottom back button */}
        <div className={`py-4 border-t border-white/10 transition-all duration-300 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          <button
            onClick={() => navigate('/chat')}
            title={sidebarCollapsed ? 'Back to Chat' : undefined}
            className={`flex items-center text-sm text-gray-400 hover:text-white transition-colors ${
              sidebarCollapsed ? 'justify-center w-full' : 'gap-2'
            }`}
          >
            <ArrowLeft size={16} className="flex-shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-300 ${
              sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
            }`}>Back to Chat</span>
          </button>
        </div>
      </aside>
      
      {/* Main content area */}
      <main className={`flex-1 overflow-auto ${isDark ? 'bg-[#0d1117]' : 'bg-gray-50'}`}>
        <Outlet />
      </main>
    </div>
  )
}

export default function ConsoleLayout() {
  return (
    <ConsoleThemeProvider>
      <ConsoleLayoutInner />
    </ConsoleThemeProvider>
  )
}
