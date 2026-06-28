import { useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'

/**
 * 流式 Markdown 渲染器
 * 使用标准的 ``` 语法检测代码块开始和结束
 */
export default function StreamingMarkdownRenderer({ content }) {
  const containerRef = useRef(null)
  const stateRef = useRef({
    lastContent: '',
    inCodeBlock: false,
    codeLanguage: '',
    currentCodeElement: null,
    codeBlockCounter: 0,
    lineBuffer: '',
    textBuffer: ''
  })

  useEffect(() => {
    if (!containerRef.current || !content) return

    const state = stateRef.current
    
    // 只处理新增的内容（增量更新）
    if (content === state.lastContent) return
    
    const newChars = content.slice(state.lastContent.length)
    state.lastContent = content

    // 逐字符处理新增内容
    for (let i = 0; i < newChars.length; i++) {
      const char = newChars[i]
      
      // 累积到行缓冲区
      state.lineBuffer += char
      
      // 检测换行符，处理完整的行
      if (char === '\n' || i === newChars.length - 1) {
        const line = state.lineBuffer
        
        // 检测代码块标记 ```
        if (line.trim().startsWith('```')) {
          if (!state.inCodeBlock) {
            // 先输出缓存的普通文本
            if (state.textBuffer) {
              appendFormattedText(state.textBuffer)
              state.textBuffer = ''
            }
            
            // 开始代码块
            const language = line.trim().slice(3).trim() || 'code'
            const codeBlockId = `streaming-code-${state.codeBlockCounter}`
            const codeBlockHTML = createCodeBlockElement(language, codeBlockId, state.codeBlockCounter)
            containerRef.current.appendChild(codeBlockHTML)
            
            state.inCodeBlock = true
            state.codeLanguage = language
            state.currentCodeElement = document.getElementById(codeBlockId)
            state.codeBlockCounter++
          } else {
            // 结束代码块
            state.inCodeBlock = false
            state.currentCodeElement = null
          }
          
          state.lineBuffer = ''
          continue
        }
        
        // 在代码块内：追加到代码元素
        if (state.inCodeBlock && state.currentCodeElement) {
          state.currentCodeElement.textContent += state.lineBuffer
          state.lineBuffer = ''
        } else {
          // 普通文本：累积到文本缓冲区
          state.textBuffer += state.lineBuffer
          state.lineBuffer = ''
        }
      }
    }
    
    // 处理剩余的普通文本
    if (state.textBuffer && !state.inCodeBlock) {
      appendFormattedText(state.textBuffer)
      state.textBuffer = ''
    }
    
  }, [content])

  // 追加格式化的文本
  function appendFormattedText(text) {
    if (!containerRef.current || !text) return
    
    const wrapper = document.createElement('span')
    wrapper.className = 'text-white/90 text-sm inline-block'
    wrapper.style.whiteSpace = 'pre-wrap'
    wrapper.textContent = text
    containerRef.current.appendChild(wrapper)
  }

  // 创建代码块元素
  function createCodeBlockElement(language, codeId, counter) {
    const wrapper = document.createElement('div')
    wrapper.className = 'code-block-wrapper my-2 rounded-md overflow-hidden border border-white/10 max-w-3xl'
    
    wrapper.innerHTML = DOMPurify.sanitize(`
      <div class="relative bg-black/40 px-3 py-1.5 border-b border-white/10">
        <span class="text-xs text-white/50">${language}</span>
        <button onclick="copyStreamCode${counter}()" class="absolute top-1.5 right-2 text-xs px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors">
          <span id="copy-btn-stream-${counter}">复制</span>
        </button>
      </div>
      <pre class="bg-black/30 p-3 overflow-x-auto"><code id="${codeId}" class="text-xs text-white/85 font-mono whitespace-pre-wrap leading-relaxed"></code></pre>
    `)
    
    // 注册复制函数
    window[`copyStreamCode${counter}`] = () => {
      const code = document.getElementById(codeId)
      if (code) {
        navigator.clipboard.writeText(code.textContent)
        const btn = document.getElementById(`copy-btn-stream-${counter}`)
        if (btn) {
          btn.textContent = '✓ 已复制'
          setTimeout(() => { btn.textContent = '复制' }, 2000)
        }
      }
    }
    
    return wrapper
  }

  return <div ref={containerRef} className="markdown-content" />
}
