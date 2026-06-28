import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowDown, ChevronLeft, ChevronRight, ChevronDown, MoreVertical, LogOut, Home, Settings, SmilePlus, PenLine, HelpCircle, BookOpen, Monitor, Sun, Moon, Pin, Plus, Search, MessageSquare, FolderOpen, LayoutGrid, LayoutDashboard, X, Workflow, GitBranch, Loader2, CornerDownLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getSessions, getSessionMessages, deleteSession, renameSession, sendDualChat, predictInput, sendPredictFeedback } from '../api/chat'
import MarkdownRenderer from './MarkdownRenderer'

// ===== 模块级状态：用于在组件卸载时保持 loading 状态 =====
// 这样切换页面后返回，loading 动画可以正确恢复
const globalChatState = {
  isLoading: false,
  messages: [],
  currentSessionId: null,
  hasStartedChat: false
}

// 获取时间问候语
const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) return 'Good morning,'
  if (hour >= 12 && hour < 18) return 'Good afternoon,'
  if (hour >= 18 && hour < 24) return 'Good evening,'
  return 'Hey there,'
}

// 随机名言列表
const spiderQuotes = [
  'Your friendly neighborhood Spider AI, at your service.',
  'Greetings from your friendly neighborhood Spider AI~',
  'Hey, nice hair! Or should I say, nice you!',
  'Just doing whatever a spider can.',
  'Your problems will dissolve in two hours. Cheers!',
  "I'm not a big shot like OpenAI. I just... do my part.",
]

// 可折叠的用户消息组件
const CollapsibleUserMessage = ({ content, isDarkBg, resolvedTheme, bgMode }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentRef = useRef(null)
  const [needsCollapse, setNeedsCollapse] = useState(false)

  const MAX_HEIGHT = 150 // 约6行文字的高度（px）

  useEffect(() => {
    if (contentRef.current) {
      setNeedsCollapse(contentRef.current.scrollHeight > MAX_HEIGHT)
    }
  }, [content])

  // 根据背景模式确定渐变遮罩颜色
  const getGradientClass = () => {
    if (bgMode === 'video') {
      return 'bg-gradient-to-t from-white/15 to-transparent'
    }
    if (isDarkBg) {
      return 'bg-gradient-to-t from-[#2a2a2a] to-transparent'
    }
    return 'bg-gradient-to-t from-[#5d4e37] to-transparent'
  }

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className={`overflow-hidden transition-all duration-300 ${
          !isExpanded && needsCollapse ? 'max-h-[150px]' : 'max-h-none'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>

      {/* 渐变遮罩 - 折叠时显示 */}
      {needsCollapse && !isExpanded && (
        <div className={`absolute bottom-0 left-0 right-0 h-12 pointer-events-none ${getGradientClass()}`} />
      )}

      {/* Show more / Show less 按钮 */}
      {needsCollapse && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`mt-1 text-sm transition-colors ${
            isDarkBg
              ? 'text-white/50 hover:text-white/80'
              : 'text-white/60 hover:text-white/90'
          }`}
        >
          {isExpanded ? 'Show less 显示更少' : 'Show more 显示更多'}
        </button>
      )}
    </div>
  )
}

// 双答案卡片组件
const DualAnswerCard = ({ answers, isDarkBg, bgMode, isStreaming }) => {
  const labels = [
    { text: '精准回答', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', temp: 'temp=0.3' },
    { text: '深度分析', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', temp: 'temp=0.9' }
  ]
  const labelsLight = [
    { text: '精准回答', color: 'bg-blue-100 text-blue-700 border-blue-200', temp: 'temp=0.3' },
    { text: '深度分析', color: 'bg-purple-100 text-purple-700 border-purple-200', temp: 'temp=0.9' }
  ]

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full">
      {answers.map((answer, idx) => {
        const label = isDarkBg ? labels[idx] : labelsLight[idx]
        return (
          <div
            key={idx}
            className={`flex-1 min-w-0 rounded-xl border p-4 transition-all ${
              isDarkBg
                ? 'bg-white/[0.04] border-white/[0.1] backdrop-blur-sm'
                : 'bg-white/60 border-[#e8d5b7]/60'
            }`}
          >
            {/* 标签头 */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${label.color}`}>
                {label.text}
              </span>
              <span className={`text-[10px] font-mono ${
                isDarkBg ? 'text-white/30' : 'text-[#3d3529]/30'
              }`}>
                {label.temp}
              </span>
            </div>
            {/* 内容 */}
            <div className={`text-sm ${bgMode === 'video' ? 'video-mode-markdown' : !isDarkBg ? 'light-mode-markdown' : ''}`}>
              {answer.isError ? (
                <p className={`text-sm ${isDarkBg ? 'text-red-400' : 'text-red-600'}`}>{answer.content || '此答案生成失败'}</p>
              ) : answer.content ? (
                <MarkdownRenderer content={answer.content} />
              ) : isStreaming ? (
                <div className="flex items-center gap-1.5 py-2">
                  <span className={`w-2 h-2 rounded-full animate-pulse ${
                    isDarkBg ? 'bg-white/50' : 'bg-[#8b7355]/70'
                  }`} style={{ animationDelay: '0ms', animationDuration: '1s' }} />
                  <span className={`w-2 h-2 rounded-full animate-pulse ${
                    isDarkBg ? 'bg-white/50' : 'bg-[#8b7355]/70'
                  }`} style={{ animationDelay: '300ms', animationDuration: '1s' }} />
                  <span className={`w-2 h-2 rounded-full animate-pulse ${
                    isDarkBg ? 'bg-white/50' : 'bg-[#8b7355]/70'
                  }`} style={{ animationDelay: '600ms', animationDuration: '1s' }} />
                </div>
              ) : null}
            </div>
            {/* Token 用量 */}
            {answer.usage && (
              <div className={`flex items-center gap-3 mt-2 pt-2 border-t ${
                isDarkBg ? 'border-white/[0.06]' : 'border-[#3d3529]/[0.06]'
              }`}>
                <span className={`text-[11px] font-mono ${isDarkBg ? 'text-white/25' : 'text-[#3d3529]/25'}`}>
                  {answer.usage.input_tokens} in
                </span>
                <span className={`text-[11px] ${isDarkBg ? 'text-white/25' : 'text-[#3d3529]/25'}`}>·</span>
                <span className={`text-[11px] font-mono ${isDarkBg ? 'text-white/25' : 'text-[#3d3529]/25'}`}>
                  {answer.usage.output_tokens} out
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function ChatPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [input, setInput] = useState('')
  // 从 localStorage 读取用户的图钉偏好
  const pinKey = `spider_sidebar_pinned_${user?.username || 'default'}`
  const savedPinned = () => {
    try { return localStorage.getItem(pinKey) === 'true' } catch { return false }
  }
  const [sidebarOpen, setSidebarOpen] = useState(() => savedPinned())
  const [sidebarPinned, setSidebarPinned] = useState(() => savedPinned())
  // 背景模式: 'theme' 使用主题颜色 | 'video' 视频背景
  const [bgMode, setBgMode] = useState('theme')

  // 主题模式: 'system' | 'light' | 'dark'
  const [themeMode, setThemeMode] = useState('system')
  
  // 监听系统主题变化
  const [systemDark, setSystemDark] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
  )
  
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // 解析实际生效的主题
  const resolvedTheme = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode

  // 侧边栏是否为深色风格（视频模式和深色主题都是深色侧边栏）
  const isSidebarDark = bgMode === 'video' || resolvedTheme === 'dark'

  // 更新图钉状态时同步 localStorage
  const updatePinned = (pinned) => {
    setSidebarPinned(pinned)
    try { localStorage.setItem(pinKey, String(pinned)) } catch {}
  }

  // 关闭侧边栏时同时重置 pinned（但不清除 localStorage，保留用户偏好）
  const closeSidebar = () => {
    setSidebarOpen(false)
    setSidebarPinned(false)
  }
  // 侧边栏固定宽度 280px
  const sidebarWidth = 280
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  
  // 是否已开始对话（用户发送消息后为true，欢迎语就消失）
    // 从全局状态恢复，确保切换页面后状态正确
    const [hasStartedChat, setHasStartedChat] = useState(globalChatState.hasStartedChat)
  
  // 聊天相关状态（从全局状态恢复，确保切换页面后 loading 状态不丢失）
  const [messages, setMessages] = useState(globalChatState.messages)
  const [isLoading, setIsLoading] = useState(globalChatState.isLoading)
  const [currentSessionId, setCurrentSessionId] = useState(globalChatState.currentSessionId)
  const [modelName, setModelName] = useState('')
  const [pastedImages, setPastedImages] = useState([]) // 粘贴的图片列表
  const [showImageLimitToast, setShowImageLimitToast] = useState(false)
  const [previewImage, setPreviewImage] = useState(null) // 图片预览弹窗

  // ===== 输入预测相关 =====
  const [prediction, setPrediction] = useState(null)
  const [isPredicting, setIsPredicting] = useState(false)
  const predictTimerRef = useRef(null)
  const predictAbortRef = useRef(null)
  const inputTimestampsRef = useRef([])       // 最近5次按键时间
  const predictionShownAtRef = useRef(null)    // 预测显示时间戳

  function getAdaptiveDebounce() {
    const timestamps = inputTimestampsRef.current
    if (timestamps.length < 3) return 500
    const intervals = []
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1])
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    if (avgInterval < 200) return 300
    if (avgInterval > 1000) return 800
    return 500
  }

  const clearPrediction = useCallback((action = null, inputText = '') => {
    // 发送反馈（dismiss / ignore）
    if (action && prediction && predictionShownAtRef.current) {
      sendPredictFeedback(prediction, action, Date.now() - predictionShownAtRef.current, inputText)
    }
    setPrediction(null)
    setIsPredicting(false)
    predictionShownAtRef.current = null
    if (predictTimerRef.current) {
      clearTimeout(predictTimerRef.current)
      predictTimerRef.current = null
    }
    if (predictAbortRef.current) {
      predictAbortRef.current.abort()
      predictAbortRef.current = null
    }
  }, [prediction])

  const triggerPrediction = useCallback((text) => {
    // 清理上一次
    if (predictTimerRef.current) clearTimeout(predictTimerRef.current)
    if (predictAbortRef.current) predictAbortRef.current.abort()

    if (!text || text.trim().length < 2) {
      setPrediction(null)
      return
    }

    const debounceMs = getAdaptiveDebounce()
    predictTimerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      predictAbortRef.current = controller
      setIsPredicting(true)
      setPrediction(null)
      let accumulated = ''
      try {
        await predictInput(
          text.trim(),
          currentSessionId,
          controller.signal,
          (tokenContent) => {
            accumulated += tokenContent
            setPrediction(accumulated)
            if (!predictionShownAtRef.current) {
              predictionShownAtRef.current = Date.now()
            }
          },
          (finalPrediction) => {
            setPrediction(finalPrediction)
            if (!predictionShownAtRef.current) {
              predictionShownAtRef.current = Date.now()
            }
          }
        )
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.error('预测请求失败:', err)
        }
      } finally {
        setIsPredicting(false)
      }
    }, debounceMs)
  }, [currentSessionId])

  const acceptPrediction = useCallback(() => {
    if (prediction) {
      // 发送采纳反馈
      if (predictionShownAtRef.current) {
        sendPredictFeedback(prediction, 'accept', Date.now() - predictionShownAtRef.current, input)
      }
      setInput(prev => prev + prediction)
      setPrediction(null)
      predictionShownAtRef.current = null
    }
  }, [prediction, input])

  // 搜索弹窗状态
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHighlight, setSearchHighlight] = useState(0)

  // 工作流弹窗状态
  const [showWorkflowModal, setShowWorkflowModal] = useState(false)

  // 双答案模式 loading 状态（记录正在加载 dual 的消息 index，null 表示未加载）
  const [dualLoadingMsgIndex, setDualLoadingMsgIndex] = useState(null)

  // 删除确认弹窗状态
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, sessionId: null, title: '' })
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState({ show: false, group: null })

  // Ctrl+K 快捷键打开搜索
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPreviewImage(null)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
        setSearchQuery('')
        setSearchHighlight(0)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewImage])

  // 获取模型名称
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setModelName(data.model || ''))
      .catch(() => {})
  }, [])

  // 同步状态到全局变量（确保切换页面后状态不丢失）
  useEffect(() => {
    globalChatState.isLoading = isLoading
  }, [isLoading])

  useEffect(() => {
    globalChatState.messages = messages
  }, [messages])

  useEffect(() => {
    globalChatState.currentSessionId = currentSessionId
  }, [currentSessionId])

  useEffect(() => {
    globalChatState.hasStartedChat = hasStartedChat
  }, [hasStartedChat])

  // AI头像 - 单个视频源抓帧复用
  const avatarVideoRef = useRef(null)
  const avatarCanvasRef = useRef(document.createElement('canvas'))
  const [avatarFrame, setAvatarFrame] = useState(null)

  useEffect(() => {
    const canvas = avatarCanvasRef.current
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    const video = document.createElement('video')
    video.src = '/7a5a52fe68057009034fe93846d96d6a.mp4'
    video.autoplay = true
    video.loop = true
    video.muted = true
    video.playsInline = true
    avatarVideoRef.current = video

    let animId
    const capture = () => {
      if (video.readyState >= 2) {
        // 居中裁剪（等效 object-fit: cover）
        const vw = video.videoWidth
        const vh = video.videoHeight
        const size = Math.min(vw, vh)
        const sx = (vw - size) / 2
        const sy = (vh - size) / 2
        ctx.drawImage(video, sx, sy, size, size, 0, 0, 64, 64)
        setAvatarFrame(canvas.toDataURL('image/webp', 0.8))
      }
      animId = requestAnimationFrame(capture)
    }
    video.addEventListener('playing', () => { animId = requestAnimationFrame(capture) })
    video.play().catch(() => {})

    return () => {
      cancelAnimationFrame(animId)
      video.pause()
      video.src = ''
    }
  }, [])
  
  // 会话列表状态
  const [sessions, setSessions] = useState([])
    const [expandedGroups, setExpandedGroups] = useState({})
  const [sessionsLoading, setSessionsLoading] = useState(false)
  
  // 会话编辑状态
  const [editingSessionId, setEditingSessionId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  
  // 当前输入模式: null | 'Video' | 'Text' | 'Audio' | 'Image'
  const [inputMode, setInputMode] = useState(null)
  
  // 用户是否手动滚动（用于智能滚动）
    const [isUserScrolling, setIsUserScrolling] = useState(false)
    
    // 是否显示滚动到底部按钮（当用户向上滚动一定距离后显示）
    const [showScrollButton, setShowScrollButton] = useState(false)
  
  // Text模式的选项状态
  const [textOptions, setTextOptions] = useState({
    search: false,
    deepThink: false, // 默认关闭，后端自动思考
    canvas: false
  })
  
  // 问候语和随机名言
  const greeting = useMemo(() => getGreeting(), [])
  const [randomQuote, setRandomQuote] = useState(() => spiderQuotes[Math.floor(Math.random() * spiderQuotes.length)])
  
  // 切换背景时重新选择名言
  useEffect(() => {
    setRandomQuote(spiderQuotes[Math.floor(Math.random() * spiderQuotes.length)])
    setDisplayQuote('') // 重置打字机效果
  }, [bgMode])
  
  // 打字机效果状态 - 用于名言显示
  const [displayQuote, setDisplayQuote] = useState('')
  const [isTypingQuote, setIsTypingQuote] = useState(true)
  
  // 打字机效果状态
  const [displayPlaceholder, setDisplayPlaceholder] = useState('')
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0)
  const [isTypingPlaceholder, setIsTypingPlaceholder] = useState(true)
  
  const placeholderTexts = [
    '让 Spider AI 随机新建一个工作流',
    'Spider AI 来帮你自主探索工作流编排？',
    '文字如蛛丝，Spider AI 帮你串联思绪~',
    '一幅画胜千言，Spider AI 绘你所想！',
    '声波如网，Spider AI 为你谱写旋律',
    '让 Spider AI 定格你的精彩瞬间'
  ]
  const sidebarRef = useRef(null)
  const mainContentRef = useRef(null)
  const navRef = useRef(null)
  const dropdownRef = useRef(null)
  const messagesContainerRef = useRef(null)

  // 是否为深色背景（用于文字颜色判断）
  const isDarkBg = bgMode === 'video' || resolvedTheme === 'dark'

  // 名言打字机效果
  useEffect(() => {
    if (!isTypingQuote || displayQuote === randomQuote) {
      return
    }
    const timeout = setTimeout(() => {
      setDisplayQuote(randomQuote.slice(0, displayQuote.length + 1))
    }, 50)
    return () => clearTimeout(timeout)
  }, [displayQuote, randomQuote, isTypingQuote])

  // 切换背景模式：视频 ↔ 主题
  const toggleBgMode = () => {
    setBgMode(prev => prev === 'theme' ? 'video' : 'theme')
  }

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 点击任意区域关闭设置下拉菜单
  useEffect(() => {
    const handleClickOutside = () => {
      if (showSettings) setShowSettings(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showSettings])

  // 打字机效果
  useEffect(() => {
    const currentText = placeholderTexts[currentPlaceholderIndex]
    
    if (!isTypingPlaceholder || displayPlaceholder === currentText) {
      // 打字完成后，等待1.5秒再切换到下一条
      if (displayPlaceholder === currentText) {
        const waitTimer = setTimeout(() => {
          const nextIndex = (currentPlaceholderIndex + 1) % placeholderTexts.length
          setCurrentPlaceholderIndex(nextIndex)
          setIsTypingPlaceholder(true)
          setDisplayPlaceholder('')
        }, 1500)
        return () => clearTimeout(waitTimer)
      }
      return
    }
    
    const timeout = setTimeout(() => {
      setDisplayPlaceholder(currentText.slice(0, displayPlaceholder.length + 1))
    }, 30)
    
    return () => clearTimeout(timeout)
  }, [displayPlaceholder, currentPlaceholderIndex, isTypingPlaceholder, placeholderTexts])

  // 相对时间辅助函数
  const formatRelativeTime = (dateStr) => {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    // 判断是否是今天
    const isToday = date.toDateString() === now.toDateString()
    // 判断是否是昨天
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()
    
    if (isToday) return '今天'
    if (isYesterday) return '昨天'
    if (diffDays < 7) return `${diffDays}天前`
    if (diffDays < 30) return '上周'
    if (diffDays < 60) return '上个月'
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  // 按时间分组会话
  const groupSessionsByTime = (sessions) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const threeDaysAgo = new Date(today)
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const oneMonthAgo = new Date(today)
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const groups = [
      { key: 'today', label: '今天', sessions: [] },
      { key: 'three_days', label: '近 3 天', sessions: [] },
      { key: 'seven_days', label: '近 7 天', sessions: [] },
      { key: 'one_month', label: '1 个月内', sessions: [] },
      { key: 'older', label: '更早', sessions: [] },
    ]

    for (const session of sessions) {
      const date = new Date(session.updated_at)
      if (date >= today) {
        groups[0].sessions.push(session)
      } else if (date >= threeDaysAgo) {
        groups[1].sessions.push(session)
      } else if (date >= sevenDaysAgo) {
        groups[2].sessions.push(session)
      } else if (date >= oneMonthAgo) {
        groups[3].sessions.push(session)
      } else {
        groups[4].sessions.push(session)
      }
    }

    // 只返回非空的组
    return groups.filter(g => g.sessions.length > 0)
  }

  // 切换分组展开/收起
  const toggleGroupExpand = (groupKey) => {
    setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))
  }

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const res = await getSessions()
      // 按 updated_at 降序排列
      const sorted = (res.data || []).sort((a, b) => 
        new Date(b.updated_at) - new Date(a.updated_at)
      )
      setSessions(sorted)
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  // 会话切换
  const handleSessionClick = useCallback(async (sessionId) => {
    if (sessionId === currentSessionId) return // 避免重复加载
    setCurrentSessionId(sessionId)
    setHasStartedChat(true)
    // 持久化到 localStorage
    localStorage.setItem(`spider_last_session_${user?.username}`, sessionId)
    try {
      const res = await getSessionMessages(sessionId)
      // 将后端的 token 字段映射为 usage 对象
      const messagesWithUsage = (res.data || []).map(msg => {
        // 解析 images JSON 字符串为数组
        let images = msg.images
        if (typeof images === 'string') {
          try { images = JSON.parse(images) } catch { images = null }
        }
        const parsed = { ...msg, images: Array.isArray(images) ? images : null }
        if (parsed.role === 'assistant' && (parsed.input_tokens || parsed.output_tokens || parsed.total_tokens)) {
          return {
            ...parsed,
            usage: {
              input_tokens: parsed.input_tokens || 0,
              output_tokens: parsed.output_tokens || 0,
              total_tokens: parsed.total_tokens || 0
            }
          }
        }
        return parsed
      })
      setMessages(messagesWithUsage)
    } catch (err) {
      console.error('Failed to load messages:', err)
      setMessages([])
    }
  }, [currentSessionId, user])

  // 新建对话
  const handleNewChat = () => {
    setCurrentSessionId(null)
    setMessages([])
    setHasStartedChat(false)
    // 清除 localStorage 中的 lastSessionId
    if (user?.username) {
      localStorage.removeItem(`spider_last_session_${user.username}`)
    }
  }

  // 删除会话 - 打开确认弹窗
  const handleDeleteSession = (sessionId, sessionTitle) => {
    setDeleteConfirm({ show: true, sessionId, title: sessionTitle || '' })
  }

  // 确认删除会话
  const handleConfirmDelete = async () => {
    const sessionId = deleteConfirm.sessionId
    setDeleteConfirm({ show: false, sessionId: null, title: '' })
    
    try {
      await deleteSession(sessionId)
      // 如果删除的是当前会话，重置状态
      if (sessionId === currentSessionId) {
        setCurrentSessionId(null)
        setMessages([])
        setHasStartedChat(false)
        if (user?.username) {
          localStorage.removeItem(`spider_last_session_${user.username}`)
        }
      }
      // 刷新列表
      await loadSessions()
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  // 删除整组会话
  const handleDeleteGroup = (group) => {
    setDeleteGroupConfirm({ show: true, group })
  }

  // 确认删除整组会话
  const handleConfirmDeleteGroup = async () => {
    const group = deleteGroupConfirm.group
    setDeleteGroupConfirm({ show: false, group: null })
    if (!group) return
    
    try {
      // 逐个删除该组所有会话
      for (const session of group.sessions) {
        await deleteSession(session.id)
        // 如果删除的是当前会话，清空聊天区域
        if (session.id === currentSessionId) {
          setCurrentSessionId(null)
          setMessages([])
          setHasStartedChat(false)
          if (user?.username) {
            localStorage.removeItem(`spider_last_session_${user.username}`)
          }
        }
      }
      await loadSessions()
    } catch (err) {
      console.error('Failed to delete group:', err)
    }
  }

  // 重命名会话
  const handleRenameSession = async (sessionId) => {
    const trimmed = editingTitle.trim()
    if (!trimmed) {
      setEditingSessionId(null)
      return
    }
    try {
      await renameSession(sessionId, trimmed)
      await loadSessions()
    } catch (err) {
      console.error('Failed to rename session:', err)
    } finally {
      setEditingSessionId(null)
    }
  }

  // 组件挂载时恢复会话
  useEffect(() => {
    if (!user) return
    loadSessions()
    // 恢复上次会话
    const lastSessionId = localStorage.getItem(`spider_last_session_${user.username}`)
    if (lastSessionId) {
      handleSessionClick(lastSessionId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]) // 只在 user 变化时执行

  // 滚动到底部函数
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [])

  // 组件 mount 时滚动到底部（延迟确保 DOM 渲染完成）
  useEffect(() => {
    if (hasStartedChat && messages.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 消息更新时自动滚动到底部（智能滚动：用户手动滚动时不强制滚动）
  useEffect(() => {
    if (!isUserScrolling && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages, isUserScrolling])

  // 检测用户是否手动滚动
  const handleMessageScroll = () => {
    if (!messagesContainerRef.current) return
    const container = messagesContainerRef.current
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 10
    setIsUserScrolling(!isAtBottom)
    
    // 滚动到底部按钮：当距离底部超过 200px 时显示
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    setShowScrollButton(distanceFromBottom > 200)
  }

  // 处理粘贴图片
  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf('image') !== -1) {
        if (pastedImages.length >= 2) {
          e.preventDefault()
          setShowImageLimitToast(true)
          setTimeout(() => setShowImageLimitToast(false), 3000)
          return
        }
        e.preventDefault()
        const blob = item.getAsFile()
        if (blob) {
          const reader = new FileReader()
          reader.onload = (event) => {
            const imageData = {
              id: Date.now(),
              url: event.target.result,
              blob: blob,
              name: `粘贴图片_${Date.now()}.png`
            }
            setPastedImages(prev => {
              if (prev.length >= 2) {
                setShowImageLimitToast(true)
                setTimeout(() => setShowImageLimitToast(false), 3000)
                return prev
              }
              return [...prev, imageData]
            })
          }
          reader.readAsDataURL(blob)
        }
      }
    }
  }

  // 删除粘贴的图片
  const removeImage = (imageId) => {
    setPastedImages(prev => prev.filter(img => img.id !== imageId))
  }

  const handleSend = async () => {
    if ((!input.trim() && pastedImages.length === 0) || isLoading) return
    
    const message = input.trim()
    const images = [...pastedImages]
    setInput('')
    setPastedImages([])
    clearPrediction('ignore', input)
    setHasStartedChat(true)
    
    // 1. 添加用户消息到 UI，同时添加空的 AI 消息占位（用于显示等待动画）
    setMessages(prev => [
      ...prev, 
      { role: 'user', content: message, images: images.length > 0 ? images.map(img => img.url) : undefined },
      { role: 'assistant', content: '' }  // 空占位，触发等待动画
    ])
    setIsLoading(true)
    
    // 2. 调用后端 SSE
    const token = localStorage.getItem('spider_token')
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: message,
          session_id: currentSessionId || null,
          images: images.length > 0 ? images.map(img => img.url) : undefined
        })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let aiContent = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'content') {
                aiContent += data.content
                // 更新最后一条 AI 消息
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { 
                    role: 'assistant', 
                    content: aiContent
                  }
                  return updated
                })
              } else if (data.type === 'done') {
                // 保存 token 用量到最后一条 AI 消息
                if (data.usage) {
                  setMessages(prev => {
                    const updated = [...prev]
                    const lastMsg = updated[updated.length - 1]
                    if (lastMsg && lastMsg.role === 'assistant') {
                      lastMsg.usage = data.usage
                    }
                    return updated
                  })
                }
                // 更新 session_id
                if (data.session_id) {
                  const isNewSession = !currentSessionId
                  setCurrentSessionId(data.session_id)
                  // 持久化到 localStorage
                  if (user?.username) {
                    localStorage.setItem(`spider_last_session_${user.username}`, data.session_id)
                  }
                  // 仅首次创建新会话时刷新侧边栏列表
                  if (isNewSession) {
                    loadSessions()
                  }
                }
              } else if (data.type === 'error') {
                // 在消息列表中显示错误提示
                setMessages(prev => {
                  const updated = [...prev]
                  const lastIdx = updated.length - 1
                  if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: updated[lastIdx].content || '抱歉，发生了错误，请重试。',
                      isError: true
                    }
                  }
                  return updated
                })
                console.error('Chat error:', data.content)
              }
            } catch (e) {
              // 解析失败忽略
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      // 网络连接失败时显示友好错误消息
      setMessages(prev => {
        // 检查最后一条是否是空的 assistant 占位消息
        if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && !prev[prev.length - 1].content) {
          // 更新空占位消息为错误消息
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: '网络连接失败，请检查网络后重试。',
            isError: true
          }
          return updated
        }
        // 否则添加新的错误消息
        return [...prev, { role: 'assistant', content: '网络连接失败，请检查网络后重试。', isError: true }]
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 双答案模式：用同一条用户消息重新调用 /chat，带 mode: "dual"
  const handleDualRequest = async (userMsgContent, aiMsgIndex) => {
    if (dualLoadingMsgIndex !== null) return // 防止重复点击
    setDualLoadingMsgIndex(aiMsgIndex)

    // 在原 AI 消息位置后插入一条 dual 占位消息
    setMessages(prev => {
      const updated = [...prev]
      const dualMsg = {
        role: 'assistant',
        isDual: true,
        isDualStreaming: true,
        answers: [
          { content: '', label: '精准回答' },
          { content: '', label: '深度分析' }
        ]
      }
      // 插入到 aiMsgIndex 后面
      updated.splice(aiMsgIndex + 1, 0, dualMsg)
      return updated
    })

    const dualIndex = aiMsgIndex + 1 // 插入后的实际位置

    try {
      const response = await sendDualChat(userMsgContent, currentSessionId)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffers = ['', '']

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'content' && data.answer_index !== undefined) {
                const ai = data.answer_index
                buffers[ai] += data.content
                const snap = [...buffers]
                setMessages(prev => {
                  const updated = [...prev]
                  if (updated[dualIndex] && updated[dualIndex].isDual) {
                    updated[dualIndex] = {
                      ...updated[dualIndex],
                      answers: updated[dualIndex].answers.map((a, i) => ({
                        ...a,
                        content: snap[i] !== undefined ? snap[i] : a.content
                      }))
                    }
                  }
                  return updated
                })
              } else if (data.type === 'done' && data.answers) {
                setMessages(prev => {
                  const updated = [...prev]
                  if (updated[dualIndex] && updated[dualIndex].isDual) {
                    updated[dualIndex] = {
                      ...updated[dualIndex],
                      isDualStreaming: false,
                      answers: updated[dualIndex].answers.map((a, i) => ({
                        ...a,
                        usage: data.answers[i]?.usage || null
                      }))
                    }
                  }
                  return updated
                })
              } else if (data.type === 'error') {
                console.error('Dual chat error:', data.content)
              }
            } catch (e) { /* ignore parse error */ }
          }
        }
      }
    } catch (error) {
      console.error('Dual request failed:', error)
      setMessages(prev => {
        const updated = [...prev]
        if (updated[dualIndex] && updated[dualIndex].isDual) {
          updated[dualIndex] = {
            ...updated[dualIndex],
            isDualStreaming: false,
            answers: updated[dualIndex].answers.map(a => ({
              ...a,
              content: a.content || '',
              isError: !a.content
            }))
          }
        }
        return updated
      })
    } finally {
      setDualLoadingMsgIndex(null)
    }
  }

  return (
    <div className="flex h-screen relative">
      {/* 背景层 */}
      {bgMode === 'video' ? (
        <>
          <video
            autoPlay
            loop
            muted
            playsInline
            className="fixed inset-0 w-full h-full object-cover z-0"
          >
            <source src="/memory.mp4" type="video/mp4" />
          </video>
          {/* 深色遮罩 - 与首页一致 */}
          <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-black/50 to-black/70 z-0" />
        </>
      ) : resolvedTheme === 'dark' ? (
        <div className="fixed inset-0 bg-[#1a1a1a] z-0" />
      ) : (
        <div className="fixed inset-0 bg-[#fdf5e6] z-0" />
      )}
      
      {/* 视频模式下 Markdown 表格荧光绿高亮样式 */}
      {bgMode === 'video' && (
        <style>{`
          .video-mode-markdown table th,
          .video-mode-markdown table td {
            color: #39ff14 !important;
            text-shadow: 0 0 8px rgba(57, 255, 20, 0.4);
          }
          .video-mode-markdown table th {
            color: #7fff00 !important;
            text-shadow: 0 0 12px rgba(127, 255, 0, 0.5);
            font-weight: 700;
          }
          .video-mode-markdown table {
            border-color: rgba(57, 255, 20, 0.3) !important;
          }
          .video-mode-markdown table th,
          .video-mode-markdown table td {
            border-color: rgba(57, 255, 20, 0.2) !important;
          }
        `}</style>
      )}
      {/* 浅色模式下 Markdown 样式覆盖 */}
      {!isDarkBg && bgMode !== 'video' && (
        <style>{`
          .light-mode-markdown {
            color: #3d3529 !important;
          }
          .light-mode-markdown table {
            border-color: #d4c4a8 !important;
          }
          .light-mode-markdown table th,
          .light-mode-markdown table td {
            color: #3d3529 !important;
            text-shadow: none !important;
            border-color: #d4c4a8 !important;
          }
          .light-mode-markdown table th {
            background-color: #f0e0c8 !important;
            color: #5a4a3a !important;
            font-weight: 700;
          }
          .light-mode-markdown table tbody tr:hover {
            background-color: rgba(93, 78, 55, 0.05) !important;
          }
          .light-mode-markdown code:not(pre code) {
            background-color: #ede0cc !important;
            color: #8b5e3c !important;
            text-shadow: none !important;
          }
          .light-mode-markdown pre {
            background-color: #3d3529 !important;
            border-color: #5d4e37 !important;
          }
          .light-mode-markdown pre code {
            background-color: transparent !important;
            color: #7fff00 !important;
            text-shadow: 0 0 6px rgba(127, 255, 0, 0.5) !important;
          }
          .light-mode-markdown .code-block-wrapper .bg-black\\/40,
          .light-mode-markdown .code-block-wrapper .bg-black\\/30 {
            background-color: #3d3529 !important;
          }
          .light-mode-markdown blockquote {
            background-color: rgba(93, 78, 55, 0.08) !important;
            border-color: #8b7355 !important;
            color: #5d4e37 !important;
          }
          .light-mode-markdown a {
            color: #5d8aa8 !important;
          }
          .light-mode-markdown a:hover {
            color: #4a7a98 !important;
          }
          .light-mode-markdown strong {
            color: #3d3529 !important;
          }
          .light-mode-markdown em {
            color: #5d4e37 !important;
          }
          .light-mode-markdown h1,
          .light-mode-markdown h2,
          .light-mode-markdown h3,
          .light-mode-markdown h4 {
            color: #3d3529 !important;
          }
          .light-mode-markdown li {
            color: #3d3529 !important;
          }
          .light-mode-markdown hr {
            border-color: #d4c4a8 !important;
          }
          .light-mode-markdown .math-block {
            background-color: rgba(93, 78, 55, 0.08) !important;
            border-color: #d4c4a8 !important;
          }
        `}</style>
      )}
      {/* 点击外部关闭（仅在未固定时） */}
      {sidebarOpen && !sidebarPinned && (
        <div 
          className="fixed inset-0 z-20"
          onClick={() => {
            setSidebarOpen(false)
            setSidebarPinned(false)
          }}
        />
      )}
      
      {/* 侧边栏 - overlay模式（pinned时固定） */}
      <aside
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full z-30 w-[280px] transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${bgMode === 'video' ? 'bg-black/30 backdrop-blur-xl border-r border-white/10' : resolvedTheme === 'dark' ? 'bg-[#141414] border-r border-white/[0.06]' : 'bg-[#f5ead6] border-r border-[#e8d5b7]'}`}
      >
        <div className="flex flex-col h-full">
          {/* 用户信息区域 */}
          <div className={`p-4 flex items-center justify-between border-b ${isSidebarDark ? 'border-white/10' : 'border-black/10'}`}>
            <div>
              <div className={`${isSidebarDark ? 'text-white' : 'text-[#3d3529]'} font-medium text-sm`}>{user?.username || 'Spider User'}</div>
              <div className={`${isSidebarDark ? 'text-white/40' : 'text-[#3d3529]/40'} text-xs mt-0.5`}>{user?.email || 'user@spider.ai'}</div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* 图钉按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  updatePinned(!sidebarPinned)
                }}
                className={`p-1.5 rounded-lg transition-all duration-200 ${
                  sidebarPinned
                    ? `${isSidebarDark ? 'bg-white/15 text-white' : 'bg-black/15 text-[#3d3529]'} rotate-0`
                    : `${isSidebarDark ? 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]' : 'text-[#3d3529]/40 hover:text-[#3d3529]/70 hover:bg-black/[0.06]'} rotate-45`
                }`}
                title={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              >
                <Pin size={15} />
              </button>
              {/* 设置按钮 + 下拉菜单 */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings) }}
                  className={`p-1.5 rounded-lg transition-all ${showSettings ? `${isSidebarDark ? 'bg-white/10 text-white' : 'bg-black/10 text-[#3d3529]'}` : `${isSidebarDark ? 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]' : 'text-[#3d3529]/30 hover:text-[#3d3529]/50 hover:bg-black/[0.04]'}`}`}
                >
                  <Settings size={15} />
                </button>
                {showSettings && (
                  <div className={`absolute right-0 top-full mt-1 w-44 border rounded-lg py-1 shadow-lg z-50 ${isSidebarDark ? 'bg-[#1e1e1e] border-white/10' : 'bg-[#fff8f0] border-black/10'}`}>
                    <button className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all ${isSidebarDark ? 'text-white/70 hover:text-white hover:bg-white/[0.06]' : 'text-[#3d3529]/70 hover:text-[#3d3529] hover:bg-black/[0.06]'}`}>
                      <SmilePlus size={15} className={isSidebarDark ? 'text-white/40' : 'text-[#3d3529]/40'} />
                      <span>Feedback</span>
                    </button>
                    <button
                      onClick={() => { navigate('/'); setShowSettings(false) }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all ${isSidebarDark ? 'text-white/70 hover:text-white hover:bg-white/[0.06]' : 'text-[#3d3529]/70 hover:text-[#3d3529] hover:bg-black/[0.06]'}`}
                    >
                      <Home size={15} className={isSidebarDark ? 'text-white/40' : 'text-[#3d3529]/40'} />
                      <span>Home Page</span>
                    </button>
                    <button className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all ${isSidebarDark ? 'text-white/70 hover:text-white hover:bg-white/[0.06]' : 'text-[#3d3529]/70 hover:text-[#3d3529] hover:bg-black/[0.06]'}`}>
                      <PenLine size={15} className={isSidebarDark ? 'text-white/40' : 'text-[#3d3529]/40'} />
                      <span>Changelog</span>
                    </button>
                    <button className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all ${isSidebarDark ? 'text-white/70 hover:text-white hover:bg-white/[0.06]' : 'text-[#3d3529]/70 hover:text-[#3d3529] hover:bg-black/[0.06]'}`}>
                      <HelpCircle size={15} className={isSidebarDark ? 'text-white/40' : 'text-[#3d3529]/40'} />
                      <span>Help</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* 功能菜单列表 */}
          <div className="flex-1 min-h-0 flex flex-col">
            {/* 操作区 */}
            <div className="py-2">
              <button
                onClick={handleNewChat}
                className={`w-full flex items-center gap-3 py-2.5 px-4 transition-all ${isSidebarDark ? 'text-white/80 hover:text-white hover:bg-white/[0.06]' : 'text-[#3d3529]/80 hover:text-[#3d3529] hover:bg-black/[0.06]'}`}
              >
                <Plus size={18} className={isSidebarDark ? 'text-white/50' : 'text-[#3d3529]/50'} />
                <span className="text-sm">New Chat</span>
              </button>
              <button
                onClick={() => { setSearchOpen(true); setSearchQuery(''); setSearchHighlight(0); }}
                className={`w-full flex items-center gap-3 py-2.5 px-4 transition-all ${isSidebarDark ? 'text-white/80 hover:text-white hover:bg-white/[0.06]' : 'text-[#3d3529]/80 hover:text-[#3d3529] hover:bg-black/[0.06]'}`}
              >
                <Search size={18} className={isSidebarDark ? 'text-white/50' : 'text-[#3d3529]/50'} />
                <span className="text-sm">Search</span>
              </button>
            </div>
            
            {/* 分隔线 */}
            <div className={`mx-4 border-t ${isSidebarDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`} />

            {/* 功能区：Projects, Artifacts */}
            <div className="py-2">
              <button 
                onClick={() => navigate('/projects')}
                className={`w-full flex items-center gap-3 py-2.5 px-4 transition-all ${isSidebarDark ? 'text-white/80 hover:text-white hover:bg-white/[0.06]' : 'text-[#3d3529]/80 hover:text-[#3d3529] hover:bg-black/[0.06]'}`}
              >
                <FolderOpen size={18} className={isSidebarDark ? 'text-white/50' : 'text-[#3d3529]/50'} />
                <span className="text-sm">Projects</span>
              </button>
              <button className={`w-full flex items-center gap-3 py-2.5 px-4 transition-all ${isSidebarDark ? 'text-white/80 hover:text-white hover:bg-white/[0.06]' : 'text-[#3d3529]/80 hover:text-[#3d3529] hover:bg-black/[0.06]'}`}>
                <LayoutGrid size={18} className={isSidebarDark ? 'text-white/50' : 'text-[#3d3529]/50'} />
                <span className="text-sm">Artifacts</span>
              </button>
            </div>
            
            {/* 分隔线 */}
            <div className="mx-4 border-t border-white/[0.06]" />
            
            {/* Theme 区 */}
            <div className="py-2">
              <div className={`w-full flex items-center justify-between py-2.5 px-4 ${isSidebarDark ? 'text-white/80' : 'text-[#3d3529]/80'}`}>
                <span className="text-sm">Theme</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setThemeMode('system')}
                    className={`p-1.5 rounded-md transition-all ${themeMode === 'system' ? `${isSidebarDark ? 'bg-white/20 text-white' : 'bg-black/15 text-[#3d3529]'}` : `${isSidebarDark ? 'text-white/40 hover:text-white/70' : 'text-[#3d3529]/40 hover:text-[#3d3529]/70'}`}`}
                  >
                    <Monitor size={16} />
                  </button>
                  <button
                    onClick={() => setThemeMode('light')}
                    className={`p-1.5 rounded-md transition-all ${themeMode === 'light' ? `${isSidebarDark ? 'bg-white/20 text-white' : 'bg-black/15 text-[#3d3529]'}` : `${isSidebarDark ? 'text-white/40 hover:text-white/70' : 'text-[#3d3529]/40 hover:text-[#3d3529]/70'}`}`}
                  >
                    <Sun size={16} />
                  </button>
                  <button
                    onClick={() => setThemeMode('dark')}
                    className={`p-1.5 rounded-md transition-all ${themeMode === 'dark' ? `${isSidebarDark ? 'bg-white/20 text-white' : 'bg-black/15 text-[#3d3529]'}` : `${isSidebarDark ? 'text-white/40 hover:text-white/70' : 'text-[#3d3529]/40 hover:text-[#3d3529]/70'}`}`}
                  >
                    <Moon size={16} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* 分隔线 */}
            <div className={`mx-4 border-t ${isSidebarDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`} />

            {/* Docs, Log Out */}
            <div className="py-2">
              <button className={`w-full flex items-center gap-3 py-2.5 px-4 transition-all ${isSidebarDark ? 'text-white/80 hover:text-white hover:bg-white/[0.06]' : 'text-[#3d3529]/80 hover:text-[#3d3529] hover:bg-black/[0.06]'}`}>
                <BookOpen size={18} className={isSidebarDark ? 'text-white/50' : 'text-[#3d3529]/50'} />
                <span className="text-sm">Docs</span>
              </button>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className={`w-full flex items-center gap-3 py-2.5 px-4 transition-all ${isSidebarDark ? 'text-white/80 hover:text-white hover:bg-white/[0.06]' : 'text-[#3d3529]/80 hover:text-[#3d3529] hover:bg-black/[0.06]'}`}
              >
                <LogOut size={18} className={isSidebarDark ? 'text-white/50' : 'text-[#3d3529]/50'} />
                <span className="text-sm">Log Out</span>
              </button>
            </div>
            
            {/* 分隔线 */}
            <div className={`mx-4 border-t ${isSidebarDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`} />

            {/* CHATS区 - 放最后，flex-1撑满剩余空间 */}
            <div className="flex-1 min-h-0 flex flex-col py-2">
              <div className={`flex items-center gap-2 px-4 py-1.5 text-xs font-medium uppercase tracking-wider ${isSidebarDark ? 'text-white/50' : 'text-[#3d3529]/50'}`}>
                <MessageSquare size={14} />
                Chats
              </div>
              {/* 会话列表 - 内部滚动 */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {sessionsLoading ? (
                  <div className={`px-4 py-2 text-sm ${isSidebarDark ? 'text-white/40' : 'text-[#3d3529]/40'}`}>加载中...</div>
                ) : sessions.length === 0 ? (
                  <div className={`px-4 py-2 text-sm ${isSidebarDark ? 'text-white/40' : 'text-[#3d3529]/40'}`}>暂无对话</div>
                ) : (
                  <div className="flex flex-col">
                    {groupSessionsByTime(sessions).map(group => {
                      const isExpanded = expandedGroups[group.key]
                      const visibleSessions = isExpanded ? group.sessions : group.sessions.slice(0, 1)
                      const hasMore = group.sessions.length > 1
                      
                      return (
                        <div key={group.key} className="mb-1">
                          {/* 分组标题 */}
                          <div className="group/header flex items-center justify-between px-4 py-1">
                            <span className={`text-[11px] font-medium tracking-wide ${
                              isSidebarDark ? 'text-white/30' : 'text-[#3d3529]/30'
                            }`}>
                              {group.label}
                            </span>
                            {/* 删除整组按钮 - hover 分组标题时显示 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteGroup(group)
                              }}
                              className={`opacity-0 group-hover/header:opacity-100 p-0.5 transition-opacity ${
                                isSidebarDark 
                                  ? 'text-white/20 hover:text-red-400' 
                                  : 'text-[#3d3529]/20 hover:text-red-400'
                              }`}
                              title={`删除"${group.label}"的所有对话`}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          
                          {/* 会话列表 */}
                          <div className="flex flex-col gap-0.5">
                            {visibleSessions.map(session => (
                              <div
                                key={session.id}
                                onClick={() => handleSessionClick(session.id)}
                                className={`group flex items-center justify-between px-4 py-2 rounded-lg mx-2 cursor-pointer transition-colors ${
                                  session.id === currentSessionId
                                    ? `${isSidebarDark ? 'bg-white/15 text-white' : 'bg-black/10 text-[#3d3529]'}`
                                    : `${isSidebarDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-[#3d3529]/70 hover:bg-black/5 hover:text-[#3d3529]'}`
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  {editingSessionId === session.id ? (
                                    <input
                                      autoFocus
                                      value={editingTitle}
                                      onChange={(e) => setEditingTitle(e.target.value)}
                                      onBlur={() => handleRenameSession(session.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRenameSession(session.id)
                                        if (e.key === 'Escape') setEditingSessionId(null)
                                      }}
                                      className={`text-sm border rounded px-1 py-0.5 w-full outline-none ${isSidebarDark ? 'bg-white/10 text-white border-white/20' : 'bg-black/5 text-[#3d3529] border-black/20'}`}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    <div 
                                      className="text-sm truncate"
                                      onDoubleClick={(e) => {
                                        e.stopPropagation()
                                        setEditingSessionId(session.id)
                                        setEditingTitle(session.title || '')
                                      }}
                                    >
                                      {session.title || 'New Chat'}
                                    </div>
                                  )}
                                </div>
                                {/* 删除按钮 - hover 时显示 */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteSession(session.id, session.title)
                                  }}
                                  className={`opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity ${isSidebarDark ? 'text-white/40' : 'text-[#3d3529]/40'}`}
                                  title="删除对话"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                          
                          {/* 展开更多 / 收起 按钮 */}
                          {hasMore && (
                            <button
                              onClick={() => toggleGroupExpand(group.key)}
                              className={`w-full px-4 py-1 text-[11px] text-left transition-colors ${
                                isSidebarDark 
                                  ? 'text-white/25 hover:text-white/50' 
                                  : 'text-[#3d3529]/25 hover:text-[#3d3529]/50'
                              }`}
                            >
                              {isExpanded ? '收起' : `展开更多 (${group.sessions.length - 1})`}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* 工作流按钮（底部上方） */}
          <div className="px-4 pb-3">
            <button 
              onClick={() => setShowWorkflowModal(true)}
              className={`w-full py-2.5 border rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${isSidebarDark ? 'bg-white/[0.06] hover:bg-white/[0.1] border-white/10 text-white' : 'bg-black/[0.06] hover:bg-black/[0.1] border-black/10 text-[#3d3529]'}`}
            >
              <Workflow className="w-4 h-4" />
              Workflow 工作流编排
            </button>
          </div>
          
          {/* 平台状态（底部） */}
          <div className={`px-4 py-3 border-t ${isSidebarDark ? 'border-white/10' : 'border-black/10'}`}>
            <div className={`text-xs mb-1 ${isSidebarDark ? 'text-white/30' : 'text-[#3d3529]/30'}`}>Platform Status</div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isSidebarDark ? 'text-white/50' : 'text-[#3d3529]/50'}`}>All systems normal.</span>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            </div>
          </div>
        </div>
      </aside>

      {/* 主内容区 - 不受侧边栏影响 */}
      <div 
        ref={mainContentRef}
        className="flex-1 flex flex-col w-full"
      >
        {/* 顶部导航 - 不受侧边栏影响 */}
        <nav 
          ref={navRef}
          className="fixed top-0 left-0 right-0 z-40 bg-transparent pointer-events-none"
        >
          <div className="flex items-center justify-between px-6 py-4">
            {/* 侧边栏 toggle 按钮 - 始终显示 */}
            <button
              onClick={() => {
                if (sidebarOpen) {
                  // 关闭侧边栏，同时取消固定
                  setSidebarOpen(false)
                  setSidebarPinned(false)
                } else {
                  // 打开侧边栏，恢复用户的图钉偏好
                  const userPinPref = savedPinned()
                  setSidebarOpen(true)
                  setSidebarPinned(userPinPref)
                }
              }}
              className={`pointer-events-auto p-2 rounded-lg transition-all duration-300 ${isDarkBg ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
              style={{ marginLeft: sidebarOpen ? '280px' : '0' }}
            >
              {sidebarOpen ? (
                <ChevronLeft className={`w-5 h-5 ${isDarkBg ? 'text-white' : 'text-black'}`} />
              ) : (
                <ChevronRight className={`w-5 h-5 ${isDarkBg ? 'text-white' : 'text-black'}`} />
              )}
            </button>
            
            <div className="flex items-center gap-4 pointer-events-auto">
              {/* 切换背景按钮 - 直接点击循环切换 */}
              <button
                onClick={toggleBgMode}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all hover:scale-110 ${isDarkBg ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20'}`}
                title={`切换背景模式（当前：${bgMode === 'video' ? '视频' : '主题'}）`}
              >
                <svg className={`w-6 h-6 ${isDarkBg ? 'text-white' : 'text-black'}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C12 2 9 4 9 7C9 7 7 9 4 9C4 9 6 10 6 12C6 12 4 13 2 13C2 13 4 14 4 16C4 14 6 14 6 16C6 18 4 20 4 22C6 20 8 18 10 18C10 20 11 22 12 22C13 22 14 20 14 18C16 18 18 20 20 22C20 20 18 18 18 16C18 14 20 14 20 16C20 14 22 13 22 13C20 13 18 12 18 12C18 10 20 9 20 9C17 9 15 7 15 7C15 4 12 2 12 2M12 9A1 1 0 0 1 13 10A1 1 0 0 1 12 11A1 1 0 0 1 11 10A1 1 0 0 1 12 9Z" />
                </svg>
              </button>
              
              {/* 竖排三点菜单 */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className={`p-2 rounded-lg transition-colors ${isDarkBg ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                >
                  <MoreVertical className={`w-5 h-5 ${isDarkBg ? 'text-white' : 'text-black'}`} />
                </button>
                
                {/* 下拉菜单 */}
                {showDropdown && (
                  <div className={`absolute right-0 top-full mt-2 py-2 rounded-xl shadow-xl min-w-48 ${isDarkBg ? 'bg-black/80 backdrop-blur-xl border border-white/10' : 'bg-white border border-[#e8d5b7]'}`}>
                    <button
                      onClick={() => { navigate('/console'); setShowDropdown(false) }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${isDarkBg ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-[#5d4e37] hover:bg-[#fdf5e6]'}`}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Console
                    </button>
                    <button
                      onClick={() => { setShowDropdown(false) }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${isDarkBg ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-[#5d4e37] hover:bg-[#fdf5e6]'}`}
                    >
                      Spider本地学习器
                    </button>
                    <button
                      onClick={() => { setShowDropdown(false) }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${isDarkBg ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-[#5d4e37] hover:bg-[#fdf5e6]'}`}
                    >
                      设置
                    </button>
                    <button
                      onClick={() => { setShowDropdown(false) }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${isDarkBg ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-[#5d4e37] hover:bg-[#fdf5e6]'}`}
                    >
                      帮助
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* 标语 - 只有刚进来才展示（未开始对话） */}
        {!hasStartedChat && (
          <div 
            draggable={false}
            className={`transition-all duration-300 ease-in-out`}
            style={{
              position: 'absolute',
              top: '25%',
              left: '50%',
              transform: `translateX(-50%)`,
              marginLeft: sidebarPinned ? '140px' : '0', // pinned时向右偏移一半侧边栏宽度
              zIndex: 100,
              userSelect: 'none',
              width: 'max-content'
            }}
          >
            {/* 第一行：问候语 - 艺术字样式 font-light */}
            <div 
              className="text-3xl font-light"
              style={{
                color: isDarkBg ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                WebkitTextFillColor: isDarkBg ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'
              }}
            >
              {greeting}
            </div>
            {/* 第二行：副标题名言 - 艺术字样式 italic font-serif */}
            <div 
              className="text-4xl italic font-serif tracking-wide"
              style={{
                paddingLeft: '2rem',
                marginTop: '12px',
                color: isDarkBg ? '#ffffff' : '#000000',
                WebkitTextFillColor: isDarkBg ? '#ffffff' : '#000000',
                textShadow: '0 0 40px rgba(230,36,41,0.15)'
              }}
            >
              Spider AI, at your service.
            </div>
          </div>
        )}

        {/* 主内容区域 - pinned时向右推挤 */}
        <div 
          className={`flex-1 min-h-0 flex flex-col relative z-10 transition-all duration-300 ease-in-out ${!hasStartedChat ? 'items-center justify-center' : ''}`}
          style={{ marginLeft: sidebarPinned ? '280px' : '0' }}
        >
          {/* 消息列表 */}
          {hasStartedChat && (
            <div className="flex-1 min-h-0 w-full overflow-y-auto relative" ref={messagesContainerRef} onScroll={handleMessageScroll}>
              <div className="max-w-4xl mx-auto px-6 py-4 space-y-6">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end pl-16' : 'justify-start pr-16 gap-3'}`}>
                    {/* AI头像 - 复用单个视频源的抓帧 */}
                    {msg.role === 'assistant' && avatarFrame && (
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-1 border border-white/10 shadow-md">
                        <img
                          src={avatarFrame}
                          alt="Spider AI"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className={`${
                      msg.role === 'user'
                        ? bgMode === 'video'
                          ? 'max-w-[85%] rounded-2xl px-4 py-3 bg-white/15 backdrop-blur-md border border-white/20 text-white font-medium tracking-wide'
                          : isDarkBg
                            ? 'max-w-[85%] rounded-2xl px-4 py-3 bg-gradient-to-br from-white/[0.12] to-white/[0.06] backdrop-blur-md border border-white/[0.2] shadow-[0_0_15px_rgba(255,255,255,0.1)] text-white font-medium tracking-wide'
                            : 'max-w-[85%] rounded-2xl px-4 py-3 bg-[#5d4e37] text-white font-medium tracking-wide'
                        : msg.isError
                          ? isDarkBg
                            ? 'max-w-full bg-red-500/20 text-red-300 rounded-2xl px-4 py-3'
                            : 'max-w-full bg-red-100 text-red-700 rounded-2xl px-4 py-3'
                          : isDarkBg
                            ? 'max-w-full text-white/90'
                            : 'max-w-full text-[#5d4e37]'
                    }`}
                    style={msg.role === 'user' && isDarkBg ? { textShadow: '0 0 8px rgba(255,255,255,0.3)' } : {}}>
                      {msg.role === 'user' ? (
                        <div className="text-sm">
                          <CollapsibleUserMessage
                            content={msg.content}
                            isDarkBg={isDarkBg}
                            resolvedTheme={resolvedTheme}
                            bgMode={bgMode}
                          />
                          {msg.images && msg.images.length > 0 && (
                            <div className="flex gap-2 mt-2">
                              {msg.images.map((imgUrl, i) => (
                                <img 
                                  key={i} 
                                  src={imgUrl} 
                                  alt={`图片${i + 1}`}
                                  className="max-h-48 max-w-xs rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => setPreviewImage(imgUrl)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ) : msg.isDual ? (
                        /* ========== 双答案消息渲染 ========== */
                        <div className="w-full">
                          <DualAnswerCard
                            answers={msg.answers}
                            isDarkBg={isDarkBg}
                            bgMode={bgMode}
                            isStreaming={!!msg.isDualStreaming}
                          />
                        </div>
                      ) : (
                        <div className={`text-sm ${bgMode === 'video' ? 'video-mode-markdown' : !isDarkBg ? 'light-mode-markdown' : ''}`}>
                          {msg.isError ? (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          ) : msg.content ? (
                            <MarkdownRenderer content={msg.content} />
                          ) : isLoading && index === messages.length - 1 ? (
                            /* 等待中：显示脉冲圆点（代替空内容） */
                            <div className="flex items-center gap-1.5 py-2">
                              <span 
                                className={`w-2 h-2 rounded-full animate-pulse ${
                                  bgMode === 'video' 
                                    ? 'bg-white/60' 
                                    : isDarkBg 
                                      ? 'bg-white/50' 
                                      : 'bg-[#8b7355]/70'
                                }`} 
                                style={{ animationDelay: '0ms', animationDuration: '1s' }}
                              />
                              <span 
                                className={`w-2 h-2 rounded-full animate-pulse ${
                                  bgMode === 'video' 
                                    ? 'bg-white/60' 
                                    : isDarkBg 
                                      ? 'bg-white/50' 
                                      : 'bg-[#8b7355]/70'
                                }`} 
                                style={{ animationDelay: '300ms', animationDuration: '1s' }}
                              />
                              <span 
                                className={`w-2 h-2 rounded-full animate-pulse ${
                                  bgMode === 'video' 
                                    ? 'bg-white/60' 
                                    : isDarkBg 
                                      ? 'bg-white/50' 
                                      : 'bg-[#8b7355]/70'
                                }`} 
                                style={{ animationDelay: '600ms', animationDuration: '1s' }}
                              />
                            </div>
                          ) : null}
                          {/* Token 用量 + 多角度回答按钮 */}
                          {msg.usage && (
                            <div className={`flex items-center gap-3 mt-2 pt-2 border-t ${
                              isDarkBg ? 'border-white/[0.06]' : 'border-[#3d3529]/[0.06]'
                            }`}>
                              <span className={`text-[11px] font-mono ${
                                isDarkBg ? 'text-white/25' : 'text-[#3d3529]/25'
                              }`}>
                                {msg.usage.input_tokens} in
                              </span>
                              <span className={`text-[11px] ${
                                isDarkBg ? 'text-white/25' : 'text-[#3d3529]/25'
                              }`}>·</span>
                              <span className={`text-[11px] font-mono ${
                                isDarkBg ? 'text-white/25' : 'text-[#3d3529]/25'
                              }`}>
                                {msg.usage.output_tokens} out
                              </span>
                              <span className={`text-[11px] ${
                                isDarkBg ? 'text-white/25' : 'text-[#3d3529]/25'
                              }`}>·</span>
                              <span className={`text-[11px] font-mono ${
                                isDarkBg ? 'text-white/25' : 'text-[#3d3529]/25'
                              }`}>
                                {msg.usage.total_tokens} tokens
                              </span>
                              {/* 多角度回答按钮 */}
                              {(() => {
                                // 查找该 AI 消息对应的用户消息（前一条）
                                const prevUserMsg = index > 0 && messages[index - 1]?.role === 'user' ? messages[index - 1] : null
                                // 如果下一条已经是 dual 消息则不再显示按钮
                                const nextIsDual = index < messages.length - 1 && messages[index + 1]?.isDual
                                if (!prevUserMsg || nextIsDual) return null
                                const isDualLoading = dualLoadingMsgIndex === index
                                return (
                                  <button
                                    onClick={() => handleDualRequest(prevUserMsg.content, index)}
                                    disabled={isDualLoading || dualLoadingMsgIndex !== null}
                                    className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] transition-all ${
                                      isDarkBg
                                        ? 'text-white/30 hover:text-white/60 hover:bg-white/[0.06]'
                                        : 'text-[#3d3529]/30 hover:text-[#3d3529]/60 hover:bg-[#3d3529]/[0.06]'
                                    } ${isDualLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                    title="用不同角度重新生成两个答案"
                                  >
                                    {isDualLoading ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <GitBranch className="w-3 h-3" />
                                    )}
                                    <span>多角度</span>
                                  </button>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

              </div>
            </div>
          )}

          {/* 滚动到底部按钮 - 悬浮在输入框正上方 */}
          {hasStartedChat && showScrollButton && (
            <div className="flex justify-center py-3 relative z-20">
              <button
                onClick={scrollToBottom}
                className={`group w-9 h-9 rounded-full flex items-center justify-center
                  cursor-pointer transition-all duration-200
                  hover:scale-110 active:scale-95
                  animate-[float_2s_ease-in-out_infinite] ${
                  isDarkBg
                    ? 'bg-white/15 hover:bg-white/25 border border-white/10'
                    : 'bg-gray-800/80 hover:bg-gray-800 border border-gray-700/50'
                }`}
              >
                {/* 手绘风格 S 曲线箭头 - 红蓝变色 */}
                <svg width="18" height="22" viewBox="0 0 18 22" fill="none" className="transition-transform duration-150">
                  <defs>
                    <linearGradient id="arrow-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E62429">
                        <animate attributeName="stop-color" values="#E62429;#FFFFFF;#2B3E8F;#E62429" dur="4s" repeatCount="indefinite" />
                      </stop>
                      <stop offset="100%" stopColor="#2B3E8F">
                        <animate attributeName="stop-color" values="#2B3E8F;#E62429;#FFFFFF;#2B3E8F" dur="4s" repeatCount="indefinite" />
                      </stop>
                    </linearGradient>
                  </defs>
                  <path
                    d="M10 1 C10 1, 13 3, 8 6 C3 9, 12 11, 9 14 L9 18"
                    stroke="url(#arrow-gradient)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M4 15 L9 21 L14 15"
                    stroke="url(#arrow-gradient)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </button>
            </div>
          )}

          {/* 聊天框 - 对话开始后变为简洁底部输入条 */}
          <div className={`w-full max-w-4xl mx-auto px-6 ${hasStartedChat ? 'pb-4 pt-2' : ''}`}>
            {hasStartedChat ? (
              /* ========== 对话中 - Claude风格简洁输入条 ========== */
              <div>
                {/* 预测建议条 */}
                {prediction && (
                  <div
                    className="mb-2 flex items-center gap-3 px-4 py-2.5 rounded-2xl cursor-pointer transition-all duration-300 animate-[fadeIn_0.25s_ease-out]"
                    style={{ background: isDarkBg ? '#2a2a2a' : '#f0e6d6', border: isDarkBg ? '1px solid #404040' : '1px solid #e8d5b7' }}
                    onClick={acceptPrediction}
                  >
                    <CornerDownLeft className={`w-4 h-4 flex-shrink-0 ${isDarkBg ? 'text-white/50' : 'text-[#8b7355]'}`} />
                    <span className={`flex-1 text-sm truncate ${isDarkBg ? 'text-white/80' : 'text-[#5d4e37]'}`}>
                      “{prediction}”
                    </span>
                    <button
                      className={`p-0.5 rounded-md flex-shrink-0 transition-colors ${isDarkBg ? 'hover:bg-white/10 text-white/40 hover:text-white/70' : 'hover:bg-black/10 text-[#8b7355]/60 hover:text-[#8b7355]'}`}
                      onClick={(e) => { e.stopPropagation(); clearPrediction('dismiss', input); }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className={`w-full backdrop-blur-2xl rounded-2xl px-4 py-2 transition-all duration-300 ${
                isDarkBg 
                  ? 'bg-[#2a2a2a] border border-[#404040] shadow-[0_4px_24px_rgba(0,0,0,0.4)]'
                  : 'bg-[#ffefd5] border border-[#e8d5b7] shadow-[0_4px_24px_rgba(0,0,0,0.08)]'
              }`}>
                {/* 粘贴图片预览 - 对话模式 */}
                {pastedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 pt-1">
                    {pastedImages.map((image, index) => (
                      <div key={image.id} className="relative group inline-block">
                        <img 
                          src={image.url} 
                          alt={`图片${index + 1}`}
                          className={`h-16 w-16 object-cover rounded-lg border cursor-pointer ${
                            isDarkBg ? 'border-white/20' : 'border-black/15'
                          }`}
                          onClick={() => setPreviewImage(image.url)}
                        />
                        <button
                          onClick={() => removeImage(image.id)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {showImageLimitToast && (
                  <div className="mb-2 text-xs text-amber-400">最多只能粘贴 2 张图片</div>
                )}
                <div className="flex items-center gap-2">
                  {/* + 按钮 */}
                  <button className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${isDarkBg ? 'hover:bg-white/10 text-white/50 hover:text-white/80' : 'hover:bg-black/10 text-[#8b7355]'}`}>
                    <Plus className="w-5 h-5" />
                  </button>
                  {/* 输入框 */}
                  <textarea
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto'
                        el.style.height = Math.min(el.scrollHeight, 200) + 'px'
                      }
                    }}
                    value={input}
                    onChange={(e) => {
                      const val = e.target.value
                      setInput(val)
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
                      // 记录按键时间戳（保留最近5个）
                      const now = Date.now()
                      inputTimestampsRef.current = [...inputTimestampsRef.current.slice(-4), now]
                      // 新输入覆盖旧预测时发送 ignore 反馈
                      if (prediction && predictionShownAtRef.current) {
                        sendPredictFeedback(prediction, 'ignore', now - predictionShownAtRef.current, val)
                        predictionShownAtRef.current = null
                      }
                      triggerPrediction(val)
                    }}
                    onPaste={handlePaste}
                    placeholder="Reply..."
                    rows={1}
                    className={`flex-1 bg-transparent outline-none text-base resize-none overflow-y-auto leading-[2] ${isDarkBg ? 'text-white placeholder-white/40' : 'text-[#5d4e37] placeholder-[#8b7355]/60'}`}
                    style={{ maxHeight: '200px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' && prediction) {
                        e.preventDefault()
                        acceptPrediction()
                      } else if (e.key === 'Enter' && !e.shiftKey && (input.trim() || pastedImages.length > 0)) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                  />
                  {/* 模型名称 */}
                  <span className={`text-xs whitespace-nowrap flex-shrink-0 ${isDarkBg ? 'text-white/30' : 'text-[#8b7355]/50'}`}>
                    {modelName}
                  </span>
                  {/* 发送按钮 */}
                  <button
                    onClick={handleSend}
                    disabled={(!input.trim() && pastedImages.length === 0) || isLoading}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 flex-shrink-0 ${
                      isDarkBg 
                        ? 'text-white/60 hover:text-white hover:bg-white/10' 
                        : 'text-[#8b7355] hover:text-[#5d4e37] hover:bg-black/10'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              </div>
            ) : inputMode === 'Video' ? (
              /* ========== Video模式 - 专用输入框 ========== */
              <div className={`w-full backdrop-blur-2xl rounded-2xl p-4 transition-all duration-300 ${
                bgMode === 'video' 
                  ? 'bg-white/10 backdrop-blur-2xl border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.5),0_8px_32px_rgba(255,255,255,0.1)]' 
                  : resolvedTheme === 'dark' 
                    ? 'bg-[#2a2a2a] border border-[#333333] shadow-[0_20px_60px_rgba(0,0,0,0.5),0_8px_32px_rgba(255,255,255,0.1)]'
                    : 'bg-[#ffefd5] border border-[#e8d5b7] shadow-[0_20px_60px_rgba(0,0,0,0.1),0_8px_32px_rgba(0,0,0,0.05)]'
              }`}>
                {/* 第一行：视频图标 + Generate + 右侧参数 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {/* 返回按钮 */}
                    <button
                      onClick={() => setInputMode(null)}
                      className={`p-2 rounded-lg transition-colors ${isDarkBg ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-[#8b7355]'}`}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    {/* 视频图标 */}
                    <div className={`p-2 rounded-lg ${isDarkBg ? 'bg-white/10' : 'bg-black/10'}`}>
                      <svg className={`w-5 h-5 ${isDarkBg ? 'text-white' : 'text-[#5d4e37]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    {/* Generate 生成 下拉 */}
                    <button className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDarkBg ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-black/10 hover:bg-black/15 text-[#5d4e37]'}`}>
                      <span className="font-medium">Generate 生成</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {/* 右侧参数设置 */}
                  <div className="flex items-center gap-2">
                    {/* 模型选择 */}
                    <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${isDarkBg ? 'bg-white/10 hover:bg-white/15 text-white/80' : 'bg-black/10 hover:bg-black/15 text-[#5d4e37]'}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>Wan 2.6</span>
                    </button>
                    {/* 参数设置 */}
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${isDarkBg ? 'bg-white/10 text-white/80' : 'bg-black/10 text-[#5d4e37]'}`}>
                      <span>720P</span>
                      <span className="opacity-50">|</span>
                      <span>16:9</span>
                      <span className="opacity-50">|</span>
                      <span>5s</span>
                      <button className={`ml-1 p-1 rounded ${isDarkBg ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 第二行：图片图标 + 输入框 */}
                <div className="flex items-center gap-3 mb-3">
                  {/* 图片图标 */}
                  <button className={`p-2 rounded-lg transition-colors ${isDarkBg ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-[#8b7355]'}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {/* 输入框 */}
                  <textarea
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
                    }}
                    placeholder="Describe the action and atmosphere..."
                    rows={1}
                    className={`flex-1 bg-transparent outline-none text-lg resize-none overflow-y-auto ${isDarkBg ? 'text-white placeholder-white/40' : 'text-[#5d4e37] placeholder-[#8b7355]/60'}`}
                    style={{ maxHeight: '200px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                  />
                </div>

                {/* 第三行：音频图标 + Frame按钮组 + 右侧星星 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* 音频图标 */}
                    <button className={`p-2 rounded-lg transition-colors ${isDarkBg ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-[#8b7355]'}`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </button>
                    {/* + Frame 帧 按钮 */}
                    <button className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${isDarkBg ? 'bg-white/5 hover:bg-white/10 text-white/70' : 'bg-black/5 hover:bg-black/10 text-[#5d4e37]'}`}>
                      <span>+</span>
                      <span>Frame</span>
                      <span className="opacity-60">帧</span>
                    </button>
                    {/* 交换按钮 */}
                    <button className={`p-1.5 rounded-lg ${isDarkBg ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-[#8b7355]'}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </button>
                    {/* + Frame 帧 按钮2 */}
                    <button className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${isDarkBg ? 'bg-white/5 hover:bg-white/10 text-white/70' : 'bg-black/5 hover:bg-black/10 text-[#5d4e37]'}`}>
                      <span>+</span>
                      <span>Frame</span>
                      <span className="opacity-60">帧</span>
                    </button>
                    {/* 分隔线 */}
                    <div className={`w-px h-5 ${isDarkBg ? 'bg-white/20' : 'bg-black/20'}`}></div>
                    {/* + Audio 音频 */}
                    <button className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${isDarkBg ? 'bg-white/5 hover:bg-white/10 text-white/70' : 'bg-black/5 hover:bg-black/10 text-[#5d4e37]'}`}>
                      <span>+</span>
                      <span>Audio</span>
                      <span className="opacity-60">音频</span>
                    </button>
                  </div>
                  {/* 右侧星星按钮 */}
                  <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${isDarkBg ? 'bg-white/10 hover:bg-white/15 text-white/80' : 'bg-black/10 hover:bg-black/15 text-[#5d4e37]'}`}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="text-sm">0</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ========== 默认/其他模式 - 原输入框 ========== */
              <div>
                {/* 预测建议条 */}
                {prediction && (
                  <div
                    className="mb-2 flex items-center gap-3 px-4 py-2.5 rounded-2xl cursor-pointer transition-all duration-300 animate-[fadeIn_0.25s_ease-out]"
                    style={{ background: isDarkBg ? '#2a2a2a' : '#f0e6d6', border: isDarkBg ? '1px solid #404040' : '1px solid #e8d5b7' }}
                    onClick={acceptPrediction}
                  >
                    <CornerDownLeft className={`w-4 h-4 flex-shrink-0 ${isDarkBg ? 'text-white/50' : 'text-[#8b7355]'}`} />
                    <span className={`flex-1 text-sm truncate ${isDarkBg ? 'text-white/80' : 'text-[#5d4e37]'}`}>
                      “{prediction}”
                    </span>
                    <button
                      className={`p-0.5 rounded-md flex-shrink-0 transition-colors ${isDarkBg ? 'hover:bg-white/10 text-white/40 hover:text-white/70' : 'hover:bg-black/10 text-[#8b7355]/60 hover:text-[#8b7355]'}`}
                      onClick={(e) => { e.stopPropagation(); clearPrediction('dismiss', input); }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              <div className={`w-full backdrop-blur-2xl rounded-2xl p-4 transition-all duration-300 ${
                bgMode === 'video' 
                  ? 'bg-white/10 backdrop-blur-2xl border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.5),0_8px_32px_rgba(255,255,255,0.1)] hover:shadow-[0_24px_80px_rgba(0,0,0,0.6),0_12px_48px_rgba(255,255,255,0.15)]' 
                  : resolvedTheme === 'dark' 
                    ? 'bg-[#2a2a2a] border border-[#333333] shadow-[0_20px_60px_rgba(0,0,0,0.5),0_8px_32px_rgba(255,255,255,0.1)] hover:shadow-[0_24px_80px_rgba(0,0,0,0.6),0_12px_48px_rgba(255,255,255,0.15)]'
                    : 'bg-[#ffefd5] border border-[#e8d5b7] shadow-[0_20px_60px_rgba(0,0,0,0.1),0_8px_32px_rgba(0,0,0,0.05)]'
              }`}>
                {/* 粘贴图片预览 */}
                {pastedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {pastedImages.map((image, index) => (
                      <div key={image.id} className="relative group inline-block">
                        <img 
                          src={image.url} 
                          alt={`图片${index + 1}`}
                          className={`h-16 w-16 object-cover rounded-lg border cursor-pointer ${
                            isDarkBg ? 'border-white/20' : 'border-black/15'
                          }`}
                          onClick={() => setPreviewImage(image.url)}
                        />
                        <button
                          onClick={() => removeImage(image.id)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* 图片数量限制提示 */}
                {showImageLimitToast && (
                  <div className="mb-2 text-xs text-amber-400">最多只能粘贴 2 张图片</div>
                )}
                {/* 输入框行 */}
                <div className="flex items-center gap-3">
                  {/* 左侧图标按钮组 */}
                  <div className="flex items-center gap-1">
                    {/* 图片上传 */}
                    <button className={`p-2 rounded-lg transition-colors ${isDarkBg ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
                      <svg className={`w-5 h-5 ${isDarkBg ? 'text-white/60' : 'text-[#8b7355]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                    {/* 分隔线 */}
                    <div className={`w-px h-5 ${isDarkBg ? 'bg-white/20' : 'bg-black/20'}`}></div>
                  </div>
                  
                  <textarea
                    value={input}
                    onChange={(e) => {
                      const val = e.target.value
                      setInput(val)
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
                      // 记录按键时间戳（保留最近5个）
                      const now = Date.now()
                      inputTimestampsRef.current = [...inputTimestampsRef.current.slice(-4), now]
                      // 新输入覆盖旧预测时发送 ignore 反馈
                      if (prediction && predictionShownAtRef.current) {
                        sendPredictFeedback(prediction, 'ignore', now - predictionShownAtRef.current, val)
                        predictionShownAtRef.current = null
                      }
                      triggerPrediction(val)
                    }}
                    onPaste={handlePaste}
                    placeholder={displayPlaceholder || '描述你想要 AI 帮你做什么...'}
                    rows={1}
                    className={`flex-1 bg-transparent outline-none text-lg resize-none overflow-y-auto ${isDarkBg ? 'text-white placeholder-white/50' : 'text-[#5d4e37] placeholder-[#8b7355]'}`}
                    style={{ maxHeight: '200px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' && prediction) {
                        e.preventDefault()
                        acceptPrediction()
                      } else if (e.key === 'Enter' && !e.shiftKey && (input.trim() || pastedImages.length > 0)) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                  />
                            
                  <div className="flex items-center gap-2">
                    {/* 麦克风按钮 */}
                    <button className={`p-2 rounded-lg transition-colors ${isDarkBg ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
                      <svg className={`w-5 h-5 ${isDarkBg ? 'text-white/60' : 'text-[#8b7355]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                              
                    {/* 发送按钮 - 蛛蛛图标 */}
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() && pastedImages.length === 0}
                      className="group relative h-10 w-10 hover:w-auto bg-white hover:bg-white/95 rounded-full hover:rounded-lg text-black font-medium disabled:opacity-50 transition-all duration-300 shadow-[0_4px_20px_rgba(255,255,255,0.6)] hover:shadow-[0_6px_30px_rgba(255,255,255,0.8)] overflow-hidden cursor-pointer"
                    >
                      <svg 
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 transition-opacity duration-300 group-hover:opacity-0" 
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2C12 2 9 4 9 7C9 7 7 9 4 9C4 9 6 10 6 12C6 12 4 13 2 13C2 13 4 14 4 16C4 14 6 14 6 16C6 18 4 20 4 22C6 20 8 18 10 18C10 20 11 22 12 22C13 22 14 20 14 18C16 18 18 20 20 22C20 20 18 18 18 16C18 14 20 14 20 16C20 14 22 13 22 13C20 13 18 12 18 12C18 10 20 9 20 9C17 9 15 7 15 7C15 4 12 2 12 2M12 9A1 1 0 0 1 13 10A1 1 0 0 1 12 11A1 1 0 0 1 11 10A1 1 0 0 1 12 9Z" />
                      </svg>
                                
                      <div className="flex items-center gap-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="ml-2 whitespace-nowrap font-semibold">
                          let's go!
                        </span>
                        <ArrowRight className="w-5 h-5 flex-shrink-0" />
                      </div>
                    </button>
                  </div>
                </div>
                          
                {/* 底部标签/选项 */}
                <div className="flex items-center gap-3 mt-4 text-sm">
                {inputMode === null ? (
                  // 默认模式 - 显示试试标签
                  <>
                    <span className={`font-medium ${isDarkBg ? 'text-white/50' : 'text-[#8b7355]'}`}>试试：</span>
                    {['Video', 'Text', 'Audio', 'Image'].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setInputMode(tag)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${isDarkBg ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white/80' : 'bg-black/5 hover:bg-black/10 border border-[#e8d5b7] text-[#8b7355] hover:text-[#5d4e37]'}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </>
                ) : inputMode === 'Text' ? (
                  // Text模式 - 显示搜索、深度思考、Canvas
                  <>
                    {/* 返回按钮 */}
                    <button
                      onClick={() => setInputMode(null)}
                      className={`p-2 rounded-lg transition-colors ${isDarkBg ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-[#8b7355]'}`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    {/* 搜索 */}
                    <button
                      onClick={() => setTextOptions(prev => ({ ...prev, search: !prev.search }))}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        textOptions.search
                          ? (isDarkBg ? 'bg-white/20 border border-white/30 text-white' : 'bg-[#5d4e37] border border-[#5d4e37] text-white')
                          : (isDarkBg ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white/80' : 'bg-black/5 hover:bg-black/10 border border-[#e8d5b7] text-[#8b7355] hover:text-[#5d4e37]')
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      搜索
                    </button>
                    
                    {/* 深度思考 - 带tooltip */}
                    <div className="relative group/tooltip">
                      <button
                        onClick={() => setTextOptions(prev => ({ ...prev, deepThink: !prev.deepThink }))}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          textOptions.deepThink
                            ? (isDarkBg ? 'bg-white/20 border border-white/30 text-white' : 'bg-[#5d4e37] border border-[#5d4e37] text-white')
                            : (isDarkBg ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white/80' : 'bg-black/5 hover:bg-black/10 border border-[#e8d5b7] text-[#8b7355] hover:text-[#5d4e37]')
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        深度思考
                      </button>
                      {/* Tooltip */}
                      <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none ${
                        isDarkBg ? 'bg-white/20 text-white' : 'bg-[#5d4e37] text-white'
                      }`}>
                        <div>开启后所有Agents进行深度思考</div>
                        <div className="opacity-70 mt-0.5">默认模型自动选择是否深度思考</div>
                        <div className={`absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent ${isDarkBg ? 'border-t-white/20' : 'border-t-[#5d4e37]'}`}></div>
                      </div>
                    </div>
                    
                    {/* Canvas */}
                    <button
                      onClick={() => setTextOptions(prev => ({ ...prev, canvas: !prev.canvas }))}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        textOptions.canvas
                          ? (isDarkBg ? 'bg-white/20 border border-white/30 text-white' : 'bg-[#5d4e37] border border-[#5d4e37] text-white')
                          : (isDarkBg ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white/80' : 'bg-black/5 hover:bg-black/10 border border-[#e8d5b7] text-[#8b7355] hover:text-[#5d4e37]')
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                      Canvas
                    </button>
                  </>
                ) : (
                  // 其他模式(Audio/Image) - 暂时显示返回按钮
                  <>
                    <button
                      onClick={() => setInputMode(null)}
                      className={`p-2 rounded-lg transition-colors ${isDarkBg ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-[#8b7355]'}`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className={`font-medium ${isDarkBg ? 'text-white/50' : 'text-[#8b7355]'}`}>{inputMode} 模式（待实现）</span>
                  </>
                )}
                </div>
              </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 底部名言 - 始终展示 */}
        <div 
          className={`italic font-serif tracking-wide transition-all duration-300 ease-in-out ${
            hasStartedChat ? 'text-center py-2' : ''
          }`}
          style={hasStartedChat ? {
            fontSize: '0.8rem',
            opacity: 0.5,
            color: isDarkBg ? '#ffffff' : '#000000',
            WebkitTextFillColor: isDarkBg ? '#ffffff' : '#000000',
            userSelect: 'none',
            marginLeft: sidebarPinned ? '280px' : '0',
          } : {
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            marginLeft: sidebarPinned ? '140px' : '0',
            fontSize: '1rem',
            opacity: 0.8,
            color: isDarkBg ? '#ffffff' : '#000000',
            WebkitTextFillColor: isDarkBg ? '#ffffff' : '#000000',
            userSelect: 'none',
            minHeight: '1.5em',
            textShadow: '0 0 40px rgba(230,36,41,0.15)'
          }}
        >
          "{displayQuote}"
        </div>
      </div>

      {/* 搜索弹窗 */}
      {searchOpen && (
        <>
          <style>{`
            @keyframes searchSlideIn {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div 
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
            onClick={() => setSearchOpen(false)}
          >
            {/* 弹窗主体 - 无遮罩，直接覆盖 */}
            <div 
              className="relative w-full max-w-lg mx-4 bg-[#2a2a2a] border border-white/15 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.6)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{ animation: 'searchSlideIn 0.2s ease-out' }}
            >
              {/* 搜索输入 */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                <Search size={18} className="text-white/40 flex-shrink-0" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchHighlight(0); }}
                  placeholder="搜索历史会话..."
                  className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-sm"
                  onKeyDown={(e) => {
                    const filtered = sessions.filter(s => 
                      (s.title || '').toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setSearchHighlight(prev => Math.min(prev + 1, filtered.length - 1))
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setSearchHighlight(prev => Math.max(prev - 1, 0))
                    } else if (e.key === 'Enter' && filtered.length > 0) {
                      e.preventDefault()
                      handleSessionClick(filtered[searchHighlight].id)
                      setSearchOpen(false)
                    } else if (e.key === 'Escape') {
                      setSearchOpen(false)
                    }
                  }}
                />
                <button 
                  onClick={() => setSearchOpen(false)}
                  className="p-1 text-white/40 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              {/* 搜索结果 */}
              <div className="max-h-[50vh] overflow-y-auto py-2">
                {(() => {
                  const filtered = sessions.filter(s => 
                    !searchQuery || (s.title || '').toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  if (filtered.length === 0) {
                    return (
                      <div className="px-4 py-8 text-center text-white/40 text-sm">
                        没有找到匹配的会话
                      </div>
                    )
                  }
                  return filtered.map((session, idx) => (
                    <button
                      key={session.id}
                      onClick={() => { handleSessionClick(session.id); setSearchOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        idx === searchHighlight 
                          ? 'bg-white/10 text-white' 
                          : 'text-white/70 hover:bg-white/[0.06]'
                      }`}
                    >
                      <MessageSquare size={16} className="text-white/30 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{session.title || 'New Chat'}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-white/30">{formatRelativeTime(session.updated_at)}</span>
                        {idx === searchHighlight && (
                          <span className="text-xs text-white/50 bg-white/10 px-1.5 py-0.5 rounded">Enter ↵</span>
                        )}
                      </div>
                    </button>
                  ))
                })()}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 工作流编辑器弹窗 */}
      {showWorkflowModal && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowWorkflowModal(false)}
        >
          <div 
            className="w-[90vw] h-[85vh] bg-[#1a1a2e] rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Workflow className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">Workflow Editor 工作流编辑器</h2>
              </div>
              <button 
                onClick={() => setShowWorkflowModal(false)} 
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 画布区域 - 网格背景 */}
            <div 
              className="flex-1 relative overflow-hidden"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <Workflow className="w-16 h-16 text-blue-400/40" />
                <p className="text-2xl font-bold text-white/30">工作流编排功能开发中... 🚧</p>
                <p className="text-lg text-white/20">Coming Soon</p>
                <p className="text-sm text-white/10 mt-8">Drag and drop nodes to build your AI workflow</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirm.show && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setDeleteConfirm({ show: false, sessionId: null, title: '' })}
        >
          <div 
            className="w-[340px] bg-[rgba(30,30,36,0.98)] backdrop-blur-[20px] border border-white/[0.08] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] p-6"
            onClick={e => e.stopPropagation()}
          >
            {/* 标题 - 简洁一行 */}
            <p className="text-[15px] font-medium text-white/90">
              删除此对话？
            </p>
            
            {/* 描述 - 柔和的提示 */}
            <p className="mt-2 text-[13px] text-white/40 leading-relaxed">
              「{deleteConfirm.title ? (deleteConfirm.title.length > 20 ? deleteConfirm.title.slice(0, 20) + '...' : deleteConfirm.title) : '该对话'}」将被永久删除。
            </p>
            
            {/* 按钮区域 - 右对齐，小巧精致 */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setDeleteConfirm({ show: false, sessionId: null, title: '' })}
                className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-white/50 hover:text-white/70 hover:bg-white/[0.06] transition-all"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-red-400 hover:text-white hover:bg-red-500/80 transition-all"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量删除确认弹窗 */}
      {deleteGroupConfirm.show && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setDeleteGroupConfirm({ show: false, group: null })}
        >
          <div 
            className="w-[340px] bg-[rgba(30,30,36,0.98)] backdrop-blur-[20px] border border-white/[0.08] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] p-6"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[15px] font-medium text-white/90">
              删除「{deleteGroupConfirm.group?.label}」的所有对话？
            </p>
            <p className="mt-2 text-[13px] text-white/40 leading-relaxed">
              将永久删除该时间段内的 {deleteGroupConfirm.group?.sessions?.length || 0} 条对话。
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setDeleteGroupConfirm({ show: false, group: null })}
                className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-white/50 hover:text-white/70 hover:bg-white/[0.06] transition-all"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDeleteGroup}
                className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-red-400 hover:text-white hover:bg-red-500/80 transition-all"
              >
                全部删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 图片放大预览弹窗 */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img 
              src={previewImage} 
              alt="预览"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 bg-white/20 hover:bg-white/40 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg backdrop-blur-sm transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
