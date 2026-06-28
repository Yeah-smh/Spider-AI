import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/chat'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // 从 localStorage 恢复登录态（普通刷新保持登录）
  const [token, setToken] = useState(() => localStorage.getItem('spider_token'))
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('spider_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState(false)

  // 页面刷新时验证 token 有效性
  useEffect(() => {
    const loadUser = async () => {
      const storedToken = localStorage.getItem('spider_token')
      if (storedToken) {
        try {
          const response = await api.get('/auth/me')
          const userData = response.data
          localStorage.setItem('spider_user', JSON.stringify(userData))
          setUser(userData)
        } catch {
          // token 失效，清除登录状态
          localStorage.removeItem('spider_token')
          localStorage.removeItem('spider_user')
          setToken(null)
          setUser(null)
        }
      }
    }
    loadUser()
  }, [])

  // 真实登录：调用后端 /auth/login
  const login = async (username, password) => {
    if (!username || !password) {
      return { success: false, error: '用户名和密码不能为空' }
    }
    
    try {
      const response = await api.post('/auth/login', { username, password })
      const { access_token, user: userData } = response.data
      
      localStorage.setItem('spider_token', access_token)
      localStorage.setItem('spider_user', JSON.stringify(userData))
      
      setToken(access_token)
      setUser(userData)
      
      return { success: true }
    } catch (error) {
      const detail = error.response?.data?.detail || '登录失败，请重试'
      return { success: false, error: detail }
    }
  }

  // 真实注册：调用后端 /auth/register
  const register = async (username, password, email = null) => {
    if (!username || !password) {
      return { success: false, error: '用户名和密码不能为空' }
    }
    
    if (password.length < 6) {
      return { success: false, error: '密码至少需要6个字符' }
    }
    
    try {
      const response = await api.post('/auth/register', { username, password, email })
      const { access_token, user: userData } = response.data
      
      localStorage.setItem('spider_token', access_token)
      localStorage.setItem('spider_user', JSON.stringify(userData))
      
      setToken(access_token)
      setUser(userData)
      
      return { success: true }
    } catch (error) {
      const detail = error.response?.data?.detail || '注册失败，请重试'
      return { success: false, error: detail }
    }
  }

  // 发送短信验证码
  const sendSmsCode = async (phone) => {
    if (!phone) {
      return { success: false, error: '手机号不能为空' }
    }
    
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return { success: false, error: '请输入有效的手机号' }
    }
    
    try {
      const response = await api.post('/auth/sms/send', { phone })
      return { 
        success: true, 
        expiresIn: response.data.expires_in,
        code: response.data.code  // 返回验证码给组件使用
      }
    } catch (error) {
      const detail = error.response?.data?.detail || '验证码发送失败，请重试'
      return { success: false, error: detail }
    }
  }

  // 短信验证码登录
  const smsLogin = async (phone, code) => {
    if (!phone || !code) {
      return { success: false, error: '手机号和验证码不能为空' }
    }
    
    try {
      const response = await api.post('/auth/sms/verify', { phone, code })
      const { access_token, user: userData } = response.data
      
      localStorage.setItem('spider_token', access_token)
      localStorage.setItem('spider_user', JSON.stringify(userData))
      
      setToken(access_token)
      setUser(userData)
      
      return { success: true }
    } catch (error) {
      const detail = error.response?.data?.detail || '验证码错误或已过期'
      return { success: false, error: detail }
    }
  }

  // 退出登录
  const logout = () => {
    localStorage.removeItem('spider_token')
    localStorage.removeItem('spider_user')
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    register,
    logout,
    sendSmsCode,
    smsLogin
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
