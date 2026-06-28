import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  // 等待认证状态加载完成
  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    // 重定向到登录页，并记住目标页面
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
