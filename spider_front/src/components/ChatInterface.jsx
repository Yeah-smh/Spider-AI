import { useState, useRef, useEffect } from 'react'
import { Send, Mic, Image as ImageIcon, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import Message from './Message'
import SpiderSense from './SpiderSense'
import { sendMessage, uploadImage } from '../api/chat'

export default function ChatInterface({ sessionId }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '你好！我是Spider-Man好邻居AI助手。我具备蜘蛛感应能力，可以主动理解你的需求。有什么我可以帮助你的吗？',
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [spiderSenseActive, setSpiderSenseActive] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 蜘蛛感应 - 实时预测用户意图
  useEffect(() => {
    if (input.length > 3) {
      setSpiderSenseActive(true)
      // 模拟蜘蛛感应预测
      const timer = setTimeout(() => {
        const mockSuggestions = [
          '分析代码性能问题',
          '优化算法复杂度',
          '查找潜在bug'
        ]
        setSuggestions(mockSuggestions)
      }, 500)
      return () => clearTimeout(timer)
    } else {
      setSpiderSenseActive(false)
      setSuggestions([])
    }
  }, [input])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setSuggestions([])

    try {
      // 调用后端API
      const response = await sendMessage({
        session_id: sessionId,
        message: input,
      })

      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.message,
        timestamp: new Date(),
        metadata: response.data.metadata,
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '抱歉，处理你的请求时出现了错误。请稍后再试。',
        timestamp: new Date(),
        isError: true,
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: `[上传图片: ${file.name}]`,
      timestamp: new Date(),
      image: URL.createObjectURL(file),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('session_id', sessionId)

      const response = await uploadImage(formData)

      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.message,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '图片处理失败，请重试。',
        timestamp: new Date(),
        isError: true,
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion)
    setSuggestions([])
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* 消息列表容器 */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {messages.map(message => (
          <Message key={message.id} message={message} />
        ))}
        
        {/* 加载指示器 */}
        {isLoading && (
          <div className="flex items-center gap-2 text-white/60">
            <Loader2 className="w-5 h-5 animate-spin text-spider-blue" />
            <span>思维融合中...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 蜘蛛感应建议 */}
      {spiderSenseActive && suggestions.length > 0 && (
        <SpiderSense 
          suggestions={suggestions}
          onSelect={handleSuggestionClick}
        />
      )}

      {/* 输入区域 */}
      <div className="glass-card p-4">
        <div className="flex items-end gap-3">
          {/* 多模态输入按钮 */}
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 hover:bg-white/10 rounded-lg transition-colors group"
              title="上传图片"
            >
              <ImageIcon className="w-5 h-5 text-white/60 group-hover:text-white" />
            </button>
            
            <button
              className="p-3 hover:bg-white/10 rounded-lg transition-colors group"
              title="语音输入"
            >
              <Mic className="w-5 h-5 text-white/60 group-hover:text-white" />
            </button>
          </div>

          {/* 文本输入框 */}
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息... (蜘蛛感应会自动预测你的需求)"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 resize-none focus:outline-none focus:border-spider-blue transition-colors"
              rows={3}
            />
            
            {/* 蜘蛛感应活跃指示 */}
            {spiderSenseActive && (
              <div className="absolute top-2 right-2">
                <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
              </div>
            )}
          </div>

          {/* 发送按钮 */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`
              p-3 rounded-lg transition-all
              ${input.trim() && !isLoading
                ? 'bg-spider-blue hover:bg-spider-blue/80 text-white'
                : 'bg-white/5 text-white/30 cursor-not-allowed'
              }
            `}
          >
            <Send className="w-5 h-5" />
          </button>

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* 提示信息 */}
        <div className="mt-2 flex items-center gap-2 text-xs text-white/40">
          <AlertCircle className="w-3 h-3" />
          <span>支持文本、语音、图像多模态输入 | Enter 发送，Shift + Enter 换行</span>
        </div>
      </div>
    </div>
  )
}
