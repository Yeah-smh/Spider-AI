import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ConsoleThemeProvider } from './contexts/ConsoleThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './components/LoginPage'
import WelcomePage from './components/WelcomePage'
import ChatPage from './components/ChatPage'
import ConsoleLayout from './components/console/ConsoleLayout'
import DashboardPage from './components/console/DashboardPage'
import AgentsPage from './components/console/AgentsPage'
import ToolsSkillsPage from './components/console/ToolsSkillsPage'
import MemoryPage from './components/console/MemoryPage'
import LearningPage from './components/console/LearningPage'
import SettingsPage from './components/console/SettingsPage'
import ProjectsPage from './components/console/ProjectsPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<WelcomePage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/projects" element={
              <ConsoleThemeProvider>
                <ProjectsPage />
              </ConsoleThemeProvider>
            } />
            <Route path="/console" element={<ConsoleLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="agents" element={<AgentsPage />} />
              <Route path="tools" element={<ToolsSkillsPage />} />
              <Route path="learning" element={<LearningPage />} />
              <Route path="memory" element={<MemoryPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
