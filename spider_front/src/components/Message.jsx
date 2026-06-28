import { User, Bot, Clock, CheckCircle, XCircle } from 'lucide-react'
import { format } from '../utils/date'

export default function Message({ message }) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* 头像 */}
      <div className={`
        flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
        ${isUser ? 'bg-spider-blue' : 'spider-gradient'}
      `}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>

      {/* 消息内容 */}
      <div className={`flex-1 max-w-[70%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* 消息气泡 */}
        <div className={`
          message-bubble
          ${isUser ? 'user-message' : 'assistant-message'}
          ${message.isError ? 'bg-red-500/20 border border-red-500/50' : ''}
        `}>
          {/* 图片预览 */}
          {message.image && (
            <img 
              src={message.image} 
              alt="用户上传"
              className="rounded-lg mb-2 max-w-full"
            />
          )}
          
          {/* 文本内容 */}
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>

          {/* 元数据标签 */}
          {message.metadata && (
            <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-2">
              {message.metadata.model && (
                <span className="text-xs px-2 py-1 bg-purple-500/20 rounded">
                  模型: {message.metadata.model}
                </span>
              )}
              {message.metadata.tools && (
                <span className="text-xs px-2 py-1 bg-blue-500/20 rounded">
                  工具: {message.metadata.tools.join(', ')}
                </span>
              )}
              {message.metadata.confidence && (
                <span className="text-xs px-2 py-1 bg-green-500/20 rounded">
                  置信度: {(message.metadata.confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* 时间戳和状态 */}
        <div className={`flex items-center gap-2 text-xs text-white/40 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <Clock className="w-3 h-3" />
          <span>{formatTime(message.timestamp)}</span>
          
          {isUser && !message.isError && (
            <CheckCircle className="w-3 h-3 text-green-400" />
          )}
          
          {message.isError && (
            <XCircle className="w-3 h-3 text-red-400" />
          )}
        </div>
      </div>
    </div>
  )
}

function formatTime(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) {
    return '刚刚'
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`
  } else {
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}
