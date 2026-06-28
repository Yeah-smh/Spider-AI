import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, Activity, Sliders, Zap, Shield, Brain, Layers, Clock, Users, Wifi, Lock, TrendingUp, MessageCircle, X, Mic, Hand, User, ChevronDown, ChevronUp, ChevronLeft } from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'
import WorkflowCanvas from './WorkflowCanvas'

export default function WelcomePage() {
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState('')
  const [displayText, setDisplayText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [isOnThirdPage, setIsOnThirdPage] = useState(false)
  const [draggedItem, setDraggedItem] = useState(null)
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showChatDialog, setShowChatDialog] = useState(false)
  const [dialogInput, setDialogInput] = useState('')
  const [spiderY, setSpiderY] = useState(0)
  const [isClimbing, setIsClimbing] = useState(false)
  const [isDialogCollapsed, setIsDialogCollapsed] = useState(false)
  const messagesEndRef = useRef(null) // 用于自动滚动到底部
  const messagesContainerRef = useRef(null) // 对话容器的引用
  const [isUserScrolling, setIsUserScrolling] = useState(false) // 跟踪用户是否手动滚动
  const [placeholder, setPlaceholder] = useState('描述你想要 AI 帮你做什么...') // 动态提示文本
  const [displayPlaceholder, setDisplayPlaceholder] = useState('') // 打字机显示的文本
  const [isTyping, setIsTyping] = useState(true) // 是否正在打字
  const [currentIndex, setCurrentIndex] = useState(0) // 当前轮询索引
  const [inputMode, setInputMode] = useState(null) // 当前输入模式: null | 'Video' | 'Text' | 'Audio' | 'Image'
  const [textSearch, setTextSearch] = useState(false)
  const [textDeepThink, setTextDeepThink] = useState(false)
  const [textCanvas, setTextCanvas] = useState(false)
  const [pastedImages, setPastedImages] = useState([]) // 粘贴的图片列表
  const inputRef = useRef(null) // 输入框引用
  const [showImageLimitToast, setShowImageLimitToast] = useState(false) // 图片限制提示
  const [previewImage, setPreviewImage] = useState(null) // 当前预览的图片
  const [memories, setMemories] = useState([]) // 记忆列表
  const [isMemoryExpanded, setIsMemoryExpanded] = useState(false) // 记忆面板是否展开
  const [expandedRoundBox, setExpandedRoundBox] = useState(null) // 展开的圆角框 ID
  const [isDarkBackground, setIsDarkBackground] = useState(false) // 背景模式:false=视频,true=随机图片
  const [currentBgImage, setCurrentBgImage] = useState('') // 当前背景图片
  const [bgImages, setBgImages] = useState([]) // 背景图片列表
  
  // 加载 static_img 文件夹下所有图片
  useEffect(() => {
    fetch('/static_img/images.json')
      .then(res => res.json())
      .then(images => {
        // 过滤掉json文件本身
        const imgList = images.filter(img => !img.endsWith('.json'))
        setBgImages(imgList)
      })
      .catch(() => setBgImages(['/static_img/back.jpg']))
  }, [])
  const [autoLearnEnabled, setAutoLearnEnabled] = useState(true) // 自动学习开关,默认开启
  const [editingMemory, setEditingMemory] = useState(null) // 正在编辑的记忆
  const [newKeyword, setNewKeyword] = useState('') // 新关键词输入
  const [showKeywordInput, setShowKeywordInput] = useState(false) // 显示关键词输入框
  const [deleteConfirm, setDeleteConfirm] = useState(null) // 删除确认弹窗 {id, title}
  const [showWorkflow, setShowWorkflow] = useState(false) // 显示工作流画布
  
  // 模拟记忆数据
  const [memoryData, setMemoryData] = useState([
    {
      id: 1,
      title: '用户沟通偏好',
      scope: '会话',
      keywords: '沟通风格, 文字描述',
      content: '用户倾向于通过文字描述理解流程和逻辑，偏好清晰的步骤说明而非直接代码或公式'
    },
    {
      id: 2,
      title: '项目技术栈',
      scope: '全局',
      keywords: 'React 18, Vite, Tailwind CSS, lucide-react',
      content: '前端采用React 18 + Vite构建，样式使用Tailwind CSS，图标库为lucide-react，支持现代前端开发工作流'
    },
    {
      id: 3,
      title: '开发规范',
      scope: '全局',
      keywords: '代码风格, 规范, 注释',
      content: '代码需保持清晰的结构，使用适当的注释说明逻辑，避免过度复杂的嵌套，确保代码可读性和可维护性'
    },
    {
      id: 4,
      title: 'UI设计风格',
      scope: '全局',
      keywords: '写实感, 毛玻璃, 动漫风',
      content: '整体视觉风格需贴近动漫风格且超强写实，动画效果克制优雅，采用毛玻璃效果和半透明背景'
    },
    {
      id: 5,
      title: '学习兴趣',
      scope: '会话',
      keywords: '强化学习, LLM, RLHF',
      content: '用户正在学习强化学习入门知识，对RLHF、PPO、DPO等技术在LLM中的应用表现出兴趣'
    },
    {
      id: 6,
      title: '代码输出偏好',
      scope: '会话',
      keywords: '无+/-符号, 完整代码, 注释说明',
      content: '输出修改后的代码时，禁止使用+/-符号标注变更，应直接提供完整可运行的代码块，修改点在注释中描述'
    },
    {
      id: 7,
      title: '环境配置',
      scope: '全局',
      keywords: '前端目录, 代理配置, 端口',
      content: '前端项目位于d:/Spider_AI/spider_front，使用Vite代理转发/api请求至localhost:8000，实现前后端联调'
    }
  ])
  
  // 随机提示文本数组
  const placeholderTexts = [
    '让 Spider AI 随机新建一个工作流',
    'Spider AI 来帮你自主探索工作流编排？',
    '文字如蛛丝，Spider AI 帮你串联思绪~',
    '一幅画胜千言，Spider AI 绘你所想！',
    '声波如网，Spider AI 为你谱写旋律',
    '让 Spider AI 定格你的精彩瞬间'
  ]
  const [features, setFeatures] = useState([
    { id: 1, name: '蜘蛛感应', icon: 'Wifi', color: 'spider-red', desc: '实时监测文件变化、系统事件' },
    { id: 2, name: '灵动记忆', icon: 'Brain', color: 'spider-blue', desc: '四层分层记忆体系，跨会话理解' },
    { id: 3, name: '学习引擎', icon: 'BookOpen', color: 'purple-400', desc: '夜间静默学习，知识蒸馏' },
    { id: 4, name: '好邻居指数', icon: 'Activity', color: 'green-400', desc: '实时评估AI助手表现' },
    { id: 5, name: 'RL思想推理', icon: 'TrendingUp', color: 'pink-400', desc: '强化学习驱动，智能决策' },
    { id: 6, name: '隐私蛛网', icon: 'Lock', color: 'yellow-400', desc: '本地优先架构，数据守护' },
    { id: 7, name: '在线微调', icon: 'Sliders', color: 'cyan-400', desc: '个性化学习，专属AI' },
    { id: 8, name: null, icon: null, color: null, desc: null },
    { id: 9, name: null, icon: null, color: null, desc: null },
  ])
  
  const fullText = '能力越大，责任越大。\nSpider AI 是你的智能好邻居，\n随时准备帮你解决问题、激发灵感。'
  
  // 轮询切换 placeholder 提示文本
  useEffect(() => {
    // 初始2秒后开始第一条轮询
    const initialTimer = setTimeout(() => {
      setPlaceholder(placeholderTexts[0])
      setCurrentIndex(0)
      setIsTyping(true)
      setDisplayPlaceholder('') // 重置显示文本，准备打字
    }, 2000)
    
    return () => {
      clearTimeout(initialTimer)
    }
  }, [])
  
  // Placeholder 打字机效果
  useEffect(() => {
    if (!isTyping || displayPlaceholder === placeholder) {
      // 打字完成后，等待1.5秒再切换到下一条
      if (displayPlaceholder === placeholder && placeholder !== '描述你想要 AI 帮你做什么...') {
        const waitTimer = setTimeout(() => {
          // 轮询到下一条
          const nextIndex = (currentIndex + 1) % placeholderTexts.length
          setPlaceholder(placeholderTexts[nextIndex])
          setCurrentIndex(nextIndex)
          setIsTyping(true)
          setDisplayPlaceholder('') // 重置显示文本，准备打字
        }, 1500)
        
        return () => clearTimeout(waitTimer)
      }
      return
    }
    
    const timeout = setTimeout(() => {
      setDisplayPlaceholder(placeholder.slice(0, displayPlaceholder.length + 1))
    }, 30) // 打字速度加快到30ms，更流畅
    
    return () => clearTimeout(timeout)
  }, [displayPlaceholder, placeholder, isTyping, placeholderTexts, currentIndex])
  
  // 智能自动滚动：只在用户没有手动滚动时才自动滚动到底部
  useEffect(() => {
    if (!isUserScrolling && messagesContainerRef.current) {
      const container = messagesContainerRef.current
      container.scrollTop = container.scrollHeight
    }
  }, [messages, isLoading, isUserScrolling])
  
  // 检测用户是否手动滚动
  const handleScroll = (e) => {
    const container = e.target
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 10
    
    // 如果用户滚动到底部，重置为自动滚动模式
    if (isAtBottom) {
      setIsUserScrolling(false)
    } else {
      // 否则记录用户正在手动滚动
      setIsUserScrolling(true)
    }
  }
  
  // 发送消息到后端（用于弹窗对话）
  const sendDialogMessage = async () => {
    if (!dialogInput.trim() || isLoading) return
    
    const userMessage = dialogInput.trim()
    setDialogInput('')
    
    // 添加用户消息到聊天记录
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/chat/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage }),
      })
      
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let aiContent = ''
      
      // 添加一个空的 AI 消息用于流式更新
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n\n').filter(line => line.trim())
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6))
              if (data.type === 'content') {
                aiContent += data.content
                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1] = { role: 'assistant', content: aiContent }
                  return newMessages
                })
              } else if (data.type === 'error') {
                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1] = { role: 'assistant', content: `⚠️ ${data.content}` }
                  return newMessages
                })
              }
            } catch (e) {
              console.warn('Failed to parse SSE:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，发生了错误。请稍后再试。' }])
    } finally {
      setIsLoading(false)
    }
  }
  
  // 显示图片限制提示
  const showImageLimitMessage = () => {
    setShowImageLimitToast(true)
    setTimeout(() => setShowImageLimitToast(false), 3000)
  }

  // 处理粘贴图片
  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      
      // 检查是否为图片
      if (item.type.indexOf('image') !== -1) {
        // 检查图片数量限制
        if (pastedImages.length >= 2) {
          e.preventDefault()
          showImageLimitMessage()
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
              // 再次检查数量限制
              if (prev.length >= 2) {
                showImageLimitMessage()
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

  // 删除图片
  const removeImage = (imageId) => {
    setPastedImages(prev => prev.filter(img => img.id !== imageId))
  }

  // 键盘删除图片功能
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ESC 键关闭图片预览
      if (e.key === 'Escape' && previewImage) {
        setPreviewImage(null)
        return
      }
      
      // Delete 或 Backspace 键删除最后一张图片
      if ((e.key === 'Delete' || e.key === 'Backspace') && pastedImages.length > 0) {
        // 只有当输入框为空时才删除图片
        if (!inputValue.trim() && document.activeElement === inputRef.current) {
          e.preventDefault()
          setPastedImages(prev => prev.slice(0, -1))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pastedImages, inputValue, previewImage])
  
  // 点击页面空白处关闭展开的圆角框
  useEffect(() => {
    const handleClickOutside = (e) => {
      // 如果有展开的圆角框，则关闭它
      if (expandedRoundBox) {
        setExpandedRoundBox(null)
      }
    }

    if (expandedRoundBox) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [expandedRoundBox])

  // 监听Esc键关闭编辑弹窗
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && editingMemory) {
        setEditingMemory(null)
        setShowKeywordInput(false)
        setNewKeyword('')
      }
    }

    if (editingMemory) {
      document.addEventListener('keydown', handleEscKey)
      return () => document.removeEventListener('keydown', handleEscKey)
    }
  }, [editingMemory])

  // 发送消息到后端（用于首页输入框）
  const sendMessage = async () => {
    if ((!inputValue.trim() && pastedImages.length === 0) || isLoading) return
    
    // 如果对话框是收起状态，则展开
    if (isDialogCollapsed) {
      setIsDialogCollapsed(false)
    }
    
    const userMessage = inputValue.trim()
    const images = [...pastedImages]
    setInputValue('')
    setPastedImages([])
    
    // 添加用户消息到聊天记录（包含图片）
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage,
      images: images.map(img => img.url)
    }])
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/chat/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage, images: images.length > 0 ? images.map(img => img.url) : undefined }),
      })
      
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let aiContent = ''
      
      // 添加一个空的 AI 消息用于流式更新
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n\n').filter(line => line.trim())
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6))
              if (data.type === 'content') {
                aiContent += data.content
                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1] = { role: 'assistant', content: aiContent }
                  return newMessages
                })
              } else if (data.type === 'error') {
                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1] = { role: 'assistant', content: `⚠️ ${data.content}` }
                  return newMessages
                })
              }
            } catch (e) {
              console.warn('Failed to parse SSE:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，发生了错误。请稍后再试。' }])
    } finally {
      setIsLoading(false)
    }
  }
  
  // 拖动处理函数
  const handleDragStart = (e, index) => {
    setDraggedItem(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    if (draggedItem === null) return

    const newFeatures = [...features]
    const draggedFeature = newFeatures[draggedItem]
    newFeatures.splice(draggedItem, 1)
    newFeatures.splice(dropIndex, 0, draggedFeature)
    
    setFeatures(newFeatures)
    setDraggedItem(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  // 渲染图标组件
  const renderIcon = (iconName, color) => {
    const iconProps = { className: `w-12 h-12 text-${color} drop-shadow-[0_0_10px_rgba(230,36,41,0.5)] transition-transform duration-500 group-hover:scale-110`, strokeWidth: 1.5 }
    
    switch(iconName) {
      case 'Wifi': return <Wifi {...iconProps} />
      case 'Brain': return <Brain {...iconProps} />
      case 'BookOpen': return <BookOpen {...iconProps} />
      case 'Activity': return <Activity {...iconProps} />
      case 'TrendingUp': return <TrendingUp {...iconProps} className={`w-14 h-14 text-${color} drop-shadow-[0_0_10px_rgba(236,72,153,0.6)] transition-transform duration-500 group-hover:scale-110`} />
      case 'Lock': return <Lock {...iconProps} />
      case 'Sliders': return <Sliders {...iconProps} />
      default: return null
    }
  }
  
  // 打字机效果
  useEffect(() => {
    let timeout
    
    if (!isDeleting && displayText === fullText) {
      timeout = setTimeout(() => setIsDeleting(true), 2000)
    } else if (isDeleting && displayText === '') {
      timeout = setTimeout(() => setIsDeleting(false), 1000)
    } else if (isDeleting) {
      const deleteSpeed = Math.random() > 0.5 ? 20 : 100
      timeout = setTimeout(() => {
        setDisplayText(displayText.slice(0, -1))
      }, deleteSpeed)
    } else {
      timeout = setTimeout(() => {
        setDisplayText(fullText.slice(0, displayText.length + 1))
      }, 50)
    }
    
    return () => clearTimeout(timeout)
  }, [displayText, isDeleting, fullText])

  // 监听滚动
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      setScrolled(scrollY > 100)
      
      // 检测是否在第3页（Product Features 区域）
      // 假设第3页大约从页面高度的2倍开始
      const viewportHeight = window.innerHeight
      const thirdPageStart = viewportHeight * 2 - 200 // 提前一点触发
      setIsOnThirdPage(scrollY > thirdPageStart)
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 小蜘蛛侠动画：随机弹跳和爬蜘蛛丝
  useEffect(() => {
    if (!scrolled) return

    // 随机弹跳动画
    const bounceInterval = setInterval(() => {
      if (!isClimbing && Math.random() > 0.7) {
        // 30% 的几率弹跳
        setSpiderY(-10)
        setTimeout(() => setSpiderY(0), 300)
      }
    }, 2000)

    // 随机爬蜘蛛丝动画
    const climbInterval = setInterval(() => {
      if (Math.random() > 0.8) {
        // 20% 的几率爬蜘蛛丝
        setIsClimbing(true)
        setSpiderY(-20)
        setTimeout(() => {
          setSpiderY(0)
          setTimeout(() => setIsClimbing(false), 500)
        }, 1500)
      }
    }, 5000)

    return () => {
      clearInterval(bounceInterval)
      clearInterval(climbInterval)
    }
  }, [scrolled, isClimbing])

  return (
    <div className="min-h-screen bg-white">
      {/* 工作流画布 */}
      {showWorkflow && (
        <WorkflowCanvas onClose={() => setShowWorkflow(false)} />
      )}
      
      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <div className="bg-transparent backdrop-blur-md border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            {/* 标题栏 */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">Spider AI</h3>
            </div>
            
            {/* 内容 */}
            <div className="mb-8">
              <p className="text-white/90 text-center text-lg">
                确定要删除记忆
              </p>
              <p className="text-white/70 text-center text-sm mt-2">
                "{deleteConfirm.title}"
              </p>
            </div>
            
            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl text-white/90 text-sm font-medium transition-all"
              >
                取消
              </button>
              <button
                onClick={() => {
                  // 执行删除
                  setMemoryData(memoryData.filter(m => m.id !== deleteConfirm.id))
                  // 如果删除的是当前展开的项,关闭展开
                  if (expandedRoundBox === deleteConfirm.id) {
                    setExpandedRoundBox(null)
                  }
                  console.log('删除记忆', deleteConfirm.title)
                  setDeleteConfirm(null)
                }}
                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl text-white/90 text-sm font-medium transition-all"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 编辑记忆侧边栏 */}
      {editingMemory && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          {/* 背景遮罩 */}
          <div 
            className="absolute inset-0"
            onClick={() => setEditingMemory(null)}
          />
          
          {/* 编辑记忆表单 */}
          <div className="relative bg-white/5 backdrop-blur-md rounded-lg w-full max-w-md aspect-square border border-white/10 shadow-2xl flex flex-col">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-white text-base font-medium">编辑记忆</h2>
              <button
                onClick={() => setEditingMemory(null)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 弹窗内容 */}
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {/* 标题 */}
              <div>
                <label className="block text-white/70 text-xs mb-1.5">标题</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editingMemory.title}
                    onChange={(e) => setEditingMemory({...editingMemory, title: e.target.value})}
                    maxLength={200}
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder-white/30 outline-none focus:border-white/30 transition-colors"
                  />
                  <span className="absolute right-2 top-2 text-white/40 text-[10px]">{editingMemory.title.length}/200</span>
                </div>
              </div>
              
              {/* 范围（固定） */}
              <div>
                <label className="block text-white/70 text-xs mb-1.5">范围（固定）</label>
                <div className="px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white/50">
                  会话
                </div>
              </div>
              
              {/* 关键词 */}
              <div>
                <label className="block text-white/70 text-xs mb-1.5">关键词</label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {editingMemory.keywords.split(',').filter(k => k.trim()).map((keyword, idx) => (
                    <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded border border-white/10">
                      <span className="text-white/90 text-xs">{keyword.trim()}</span>
                      <button
                        onClick={() => {
                          const keywords = editingMemory.keywords.split(',').filter(k => k.trim())
                          keywords.splice(idx, 1)
                          setEditingMemory({...editingMemory, keywords: keywords.join(', ')})
                        }}
                        className="text-white/50 hover:text-white transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  
                  {/* 条件显示输入框或+号按钮 */}
                  {showKeywordInput ? (
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newKeyword.trim()) {
                          const keywords = editingMemory.keywords ? editingMemory.keywords + ', ' + newKeyword.trim() : newKeyword.trim()
                          setEditingMemory({...editingMemory, keywords})
                          setNewKeyword('')
                          setShowKeywordInput(false)
                          e.preventDefault()
                        } else if (e.key === 'Escape') {
                          setNewKeyword('')
                          setShowKeywordInput(false)
                        }
                      }}
                      onBlur={() => {
                        setNewKeyword('')
                        setShowKeywordInput(false)
                      }}
                      autoFocus
                      placeholder="输入以保存"
                      className="px-2 py-1 text-xs bg-white/5 border border-white/10 border-dashed rounded text-white placeholder-white/40 outline-none focus:border-white/30 focus:bg-white/10 transition-colors w-24"
                    />
                  ) : (
                    <button
                      onClick={() => setShowKeywordInput(true)}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 border-dashed text-white/70 hover:text-white transition-colors text-xs flex items-center gap-1"
                    >
                      <span className="text-sm">+</span>
                    </button>
                  )}
                </div>
              </div>
              
              {/* 内容 */}
              <div className="flex-1 flex flex-col">
                <label className="block text-white/70 text-xs mb-1.5">内容</label>
                <div className="relative flex-1">
                  <textarea
                    value={editingMemory.content}
                    onChange={(e) => setEditingMemory({...editingMemory, content: e.target.value})}
                    maxLength={1000}
                    className="w-full h-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder-white/30 outline-none focus:border-white/30 transition-colors resize-none"
                    placeholder="请输入记忆内容..."
                  />
                  <span className="absolute right-2 bottom-2 text-white/40 text-[10px]">{editingMemory.content.length}/1000</span>
                </div>
              </div>
            </div>
            
            {/* 弹窗底部 */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-white/10">
              <button
                onClick={() => setEditingMemory(null)}
                className="px-4 py-1.5 text-sm bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 rounded-md text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  // 即时更新记忆数据
                  setMemoryData(memoryData.map(m => 
                    m.id === editingMemory.id ? editingMemory : m
                  ))
                  console.log('保存记忆', editingMemory)
                  setEditingMemory(null)
                  setShowKeywordInput(false)
                  setNewKeyword('')
                }}
                className="px-4 py-1.5 text-sm bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/20 rounded-md text-white transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 图片放大预览模态框 */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center gap-4">
            <img 
              src={previewImage.url} 
              alt={previewImage.name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex items-center gap-4">
              <span className="text-white text-sm font-medium">{previewImage.name}</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg text-white text-sm transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 图片限制提示 Toast */}
      {showImageLimitToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-black/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl px-6 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.3),0_8px_32px_rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-4">
              {/* 蜘蛛侠 Icon - 纯白 */}
              <div className="relative">
                <svg className="w-8 h-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C12 2 9 4 9 7C9 7 7 9 4 9C4 9 6 10 6 12C6 12 4 13 2 13C2 13 4 14 4 16C4 14 6 14 6 16C6 18 4 20 4 22C6 20 8 18 10 18C10 20 11 22 12 22C13 22 14 20 14 18C16 18 18 20 20 22C20 20 18 18 18 16C18 14 20 14 20 16C20 14 22 13 22 13C20 13 18 12 18 12C18 10 20 9 20 9C17 9 15 7 15 7C15 4 12 2 12 2M12 9A1 1 0 0 1 13 10A1 1 0 0 1 12 11A1 1 0 0 1 11 10A1 1 0 0 1 12 9Z" />
                </svg>
              </div>
              
              {/* 文字内容 */}
              <div>
                <p className="text-white font-bold text-lg drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                  Spider AI
                </p>
                <p className="text-white text-sm mt-0.5 drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]">
                  未进入空间前，只能上传2张图片
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 第一屏 - Hero 区域 */}
      <div className="relative h-screen overflow-hidden">
        {/* 背景 - 视频或随机图片 */}
        {isDarkBackground ? (
          <img 
            src={currentBgImage} 
            alt="background" 
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/learn.mp4" type="video/mp4" />
          </video>
        )}

        {/* 深色遮罩 - 有对话时显示 */}
        {messages.length > 0 && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-all duration-500" />
        )}

        {/* Hero 内容 */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Hero 区域主要内容 - 有对话时隐藏内容但保留占位 */}
          <div className={`flex flex-col justify-center flex-1 px-8 max-w-7xl transition-all duration-500`}>
            {messages.length === 0 && (
            <div className="max-w-3xl">
              <h1 className="text-5xl font-bold text-white leading-tight mb-6 drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                Learn Humbly,
                <br />
                Help Extraordinarily~
              </h1>
              
              <p className="text-xl text-white/80 mb-8 font-light italic min-h-[4.5rem] whitespace-pre-line">
                {displayText}
                <span className="animate-pulse">|</span>
              </p>

              <button
                onClick={() => navigate('/chat')}
                className="group ml-2 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white font-medium hover:bg-white/20 transition-all flex items-center gap-3 text-base"
              >
                立即体验 Spider AI
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            )}
          </div>

          {/* 对话历史浮层 - 居中显示 */}
          {messages.length > 0 && !isDialogCollapsed && (
            <div className="absolute left-0 right-0 bottom-[12rem] top-28 px-8 flex justify-center pointer-events-none z-10">
              <div className="w-full max-w-4xl">
                <div 
                  ref={messagesContainerRef} 
                  onScroll={handleScroll}
                  className="h-full overflow-y-auto space-y-4 relative pointer-events-auto"
                >
                  {/* 收起按钮 - 粘性定位跟随滚动 */}
                  <div className="sticky top-0 right-0 flex justify-end z-10 -mb-2">
                    <button
                      onClick={() => setIsDialogCollapsed(true)}
                      className="w-8 h-8 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center transition-all hover:scale-110"
                      title="收起对话历史"
                    >
                      <ChevronDown className="w-4 h-4 text-white/70" />
                    </button>
                  </div>

                  {/* 对话消息 - 用户往右，AI往左 */}
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${
                        msg.role === 'user' ? 'justify-end pl-16' : 'justify-start pr-16'
                      }`}
                    >
                      <div
                        className={`${
                          msg.role === 'user' 
                            ? 'max-w-[85%] rounded-2xl px-4 py-3 bg-gradient-to-br from-white/[0.12] to-white/[0.06] backdrop-blur-md border border-white/[0.2] shadow-[0_0_15px_rgba(255,255,255,0.1)] text-white font-medium tracking-wide' 
                            : 'max-w-full text-white/90'
                        }`}
                        style={msg.role === 'user' ? { textShadow: '0 0 8px rgba(255,255,255,0.3)' } : {}}
                      >
                        {msg.role === 'user' ? (
                          <div>
                            {msg.images && msg.images.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-2">
                                {msg.images.map((imgUrl, imgIdx) => (
                                  <img 
                                    key={imgIdx}
                                    src={imgUrl} 
                                    alt="用户图片"
                                    className="max-w-[200px] max-h-[200px] object-contain rounded-lg border border-white/20 cursor-pointer hover:opacity-80 transition-opacity"
                                    onDoubleClick={() => setPreviewImage({ url: imgUrl, name: `用户图片${imgIdx + 1}` })}
                                  />
                                ))}
                              </div>
                            )}
                            {msg.content && <p className="whitespace-pre-wrap text-sm">{msg.content}</p>}
                          </div>
                        ) : (
                          <div className="text-sm">
                            <MarkdownRenderer content={msg.content} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* 加载中的动画 */}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="max-w-full rounded-2xl px-4 py-2 bg-white/[0.08] backdrop-blur-[2px] border border-white/[0.15] text-white/90">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* 水平分割线 - 独立居中，绝对定位 */}
          {messages.length > 0 && !isDialogCollapsed && (
            <div className="absolute left-0 right-0 bottom-[11rem] px-8 flex justify-center pointer-events-none z-10">
              <div className="w-full max-w-4xl">
                <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              </div>
            </div>
          )}

          {/* 底部输入栏 */}
          <div className={`pb-8 px-8 transition-all duration-500 ${
            messages.length > 0 && !isDialogCollapsed ? 'flex justify-end' : 'flex justify-center'
          }`}>
            <div className={`w-full transition-all duration-500 ${
              messages.length > 0 && !isDialogCollapsed ? 'max-w-5xl pl-80' : 'max-w-4xl'
            }`}>
            
            {/* 记忆面板 - 在左侧 */}
            {messages.length > 0 && !isDialogCollapsed && (
              <div className="fixed left-8 bottom-[3rem] w-64 flex flex-col gap-3">
                {/* 工作流按钮 */}
                <div>
                  <h3 className="text-white/50 text-lg transition-all duration-300 px-2 mb-3">自主/自定义工作流：</h3>
                  <button
                    onClick={() => {
                      setShowWorkflow(true)
                    }}
                    className="w-full px-4 py-2.5 bg-transparent border border-white/10 rounded-xl text-white/90 text-sm text-left hover:bg-white/5 transition-all flex items-center justify-between"
                  >
                    <span>工作流</span>
                    <svg 
                      className="w-4 h-4 text-white/70" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                
                {/* 记忆列表 */}
                <div>
                  {/* 标题 */}
                  <h3 className="text-white/50 text-lg transition-all duration-300 px-2 mb-3">记忆列表 / Memory：</h3>
                  
                  {/* 圆角侧边框 */}
                  <div className="relative">
                  <button
                    onClick={() => {
                      setIsMemoryExpanded(!isMemoryExpanded)
                      // 关闭内部弹窗时，重置展开的圆角框
                      if (isMemoryExpanded) {
                        setExpandedRoundBox(null)
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-transparent border border-white/10 rounded-xl text-white/90 text-sm text-left hover:bg-white/5 transition-all flex items-center justify-between"
                  >
                    <span>{memories.length > 0 ? `${memories.length} 条记忆` : '暂无记忆'}</span>
                    <svg 
                      className={`w-4 h-4 text-white/70 transition-transform duration-300`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      {isMemoryExpanded ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      )}
                    </svg>
                  </button>
                  
                  {/* 上拉展开内容 */}
                  {isMemoryExpanded && (
                    <div 
                      className={`absolute bottom-full left-0 right-0 mb-2 max-h-96 backdrop-blur-md border border-white/10 rounded-xl p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent ${
                        isDarkBackground ? 'bg-[#2d2d44]' : 'bg-white/10'
                      }`} 
                      style={{ overflowY: 'auto', overflowX: 'visible' }}
                    >
                      {/* 首标题 */}
                      <div className="pb-3 border-b border-white/10">
                        <h4 className="text-white/90 text-xs font-medium mb-2">根据您的聊天内容自动学习您的偏好（体验）</h4>
                        <div className="flex items-center justify-between">
                          <span className="text-white/70 text-xs">开启自动生成</span>
                          <button
                            onClick={() => setAutoLearnEnabled(!autoLearnEnabled)}
                            className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                              autoLearnEnabled ? 'bg-green-500' : 'bg-white/20'
                            }`}
                          >
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${
                              autoLearnEnabled ? 'translate-x-6' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      </div>
                      
                      {/* 七个圆角框 - 根据实际记忆数据动态生成 */}
                      {memoryData.map((box) => (
                        <div key={box.id} className="relative group">
                          <button
                            onClick={(e) => {
                              e.stopPropagation() // 阻止事件冒泡
                              setExpandedRoundBox(expandedRoundBox === box.id ? null : box.id)
                            }}
                            className={`w-full px-3 py-2 border border-white/10 rounded-lg text-white/90 text-xs text-left transition-all flex items-center justify-between ${
                              isDarkBackground ? 'bg-[#1e1e2e] hover:bg-[#252538]' : 'bg-white/10 hover:bg-white/20'
                            }`}
                          >
                            <span>{box.title}</span>
                            <div className="flex items-center gap-2">
                              {/* 编辑和删除按钮 - 悬停时显示 */}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // 加载对应的记忆数据
                                    const memory = memoryData.find(m => m.id === box.id)
                                    if (memory) {
                                      setEditingMemory({...memory})
                                    }
                                    setShowKeywordInput(false)
                                    setNewKeyword('')
                                  }}
                                  className="p-1 hover:bg-white/20 rounded transition-colors"
                                  title="编辑"
                                >
                                  <svg className="w-3.5 h-3.5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // 显示删除确认弹窗
                                    setDeleteConfirm({ id: box.id, title: box.title })
                                  }}
                                  className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                  title="删除"
                                >
                                  <svg className="w-3.5 h-3.5 text-white/70 hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                              
                              {/* 箭头图标 */}
                              <svg 
                                className={`w-3 h-3 text-white/70 transition-transform duration-300`} 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                {expandedRoundBox === box.id ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                )}
                              </svg>
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}
            
            {/* 圆角框展开内容 - fixed定位在记忆面板外层，全局显示 */}
            {messages.length > 0 && !isDialogCollapsed && expandedRoundBox && (() => {
              const memory = memoryData.find(m => m.id === expandedRoundBox)
              if (!memory) return null
              
              return (
                <div 
                  onClick={(e) => e.stopPropagation()} // 阻止事件冒泡
                  className={`fixed left-[calc(2rem+16rem+1rem)] w-96 backdrop-blur-md border border-white/10 rounded-xl p-4 z-[100] ${
                    isDarkBackground ? 'bg-[#1e1e2e]' : 'bg-white/10'
                  }`} 
                  style={{ 
                    bottom: `calc(3rem + ${(8 - expandedRoundBox) * 2.5}rem)`
                  }}
                >
                  <div className="space-y-2">
                    <div>
                      <p className="text-white/50 text-xs mb-1">范围（固定）</p>
                      <p className="text-white/90 text-sm">{memory.scope}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">关键词</p>
                      <p className="text-white/90 text-sm">{memory.keywords}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs mb-1">内容</p>
                      <p className="text-white/90 text-sm leading-relaxed">
                        {memory.content}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}
            
            {/* 输入框容器 - 始终固定在底部 */}
            <div className={`w-full max-w-4xl rounded-2xl p-4 transition-all duration-300 ${
              messages.length > 0 && !isDialogCollapsed
                ? 'bg-transparent border-transparent shadow-none' 
                : 'bg-[rgba(38,38,44,0.8)] backdrop-blur-[20px] border border-white/10 rounded-3xl shadow-[inset_0_0_10px_rgba(255,255,255,0.08),0_20px_60px_rgba(0,0,0,0.5)]'
            }`}>
              {/* 收起状态 - 展开按钮 */}
              {messages.length > 0 && isDialogCollapsed && (
                <div className="mb-4 flex justify-center">
                  <button
                    onClick={() => setIsDialogCollapsed(false)}
                    className="w-8 h-8 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center transition-all hover:scale-110"
                    title="展开对话历史"
                  >
                    <ChevronUp className="w-4 h-4 text-white/70" />
                  </button>
                </div>
              )}
              
              {/* 输入框区域（包含图片预览） */}
              {inputMode === 'Video' ? (
                /* ========== Video模式 - 专用输入框 ========== */
                <div className="flex flex-col gap-3">
                  {/* 第一行：视频图标 + Generate + 右侧参数 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* 返回按钮 */}
                      <button
                        onClick={() => setInputMode(null)}
                        className="p-2 rounded-lg transition-colors hover:bg-white/10 text-white/60"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      {/* 视频图标 */}
                      <div className="p-2 rounded-lg bg-white/10">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      {/* Generate 生成 下拉 */}
                      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white">
                        <span className="font-medium">Generate 生成</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    {/* 右侧参数设置 */}
                    <div className="flex items-center gap-2">
                      {/* 模型选择 */}
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-white/10 hover:bg-white/15 text-white/80">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>Wan 2.6</span>
                      </button>
                      {/* 参数设置 */}
                      <div className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-white/10 text-white/80">
                        <span>720P</span>
                        <span className="opacity-50">|</span>
                        <span>16:9</span>
                        <span className="opacity-50">|</span>
                        <span>5s</span>
                        <button className="ml-1 p-1 rounded hover:bg-white/10">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 第二行：图片图标 + 输入框 */}
                  <div className="flex items-center gap-3">
                    {/* 图片图标 */}
                    <button className="p-2 rounded-lg transition-colors hover:bg-white/10 text-white/60">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                    {/* 输入框 */}
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Describe the action and atmosphere..."
                      className="flex-1 bg-transparent outline-none text-lg text-white placeholder-white/40"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && inputValue.trim()) {
                          sendMessage()
                        }
                      }}
                    />
                  </div>

                  {/* 第三行：音频图标 + Frame按钮组 + 右侧星星 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* 音频图标 */}
                      <button className="p-2 rounded-lg transition-colors hover:bg-white/10 text-white/60">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </button>
                      {/* + Frame 帧 按钮 */}
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-white/70">
                        <span>+</span>
                        <span>Frame</span>
                        <span className="opacity-60">帧</span>
                      </button>
                      {/* 交换按钮 */}
                      <button className="p-1.5 rounded-lg hover:bg-white/10 text-white/60">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                      {/* + Frame 帧 按钮2 */}
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-white/70">
                        <span>+</span>
                        <span>Frame</span>
                        <span className="opacity-60">帧</span>
                      </button>
                      {/* 分隔线 */}
                      <div className="w-px h-5 bg-white/20"></div>
                      {/* + Audio 音频 */}
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-white/70">
                        <span>+</span>
                        <span>Audio</span>
                        <span className="opacity-60">音频</span>
                      </button>
                    </div>
                    {/* 右侧星星按钮 */}
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white/80">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <span className="text-sm">0</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* ========== 默认模式 - 原输入框 ========== */
              <div className="flex flex-col gap-3">
                {/* 图片文件名列表 - 在输入框内部 */}
                {pastedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pastedImages.map((image, index) => (
                      <div key={image.id} className="relative group inline-block">
                        <img 
                          src={image.url} 
                          alt={`图片${index + 1}`}
                          className="h-16 w-16 object-cover rounded-lg border border-white/20 cursor-pointer"
                          onClick={() => setPreviewImage({ url: image.url, name: image.name || `图片${index + 1}` })}
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
                
                {/* 输入框行 */}
                <div className="flex items-center gap-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onPaste={handlePaste}
                  placeholder={displayPlaceholder}
                  className="flex-1 bg-transparent text-white placeholder-white/50 outline-none text-lg transition-all duration-300"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (inputValue.trim() || pastedImages.length > 0)) {
                      sendMessage()
                    }
                  }}
                />
                
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={sendMessage}
                    disabled={(!inputValue.trim() && pastedImages.length === 0) || isLoading}
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
              </div>
              )}
              
              {/* 底部标签 */}
              <div className="flex items-center justify-between mt-4 text-sm">
                {inputMode === null ? (
                  // 默认模式 - 显示试试标签
                  <div className="flex items-center gap-3">
                    <span className="text-white/50 font-medium">试试：</span>
                    {['Video', 'Text', 'Audio', 'Image'].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setInputMode(tag)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white/60 hover:text-white/80 transition-colors text-sm font-medium"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : inputMode === 'Text' ? (
                  // Text模式 - 显示搜索、深度思考、Canvas
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setInputMode(null)}
                      className="p-2 rounded-lg transition-colors hover:bg-white/10 text-white/60"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setTextSearch(!textSearch)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        textSearch
                          ? 'bg-white/20 border border-white/30 text-white'
                          : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white/80'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      搜索
                    </button>
                    <div className="relative group/tooltip">
                      <button
                        onClick={() => setTextDeepThink(!textDeepThink)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          textDeepThink
                            ? 'bg-white/20 border border-white/30 text-white'
                            : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white/80'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        深度思考
                      </button>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none bg-white/20 text-white">
                        <div>开启后所有Agents进行深度思考</div>
                        <div className="opacity-70 mt-0.5">默认模型自动选择是否深度思考</div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white/20"></div>
                      </div>
                    </div>
                    <button
                      onClick={() => setTextCanvas(!textCanvas)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        textCanvas
                          ? 'bg-white/20 border border-white/30 text-white'
                          : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white/80'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                      Canvas
                    </button>
                  </div>
                ) : (
                  // 其他模式(Audio/Image) - 显示返回按钮 + 模式名称（Video已有专用输入框，不显示此处）
                  inputMode !== 'Video' && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setInputMode(null)}
                      className="p-2 rounded-lg transition-colors hover:bg-white/10 text-white/60"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-white/50 font-medium">{inputMode} 模式（待实现）</span>
                  </div>
                  )
                )}
                
                {/* 功能圆圈 - 只在默认模式显示 */}
                {inputMode === null && <div className="flex items-center gap-4">
                  {[
                    { icon: BookOpen, title: '博客' },
                    { icon: Activity, title: '好邻居指数' },
                    { icon: Sliders, title: '微调' },
                  ].map((item, index) => (
                    <div key={item.title} className="relative group">
                      <button className="w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg hover:shadow-xl">
                        <item.icon className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
                      </button>
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-black/90 backdrop-blur-sm px-3 py-1.5 rounded-lg whitespace-nowrap">
                          <p className="text-white text-xs font-medium">{item.title}</p>
                        </div>
                      </div>
                      {[...Array(2)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-1 h-1 bg-gradient-to-br from-spider-red to-spider-blue rounded-full animate-pulse"
                          style={{
                            top: `${Math.sin((index * 2 + i) * 0.8) * 20 + 5}px`,
                            left: `${Math.cos((index * 2 + i) * 0.8) * 20 + 5}px`,
                            animationDelay: `${i * 0.3}s`,
                            animationDuration: '2s'
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>}
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* 顶部导航 - 固定定位 */}
      <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 transition-all duration-300 ${
        isOnThirdPage ? '' : scrolled ? 'bg-white/95 backdrop-blur-lg shadow-lg' : 'bg-black/40 backdrop-blur-sm'
      }`}>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center p-1.5">
            <svg className={`w-full h-full transition-colors ${
              isOnThirdPage ? 'text-white' : scrolled ? 'text-black' : 'text-white'
            }`} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* 蜘蛛身体 */}
              <ellipse cx="32" cy="32" rx="8" ry="10" fill="currentColor" opacity="0.95"/>
              <ellipse cx="32" cy="20" rx="6" ry="7" fill="currentColor" opacity="0.95"/>
              
              {/* 左侧腿 */}
              <path d="M24 28 Q16 24 10 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
              <path d="M22 30 Q14 30 8 32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
              <path d="M23 34 Q15 38 10 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
              <path d="M25 37 Q18 42 14 48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
              
              {/* 右侧腿 */}
              <path d="M40 28 Q48 24 54 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
              <path d="M42 30 Q50 30 56 32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
              <path d="M41 34 Q49 38 54 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
              <path d="M39 37 Q46 42 50 48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
              
              {/* 眼睛 */}
              <circle cx="29" cy="18" r="1.5" fill="white" opacity="0.9"/>
              <circle cx="35" cy="18" r="1.5" fill="white" opacity="0.9"/>
              
              {/* 腿部关节 */}
              <circle cx="10" cy="20" r="1" fill="currentColor" opacity="0.8"/>
              <circle cx="8" cy="32" r="1" fill="currentColor" opacity="0.8"/>
              <circle cx="10" cy="42" r="1" fill="currentColor" opacity="0.8"/>
              <circle cx="14" cy="48" r="1" fill="currentColor" opacity="0.8"/>
              <circle cx="54" cy="20" r="1" fill="currentColor" opacity="0.8"/>
              <circle cx="56" cy="32" r="1" fill="currentColor" opacity="0.8"/>
              <circle cx="54" cy="42" r="1" fill="currentColor" opacity="0.8"/>
              <circle cx="50" cy="48" r="1" fill="currentColor" opacity="0.8"/>
            </svg>
          </div>
          <span className={`text-2xl font-bold italic transition-colors ${
            isOnThirdPage ? 'text-white' : scrolled ? 'text-black' : 'text-white'
          }`}>Spider AI</span>
          </div>
          
          {/* 向下滚动提示 - 导航栏内 */}
          <div className="flex items-center gap-2 animate-bounce">
            <p className={`text-sm font-medium transition-colors ${
              isOnThirdPage ? 'text-white/70' : scrolled ? 'text-black/70' : 'text-white/70'
            }`}>向下滚动探索更多</p>
            <svg className={`w-5 h-5 transition-colors ${
              isOnThirdPage ? 'text-white/70' : scrolled ? 'text-black/70' : 'text-white/70'
            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

        </div>
        
        <div className="flex items-center gap-8">
          {/* 背景调节按钮 */}
          <button
            onClick={() => {
                          if (!isDarkBackground) {
                            // 切换到图片模式时，随机选择一张图片
                            const randomImg = bgImages[Math.floor(Math.random() * bgImages.length)]
                            setCurrentBgImage(randomImg)
                          }
                          setIsDarkBackground(!isDarkBackground)
                        }}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all hover:scale-110 ${
              isOnThirdPage ? 'bg-white/10 hover:bg-white/20' : scrolled ? 'bg-black/10 hover:bg-black/20' : 'bg-white/10 hover:bg-white/20'
            }`}
            title={`切换背景模式（当前：${isDarkBackground ? '深蓝灰色' : '视频'}）`}
          >
            <svg className={`w-6 h-6 transition-colors ${
              isOnThirdPage ? 'text-white' : scrolled ? 'text-black' : 'text-white'
            }`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C12 2 9 4 9 7C9 7 7 9 4 9C4 9 6 10 6 12C6 12 4 13 2 13C2 13 4 14 4 16C4 14 6 14 6 16C6 18 4 20 4 22C6 20 8 18 10 18C10 20 11 22 12 22C13 22 14 20 14 18C16 18 18 20 20 22C20 20 18 18 18 16C18 14 20 14 20 16C20 14 22 13 22 13C20 13 18 12 18 12C18 10 20 9 20 9C17 9 15 7 15 7C15 4 12 2 12 2M12 9A1 1 0 0 1 13 10A1 1 0 0 1 12 11A1 1 0 0 1 11 10A1 1 0 0 1 12 9Z" />
            </svg>
          </button>
          
          <a href="#features" className={`transition-colors text-sm ${
            isOnThirdPage ? 'text-white/80 hover:text-white' : scrolled ? 'text-black/70 hover:text-black' : 'text-white/80 hover:text-white'
          }`}>
            辅助功能（手语等）
          </a>
          <a href="#docs" className={`transition-colors text-sm ${
            isOnThirdPage ? 'text-white/80 hover:text-white' : scrolled ? 'text-black/70 hover:text-black' : 'text-white/80 hover:text-white'
          }`}>
            Spider本地学习器
          </a>
          <button
            onClick={() => navigate('/chat')}
            className={`px-6 py-2.5 rounded-full font-medium transition-all flex items-center gap-2 text-sm ${
              isOnThirdPage ? 'bg-white text-black hover:bg-white/90' : scrolled ? 'bg-black text-white hover:bg-black/90' : 'bg-white text-black hover:bg-white/90'
            }`}
          >
            开始使用
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* 第二部分 - Introducing Spider AI */}
      <section id="features" className="py-20 px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-black mb-16" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
            Introducing Spider AI
          </h2>
          
          {/* 功能卡片 - 水平并排 */}
          <div className="flex gap-4 justify-center">
            {/* 卡片1: 图流编排 */}
            <div className="group relative bg-white rounded-2xl overflow-hidden h-[500px] cursor-pointer transition-all duration-500 w-64 hover:w-[600px]">
              {/* 视频区域 */}
              <div className="relative h-[350px] bg-black overflow-hidden">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                >
                  <source src="/workflow_graph.mp4" type="video/mp4" />
                </video>
              </div>
              
              {/* 内容区域 */}
              <div className="p-6 bg-white">
                <h3 className="text-2xl font-bold text-black mb-2" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                  GraphFlow
                </h3>
                <p className="text-sm text-gray-500 mb-3">图流编排</p>
                <p className="text-gray-700 text-sm leading-relaxed max-w-0 group-hover:max-w-xs overflow-hidden transition-all duration-500">
                  复杂任务自动分解，多步骤智能协作，LangGraph驱动的高级工作流编排能力
                </p>
              </div>
            </div>

            {/* 卡片2: 学习引擎 */}
            <div className="group relative bg-white rounded-2xl overflow-hidden h-[500px] cursor-pointer transition-all duration-500 w-64 hover:w-[600px]">
              {/* 视频区域 */}
              <div className="relative h-[350px] bg-black overflow-hidden">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                >
                  <source src="/learn.mp4" type="video/mp4" />
                </video>
              </div>
              
              {/* 内容区域 */}
              <div className="p-6 bg-white">
                <h3 className="text-2xl font-bold text-black mb-2" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                  LearningEngine
                </h3>
                <p className="text-sm text-gray-500 mb-3">学习引擎</p>
                <p className="text-gray-700 text-sm leading-relaxed max-w-0 group-hover:max-w-xs overflow-hidden transition-all duration-500">
                  夜间静默学习，文件索引、知识提取、模式挖掘，持续进化的智能大脑
                </p>
              </div>
            </div>

            {/* 卡片3: 手语支持 */}
            <div className="group relative bg-white rounded-2xl overflow-hidden h-[500px] cursor-pointer transition-all duration-500 w-64 hover:w-[600px]">
              {/* 视频区域 */}
              <div className="relative h-[350px] bg-black overflow-hidden">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                >
                  <source src="/sign_language.mp4" type="video/mp4" />
                </video>
              </div>
              
              {/* 内容区域 */}
              <div className="p-6 bg-white">
                <h3 className="text-2xl font-bold text-black mb-2" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                  Sign Language
                </h3>
                <p className="text-sm text-gray-500 mb-3">手语支持</p>
                <p className="text-gray-700 text-sm leading-relaxed max-w-0 group-hover:max-w-xs overflow-hidden transition-all duration-500">
                  无障碍交互，手语识别与生成，让每个人都能享受AI助手的便利
                </p>
              </div>
            </div>

            {/* 卡片4: 记忆系统 */}
            <div className="group relative bg-white rounded-2xl overflow-hidden h-[500px] cursor-pointer transition-all duration-500 w-64 hover:w-[600px]">
              {/* 视频区域 */}
              <div className="relative h-[350px] bg-black overflow-hidden">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                >
                  <source src="/memory.mp4" type="video/mp4" />
                </video>
              </div>
              
              {/* 内容区域 */}
              <div className="p-6 bg-white">
                <h3 className="text-2xl font-bold text-black mb-2" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                  SpiderMemory
                </h3>
                <p className="text-sm text-gray-500 mb-3">蜘蛛记忆</p>
                <p className="text-gray-700 text-sm leading-relaxed max-w-0 group-hover:max-w-xs overflow-hidden transition-all duration-500">
                  四层分层记忆体系，工作/短期/长期/程序性记忆，跨会话理解，永不遗忘
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 第三部分 - Product Features */}
      <section className="relative py-24 px-8 overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-spider-blue/20"></div>
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 bg-spider-red/20 rounded-full filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-spider-blue/20 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-500/10 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        
        {/* 蜘蛛网装饰 */}
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="spider-web" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M50,50 L50,0 M50,50 L100,25 M50,50 L100,75 M50,50 L50,100 M50,50 L0,75 M50,50 L0,25" 
                      stroke="white" strokeWidth="0.5" fill="none"/>
                <circle cx="50" cy="50" r="30" stroke="white" strokeWidth="0.5" fill="none"/>
                <circle cx="50" cy="50" r="15" stroke="white" strokeWidth="0.5" fill="none"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#spider-web)" />
          </svg>
        </div>

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
              Product Features
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              能力越大，责任越大。打造真正懂你的智能AI好邻居
            </p>
          </div>

          {/* 九宫格布局 */}
          <div className="grid grid-cols-3 gap-3 max-w-3xl mx-auto">
            {features.map((feature, index) => (
              feature.name ? (
                <div
                  key={feature.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`group relative aspect-square bg-white/5 backdrop-blur-xl rounded-xl border transition-all duration-500 overflow-hidden cursor-grab active:cursor-grabbing ${
                    draggedItem === index ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
                  } ${
                    feature.id === 5 ? 'border-white/20 hover:border-pink-500/50' : 'border-white/10 hover:border-' + feature.color.replace('spider-', '') + '/50'
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br from-${feature.color.replace('spider-', '')}/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                  <div className="relative h-full flex flex-col items-center justify-center p-4">
                    <div className="mb-3">
                      {renderIcon(feature.icon, feature.color)}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1 text-center">{feature.name}</h3>
                    <p className="text-gray-400 text-xs text-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 mt-1">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  key={feature.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className="relative aspect-square bg-white/5 backdrop-blur-xl rounded-xl border border-white/5 opacity-30"
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white/20 rounded-full"></div>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      </section>

      {/* 底部 Footer - 许可证 */}
      <footer className="relative bg-black/90 backdrop-blur-xl border-t border-white/10 py-12 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo 和名称 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center p-1.5">
                <svg className="w-full h-full text-white" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* 蜘蛛身体 */}
                  <ellipse cx="32" cy="32" rx="8" ry="10" fill="currentColor" opacity="0.95"/>
                  <ellipse cx="32" cy="20" rx="6" ry="7" fill="currentColor" opacity="0.95"/>
                  {/* 左侧腿 */}
                  <path d="M24 28 Q16 24 10 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  <path d="M22 30 Q14 30 8 32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  <path d="M23 34 Q15 38 10 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  <path d="M25 37 Q18 42 14 48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  {/* 右侧腿 */}
                  <path d="M40 28 Q48 24 54 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  <path d="M42 30 Q50 30 56 32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  <path d="M41 34 Q49 38 54 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  <path d="M39 37 Q46 42 50 48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  {/* 眼睛 */}
                  <circle cx="29" cy="18" r="1.5" fill="white" opacity="0.9"/>
                  <circle cx="35" cy="18" r="1.5" fill="white" opacity="0.9"/>
                </svg>
              </div>
              <span className="text-xl font-bold italic text-white">Spider AI</span>
            </div>

            {/* 许可证信息 */}
            <div className="flex flex-col md:flex-row items-center gap-6 text-gray-400 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                </svg>
                <span>Licensed under MIT License</span>
              </div>
              <div className="h-4 w-px bg-gray-600 hidden md:block"></div>
              <div>
                <span>© 2025 Spider AI. All rights reserved.</span>
              </div>
            </div>

            {/* 社交链接 */}
            <div className="flex items-center gap-4">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" 
                 className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" 
                 className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* 底部分割线 */}
          <div className="mt-8 pt-8 border-t border-white/5">
            <p className="text-center text-gray-500 text-xs">
              With great power comes great responsibility. • 能力越大，责任越大。
            </p>
          </div>
        </div>
      </footer>

      {/* 浮窗 AI 控件 - 仅在第2、3页显示 */}
      {scrolled && (
        <>
          {/* 倒挂蜘蛛侠 AI 按钮 - 左上角 */}
          <div 
            className="fixed left-8 z-50 animate-in slide-in-from-top-8 fade-in duration-500"
            style={{ 
              top: `${96 + spiderY}px`,
              transition: isClimbing ? 'top 1.5s ease-in-out' : 'top 0.3s ease-out'
            }}
          >
            <div className="relative group">
              {/* 蜘蛛丝 */}
              <div className={`absolute left-1/2 -translate-x-1/2 -top-24 w-px h-24 bg-gradient-to-b transition-colors ${
                isOnThirdPage 
                  ? 'from-white/0 via-white/30 to-white/50' 
                  : 'from-gray-900/0 via-gray-900/30 to-gray-900/50'
              }`}></div>
              
              <button 
                onClick={() => setShowChatDialog(!showChatDialog)}
                className={`w-12 h-12 rounded-full transition-all duration-300 hover:scale-125 relative flex items-center justify-center ${
                  isOnThirdPage
                    ? 'bg-white/5 hover:bg-white/10 backdrop-blur-sm shadow-[0_8px_32px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_48px_rgba(255,255,255,0.3)]'
                    : 'bg-black/5 hover:bg-black/10 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.15)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.25)]'
                }`}
                style={{ transform: 'rotate(180deg)' }}
              >
                {/* 透明蜘蛛 Logo - 与项目 Logo 保持一致 */}
                <svg className={`w-8 h-8 transition-colors duration-300 ${
                  isOnThirdPage ? 'text-white' : 'text-black'
                }`} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* 蜘蛛身体 */}
                  <ellipse cx="32" cy="32" rx="8" ry="10" fill="currentColor" opacity="0.95"/>
                  <ellipse cx="32" cy="20" rx="6" ry="7" fill="currentColor" opacity="0.95"/>
                  
                  {/* 左侧腿 */}
                  <path d="M24 28 Q16 24 10 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  <path d="M22 30 Q14 30 8 32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  <path d="M23 34 Q15 38 10 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  <path d="M25 37 Q18 42 14 48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  
                  {/* 右侧腿 */}
                  <path d="M40 28 Q48 24 54 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  <path d="M42 30 Q50 30 56 32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  <path d="M41 34 Q49 38 54 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  <path d="M39 37 Q46 42 50 48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
                  
                  {/* 眼睛 */}
                  <circle cx="29" cy="18" r="1.5" fill="white" opacity="0.9"/>
                  <circle cx="35" cy="18" r="1.5" fill="white" opacity="0.9"/>
                  
                  {/* 腿部关节 */}
                  <circle cx="10" cy="20" r="1" fill="currentColor" opacity="0.8"/>
                  <circle cx="8" cy="32" r="1" fill="currentColor" opacity="0.8"/>
                  <circle cx="10" cy="42" r="1" fill="currentColor" opacity="0.8"/>
                  <circle cx="14" cy="48" r="1" fill="currentColor" opacity="0.8"/>
                  <circle cx="54" cy="20" r="1" fill="currentColor" opacity="0.8"/>
                  <circle cx="56" cy="32" r="1" fill="currentColor" opacity="0.8"/>
                  <circle cx="54" cy="42" r="1" fill="currentColor" opacity="0.8"/>
                  <circle cx="50" cy="48" r="1" fill="currentColor" opacity="0.8"/>
                </svg>
              </button>
              
              {/* 悬停提示 */}
              <div className="absolute top-16 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="bg-black/90 backdrop-blur-sm px-3 py-1.5 rounded-lg whitespace-nowrap">
                  <p className="text-white text-xs font-medium">Spider AI</p>
                </div>
              </div>
            </div>
          </div>

          {/* 透明对话框 - 从上方展开 */}
          {showChatDialog && (
            <div className="fixed left-8 top-40 z-50 w-96 h-[500px] bg-black/40 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5),0_8px_32px_rgba(255,255,255,0.1)] flex flex-col overflow-hidden animate-in slide-in-from-top-8 fade-in duration-300">
              {/* 头部 */}
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-white" />
                  <h3 className="text-white font-medium text-sm">Spider AI</h3>
                </div>
                <button
                  onClick={() => setShowChatDialog(false)}
                  className="w-6 h-6 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-white/70" />
                </button>
              </div>

              {/* 对话内容区域 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/50">
                    <MessageCircle className="w-12 h-12 mb-3" />
                    <p className="text-sm">开始对话吧</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {/* AI 头像 - 蜘蛛图标 */}
                      {msg.role === 'assistant' && (
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <ellipse cx="32" cy="32" rx="6" ry="7" fill="currentColor" opacity="0.95"/>
                            <ellipse cx="32" cy="22" rx="4" ry="5" fill="currentColor" opacity="0.95"/>
                            <path d="M26 30 Q20 28 16 26" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.9"/>
                            <path d="M25 32 Q19 32 15 33" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.9"/>
                            <path d="M26 34 Q20 36 16 38" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.9"/>
                            <path d="M38 30 Q44 28 48 26" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.9"/>
                            <path d="M39 32 Q45 32 49 33" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.9"/>
                            <path d="M38 34 Q44 36 48 38" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.9"/>
                            <circle cx="29" cy="21" r="1" fill="white" opacity="0.9"/>
                            <circle cx="35" cy="21" r="1" fill="white" opacity="0.9"/>
                          </svg>
                        </div>
                      )}
                      
                      {/* 消息内容 */}
                      <div className={`${msg.role === 'user' ? 'max-w-[75%]' : 'max-w-[90%]'} rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-white/15 text-white'
                          : 'bg-transparent text-white/90'
                      }`}>
                        <div className="break-words overflow-hidden">
                          <MarkdownRenderer content={msg.content} />
                        </div>
                      </div>
                      
                      {/* 用户头像 */}
                      {msg.role === 'user' && (
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex gap-2 justify-start">
                    {/* AI 头像 - 加载中 */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <ellipse cx="32" cy="32" rx="6" ry="7" fill="currentColor" opacity="0.95"/>
                        <ellipse cx="32" cy="22" rx="4" ry="5" fill="currentColor" opacity="0.95"/>
                        <path d="M26 30 Q20 28 16 26" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.9"/>
                        <path d="M25 32 Q19 32 15 33" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.9"/>
                        <path d="M26 34 Q20 36 16 38" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.9"/>
                        <path d="M38 30 Q44 28 48 26" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.9"/>
                        <path d="M39 32 Q45 32 49 33" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.9"/>
                        <path d="M38 34 Q44 36 48 38" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.9"/>
                        <circle cx="29" cy="21" r="1" fill="white" opacity="0.9"/>
                        <circle cx="35" cy="21" r="1" fill="white" opacity="0.9"/>
                      </svg>
                    </div>
                    <div className="bg-white/10 text-white/90 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 输入区域 */}
              <div className="p-3 border-t border-white/10">
                <div className="flex items-center gap-2">
                  {/* 麦克风按钮 */}
                  <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors group">
                    <Mic className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-colors" />
                  </button>
                  
                  {/* 分隔线 */}
                  <div className="h-4 w-px bg-white/20"></div>
                  
                  {/* 手语按钮 */}
                  <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors group">
                    <Hand className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-colors" />
                  </button>
                  
                  <input
                    type="text"
                    value={dialogInput}
                    onChange={(e) => setDialogInput(e.target.value)}
                    placeholder="输入消息..."
                    className="flex-1 bg-white/5 text-white placeholder-white/40 outline-none px-3 py-2 rounded-lg text-sm border border-white/10 focus:border-white/20 focus:bg-white/10 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && dialogInput.trim()) {
                        sendDialogMessage()
                      }
                    }}
                  />
                  <button
                    onClick={sendDialogMessage}
                    disabled={!dialogInput.trim() || isLoading}
                    className="w-8 h-8 bg-white/15 hover:bg-white/25 text-white rounded-lg disabled:opacity-50 transition-all flex items-center justify-center"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}