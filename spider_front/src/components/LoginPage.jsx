import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Github, MessageCircle, Smartphone } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register, isAuthenticated, sendSmsCode, smsLogin } = useAuth()

  // 已登录则自动跳转
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/chat'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated])

  // 视频 refs
  const video1Ref = useRef(null)
  const video2Ref = useRef(null)

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [loginType, setLoginType] = useState('password') // 'password' | 'sms'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // 手机号登录相关状态
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [autoTyping, setAutoTyping] = useState(false)  // 自动输入状态
  const [receivedCode, setReceivedCode] = useState('')  // 接收到的验证码

  // 验证码倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 获取时间问候语
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 12) return 'Good morning,'
    if (hour >= 12 && hour < 18) return 'Good afternoon,'
    if (hour >= 18 && hour < 24) return 'Good evening,'
    return 'Hey there,'
  }

  // 手机号输入处理（只允许数字，最多11位）
  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 11)
    setPhone(value)
  }

  // 验证码输入处理（只允许数字，最多6位）
  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
    setSmsCode(value)
  }

  // 发送验证码
  const handleSendCode = async () => {
    if (countdown > 0 || isSendingCode) return
    
    setError('')
    setIsSendingCode(true)
    
    const result = await sendSmsCode(phone)
    
    if (result.success) {
      setCountdown(60)
      // 1秒后开始自动输入
      if (result.code) {
        setReceivedCode(result.code)
        setTimeout(() => {
          typeCodeAndLogin(result.code)
        }, 1000)
      }
    } else {
      setError(result.error)
    }
    
    setIsSendingCode(false)
  }

  // 打字机效果输入 + 自动登录
  const typeCodeAndLogin = async (code) => {
    setAutoTyping(true)
    setSmsCode('') // 清空
    
    // 逐个字符输入
    for (let i = 0; i < code.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 150)) // 每个字符150ms
      setSmsCode(code.slice(0, i + 1))
    }
    
    // 输入完成后，等待300ms再提交
    await new Promise(resolve => setTimeout(resolve, 300))
    setAutoTyping(false)
    
    // 自动提交登录
    handleAutoLogin(code)
  }

  // 自动登录
  const handleAutoLogin = async (code) => {
    setIsLoading(true)
    const result = await smsLogin(phone, code)
    
    if (result.success) {
      const from = location.state?.from?.pathname || '/chat'
      navigate(from, { replace: true })
    } else {
      setError(result.error)
    }
    
    setIsLoading(false)
  }

  // 手机号登录提交
  const handleSmsLogin = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    const result = await smsLogin(phone, smsCode)
    
    if (result.success) {
      const from = location.state?.from?.pathname || '/chat'
      navigate(from, { replace: true })
    } else {
      setError(result.error)
    }
    
    setIsLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setIsLoading(false)
          return
        }
        const result = await register(username, password)
        if (!result.success) {
          setError(result.error)
          setIsLoading(false)
          return
        }
      } else {
        const result = await login(username, password)
        if (!result.success) {
          setError(result.error)
          setIsLoading(false)
          return
        }
      }

      const from = location.state?.from?.pathname || '/chat'
      navigate(from, { replace: true })
    } catch (err) {
      setError('Operation failed, please try again')
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
    setPassword('')
    setConfirmPassword('')
    setLoginType('password') // 切换模式时重置为密码登录
  }
  
  const switchLoginType = (type) => {
    setLoginType(type)
    setError('')
  }

  const handleGithubLogin = () => {
    console.log('GitHub login clicked')
  }

  const handleWechatLogin = () => {
    console.log('WeChat login clicked')
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#1a1a1a]">
      {/* 左侧表单区域 - 60% */}
      <div className="w-full lg:w-[60%] relative flex items-center">
        {/* 表单容器 - 偏左居中 */}
        <div className="relative z-10 w-full max-w-md mx-auto lg:ml-[15%] lg:mr-auto px-8 animate-fadeInUp">
          {/* 时间问候 + 艺术字 */}
          <div className="mb-12">
            <p className="text-3xl font-light text-white/80">{getGreeting()}</p>
            <p 
              className="text-5xl italic font-serif text-white tracking-wide mt-1"
              style={{ textShadow: '0 0 40px rgba(230,36,41,0.15)' }}
            >
              My friends~
            </p>
          </div>

          {/* 登录方式切换（仅登录模式显示） */}
          {mode === 'login' && (
            <div className="flex items-center gap-2 mb-6 p-1 bg-white/[0.03] rounded-xl border border-white/[0.08]">
              <button
                type="button"
                onClick={() => switchLoginType('password')}
                className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  loginType === 'password'
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                账号密码登录
              </button>
              <button
                type="button"
                onClick={() => switchLoginType('sms')}
                className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  loginType === 'sms'
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                <Smartphone size={16} />
                手机号登录
              </button>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-500/15 border border-red-500/20 text-red-300 rounded-xl p-3 text-sm mb-6">
              {error}
            </div>
          )}

          {/* 手机号登录表单 */}
          {mode === 'login' && loginType === 'sms' ? (
            <form onSubmit={handleSmsLogin} className="space-y-4">
              {/* 手机号输入框 */}
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="请输入手机号"
                className="w-full h-14 bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 text-white text-base placeholder-white/25 focus:border-white/20 focus:bg-white/[0.05] focus:outline-none transition-all"
              />

              {/* 验证码输入框 + 获取按钮 */}
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={smsCode}
                    onChange={handleCodeChange}
                    placeholder={autoTyping ? '' : '请输入验证码'}
                    disabled={autoTyping}
                    className="w-full h-14 bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 text-white text-base placeholder-white/25 focus:border-white/20 focus:bg-white/[0.05] focus:outline-none transition-all disabled:opacity-70"
                  />
                  {autoTyping && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white/60 animate-pulse" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || isSendingCode || phone.length !== 11}
                  className="w-32 h-14 bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white/80"
                >
                  {isSendingCode ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : countdown > 0 ? (
                    `${countdown}s后重新获取`
                  ) : (
                    '获取验证码'
                  )}
                </button>
              </div>

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={isLoading || autoTyping || phone.length !== 11 || smsCode.length < 4}
                className="w-full h-14 bg-white text-[#1a1a1a] rounded-xl font-semibold text-base hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    登录中...
                  </>
                ) : autoTyping ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    自动输入中...
                  </>
                ) : (
                  '登录'
                )}
              </button>
            </form>
          ) : (
            /* 账号密码表单 */
            <form onSubmit={handleSubmit} className="space-y-4">
            {/* 用户名输入框 */}
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Phone / Email"
              className="w-full h-14 bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 text-white text-base placeholder-white/25 focus:border-white/20 focus:bg-white/[0.05] focus:outline-none transition-all"
            />

            {/* 密码输入框 */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Password"
                className="w-full h-14 bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 pr-12 text-white text-base placeholder-white/25 focus:border-white/20 focus:bg-white/[0.05] focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* 确认密码（仅注册模式） */}
            {mode === 'register' && (
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Confirm password"
                  className="w-full h-14 bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 pr-12 text-white text-base placeholder-white/25 focus:border-white/20 focus:bg-white/[0.05] focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            )}

            {/* Remember me + Forgot password（仅登录模式） */}
            {mode === 'login' && (
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-white/40">Remember me</span>
                <button
                  type="button"
                  className="text-sm text-white/40 hover:text-white/60 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-white text-[#1a1a1a] rounded-xl font-semibold text-base hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {mode === 'login' ? 'Signing in...' : 'Signing up...'}
                </>
              ) : (
                mode === 'login' ? 'Sign in' : 'Sign up'
              )}
            </button>
          </form>
          )}

          {/* 切换登录/注册 */}
          <div className="mt-6 text-sm text-white/50 text-center">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-[#E62429] hover:text-[#ff3a3f] transition-colors font-medium"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-[#E62429] hover:text-[#ff3a3f] transition-colors font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </div>

          {/* 分割线 */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-white/30 text-sm">OR</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          {/* 第三方登录按钮 */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGithubLogin}
              className="w-full h-12 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] rounded-xl font-medium transition-all flex items-center justify-center gap-3 text-white"
            >
              <Github size={20} />
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={handleWechatLogin}
              className="w-full h-12 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] rounded-xl font-medium transition-all flex items-center justify-center gap-3 text-white"
            >
              <MessageCircle size={20} />
              Continue with WeChat
            </button>
          </div>

          {/* 底部条款 */}
          <p className="mt-10 text-xs text-white/40 text-center leading-relaxed">
            By signing in, you agree to our{' '}
            <span className="text-white/50 hover:text-white cursor-pointer transition-colors">
              Terms of Service
            </span>
            {' '}and{' '}
            <span className="text-white/50 hover:text-white cursor-pointer transition-colors">
              Privacy Policy
            </span>
          </p>
        </div>
      </div>

      {/* 右侧视频浮窗区域 - 40% - 桌面端显示 */}
      <div className="hidden lg:flex lg:w-[40%] items-center justify-center pl-0 pr-12">
        {/* 卡片组容器 - 整体悬浮动画 */}
        <div className="relative w-[420px] h-[480px] animate-float">
          {/* 卡片1 - 底层/后面 */}
          <div 
            className="absolute left-0 top-0 w-[280px] h-[380px] rounded-2xl overflow-hidden border border-white/10 rotate-[-6deg] scale-95 z-0 transition-all duration-300 hover:scale-105 hover:z-30 cursor-pointer"
            style={{ 
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
            onMouseEnter={() => video1Ref.current?.play()}
            onMouseLeave={() => video1Ref.current?.pause()}
          >
            <video 
              ref={video1Ref}
              muted 
              loop 
              playsInline 
              disablePictureInPicture
              disableRemotePlayback
              controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
              className="w-full h-full object-cover"
            >
              <source src="/learn.mp4" type="video/mp4" />
            </video>
          </div>
          
          {/* 卡片2 - 顶层/前面 */}
          <div 
            className="absolute right-0 bottom-8 w-[280px] h-[380px] rounded-2xl overflow-hidden border border-white/10 rotate-[3deg] z-10 transition-all duration-300 hover:scale-105 hover:z-30 cursor-pointer"
            style={{ 
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
            onMouseEnter={() => video2Ref.current?.play()}
            onMouseLeave={() => video2Ref.current?.pause()}
          >
            <video 
              ref={video2Ref}
              muted 
              loop 
              playsInline 
              disablePictureInPicture
              disableRemotePlayback
              controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
              className="w-full h-full object-cover"
            >
              <source src="/workflow_graph.mp4" type="video/mp4" />
            </video>
          </div>
          
          {/* Spider AI 艺术字 */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-lg italic font-serif tracking-widest">
            Spider AI
          </div>
        </div>
      </div>

      {/* CSS 动画 */}
      <style>{`
        /* 隐藏视频浏览器默认控件 */
        video::-webkit-media-controls {
          display: none !important;
        }
        video::-webkit-media-controls-enclosure {
          display: none !important;
        }
        video::-webkit-media-controls-overlay-play-button {
          display: none !important;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.5s ease-out forwards;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
