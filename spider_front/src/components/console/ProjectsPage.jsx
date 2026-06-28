import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import {
  ChevronRight, ChevronDown, ChevronLeft,
  FileText, FolderOpen, ArrowUp,
  Paperclip, Globe, Image, Film,
  Maximize2, X, FilePlus, FolderPlus, Upload, Save, Play, Loader2, Trash2, Pencil, Plus,
  CheckCircle, XCircle, Zap, Bot
} from 'lucide-react'
import { getProjects, createProject, deleteProject, getProjectFiles, createFile, createFolder, getFileContent, updateFile, deleteFile, uploadProjectFile, runCode, renameFile, updateProject, moveFile, projectChat, getSkills, getSkillDetail, deleteSkill, getMcpPresets, enableMcp, getMcpServers, deleteMcpServer, getSubAgents, deleteSubAgent, getProjectMessages } from '../../api/chat'
import MarkdownRenderer from '../MarkdownRenderer'
import { useConsoleTheme } from '../../contexts/ConsoleThemeContext'

// Catppuccin Mocha（深色）
const darkColors = {
  crust: '#11111b',
  mantle: '#181825',
  base: '#1e1e2e',
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',
  text: '#cdd6f4',
  subtext1: '#bac2de',
  subtext0: '#a6adc8',
  overlay0: '#6c7086',
  blue: '#89b4fa',
  green: '#a6e3a1',
  red: '#f38ba8',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
  hover: 'rgba(255,255,255,0.04)',
  hoverActive: 'rgba(255,255,255,0.08)',
}

// 亮色主题
const lightColors = {
  crust: '#fdf5e6',      // 主背景 - 奶白/米黄（ChatPage 的 bg-[#fdf5e6]）
  mantle: '#f5ead6',     // 侧边栏背景（ChatPage sidebar）
  base: '#fdf5e6',       // 内容区背景
  surface0: '#f0e4d0',   // 次级面板/卡片背景
  surface1: '#e8d5b7',   // 边框色/更深层
  surface2: '#dbc7a8',   // 更深的表面
  text: '#3d3529',       // 主文本色（ChatPage 的深棕）
  subtext1: '#5d4e37',   // 次级文本
  subtext0: '#7a6b55',   // 弱化文本
  overlay0: '#8b7355',   // 叠加/占位色
  blue: '#2563eb',       // 链接/高亮蓝
  green: '#16a34a',      // 成功绿
  red: '#dc2626',        // 错误红
  yellow: '#ca8a04',     // 警告黄
  mauve: '#7c3aed',      // 紫色
  peach: '#ea580c',      // 橙色
  teal: '#0d9488',       // 青色
  hover: 'rgba(139,115,85,0.08)',     // 暖色 hover
  hoverActive: 'rgba(139,115,85,0.14)', // 暖色 active hover
}

// 配置 Monaco Editor 使用本地安装的包，不依赖 CDN
loader.config({ monaco })

// 获取文件图标颜色
const getFileIconColor = (filename, colors) => {
  if (filename.endsWith('.py')) return colors.green
  if (filename.endsWith('.md')) return colors.blue
  return colors.subtext0
}

// 文件树项组件
const FileTreeItem = ({ 
  item, depth = 0, expandedFolders, onToggleFolder, onFileClick, 
  selectedFile, onDeleteFile, onContextMenu, renamingItem, setRenamingItem,
  onConfirmRename, creatingItem, setCreatingItem, onConfirmCreating,
  draggingPath, setDraggingPath, dropTargetPath, setDropTargetPath, onMoveFile,
  colors
}) => {
  const isFolder = item.is_folder
  const isExpanded = expandedFolders[item.path]
  const isSelected = selectedFile?.path === item.path
  const isRenaming = renamingItem?.path === item.path
  const renameInputRef = useRef(null)
  
  const isDragging = draggingPath === item.path
  const isDropTarget = dropTargetPath === item.path

  // 自动聚焦重命名输入框
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  // 双击重命名
  const handleDoubleClick = () => {
    if (!isFolder) {
      setRenamingItem({ path: item.path, name: item.name })
    }
  }

  // 拖拽开始
  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', item.path)
    e.dataTransfer.setData('application/x-project-file', JSON.stringify({
      path: item.path,
      name: item.name,
      isDir: isFolder
    }))
    e.dataTransfer.effectAllowed = 'copyMove'
    setDraggingPath(item.path)
  }

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggingPath(null)
    setDropTargetPath(null)
  }

  // 拖拽经过（只对文件夹有效）
  const handleDragOver = (e) => {
    if (isFolder) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropTargetPath(item.path)
    }
  }

  // 拖拽离开
  const handleDragLeave = () => {
    if (dropTargetPath === item.path) {
      setDropTargetPath(null)
    }
  }

  // 放下
  const handleDrop = (e) => {
    e.preventDefault()
    const sourcePath = e.dataTransfer.getData('text/plain')
    if (sourcePath !== item.path) {
      onMoveFile(sourcePath, item.path)
    }
    setDraggingPath(null)
    setDropTargetPath(null)
  }

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => isFolder ? onToggleFolder(item.path) : onFileClick(item)}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => onContextMenu(e, item)}
        style={{
          marginLeft: `${depth * 12}px`,
          backgroundColor: isDropTarget 
            ? 'rgba(137, 180, 250, 0.15)' 
            : isSelected ? colors.surface0 : 'transparent',
          color: isSelected ? colors.text : colors.subtext1,
          opacity: isDragging ? 0.5 : 1,
        }}
        className="group flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-all duration-150"
        onMouseEnter={(e) => {
          if (!isSelected && !isDropTarget) e.currentTarget.style.backgroundColor = colors.hoverActive
        }}
        onMouseLeave={(e) => {
          if (!isSelected && !isDropTarget) e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        {isFolder ? (
          <>
            {isExpanded ? (
              <ChevronDown size={14} style={{ color: colors.subtext0 }} />
            ) : (
              <ChevronRight size={14} style={{ color: colors.subtext0 }} />
            )}
            <FolderOpen size={14} style={{ color: colors.blue }} />
          </>
        ) : (
          <>
            <span style={{ width: 14 }} />
            <FileText size={14} style={{ color: getFileIconColor(item.name, colors) }} />
          </>
        )}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renamingItem.name}
            onChange={(e) => setRenamingItem(prev => ({ ...prev, name: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirmRename()
              if (e.key === 'Escape') setRenamingItem(null)
            }}
            onBlur={onConfirmRename}
            className="text-sm flex-1 outline-none px-1 py-0.5 rounded"
            style={{ 
              backgroundColor: colors.surface0, 
              color: colors.text,
              border: `1px solid ${colors.mauve}`
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm truncate flex-1">{item.name}</span>
        )}
        {!isFolder && !isRenaming && (
          <button
            onClick={(e) => onDeleteFile(item.path, e)}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
          >
            <X size={12} style={{ color: colors.red }} />
          </button>
        )}
      </div>
      {isFolder && isExpanded && (
        <>
          {/* 内联创建输入框 */}
          {creatingItem && creatingItem.parentPath === item.path && (
            <div
              style={{ marginLeft: `${(depth + 1) * 12}px` }}
              className="flex items-center gap-2 py-1.5 px-2"
            >
              {creatingItem.type === 'folder' ? (
                <FolderOpen size={14} style={{ color: colors.blue }} />
              ) : (
                <FileText size={14} style={{ color: colors.subtext0 }} />
              )}
              <input
                type="text"
                value={creatingItem.name}
                onChange={(e) => setCreatingItem(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onConfirmCreating()
                  if (e.key === 'Escape') setCreatingItem(null)
                }}
                onBlur={onConfirmCreating}
                placeholder={creatingItem.type === 'folder' ? '文件夹名' : '文件名'}
                autoFocus
                className="text-sm flex-1 outline-none px-2 py-0.5 rounded"
                style={{ 
                  backgroundColor: colors.surface0, 
                  color: colors.text,
                  border: `1px solid ${colors.mauve}`
                }}
              />
            </div>
          )}
          {/* 子项 */}
          {item.children?.map((child, idx) => (
            <FileTreeItem
              key={child.path || idx}
              item={child}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onFileClick={onFileClick}
              selectedFile={selectedFile}
              onDeleteFile={onDeleteFile}
              onContextMenu={onContextMenu}
              renamingItem={renamingItem}
              setRenamingItem={setRenamingItem}
              onConfirmRename={onConfirmRename}
              creatingItem={creatingItem}
              setCreatingItem={setCreatingItem}
              onConfirmCreating={onConfirmCreating}
              draggingPath={draggingPath}
              setDraggingPath={setDraggingPath}
              dropTargetPath={dropTargetPath}
              setDropTargetPath={setDropTargetPath}
              onMoveFile={onMoveFile}
              colors={colors}
            />
          ))}
        </>
      )}
    </div>
  )
}

// 折叠区域组件
const CollapsibleSection = ({ title, subtitle, expanded, onToggle, children, colors }) => (
  <div className="border-b" style={{ borderColor: colors.surface0 }}>
    <div
      onClick={onToggle}
      className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors duration-150"
      style={{ color: colors.text }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.hover}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <div>
        <span className="text-sm font-semibold">{title}</span>
        {subtitle && (
          <span className="ml-2 text-xs" style={{ color: colors.overlay0 }}>{subtitle}</span>
        )}
      </div>
      {expanded ? (
        <ChevronDown size={16} style={{ color: colors.overlay0 }} />
      ) : (
        <ChevronRight size={16} style={{ color: colors.overlay0 }} />
      )}
    </div>
    {expanded && (
      <div className="px-4 pb-3">
        {children}
      </div>
    )}
  </div>
)

// 根据 SSE 的 tool_start / tool_done 事件生成进度行文本
const buildProgressLine = (eventType, tool, args, result) => {
  if (eventType === 'tool_start') {
    if (tool === 'list_sub_agents') return '🔍 正在查看已注册的子代理...'
    if (tool === 'create_sub_agent') return '🛠️ 正在创建子代理...'
    if (tool === 'run_sub_agent') {
      const agentName = args?.agent_name || args?.name || args?.subagent_name || ''
      return agentName
        ? `⚡ 正在调用子代理 ${agentName} 执行任务...`
        : '⚡ 正在调用子代理执行任务...'
    }
    if (tool === 'read_file') return `📖 正在读取文件 ${args?.path || ''}...`
    if (tool === 'write_file') return `📝 正在写入文件 ${args?.path || ''}...`
    if (tool === 'list_files') return '📂 正在列出文件...'
    if (tool === 'create_skill') return '🛠️ 正在创建技能...'
    if (tool === 'use_skill') return `🎯 正在使用技能 ${args?.skill_name || ''}...`
    if (tool === 'delete_skill') return '🗑️ 正在删除技能...'
    if (tool === 'create_mcp') return '🔌 正在创建 MCP 服务...'
    if (tool === 'enable_mcp') return '🔌 正在启用 MCP 服务...'
    return `📝 ${tool}...`
  }
  if (eventType === 'tool_done') {
    if (tool === 'list_sub_agents') return '✅ 子代理列表已获取'
    if (tool === 'create_sub_agent') {
      let displayName = ''
      try {
        const parsed = typeof result === 'string' ? JSON.parse(result) : result
        displayName = parsed?.display_name || parsed?.data?.display_name || parsed?.name || parsed?.data?.name || ''
      } catch (_) {}
      return displayName ? `✅ 已创建子代理「${displayName}」` : '✅ 子代理已创建'
    }
    // run_sub_agent 完成时 content 已经在流，不额外提示
    if (tool === 'run_sub_agent') return null
    return `✅ ${tool} 完成`
  }
  return null
}

// Chat 消息组件
const ChatMessage = ({ message, isStreaming = false, colors, isDark = true }) => {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div
          className="px-4 py-2.5 rounded-2xl"
          style={{
            backgroundColor: colors.surface0,
            color: colors.text,
            maxWidth: '70%',
            borderBottomRightRadius: '4px',
          }}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start gap-2 mb-4">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: colors.blue }}
      >
        <span className="text-white text-xs font-bold">S</span>
      </div>
      <div style={{ maxWidth: '85%' }}>
        {/* 工具调用进度行（在正式 content 之前显示） */}
        {Array.isArray(message.toolProgress) && message.toolProgress.length > 0 && (
          <div className="mb-2 space-y-1">
            {message.toolProgress.map((line, i) => (
              <div
                key={i}
                className="text-xs leading-relaxed"
                style={{ color: colors.subtext0 || colors.overlay1 }}
              >
                {line}
              </div>
            ))}
            {message.content && (
              <div
                className="mt-2 mb-1"
                style={{
                  height: '1px',
                  backgroundColor: colors.surface1 || colors.overlay0,
                  opacity: 0.4,
                }}
              />
            )}
          </div>
        )}
        <div
          className={`text-sm leading-relaxed prose-sm max-w-none ${!isDark ? 'projects-light-markdown' : ''}`}
          style={{ color: colors.text }}
        >
          <MarkdownRenderer content={message.content} />
          {isStreaming && (
            <span
              className="inline-block ml-0.5"
              style={{
                color: colors.blue,
                animation: 'blink 1s infinite'
              }}
            >
              ▍
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const navigate = useNavigate()

  // 主题控制
  const { isDark, toggleTheme } = useConsoleTheme()
  const colors = isDark ? darkColors : lightColors

  // 编辑器主题状态（用于回退）
  const [editorTheme, setEditorTheme] = useState('vs-dark')
  const [editorReady, setEditorReady] = useState(false)
  const editorRef = useRef(null)
  // 防止补全提供器重复注册
  const completionRegistered = useRef(false)
  const inlineCompletionRegistered = useRef(false)
  // 用于在 InlineCompletionsProvider 闭包中获取最新的 projectId / 文件信息
  const projectIdRef = useRef(null)
  const currentFileRef = useRef(null)

  // 注册 Monaco 语言补全提供器（Python / JS / TS）
  const registerCompletionProviders = (monacoInstance) => {
    if (completionRegistered.current) return
    completionRegistered.current = true

    const buildRange = (model, position) => {
      const word = model.getWordUntilPosition(position)
      return {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }
    }

    // Python 补全
    monacoInstance.languages.registerCompletionItemProvider('python', {
      provideCompletionItems: (model, position) => {
        const range = buildRange(model, position)
        const suggestions = [
          ...['import', 'from', 'def', 'class', 'return', 'if', 'elif', 'else',
              'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'yield',
              'lambda', 'pass', 'break', 'continue', 'raise', 'assert', 'global',
              'nonlocal', 'del', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is',
              'async', 'await'].map(kw => ({
            label: kw,
            kind: monacoInstance.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
          })),
          ...['print', 'len', 'range', 'type', 'str', 'int', 'float', 'list', 'dict',
              'tuple', 'set', 'bool', 'input', 'open', 'enumerate', 'zip', 'map',
              'filter', 'sorted', 'reversed', 'isinstance', 'hasattr', 'getattr',
              'setattr', 'super', 'property', 'staticmethod', 'classmethod',
              'abs', 'max', 'min', 'sum', 'round', 'format', 'repr', 'hash', 'id',
              'iter', 'next', 'callable', 'vars', 'dir', 'help'].map(fn => ({
            label: fn,
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: fn,
            detail: 'built-in',
            range,
          })),
          ...['os', 'sys', 'json', 'time', 'datetime', 'random', 'math', 're',
              'pathlib', 'collections', 'itertools', 'functools', 'typing',
              'asyncio', 'threading', 'subprocess', 'logging', 'unittest',
              'requests', 'numpy', 'pandas', 'flask', 'fastapi', 'pydantic',
              'sqlalchemy', 'langchain', 'openai'].map(mod => ({
            label: mod,
            kind: monacoInstance.languages.CompletionItemKind.Module,
            insertText: mod,
            detail: 'module',
            range,
          })),
          {
            label: 'def function',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: 'def ${1:function_name}(${2:params}):\n    ${3:pass}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Function definition',
            range,
          },
          {
            label: 'class',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: 'class ${1:ClassName}:\n    def __init__(self${2:, params}):\n        ${3:pass}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Class definition',
            range,
          },
          {
            label: 'if __name__',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: 'if __name__ == "__main__":\n    ${1:main()}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Main guard',
            range,
          },
          {
            label: 'try except',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: 'try:\n    ${1:pass}\nexcept ${2:Exception} as e:\n    ${3:print(e)}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Try/except block',
            range,
          },
          {
            label: 'with open',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: 'with open(${1:filename}, "${2:r}") as f:\n    ${3:content = f.read()}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'File open context manager',
            range,
          },
        ]
        return { suggestions }
      },
    })

    // JavaScript / TypeScript 共用 provider
    const jsProvider = {
      provideCompletionItems: (model, position) => {
        const range = buildRange(model, position)
        const suggestions = [
          ...['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for',
              'while', 'switch', 'case', 'break', 'continue', 'try', 'catch',
              'finally', 'throw', 'new', 'class', 'extends', 'import', 'export',
              'default', 'from', 'async', 'await', 'yield', 'typeof', 'instanceof',
              'true', 'false', 'null', 'undefined', 'this', 'super'].map(kw => ({
            label: kw,
            kind: monacoInstance.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
          })),
          ...['console.log', 'JSON.parse', 'JSON.stringify', 'Array.isArray',
              'Object.keys', 'Object.values', 'Object.entries', 'Promise.all',
              'setTimeout', 'setInterval', 'fetch', 'addEventListener',
              'document.querySelector', 'document.getElementById'].map(api => ({
            label: api,
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: api,
            detail: 'Web API',
            range,
          })),
          {
            label: 'arrow function',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: 'const ${1:name} = (${2:params}) => {\n  ${3}\n}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Arrow function',
            range,
          },
          {
            label: 'async function',
            kind: monacoInstance.languages.CompletionItemKind.Snippet,
            insertText: 'async function ${1:name}(${2:params}) {\n  ${3}\n}',
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Async function',
            range,
          },
        ]
        return { suggestions }
      },
    }
    monacoInstance.languages.registerCompletionItemProvider('javascript', jsProvider)
    monacoInstance.languages.registerCompletionItemProvider('typescript', jsProvider)
  }

  // AI 代码补全 - Ghost Text（类似 GitHub Copilot）
  const registerInlineCompletion = (monacoInstance) => {
    console.log('=== [AI Code Complete] registerInlineCompletion called ===')

    if (inlineCompletionRegistered.current) {
      console.log('[AI Code Complete] already registered, skip')
      return
    }

    // API 可用性检查（Monaco >= 0.34.0 才支持）
    if (!monacoInstance?.languages?.registerInlineCompletionsProvider) {
      console.error('[AI Code Complete] registerInlineCompletionsProvider NOT available in this Monaco version!')
      return
    }

    inlineCompletionRegistered.current = true

    // 仅 abortController 可跨调用共享（用于取消上一次未完成的 fetch）
    // debounceTimer 必须每次调用独立，否则上一次调用的 cancellation 回调
    // 会错误地清掉本次调用的 timer，导致 Promise 永远不 resolve、fetch 永不触发
    let abortController = null

    monacoInstance.languages.registerInlineCompletionsProvider('*', {
      provideInlineCompletions: async (model, position, context, token) => {
        console.log('[AI Code Complete] provideInlineCompletions triggered, position:', position.lineNumber, position.column)

        // 取消之前还在 in-flight 的 fetch
        if (abortController) {
          try { abortController.abort() } catch (_) {}
          abortController = null
        }

        // 防抖：每次调用独立 timer，由 Monaco 通过 token.onCancellationRequested 取消
        try {
          await new Promise((resolve, reject) => {
            const handle = setTimeout(resolve, 500)
            token.onCancellationRequested(() => {
              clearTimeout(handle)
              reject(new Error('cancelled'))
            })
          })
        } catch (_) {
          console.debug('[AI Code Complete] debounce cancelled')
          return { items: [] }
        }

        const projectId = projectIdRef.current
        if (!projectId) {
          console.warn('[AI Code Complete] no projectId in ref, skip (currentProject not set?)')
          return { items: [] }
        }

        const code = model.getValue()
        const language = model.getLanguageId()
        // 阈值与后端 _code_complete 的 len(code.strip()) < 3 对齐
        if (!code || code.trim().length < 3) {
          console.debug('[AI Code Complete] code too short, skip (len=', code ? code.trim().length : 0, ')')
          return { items: [] }
        }

        // 行首且整行为空时不触发，避免无意义请求
        const lineText = model.getLineContent(position.lineNumber) || ''
        if (position.column === 1 && lineText.trim().length === 0) {
          console.debug('[AI Code Complete] empty line at column 1, skip')
          return { items: [] }
        }

        console.log('[AI Code Complete] fetching /code-complete, projectId=', projectId, 'lang=', language)

        abortController = new AbortController()
        const signal = abortController.signal
        // 把 Monaco 的 token 取消同步到 fetch（否则 Monaco 取消后 fetch 仍会跑完）
        const cancelFetch = () => {
          try { abortController && abortController.abort() } catch (_) {}
        }
        token.onCancellationRequested(cancelFetch)

        try {
          const tk = localStorage.getItem('spider_token')
          const response = await fetch(`/api/projects/${projectId}/code-complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(tk ? { 'Authorization': `Bearer ${tk}` } : {}),
            },
            body: JSON.stringify({
              code,
              cursor_line: position.lineNumber,
              cursor_column: position.column,
              language,
              file_path: currentFileRef.current?.path || '',
            }),
            signal,
          })

          if (!response.ok) {
            console.warn('[inline-completion] HTTP', response.status)
            return { items: [] }
          }

          const data = await response.json()
          // 仅去掉首尾换行，保留行内空格（缩进可能是有效补全的一部分）
          let completion = (data && typeof data.completion === 'string') ? data.completion : ''
          completion = completion.replace(/^\n+/, '').replace(/\n+$/, '')
          if (!completion) {
            console.debug('[inline-completion] empty completion from backend')
            return { items: [] }
          }

          // 使用 monaco.Range 构造器，兼容性比纯对象更稳
          const range = new monacoInstance.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column,
          )

          console.debug('[inline-completion] show ghost text:', JSON.stringify(completion))

          return {
            items: [{
              insertText: completion,
              range,
              // 关闭自动括号配对，避免 Monaco 改写补全内容
              completeBracketPairs: false,
            }],
            // 显式声明无 enableForwardStability，避免某些版本下被过滤
            enableForwardStability: true,
          }
        } catch (err) {
          if (err && err.name !== 'AbortError') {
            console.warn('[inline-completion] error:', err)
          }
          return { items: [] }
        }
      },
      freeInlineCompletions: () => {},
      // Monaco 0.55+ 需要 disposeInlineCompletions 方法，否则会抛 TypeError
      disposeInlineCompletions: () => {},
      handleItemDidShow: () => {},
    })
  }

  // Monaco Editor Catppuccin Mocha 主题定义
  const handleEditorWillMount = (monaco) => {
    try {
      monaco.editor.defineTheme('catppuccin-mocha', {
      base: 'vs-dark',
      inherit: true,  // 继承 vs-dark 的 token 规则作为兜底
      rules: [
        // 默认文本
        { token: '', foreground: 'cdd6f4', background: '1e1e2e' },
        
        // 确保 identifier 类型有合理的颜色分配
        { token: 'identifier', foreground: 'cdd6f4' },
        { token: 'type.identifier', foreground: 'f9e2af' },
        { token: 'class', foreground: 'f9e2af' },
        
        // 注释
        { token: 'comment', foreground: '9399b2', fontStyle: 'italic' },
        { token: 'comment.block', foreground: '9399b2', fontStyle: 'italic' },
        { token: 'comment.line', foreground: '9399b2', fontStyle: 'italic' },
        
        // 关键字 - Mauve
        { token: 'keyword', foreground: 'cba6f7' },
        { token: 'keyword.control', foreground: 'cba6f7' },
        { token: 'keyword.operator', foreground: '89dceb' },
        
        // 字符串 - Green
        { token: 'string', foreground: 'a6e3a1' },
        { token: 'string.escape', foreground: 'f2cdcd' },
        { token: 'string.regex', foreground: 'fab387' },
        
        // 数字/常量 - Peach
        { token: 'number', foreground: 'fab387' },
        { token: 'number.float', foreground: 'fab387' },
        { token: 'number.hex', foreground: 'fab387' },
        { token: 'constant', foreground: 'fab387' },
        { token: 'constant.language', foreground: 'fab387' },
        
        // 类型/类 - Yellow
        { token: 'type', foreground: 'f9e2af' },
        { token: 'struct', foreground: 'f9e2af' },
        { token: 'interface', foreground: 'f9e2af' },
        
        // 函数 - Blue
        { token: 'function', foreground: '89b4fa' },
        { token: 'function.declaration', foreground: '89b4fa' },
        { token: 'method', foreground: '89b4fa' },
        
        // 变量/参数 - Text/Maroon
        { token: 'variable', foreground: 'cdd6f4' },
        { token: 'variable.parameter', foreground: 'eba0ac' },
        { token: 'parameter', foreground: 'eba0ac' },
        
        // 运算符 - Sky
        { token: 'operator', foreground: '89dceb' },
        { token: 'delimiter', foreground: '9399b2' },
        { token: 'delimiter.bracket', foreground: '9399b2' },
        { token: 'delimiter.parenthesis', foreground: '9399b2' },
        
        // 装饰器 - Rosewater
        { token: 'tag', foreground: 'f5e0dc' },
        { token: 'metatag', foreground: 'f5e0dc' },
        { token: 'annotation', foreground: 'f5e0dc' },
        
        // 内置函数/标识符 - Red
        { token: 'predefined', foreground: 'f38ba8' },
        { token: 'support.function', foreground: 'f38ba8' },
        
        // Namespace/Module - Teal
        { token: 'namespace', foreground: '94e2d5' },
        
        // 属性 - Lavender
        { token: 'attribute', foreground: 'b4befe' },
        { token: 'attribute.name', foreground: 'b4befe' },
        
        // Python specific - Monaco 对 Python 的 token 类型
        { token: 'identifier.python', foreground: 'cdd6f4' },
        { token: 'delimiter.python', foreground: '9399b2' },
        { token: 'keyword.python', foreground: 'cba6f7' },
        { token: 'number.python', foreground: 'fab387' },
        { token: 'string.python', foreground: 'a6e3a1' },
        { token: 'comment.python', foreground: '9399b2', fontStyle: 'italic' },
        
        // Markdown
        { token: 'markup.heading', foreground: 'f38ba8', fontStyle: 'bold' },
        { token: 'markup.bold', fontStyle: 'bold', foreground: 'fab387' },
        { token: 'markup.italic', fontStyle: 'italic', foreground: 'cba6f7' },
        { token: 'markup.inline', foreground: 'a6e3a1' },
        { token: 'markup.list', foreground: '89b4fa' },
        { token: 'markup.quote', foreground: '9399b2', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#1e1e2e',
        'editor.foreground': '#cdd6f4',
        'editor.lineHighlightBackground': '#cdd6f41a',
        'editor.selectionBackground': '#74c7ec40',
        'editor.inactiveSelectionBackground': '#74c7ec20',
        'editorLineNumber.foreground': '#7f849c',
        'editorLineNumber.activeForeground': '#b4befe',
        'editorCursor.foreground': '#f5e0dc',
        'editor.selectionHighlightBackground': '#74c7ec20',
        'editor.findMatchBackground': '#f9e2af40',
        'editor.findMatchHighlightBackground': '#f9e2af20',
        'editorBracketMatch.background': '#585b7050',
        'editorBracketMatch.border': '#585b70',
        'editorIndentGuide.background': '#31324450',
        'editorIndentGuide.activeBackground': '#45475a',
        'editorWidget.background': '#181825',
        'editorWidget.border': '#313244',
        'editorSuggestWidget.background': '#181825',
        'editorSuggestWidget.border': '#313244',
        'editorSuggestWidget.foreground': '#cdd6f4',
        'editorSuggestWidget.selectedBackground': '#45475a',
        'editorHoverWidget.background': '#181825',
        'editorHoverWidget.border': '#313244',
        'editorGutter.background': '#1e1e2e',
        'scrollbarSlider.background': '#585b7030',
        'scrollbarSlider.hoverBackground': '#585b7060',
        'scrollbarSlider.activeBackground': '#585b7090',
        'minimap.background': '#181825',
      },
    })
      setEditorTheme('catppuccin-mocha')
    } catch (e) {
      console.error('Failed to define Monaco theme, falling back to vs-dark:', e)
      setEditorTheme('vs-dark')
    }
  }

  // 编辑器挂载成功回调
  const handleEditorMount = (editor, monacoInstance) => {
    console.log('=== [AI Code Complete] Monaco Editor mounted, monaco=', !!monacoInstance, 'editor=', !!editor, ' ===')
    editorRef.current = editor
    setEditorReady(true)

    // 注册语言级补全提供器（Python / JS / TS）
    registerCompletionProviders(monacoInstance)

    // 注册 AI Ghost Text 补全（全语言）
    registerInlineCompletion(monacoInstance)

    // 启用 inline suggestions（默认通常已开启，这里显式确保）
    try {
      editor.updateOptions({ inlineSuggest: { enabled: true, mode: 'subword' } })
    } catch (_) {}

    // 注册自定义右键菜单：附加到对话
    editor.addAction({
      id: 'attach-to-chat',
      label: '📎 附加到对话',
      keybindings: [
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyL
      ],
      precondition: 'editorHasSelection',
      contextMenuGroupId: '9_cutcopypaste',
      contextMenuOrder: 5,
      run: (ed) => {
        const selection = ed.getSelection()
        if (!selection || selection.isEmpty()) return
        const selectedText = ed.getModel().getValueInRange(selection)
        if (!selectedText.trim()) return

        handleAttachCodeSnippet({
          code: selectedText,
          startLine: selection.startLineNumber,
          endLine: selection.endLineNumber
        })
      }
    })
  }

  // 布局状态
  const [leftWidth, setLeftWidth] = useState(240)
  const [rightWidth, setRightWidth] = useState(280)
  const [draggingPanel, setDraggingPanel] = useState(null) // 'left' | 'right' | null

  // 内容状态
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [fileTree, setFileTree] = useState([])   // 后端直接返回树形结构
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef(null)
  const [expandedFolders, setExpandedFolders] = useState({})
  const [selectedFile, setSelectedFile] = useState(null)
  const [showIDE, setShowIDE] = useState(false)
  const [ideHeight, setIdeHeight] = useState(300)
  const [isDraggingIde, setIsDraggingIde] = useState(false)
  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)

  // ========== 技能状态 ==========
  const [skills, setSkills] = useState([])

  // ========== MCP 状态 ==========
  const [mcpServers, setMcpServers] = useState([])
  const [mcpPresets, setMcpPresets] = useState([])
  const [showMcpPresets, setShowMcpPresets] = useState(false)
  const [mcpEnvForm, setMcpEnvForm] = useState({})  // 用于配置 API Key
  const [configuringPreset, setConfiguringPreset] = useState(null)  // 正在配置的预置 Server

  // ========== 子代理状态 ==========
  const [subAgents, setSubAgents] = useState([])
  const [showSubAgents, setShowSubAgents] = useState(true)

  // ========== 新增状态：项目切换下拉菜单 ==========
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const projectDropdownRef = useRef(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [showNewProjectInput, setShowNewProjectInput] = useState(false)

  // ========== 新增状态：项目名编辑 ==========
  const [editingProjectName, setEditingProjectName] = useState(false)
  const [projectNameInput, setProjectNameInput] = useState('')
  const projectNameInputRef = useRef(null)

  // ========== 新增状态：内联创建 ==========
  // creatingItem: null | { type: 'file'|'folder', parentPath: string, name: string }
  const [creatingItem, setCreatingItem] = useState(null)

  // ========== 新增状态：右键菜单 ==========
  // contextMenu: null | { x: number, y: number, target: item }
  const [contextMenu, setContextMenu] = useState(null)
  const contextMenuRef = useRef(null)

  // ========== 新增状态：内联重命名 ==========
  // renamingItem: null | { path: string, name: string }
  const [renamingItem, setRenamingItem] = useState(null)

  // ========== 新增状态：上传相关 ==========
  const [uploadProgress, setUploadProgress] = useState(null) // { current: number, total: number }
  const folderInputRef = useRef(null)

  // 代码运行状态
  const [isRunning, setIsRunning] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState(null) // {stdout, stderr, exit_code, duration_ms}
  const [showTerminal, setShowTerminal] = useState(false)
  const [terminalHeight, setTerminalHeight] = useState(180)

  // ========== 聊天消息状态 ==========
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [projectSessionId, setProjectSessionId] = useState(null)
  const messagesEndRef = useRef(null)
  const prevProjectIdRef = useRef(null)  // 追踪上一个项目 ID，用于切换时保存状态

  // ========== 任务进展与产物状态 ==========
  const [taskSteps, setTaskSteps] = useState([])   // [{tool, args, status, result}]
  const [artifacts, setArtifacts] = useState([])     // [{path, action}]

  // 消息自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 持久化当前项目 id（用于页面刷新时恢复）
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem('spider_last_project_id', String(currentProject.id))
    }
  }, [currentProject])

  // 同步 projectId / 当前文件到 ref，供 InlineCompletionsProvider 闭包读取
  useEffect(() => {
    projectIdRef.current = currentProject?.id || null
  }, [currentProject])

  useEffect(() => {
    currentFileRef.current = selectedFile || null
  }, [selectedFile])

  // 加载项目列表
  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const res = await getProjects()
      const projectList = res.data
      setProjects(projectList)
      if (projectList.length > 0) {
        // 尝试恢复上次选中的项目
        const lastProjectId = localStorage.getItem('spider_last_project_id')
        if (lastProjectId) {
          const lastProject = projectList.find(p => String(p.id) === lastProjectId)
          if (lastProject) {
            setCurrentProject(lastProject)
          } else {
            setCurrentProject(projectList[0])
          }
        } else {
          setCurrentProject(projectList[0])
        }
      }
      setLoading(false)
    } catch (err) {
      console.error('Failed to load projects:', err)
      setLoading(false)
    }
  }

  // 当 currentProject 变化时，加载文件列表并从后端加载历史消息
  useEffect(() => {
    if (currentProject) {
      loadFiles(currentProject.id)
      
      // 从后端加载历史聊天消息
      getProjectMessages(currentProject.id).then(res => {
        if (res.data && res.data.length > 0) {
          setMessages(res.data)
          if (res.session_id) {
            setProjectSessionId(res.session_id)
          }
        } else {
          setMessages([])
          setProjectSessionId(null)
        }
        // taskSteps 和 artifacts 是临时UI状态，不需要恢复
        setTaskSteps([])
        setArtifacts([])
      }).catch(() => {
        setMessages([])
        setProjectSessionId(null)
        setTaskSteps([])
        setArtifacts([])
      })
      
      // 加载子代理列表
      getSubAgents(currentProject.id).then(res => {
        setSubAgents(res.data || [])
      }).catch(() => {})
      
      prevProjectIdRef.current = currentProject.id
    } else {
      setSubAgents([])
    }
  }, [currentProject])

  const loadFiles = async (projectId) => {
    try {
      const res = await getProjectFiles(projectId)
      // 后端直接返回树形结构
      setFileTree(res.data)
    } catch (err) {
      console.error('Failed to load files:', err)
    }
    // 加载项目技能
    getSkills(projectId).then(res => setSkills(res.data?.data || [])).catch(() => {})
    // 加载项目 MCP Servers
    getMcpServers(projectId).then(res => setMcpServers(res.data || [])).catch(() => {})
  }

  // 点击文件 → 加载完整内容（含 content）
  const handleFileClick = async (file) => {
    if (file.is_folder) {
      handleToggleFolder(file.path)
      return
    }
    try {
      const res = await getFileContent(currentProject.id, file.path)
      setSelectedFile(res.data)
      // 自动展开 IDE
      if (!showIDE) setShowIDE(true)
    } catch (err) {
      console.error('Failed to load file:', err)
    }
  }

  // 删除文件
  const handleDeleteFile = async (filePath, e) => {
    e.stopPropagation()
    if (!currentProject) return
    try {
      await deleteFile(currentProject.id, filePath)
      if (selectedFile?.path === filePath) setSelectedFile(null)
      await loadFiles(currentProject.id)
    } catch (err) {
      console.error('Failed to delete file:', err)
    }
  }

  // 保存编辑
  const handleSaveFile = async () => {
    if (!selectedFile || !currentProject) return
    try {
      await updateFile(currentProject.id, selectedFile.path, { content: selectedFile.content })
    } catch (err) {
      console.error('Failed to save file:', err)
    }
  }

  // 创建项目（如果没有项目）
  const handleCreateProject = async () => {
    try {
      const res = await createProject({ name: 'Spider AI Demo' })
      setCurrentProject(res.data)
      setProjects(prev => [res.data, ...prev])
    } catch (err) {
      console.error('Failed to create project:', err)
    }
  }

  // 右侧折叠区域状态
  const [expandedSections, setExpandedSections] = useState({
    progress: true,
    artifacts: true,
    skills: false,
  })

  // 水平拖拽逻辑
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!draggingPanel) return
      if (draggingPanel === 'left') {
        const newWidth = Math.min(Math.max(e.clientX, 180), 360)
        setLeftWidth(newWidth)
      } else if (draggingPanel === 'right') {
        const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 200), 400)
        setRightWidth(newWidth)
      }
    }
    const handleMouseUp = () => setDraggingPanel(null)

    if (draggingPanel) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [draggingPanel])

  // IDE 高度拖拽逻辑
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingIde) return
      // 计算从底部往上的高度
      const newHeight = Math.min(Math.max(window.innerHeight - e.clientY - 60, 150), window.innerHeight - 200)
      setIdeHeight(newHeight)
    }
    const handleMouseUp = () => {
      setIsDraggingIde(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    if (isDraggingIde) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingIde])

  // 文件夹展开/折叠
  const handleToggleFolder = (folderPath) => {
    setExpandedFolders(prev => ({ ...prev, [folderPath]: !prev[folderPath] }))
  }

  // ========== 新增：项目切换相关 ==========
  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target)) {
        setShowProjectDropdown(false)
        setShowNewProjectInput(false)
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 切换项目
  const handleSwitchProject = (project) => {
    setCurrentProject(project)
    setShowProjectDropdown(false)
  }

  // 新建项目
  const handleCreateNewProject = async () => {
    if (!newProjectName.trim()) return
    try {
      const res = await createProject({ name: newProjectName.trim() })
      setProjects(prev => [res.data, ...prev])
      setCurrentProject(res.data)
      setShowProjectDropdown(false)
      setShowNewProjectInput(false)
      setNewProjectName('')
    } catch (err) {
      console.error('Failed to create project:', err)
    }
  }

  // 删除项目
  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation()
    if (!window.confirm('确定要删除这个项目吗？')) return
    try {
      await deleteProject(projectId)
      const newProjects = projects.filter(p => p.id !== projectId)
      setProjects(newProjects)
      if (currentProject?.id === projectId) {
        resetProjectState()
        if (newProjects.length > 0) {
          setCurrentProject(newProjects[0])
        } else {
          setCurrentProject(null)
        }
      }
    } catch (err) {
      console.error('Failed to delete project:', err)
    }
  }

  // ========== 新增：项目名编辑相关 ==========
  const startEditProjectName = () => {
    if (!currentProject) return
    setProjectNameInput(currentProject.name)
    setEditingProjectName(true)
  }

  const confirmEditProjectName = async () => {
    if (!projectNameInput.trim() || !currentProject) {
      setEditingProjectName(false)
      return
    }
    try {
      await updateProject(currentProject.id, { name: projectNameInput.trim() })
      // 更新本地状态
      setCurrentProject(prev => ({ ...prev, name: projectNameInput.trim() }))
      setProjects(prev => prev.map(p => 
        p.id === currentProject.id ? { ...p, name: projectNameInput.trim() } : p
      ))
      setEditingProjectName(false)
    } catch (err) {
      console.error('Failed to update project name:', err)
      setEditingProjectName(false)
    }
  }

  // ========== 新增：重置项目状态 ==========
  const resetProjectState = () => {
    setSelectedFile(null)
    setFileTree([])
    setTerminalOutput(null)
    setShowTerminal(false)
    setShowIDE(false)
    setExpandedFolders({})
    setRenamingItem(null)
    setCreatingItem(null)
    setContextMenu(null)
    // 清空聊天状态
    setMessages([])
    setProjectSessionId(null)
    setIsStreaming(false)
    // 清空任务进展与产物
    setTaskSteps([])
    setArtifacts([])
    // 清空技能列表
    setSkills([])
    // 清空 MCP Servers
    setMcpServers([])
  }

  // ========== 新建会话 ==========
  const handleNewSession = () => {
    setMessages([])
    setProjectSessionId(null)
    setTaskSteps([])
    setArtifacts([])
  }

  // ========== 聊天消息发送 ==========
  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isStreaming || !currentProject) return
    
    // 检查是否为 /new 命令
    if (input.trim() === '/new') {
      handleNewSession()
      setInput('')
      return
    }
    
    const userMessage = input.trim()
    setInput('')
    
    // 添加用户消息（包含附件信息）
    let displayMessage = userMessage
    if (attachedFiles.length > 0) {
      const fileList = attachedFiles.map(f => f.path).join(', ')
      displayMessage = userMessage ? `${userMessage}\n\n[附件: ${fileList}]` : `[附件: ${fileList}]`
    }
    setMessages(prev => [...prev, { role: 'user', content: displayMessage }])
    
    // 添加空的 AI 消息占位
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    setIsStreaming(true)
    setIsLoading(true)
    // 清空任务进展（保留产物）
    setTaskSteps([])
    
    // 拆分常规文件与代码片段
    const regularFiles = attachedFiles.filter(f => f.type !== 'code-snippet').map(f => f.path)
    const codeSnippets = attachedFiles.filter(f => f.type === 'code-snippet')

    // 构造文件路径列表：当前打开的文件 + 附加的常规文件
    const files = selectedFile ? [selectedFile.path, ...regularFiles] : regularFiles

    // 将代码片段以上下文形式前置到 prompt
    let finalPrompt = userMessage
    if (codeSnippets.length > 0) {
      const snippetContext = codeSnippets.map(s =>
        `[代码片段: ${s.name} L${s.startLine}-L${s.endLine}]\n\`\`\`\n${s.content}\n\`\`\``
      ).join('\n\n')
      finalPrompt = snippetContext + '\n\n' + userMessage
    }

    // 清空附件列表
    setAttachedFiles([])

    try {
      const response = await projectChat(currentProject.id, {
        prompt: finalPrompt,
        files: files,
        session_id: projectSessionId
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') continue
          
          try {
            const data = JSON.parse(jsonStr)
            if (data.type === 'content' && data.content) {
              // 收到第一个内容时取消 loading
              setIsLoading(false)
              // 追加到最后一条 AI 消息
              setMessages(prev => {
                const updated = [...prev]
                const lastMsg = updated[updated.length - 1]
                if (lastMsg && lastMsg.role === 'assistant') {
                  updated[updated.length - 1] = { ...lastMsg, content: lastMsg.content + data.content }
                }
                return updated
              })
            } else if (data.type === 'tool_start') {
              // 只显示我们定义的工具（过滤 deepagents 内置工具）
              const knownTools = ['read_file', 'write_file', 'list_files', 'create_skill', 'use_skill', 'delete_skill', 'create_mcp', 'enable_mcp', 'create_sub_agent', 'run_sub_agent', 'list_sub_agents']
              if (knownTools.includes(data.tool)) {
                setTaskSteps(prev => [...prev, { 
                  tool: data.tool, 
                  args: data.args, 
                  status: 'running' 
                }])
                // 同时追加进度行到当前 AI 消息气泡
                const progressLine = buildProgressLine('tool_start', data.tool, data.args, null)
                if (progressLine) {
                  setMessages(prev => {
                    const updated = [...prev]
                    const lastMsg = updated[updated.length - 1]
                    if (lastMsg && lastMsg.role === 'assistant') {
                      const existing = Array.isArray(lastMsg.toolProgress) ? lastMsg.toolProgress : []
                      updated[updated.length - 1] = { ...lastMsg, toolProgress: [...existing, progressLine] }
                    }
                    return updated
                  })
                }
              }
            } else if (data.type === 'tool_done') {
              const knownTools = ['read_file', 'write_file', 'list_files', 'create_skill', 'use_skill', 'delete_skill', 'create_mcp', 'enable_mcp', 'create_sub_agent', 'run_sub_agent', 'list_sub_agents']
              if (knownTools.includes(data.tool)) {
                setTaskSteps(prev => {
                  const updated = [...prev]
                  const idx = updated.findLastIndex(s => s.tool === data.tool && s.status === 'running')
                  if (idx !== -1) {
                    updated[idx] = { ...updated[idx], status: data.success ? 'done' : 'error', result: data.result }
                  }
                  return updated
                })
                // 同时追加完成行到当前 AI 消息气泡
                if (data.success !== false) {
                  const progressLine = buildProgressLine('tool_done', data.tool, data.args, data.result)
                  if (progressLine) {
                    setMessages(prev => {
                      const updated = [...prev]
                      const lastMsg = updated[updated.length - 1]
                      if (lastMsg && lastMsg.role === 'assistant') {
                        const existing = Array.isArray(lastMsg.toolProgress) ? lastMsg.toolProgress : []
                        updated[updated.length - 1] = { ...lastMsg, toolProgress: [...existing, progressLine] }
                      }
                      return updated
                    })
                  }
                }
              }
              // write_file 完成后立即刷新文件树和编辑器
              if (data.tool === 'write_file' && data.success && currentProject) {
                getProjectFiles(currentProject.id).then(res => setFileTree(res.data || [])).catch(() => {})
                if (selectedFile) {
                  getFileContent(currentProject.id, selectedFile.path)
                    .then(res => setSelectedFile(prev => ({ ...prev, content: res.data?.content || prev.content })))
                    .catch(() => {})
                }
              }
              // create_skill 完成后刷新技能列表
              if (data.tool === 'create_skill' && data.success && currentProject) {
                getSkills(currentProject.id).then(res => setSkills(res.data?.data || [])).catch(() => {})
              }
              // create_mcp / enable_mcp 完成后刷新 MCP Server 列表
              if ((data.tool === 'create_mcp' || data.tool === 'enable_mcp') && data.success && currentProject) {
                getMcpServers(currentProject.id).then(res => setMcpServers(res.data || [])).catch(() => {})
              }
              // create_sub_agent 完成后刷新子代理列表
              if (data.tool === 'create_sub_agent' && data.success && currentProject) {
                getSubAgents(currentProject.id).then(res => setSubAgents(res.data || [])).catch(() => {})
              }
            } else if (data.type === 'done') {
              setIsLoading(false)
              // 合并产物
              if (data.artifacts?.length) {
                setArtifacts(prev => [...prev, ...data.artifacts])
              }
              if (data.session_id) {
                setProjectSessionId(data.session_id)
              }
              // AI 完成后刷新文件树（可能有新文件创建）
              if (currentProject) {
                try {
                  const filesRes = await getProjectFiles(currentProject.id)
                  setFileTree(filesRes.data || [])
                } catch (e) {
                  console.error('Failed to refresh file tree:', e)
                }
                // 如果当前有打开的文件，刷新其内容
                if (selectedFile) {
                  try {
                    const contentRes = await getFileContent(currentProject.id, selectedFile.path)
                    setSelectedFile(prev => ({
                      ...prev,
                      content: contentRes.data?.content || prev.content
                    }))
                  } catch (e) {
                    // 文件可能被删除，忽略
                  }
                }
              }
            } else if (data.type === 'error') {
              setIsLoading(false)
              setMessages(prev => {
                const updated = [...prev]
                const lastMsg = updated[updated.length - 1]
                if (lastMsg && lastMsg.role === 'assistant') {
                  updated[updated.length - 1] = { ...lastMsg, content: `错误: ${data.content}` }
                }
                return updated
              })
            }
          } catch (e) {
            // 忽略 JSON 解析错误
          }
        }
      }
    } catch (err) {
      console.error('Project chat error:', err)
      setIsLoading(false)
      setMessages(prev => {
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          updated[updated.length - 1] = { ...lastMsg, content: `发送失败: ${err.message}` }
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }

  // ========== MCP 操作函数 ==========
  const loadMcpPresets = async () => {
    try {
      const res = await getMcpPresets();
      setMcpPresets(res.data || []);
      setShowMcpPresets(true);
    } catch (e) {
      console.error('加载 MCP 预置列表失败:', e);
    }
  };

  const handleEnableMcp = async (presetName, envConfig = {}) => {
    try {
      await enableMcp({
        preset_name: presetName,
        project_id: currentProject?.id,
        env_config: envConfig,
      });
      // 刷新已启用列表
      const res = await getMcpServers(currentProject?.id);
      setMcpServers(res.data || []);
      setConfiguringPreset(null);
      setMcpEnvForm({});
      // 更新预置列表的启用状态
      setMcpPresets(prev => prev.map(p => 
        p.name === presetName ? { ...p, is_enabled: true } : p
      ));
    } catch (e) {
      console.error('启用 MCP Server 失败:', e);
    }
  };

  const handleDeleteMcp = async (serverId) => {
    try {
      await deleteMcpServer(serverId);
      setMcpServers(prev => prev.filter(s => s.id !== serverId));
    } catch (e) {
      console.error('删除 MCP Server 失败:', e);
    }
  };

  // ========== 新增：文件拖拽移动相关 ==========
  const [draggingPath, setDraggingPath] = useState(null)
  const [dropTargetPath, setDropTargetPath] = useState(null)

  // ========== 新增：聊天附件状态（从文件树拖拽到聊天输入框）==========
  const [attachedFiles, setAttachedFiles] = useState([])  // [{path, name, isDir}] 或代码片段 {path, name, type:'code-snippet', startLine, endLine, content}
  const [isDragOverChat, setIsDragOverChat] = useState(false)

  // 将编辑器选中的代码片段附加到聊天输入框
  const handleAttachCodeSnippet = (snippet) => {
    const fileName = selectedFile?.name || 'snippet'
    const filePath = selectedFile?.path || 'unknown'

    const snippetData = {
      path: filePath,
      name: fileName,
      isDir: false,
      type: 'code-snippet',
      startLine: snippet.startLine,
      endLine: snippet.endLine,
      content: snippet.code
    }

    setAttachedFiles(prev => {
      // 按 path + 行号区间去重
      const isDuplicate = prev.some(f =>
        f.type === 'code-snippet' &&
        f.path === snippetData.path &&
        f.startLine === snippetData.startLine &&
        f.endLine === snippetData.endLine
      )
      if (isDuplicate) return prev
      return [...prev, snippetData]
    })
  }

  const handleMoveFile = async (sourcePath, destFolderPath) => {
    if (!currentProject || sourcePath === destFolderPath) return
    
    // 获取文件名
    const fileName = sourcePath.split('/').pop()
    // 构建目标路径
    const destPath = destFolderPath ? `${destFolderPath}/${fileName}` : fileName
    
    // 不能移动到自己或自己的子目录
    if (sourcePath === destPath || destPath.startsWith(sourcePath + '/')) return
    
    try {
      await moveFile(currentProject.id, {
        source_path: sourcePath,
        destination_path: destPath
      })
      // 刷新文件列表
      await loadFiles(currentProject.id)
      // 如果移动的是当前打开的文件，关闭它
      if (selectedFile?.path === sourcePath) {
        setSelectedFile(null)
      }
    } catch (err) {
      console.error('Failed to move file:', err)
    }
  }

  // ========== 新增：内联创建相关 ==========
  const startCreating = (type, parentPath = '') => {
    setCreatingItem({ type, parentPath, name: '' })
    // 展开父文件夹
    if (parentPath) {
      setExpandedFolders(prev => ({ ...prev, [parentPath]: true }))
    }
  }

  const confirmCreating = async () => {
    if (!creatingItem || !creatingItem.name.trim() || !currentProject) return
    try {
      if (creatingItem.type === 'file') {
        await createFile(currentProject.id, {
          name: creatingItem.name.trim(),
          content: '',
          parent_path: creatingItem.parentPath
        })
      } else {
        await createFolder(currentProject.id, {
          name: creatingItem.name.trim(),
          parent_path: creatingItem.parentPath
        })
      }
      setCreatingItem(null)
      await loadFiles(currentProject.id)
    } catch (err) {
      console.error('Failed to create:', err)
    }
  }

  // ========== 新增：右键菜单相关 ==========
  const handleContextMenu = (e, item) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      target: item
    })
  }

  const handleContextMenuAction = async (action) => {
    const item = contextMenu?.target
    setContextMenu(null)

    if (!item) return

    switch (action) {
      case 'newFile':
        startCreating('file', item.is_folder ? item.path : '')
        break
      case 'newFolder':
        startCreating('folder', item.is_folder ? item.path : '')
        break
      case 'rename':
        setRenamingItem({ path: item.path, name: item.name })
        break
      case 'delete':
        if (window.confirm(`确定要删除 ${item.name} 吗？`)) {
          await handleDeleteFile(item.path, { stopPropagation: () => {} })
        }
        break
    }
  }

  const handleBlankContextMenu = (e) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      target: null // 空白区域
    })
  }

  // ========== 新增：内联重命名相关 ==========
  const confirmRename = async () => {
    if (!renamingItem || !renamingItem.name.trim() || !currentProject) return
    try {
      await renameFile(currentProject.id, renamingItem.path, { new_name: renamingItem.name.trim() })
      setRenamingItem(null)
      await loadFiles(currentProject.id)
    } catch (err) {
      console.error('Failed to rename:', err)
    }
  }

  // ========== 新增：增强上传相关 ==========
  // 多文件上传
  const handleMultiFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0 || !currentProject) return

    setUploadProgress({ current: 0, total: files.length })

    for (let i = 0; i < files.length; i++) {
      const formData = new FormData()
      formData.append('file', files[i])
      formData.append('parent_path', '')

      try {
        await uploadProjectFile(currentProject.id, formData)
        setUploadProgress({ current: i + 1, total: files.length })
      } catch (err) {
        console.error(`Failed to upload ${files[i].name}:`, err)
      }
    }

    setUploadProgress(null)
    await loadFiles(currentProject.id)
    e.target.value = ''
  }

  // 文件夹上传
  const handleFolderUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0 || !currentProject) return

    setUploadProgress({ current: 0, total: files.length })

    // 收集所有需要的目录
    const dirs = new Set()
    for (const file of files) {
      const relativePath = file.webkitRelativePath
      const parts = relativePath.split('/')
      // 创建所有层级的目录（除了最后一层文件名）
      for (let i = 0; i < parts.length - 1; i++) {
        dirs.add(parts.slice(0, i + 1).join('/'))
      }
    }

    // 先创建所有目录
    for (const dir of Array.from(dirs).sort((a, b) => a.split('/').length - b.split('/').length)) {
      const parts = dir.split('/')
      const name = parts.pop()
      const parentPath = parts.join('/')
      try {
        await createFolder(currentProject.id, { name, parent_path: parentPath })
      } catch (err) {
        // 目录可能已存在，忽略错误
      }
    }

    // 逐个上传文件
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const relativePath = file.webkitRelativePath
      const parts = relativePath.split('/')
      const fileName = parts.pop()
      const parentPath = parts.join('/')

      const formData = new FormData()
      formData.append('file', file)
      formData.append('parent_path', parentPath)

      try {
        await uploadProjectFile(currentProject.id, formData)
        setUploadProgress({ current: i + 1, total: files.length })
      } catch (err) {
        console.error(`Failed to upload ${relativePath}:`, err)
      }
    }

    setUploadProgress(null)
    await loadFiles(currentProject.id)
    e.target.value = ''
  }

  // 运行代码
  const handleRunCode = async () => {
    if (!selectedFile || !currentProject || isRunning) return

    setIsRunning(true)
    setTerminalOutput(null)
    setShowTerminal(true)

    try {
      // 运行前自动保存当前文件到 VM
      await updateFile(currentProject.id, selectedFile.path, { content: selectedFile.content || '' })
      
      const res = await runCode(currentProject.id, {
        file_path: selectedFile.path,
        language: selectedFile.language || 'python'
      })
      setTerminalOutput(res.data)
    } catch (err) {
      console.error('Failed to run code:', err)
      setTerminalOutput({
        stdout: '',
        stderr: err.response?.data?.detail || err.message || '运行失败',
        exit_code: 1,
        execution_time: 0,
        duration_ms: 0
      })
    } finally {
      setIsRunning(false)
    }
  }

  // 切换折叠区域
  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div
      className="h-screen w-screen flex overflow-hidden"
      style={{ backgroundColor: colors.crust }}
    >
      {/* 亮色模式下 Markdown 文字颜色覆盖（针对 MarkdownRenderer 内置的 text-white 等深色背景样式） */}
      {!isDark && (
        <style>{`
          .projects-light-markdown { color: ${lightColors.text} !important; }
          .projects-light-markdown p,
          .projects-light-markdown li,
          .projects-light-markdown strong,
          .projects-light-markdown em,
          .projects-light-markdown h1,
          .projects-light-markdown h2,
          .projects-light-markdown h3,
          .projects-light-markdown h4 { color: ${lightColors.text} !important; text-shadow: none !important; }
          .projects-light-markdown blockquote {
            color: ${lightColors.subtext1} !important;
            background-color: ${lightColors.surface0} !important;
            border-color: ${lightColors.blue} !important;
          }
          .projects-light-markdown a { color: ${lightColors.blue} !important; }
          .projects-light-markdown code:not(pre code) {
            background-color: ${lightColors.surface1} !important;
            color: ${lightColors.peach} !important;
          }
          .projects-light-markdown hr { border-color: ${lightColors.surface2} !important; }
          .projects-light-markdown table { border-color: ${lightColors.surface2} !important; }
          .projects-light-markdown table th,
          .projects-light-markdown table td {
            color: ${lightColors.text} !important;
            text-shadow: none !important;
            border-color: ${lightColors.surface2} !important;
          }
          .projects-light-markdown table th { background-color: ${lightColors.surface0} !important; }
          /* 代码块：亮色模式下也保持深色背景 + 原有语法高亮颜色（业界标准做法） */
          .projects-light-markdown .code-block-wrapper {
            background-color: #1e1e2e !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
          }
          .projects-light-markdown .code-block-wrapper > div {
            background-color: #181825 !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
          }
          .projects-light-markdown .code-block-wrapper > div span {
            color: rgba(255, 255, 255, 0.55) !important;
            text-shadow: none !important;
          }
          .projects-light-markdown .code-block-wrapper > div button {
            background-color: rgba(255, 255, 255, 0.1) !important;
            color: rgba(255, 255, 255, 0.7) !important;
          }
          .projects-light-markdown .code-block-wrapper > div button:hover {
            background-color: rgba(255, 255, 255, 0.2) !important;
          }
          .projects-light-markdown pre {
            background-color: #1e1e2e !important;
          }
          .projects-light-markdown pre code {
            color: #a6e3a1 !important;
            text-shadow: 0 0 4px rgba(52, 211, 153, 0.6) !important;
            background-color: transparent !important;
          }
        `}</style>
      )}
      {/* ========== 左侧边栏 ========== */}
      <div
        className="flex flex-col flex-shrink-0"
        style={{
          width: `${leftWidth}px`,
          backgroundColor: colors.crust,
          borderRight: `1px solid ${colors.surface1}`,
        }}
      >
        {/* 顶部项目切换 */}
        <div className="py-3 px-4" style={{ borderBottom: `1px solid ${colors.surface0}` }}>
          <div 
            ref={projectDropdownRef}
            className="relative"
          >
            {editingProjectName ? (
              <input
                ref={projectNameInputRef}
                type="text"
                value={projectNameInput}
                onChange={(e) => setProjectNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmEditProjectName()
                  if (e.key === 'Escape') setEditingProjectName(false)
                }}
                onBlur={confirmEditProjectName}
                autoFocus
                className="w-full text-sm font-semibold uppercase tracking-wider px-2 py-1 rounded outline-none"
                style={{ 
                  backgroundColor: colors.surface0, 
                  color: colors.text,
                  border: `1px solid ${colors.mauve}`
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  startEditProjectName()
                }}
                className="flex items-center gap-2 w-full text-left group"
              >
                <span
                  className="text-sm font-semibold uppercase tracking-wider flex-1"
                  style={{ color: colors.text }}
                >
                  {currentProject?.name || 'Projects'}
                </span>
                <ChevronDown 
                  size={14} 
                  style={{ 
                    color: colors.subtext0,
                    transform: showProjectDropdown ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s'
                  }} 
                />
              </button>
            )}

            {/* 项目下拉菜单 */}
            {showProjectDropdown && (
              <div
                className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl z-50 overflow-hidden"
                style={{ 
                  backgroundColor: colors.surface0,
                  border: `1px solid ${colors.surface1}`,
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {/* 项目列表 */}
                {projects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleSwitchProject(project)}
                    className="flex items-center justify-between px-3 py-2 cursor-pointer group"
                    style={{ 
                      backgroundColor: currentProject?.id === project.id ? colors.surface1 : 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (currentProject?.id !== project.id) {
                        e.currentTarget.style.backgroundColor = colors.surface1
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentProject?.id !== project.id) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    <span className="text-sm" style={{ color: colors.text }}>{project.name}</span>
                    <button
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all"
                    >
                      <Trash2 size={12} style={{ color: colors.red }} />
                    </button>
                  </div>
                ))}

                {/* 分隔线 */}
                {projects.length > 0 && (
                  <div style={{ height: 1, backgroundColor: colors.surface1 }} />
                )}

                {/* 新建项目 */}
                {showNewProjectInput ? (
                  <div className="px-3 py-2">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateNewProject()
                        if (e.key === 'Escape') {
                          setShowNewProjectInput(false)
                          setNewProjectName('')
                        }
                      }}
                      placeholder="项目名称"
                      autoFocus
                      className="w-full text-sm px-2 py-1.5 rounded outline-none"
                      style={{ 
                        backgroundColor: colors.base, 
                        color: colors.text, 
                        border: `1px solid ${colors.mauve}` 
                      }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewProjectInput(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left"
                    style={{ color: colors.mauve }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Plus size={14} />
                    <span className="text-sm">新建项目</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        {currentProject && (
          <div className="flex items-center gap-1 px-3 py-2" style={{ borderBottom: `1px solid ${colors.surface0}` }}>
            <button
              onClick={() => startCreating('file', '')}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="新建文件"
            >
              <FilePlus size={14} style={{ color: colors.subtext0 }} />
            </button>
            <button
              onClick={() => startCreating('folder', '')}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="新建文件夹"
            >
              <FolderPlus size={14} style={{ color: colors.subtext0 }} />
            </button>
            <div className="relative">
              <button
                onClick={() => {
                  // 显示上传选项下拉
                  const dropdown = document.getElementById('upload-dropdown')
                  dropdown?.classList.toggle('hidden')
                }}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                title="上传"
              >
                <Upload size={14} style={{ color: colors.subtext0 }} />
              </button>
              {/* 上传下拉菜单 */}
              <div 
                id="upload-dropdown"
                className="hidden absolute left-0 top-full mt-1 rounded-lg shadow-xl z-40"
                style={{ 
                  backgroundColor: colors.surface0, 
                  border: `1px solid ${colors.surface1}`,
                  minWidth: '120px'
                }}
              >
                <button
                  onClick={() => { fileInputRef.current?.click(); document.getElementById('upload-dropdown')?.classList.add('hidden') }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Upload size={12} />
                  上传文件
                </button>
                <button
                  onClick={() => { folderInputRef.current?.click(); document.getElementById('upload-dropdown')?.classList.add('hidden') }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FolderOpen size={12} />
                  上传文件夹
                </button>
              </div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleMultiFileUpload} className="hidden" multiple />
            <input type="file" ref={folderInputRef} onChange={handleFolderUpload} className="hidden" webkitdirectory="" directory="" />
            
            {/* 上传进度 */}
            {uploadProgress && (
              <span className="text-xs ml-2" style={{ color: colors.overlay0 }}>
                {uploadProgress.current}/{uploadProgress.total}
              </span>
            )}
          </div>
        )}

        {/* 根目录内联创建输入框 */}
        {creatingItem && creatingItem.parentPath === '' && currentProject && (
          <div
            className="px-3 py-2"
            style={{ borderBottom: `1px solid ${colors.surface0}` }}
          >
            <div className="flex items-center gap-2">
              {creatingItem.type === 'folder' ? (
                <FolderOpen size={14} style={{ color: colors.blue }} />
              ) : (
                <FileText size={14} style={{ color: colors.subtext0 }} />
              )}
              <input
                type="text"
                value={creatingItem.name}
                onChange={(e) => setCreatingItem(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmCreating()
                  if (e.key === 'Escape') setCreatingItem(null)
                }}
                onBlur={confirmCreating}
                placeholder={creatingItem.type === 'folder' ? '文件夹名' : '文件名 (如 main.py)'}
                autoFocus
                className="flex-1 text-xs px-2 py-1 rounded outline-none"
                style={{ backgroundColor: colors.surface0, color: colors.text, border: `1px solid ${colors.mauve}` }}
              />
            </div>
          </div>
        )}

        {/* 文件树 */}
        <div 
          className="flex-1 overflow-y-auto px-2"
          onContextMenu={handleBlankContextMenu}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
          }}
          onDrop={(e) => {
            e.preventDefault()
            const sourcePath = e.dataTransfer.getData('text/plain')
            // 拖到空白区域 = 移动到根目录
            handleMoveFile(sourcePath, '')
            setDraggingPath(null)
            setDropTargetPath(null)
          }}
        >
          {fileTree.map((item, idx) => (
            <FileTreeItem
              key={item.path || idx}
              item={item}
              expandedFolders={expandedFolders}
              onToggleFolder={handleToggleFolder}
              onFileClick={handleFileClick}
              selectedFile={selectedFile}
              onDeleteFile={handleDeleteFile}
              onContextMenu={handleContextMenu}
              renamingItem={renamingItem}
              setRenamingItem={setRenamingItem}
              onConfirmRename={confirmRename}
              creatingItem={creatingItem}
              setCreatingItem={setCreatingItem}
              onConfirmCreating={confirmCreating}
              draggingPath={draggingPath}
              setDraggingPath={setDraggingPath}
              dropTargetPath={dropTargetPath}
              setDropTargetPath={setDropTargetPath}
              onMoveFile={handleMoveFile}
              colors={colors}
            />
          ))}
        </div>

        {/* 右键菜单 */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="fixed rounded-lg shadow-xl z-50 overflow-hidden"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              backgroundColor: colors.surface0,
              border: `1px solid ${colors.surface1}`,
              minWidth: '140px'
            }}
          >
            {contextMenu.target?.is_folder ? (
              <>
                <button
                  onClick={() => handleContextMenuAction('newFile')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FilePlus size={12} style={{ color: colors.blue }} />
                  新建文件
                </button>
                <button
                  onClick={() => handleContextMenuAction('newFolder')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FolderPlus size={12} style={{ color: colors.blue }} />
                  新建文件夹
                </button>
                <div style={{ height: 1, backgroundColor: colors.surface1 }} />
                <button
                  onClick={() => handleContextMenuAction('rename')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Pencil size={12} style={{ color: colors.yellow }} />
                  重命名
                </button>
                <button
                  onClick={() => handleContextMenuAction('delete')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm"
                  style={{ color: colors.red }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Trash2 size={12} />
                  删除
                </button>
              </>
            ) : contextMenu.target ? (
              <>
                <button
                  onClick={() => handleContextMenuAction('rename')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Pencil size={12} style={{ color: colors.yellow }} />
                  重命名
                </button>
                <button
                  onClick={() => handleContextMenuAction('delete')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm"
                  style={{ color: colors.red }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Trash2 size={12} />
                  删除
                </button>
              </>
            ) : (
              <>
                {/* 空白区域右键 */}
                <button
                  onClick={() => { startCreating('file', ''); setContextMenu(null) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FilePlus size={12} style={{ color: colors.blue }} />
                  新建文件
                </button>
                <button
                  onClick={() => { startCreating('folder', ''); setContextMenu(null) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm"
                  style={{ color: colors.text }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FolderPlus size={12} style={{ color: colors.blue }} />
                  新建文件夹
                </button>
              </>
            )}
          </div>
        )}

        {/* 子代理面板 */}
        {currentProject && (
          <div style={{ borderTop: `1px solid ${colors.surface0}` }}>
            {/* 标题栏 - 可折叠 */}
            <div 
              className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
              style={{ color: colors.subtext0 }}
              onClick={() => setShowSubAgents(!showSubAgents)}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
                <Bot size={13} />
                <span>子代理</span>
                {subAgents.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px]"
                    style={{ backgroundColor: colors.surface0, color: colors.subtext1 }}>
                    {subAgents.length}
                  </span>
                )}
              </div>
              <ChevronRight 
                size={13} 
                className={`transition-transform duration-150 ${showSubAgents ? 'rotate-90' : ''}`}
                style={{ color: colors.overlay0 }}
              />
            </div>
            
            {/* 子代理列表 */}
            {showSubAgents && (
              <div className="px-2 pb-2 space-y-1 max-h-40 overflow-y-auto">
                {subAgents.length === 0 ? (
                  <div className="text-xs px-2 py-3 text-center" style={{ color: colors.overlay0 }}>
                    AI 会根据需要自动创建子代理
                  </div>
                ) : (
                  subAgents.map(agent => (
                    <div 
                      key={agent.id}
                      className="group flex items-start gap-2 px-2 py-1.5 rounded-md transition-colors duration-150 hover:bg-opacity-50"
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.surface0}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div 
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: agent.is_enabled ? colors.green : colors.overlay0 }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium truncate" style={{ color: colors.text }}>
                            {agent.display_name}
                          </span>
                        </div>
                        {agent.description && (
                          <p className="text-[11px] truncate mt-0.5" style={{ color: colors.subtext0 }}>
                            {agent.description}
                          </p>
                        )}
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-0.5 rounded hover:bg-opacity-50 flex-shrink-0"
                        style={{ color: colors.overlay0 }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`确定删除子代理「${agent.display_name}」？`)) {
                            await deleteSubAgent(agent.id);
                            setSubAgents(prev => prev.filter(a => a.id !== agent.id));
                          }
                        }}
                        title="删除子代理"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* 底部返回链接 */}
        <div
          className="py-3 px-4"
          style={{ borderTop: `1px solid ${colors.surface0}` }}
        >
          <button
            onClick={() => navigate('/chat')}
            className="flex items-center gap-1 text-sm transition-colors duration-150"
            style={{ color: colors.subtext0 }}
            onMouseEnter={(e) => e.currentTarget.style.color = colors.text}
            onMouseLeave={(e) => e.currentTarget.style.color = colors.subtext0}
          >
            <ChevronLeft size={16} />
            <span>Back to Chat</span>
          </button>
        </div>
      </div>

      {/* 左侧拖拽手柄 */}
      <div
        className="w-1 flex-shrink-0 transition-colors duration-150"
        style={{
          backgroundColor: colors.surface1,
          cursor: 'col-resize',
        }}
        onMouseDown={() => setDraggingPanel('left')}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
        onMouseLeave={(e) => {
          if (draggingPanel !== 'left') e.currentTarget.style.backgroundColor = 'transparent'
        }}
      />

      {/* ========== 中间主区域 ========== */}
      <div
        className="flex-1 flex flex-col"
        style={{ backgroundColor: colors.base }}
      >
        {/* 顶部标题栏 */}
        <div
          className="px-6 py-3 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: `1px solid ${colors.surface0}` }}
        >
          <div className="flex items-center gap-3">
            <span className="font-semibold text-base" style={{ color: colors.text }}>
              {currentProject?.name || 'Spider AI'}
            </span>
            <button
              onClick={handleNewSession}
              title="新建会话"
              className="p-1.5 rounded-md transition-colors duration-150"
              style={{ color: colors.subtext0 }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.surface0
                e.currentTarget.style.color = colors.text
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = colors.subtext0
              }}
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleTheme()}
              className="p-1.5 rounded-lg transition-colors"
              style={{ 
                color: colors.subtext1,
                backgroundColor: 'transparent'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.surface0}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              title={isDark ? '切换亮色' : '切换深色'}
            >
              {isDark ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
            <button
              onClick={() => setShowIDE(!showIDE)}
              className="flex items-center gap-1 px-2 py-1 rounded-md transition-colors duration-150"
              style={{ backgroundColor: colors.surface0 }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.surface0}
            >
              {showIDE ? (
                <ChevronDown size={14} style={{ color: colors.subtext0 }} />
              ) : (
                <ChevronRight size={14} style={{ color: colors.subtext0 }} />
              )}
              <span className="text-xs" style={{ color: colors.overlay0 }}>IDE</span>
            </button>
          </div>
        </div>

        {/* 无项目状态 */}
        {projects.length === 0 && !loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <FolderOpen size={48} style={{ color: colors.surface0 }} />
            <p style={{ color: colors.overlay0 }}>还没有项目</p>
            <button
              onClick={handleCreateProject}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: colors.blue, color: colors.crust }}
            >
              创建第一个项目
            </button>
          </div>
        ) : (
          <>
            {/* 对话内容区域 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {messages.length > 0 ? (
                messages.map((msg, idx) => (
                  <ChatMessage 
                    key={idx} 
                    message={msg} 
                    isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant'}
                    colors={colors}
                    isDark={isDark}
                  />
                ))
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span style={{ color: colors.overlay0 }} className="text-sm">开始与 AI 对话吧</span>
                </div>
              )}
              {/* AI 思考中加载提示 */}
              {isLoading && (
                <div className="flex justify-start gap-2 mb-4">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: colors.blue }}
                  >
                    <span className="text-white text-xs font-bold">S</span>
                  </div>
                  <div style={{ maxWidth: '85%' }}>
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ backgroundColor: colors.surface0 }}
                    >
                      <div className="flex gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{ backgroundColor: colors.subtext0, animationDelay: '0ms' }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{ backgroundColor: colors.subtext0, animationDelay: '150ms' }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{ backgroundColor: colors.subtext0, animationDelay: '300ms' }}
                        />
                      </div>
                      <span className="text-sm" style={{ color: colors.subtext0 }}>思考中...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* IDE 区域 (默认隐藏) */}
            {showIDE && (
              <div 
                className="flex flex-col flex-shrink-0 overflow-hidden"
                style={{ 
                  height: ideHeight, 
                  borderTop: `1px solid ${colors.surface0}`,
                  transition: isDraggingIde ? 'none' : 'height 0.2s ease'
                }}
              >
                {/* 拖拽手柄 */}
                <div
                  className="h-1.5 cursor-row-resize flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: colors.surface0 }}
                  onMouseDown={() => setIsDraggingIde(true)}
                >
                  <div className="flex gap-0.5">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: colors.surface2 }} />
                    ))}
                  </div>
                </div>
                
                {/* IDE 操作栏 */}
                <div 
                  className="flex items-center justify-between px-3 flex-shrink-0"
                  style={{ height: '28px', backgroundColor: colors.mantle, borderBottom: `1px solid ${colors.surface0}` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: colors.overlay0 }}>
                      {selectedFile?.name || 'IDE'}
                      {selectedFile?.isSkill && <span style={{ color: colors.mauve, marginLeft: 4 }}>(技能)</span>}
                    </span>
                    {/* Run 按钮 - 只对 Python 文件显示，技能文件不显示 */}
                    {selectedFile?.path?.endsWith('.py') && !selectedFile?.isSkill && (
                      <button
                        onClick={handleRunCode}
                        disabled={isRunning}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors"
                        style={{
                          backgroundColor: isRunning ? colors.surface0 : 'transparent',
                          cursor: isRunning ? 'not-allowed' : 'pointer'
                        }}
                        title="运行代码"
                      >
                        {isRunning ? (
                          <Loader2 size={12} className="animate-spin" style={{ color: colors.overlay0 }} />
                        ) : (
                          <Play size={12} style={{ color: colors.green }} />
                        )}
                        <span className="text-xs" style={{ color: isRunning ? colors.overlay0 : colors.green }}>
                          {isRunning ? 'Running' : 'Run'}
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* 保存按钮 - 技能文件不显示 */}
                    {!selectedFile?.isSkill && (
                      <button
                        onClick={handleSaveFile}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                        title="保存文件"
                      >
                        <Save size={12} style={{ color: colors.green }} />
                      </button>
                    )}
                    {/* 最大化按钮 */}
                    <button
                      onClick={() => {
                        setIdeHeight(ideHeight >= window.innerHeight - 120 ? 300 : window.innerHeight - 120)
                      }}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      title="最大化/还原"
                    >
                      <Maximize2 size={12} style={{ color: colors.subtext0 }} />
                    </button>
                    {/* 关闭按钮 */}
                    <button
                      onClick={() => setShowIDE(false)}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      title="关闭 IDE"
                    >
                      <X size={12} style={{ color: colors.red }} />
                    </button>
                  </div>
                </div>
                
                {/* Monaco Editor */}
                <div className="flex-1 overflow-hidden">
                  <Editor
                    height="100%"
                    language={selectedFile?.language || 'python'}
                    value={selectedFile?.content || '# Select a file from the sidebar'}
                    theme={isDark ? editorTheme : 'light'}
                    beforeMount={handleEditorWillMount}
                    onMount={handleEditorMount}
                    onChange={(value) => {
                      if (selectedFile) {
                        setSelectedFile(prev => ({ ...prev, content: value }))
                      }
                    }}
                    loading={
                      <div 
                        className="flex items-center justify-center h-full"
                        style={{ backgroundColor: colors.base, color: colors.overlay0 }}
                      >
                        <span className="text-sm">编辑器加载中...</span>
                      </div>
                    }
                    options={{
                      fontSize: 13,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      lineNumbers: 'on',
                      padding: { top: 8 },
                      // 代码补全相关配置
                      suggestOnTriggerCharacters: true,
                      quickSuggestions: true,
                      wordBasedSuggestions: 'currentDocument',
                      acceptSuggestionOnCommitCharacter: true,
                      tabCompletion: 'on',
                      // 显式启用 ghost text，防止某些版本/主题下默认值失效
                      inlineSuggest: { enabled: true, mode: 'subword' },
                    }}
                  />
                </div>

                {/* 终端输出面板 */}
                {showTerminal && (
                  <div 
                    className="flex flex-col flex-shrink-0"
                    style={{ 
                      height: `${terminalHeight}px`,
                      backgroundColor: colors.crust,
                      borderTop: `1px solid ${colors.surface0}`
                    }}
                  >
                    {/* 终端拖拽条 */}
                    <div
                      style={{ height: '4px', cursor: 'ns-resize', backgroundColor: colors.surface0 }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        const startY = e.clientY
                        const startH = terminalHeight
                        const onMove = (ev) => {
                          const delta = startY - ev.clientY
                          setTerminalHeight(Math.max(80, Math.min(500, startH + delta)))
                        }
                        const onUp = () => {
                          window.removeEventListener('mousemove', onMove)
                          window.removeEventListener('mouseup', onUp)
                        }
                        window.addEventListener('mousemove', onMove)
                        window.addEventListener('mouseup', onUp)
                      }}
                    />
                    {/* 终端标题栏 */}
                    <div 
                      className="flex items-center justify-between px-3 flex-shrink-0"
                      style={{ height: '24px', backgroundColor: colors.mantle, borderBottom: `1px solid ${colors.surface0}` }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: colors.text }}>终端输出</span>
                        {terminalOutput && (
                          <span className="text-xs" style={{ color: colors.overlay0 }}>
                            执行时间: {((terminalOutput.duration_ms || 0) / 1000).toFixed(2)}s
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {/* 清除按钮 */}
                        <button
                          onClick={() => setTerminalOutput(null)}
                          className="p-0.5 rounded hover:bg-white/10 transition-colors"
                          title="清除输出"
                        >
                          <Trash2 size={12} style={{ color: colors.overlay0 }} />
                        </button>
                        {/* 关闭按钮 */}
                        <button
                          onClick={() => setShowTerminal(false)}
                          className="p-0.5 rounded hover:bg-white/10 transition-colors"
                          title="关闭终端"
                        >
                          <X size={12} style={{ color: colors.red }} />
                        </button>
                      </div>
                    </div>
                    {/* 终端内容 */}
                    <div 
                      className="flex-1 overflow-auto p-3 font-mono text-xs"
                      style={{ backgroundColor: colors.crust }}
                    >
                      {isRunning ? (
                        <div className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" style={{ color: colors.green }} />
                          <span style={{ color: colors.overlay0 }}>正在执行...</span>
                        </div>
                      ) : terminalOutput ? (
                        <>
                          {/* stdout */}
                          {terminalOutput.stdout && (
                            <div className="mb-2">
                              <span style={{ color: colors.green }}>$ </span>
                              <span style={{ color: colors.text }} className="whitespace-pre-wrap">{terminalOutput.stdout}</span>
                            </div>
                          )}
                          {/* stderr */}
                          {terminalOutput.stderr && (
                            <div className="mb-2">
                              <span style={{ color: colors.red }}>Error: </span>
                              <span style={{ color: colors.red }} className="whitespace-pre-wrap">{terminalOutput.stderr}</span>
                            </div>
                          )}
                          {/* 退出码 */}
                          <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${colors.surface0}` }}>
                            <span style={{ color: colors.overlay0 }}>退出码: </span>
                            <span style={{ color: terminalOutput.exit_code === 0 ? colors.green : colors.red }}>
                              {terminalOutput.exit_code}
                            </span>
                          </div>
                        </>
                      ) : (
                        <span style={{ color: colors.overlay0 }}>暂无输出</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Qoder 风格输入框 */}
            <div className="px-6 pb-4 pt-2 flex-shrink-0">
              <div
                className={`rounded-xl transition-all duration-200 ${isDragOverChat ? 'border-purple-500 bg-purple-500/10' : ''}`}
                style={{
                  backgroundColor: isDragOverChat ? 'rgba(203, 166, 247, 0.1)' : colors.surface0,
                  border: `1px solid ${isDragOverChat ? '#cba6f7' : inputFocused ? colors.mauve : colors.surface1}`,
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                  setIsDragOverChat(true)
                }}
                onDragLeave={(e) => {
                  // 只有离开容器时才取消
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setIsDragOverChat(false)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragOverChat(false)
                  const fileData = e.dataTransfer.getData('application/x-project-file')
                  if (fileData) {
                    try {
                      const file = JSON.parse(fileData)
                      // 避免重复
                      setAttachedFiles(prev => {
                        if (prev.some(f => f.path === file.path)) return prev
                        return [...prev, file]
                      })
                    } catch {}
                  }
                }}
              >
                {/* 已附加文件 / 代码片段标签 */}
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                    {attachedFiles.map((file, idx) => {
                      const isSnippet = file.type === 'code-snippet'
                      const accent = isSnippet ? '#a6e3a1' : '#cba6f7'
                      const bg = isSnippet ? 'rgba(166, 227, 161, 0.12)' : 'rgba(203, 166, 247, 0.2)'
                      const border = isSnippet ? 'rgba(166, 227, 161, 0.3)' : 'rgba(203, 166, 247, 0.3)'
                      const key = isSnippet ? `${file.path}:${file.startLine}-${file.endLine}:${idx}` : `${file.path}:${idx}`
                      return (
                        <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border" style={{ backgroundColor: bg, color: accent, borderColor: border }}>
                          <span>{isSnippet ? '✂️' : (file.isDir ? '📁' : '📄')}</span>
                          <span>{isSnippet ? `${file.name}:L${file.startLine}-L${file.endLine}` : file.name}</span>
                          <button
                            onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="ml-0.5 hover:text-white"
                            style={{ color: accent }}
                          >×</button>
                        </span>
                      )
                    })}
                  </div>
                )}
                {/* 输入区域 */}
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="描述任务，/ 调用技能与工具"
                  rows={1}
                  className="w-full bg-transparent outline-none text-sm resize-none px-4 py-3"
                  style={{
                    color: colors.text,
                    maxHeight: '72px',
                  }}
                  onInput={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 72) + 'px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                />
                {/* 底部工具栏 */}
                <div
                  className="flex items-center justify-between px-3 pb-2"
                >
                  {/* 左侧图标按钮 */}
                  <div className="flex items-center gap-1">
                    {[Paperclip, Globe, Image].map((Icon, idx) => (
                      <button
                        key={idx}
                        className="p-1.5 rounded-md transition-colors duration-150"
                        style={{ color: colors.overlay0 }}
                        onMouseEnter={(e) => e.currentTarget.style.color = colors.subtext0}
                        onMouseLeave={(e) => e.currentTarget.style.color = colors.overlay0}
                      >
                        <Icon size={16} />
                      </button>
                    ))}
                  </div>
                  {/* 发送按钮 */}
                  <button
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150"
                    style={{ backgroundColor: colors.green }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                    onClick={handleSend}
                    disabled={isStreaming || !input.trim()}
                  >
                    <ArrowUp size={16} style={{ color: '#1e1e2e' }} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 右侧拖拽手柄 */}
      <div
        className="w-1 flex-shrink-0 transition-colors duration-150"
        style={{
          backgroundColor: 'transparent',
          cursor: 'col-resize',
        }}
        onMouseDown={() => setDraggingPanel('right')}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surface1}
        onMouseLeave={(e) => {
          if (draggingPanel !== 'right') e.currentTarget.style.backgroundColor = 'transparent'
        }}
      />

      {/* ========== 右侧边栏 ========== */}
      <div
        className="flex flex-col flex-shrink-0 overflow-y-auto"
        style={{
          width: `${rightWidth}px`,
          backgroundColor: colors.crust,
        }}
      >
        {/* Section 1: 任务进展 */}
        <CollapsibleSection
          title="任务进展"
          expanded={expandedSections.progress}
          onToggle={() => toggleSection('progress')}
          colors={colors}
        >
          {taskSteps.length > 0 ? (
            taskSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2 py-1 px-2 text-xs">
                {step.status === 'running' ? (
                  <Loader2 size={12} className="animate-spin" style={{ color: colors.blue }} />
                ) : step.status === 'done' ? (
                  <CheckCircle size={12} style={{ color: colors.green }} />
                ) : (
                  <XCircle size={12} style={{ color: colors.red }} />
                )}
                <span style={{ color: colors.text }}>
                  {step.tool === 'write_file' ? `写入 ${step.args?.file_path || ''}` :
                   step.tool === 'read_file' ? `读取 ${step.args?.file_path || ''}` :
                   step.tool === 'list_files' ? '查看文件结构' :
                   step.tool === 'create_skill' ? `创建技能 ${step.args?.name || ''}` :
                   step.tool === 'use_skill' ? `使用技能 ${step.args?.skill_name || ''}` :
                   step.tool === 'delete_skill' ? `删除技能 ${step.args?.skill_name || ''}` :
                   step.tool}
                </span>
              </div>
            ))
          ) : (
            <div className="text-sm text-center py-2" style={{ color: colors.overlay0 }}>
              暂无待办
            </div>
          )}
        </CollapsibleSection>

        {/* Section 2: 产物 */}
        <CollapsibleSection
          title="产物"
          subtitle={artifacts.length > 0 ? artifacts.length : ''}
          expanded={expandedSections.artifacts}
          onToggle={() => toggleSection('artifacts')}
          colors={colors}
        >
          {artifacts.length > 0 ? (
            artifacts.map((art, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors duration-150 text-sm"
                style={{ color: colors.subtext1 }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.hoverActive}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={() => {
                  // 点击产物文件：打开到编辑器
                  handleFileClick({ name: art.path.split('/').pop(), path: art.path, is_folder: false })
                }}
              >
                <FileText size={14} style={{ color: colors.blue }} />
                <span className="truncate">{art.path}</span>
                <span className="text-xs ml-auto flex-shrink-0" style={{ color: colors.overlay0 }}>
                  AI 生成
                </span>
              </div>
            ))
          ) : (
            <div className="text-sm text-center py-2" style={{ color: colors.overlay0 }}>
              暂无产物
            </div>
          )}
        </CollapsibleSection>

        {/* Section 3: 技能与 MCP */}
        <CollapsibleSection
          title="技能与 MCP"
          expanded={expandedSections.skills}
          onToggle={() => toggleSection('skills')}
          colors={colors}
        >
          {/* 技能列表 */}
          <div style={{ marginBottom: skills.length > 0 ? 12 : 0 }}>
            {skills.length > 0 ? (
              skills.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors duration-150 group cursor-pointer"
                  style={{ color: colors.subtext1 }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.hoverActive}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={async () => {
                    // 点击技能条目：在编辑器中显示脚本内容
                    try {
                      const res = await getSkillDetail(skill.id)
                      const skillData = res.data?.data
                      if (skillData) {
                        setSelectedFile({
                          name: `${skillData.name}.md`,
                          path: `__skill__/${skillData.name}.md`,
                          content: skillData.content || '',
                          language: 'markdown',
                          isSkill: true,
                          skillId: skill.id,
                        })
                        if (!showIDE) setShowIDE(true)
                      }
                    } catch (e) {
                      console.error('Failed to load skill:', e)
                    }
                  }}
                >
                  <Zap size={14} style={{ color: colors.mauve }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: colors.text }}>{skill.name}</div>
                    {skill.description && (
                      <div className="text-xs truncate" style={{ color: colors.overlay0 }}>{skill.description}</div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-center py-2" style={{ color: colors.overlay0 }}>
                暂无技能
              </div>
            )}
          </div>

          {/* MCP Servers 分区 */}
          <div style={{ borderTop: `1px solid ${colors.surface0}`, paddingTop: 12 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: colors.subtext0 }}>MCP Servers</span>
              <button
                onClick={loadMcpPresets}
                className="text-xs transition-colors duration-150"
                style={{ color: colors.mauve }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#d4b5f9'}
                onMouseLeave={(e) => e.currentTarget.style.color = colors.mauve}
                title="浏览公共 MCP"
              >
                + 添加
              </button>
            </div>

            {/* 已启用的 MCP Server 列表 */}
            {mcpServers.length === 0 ? (
              <p className="text-xs italic" style={{ color: colors.overlay0 }}>暂无启用的 MCP Server</p>
            ) : (
              <div className="space-y-1">
                {mcpServers.map(server => (
                  <div
                    key={server.id}
                    className="group flex items-start justify-between px-2 py-2 rounded text-xs hover:bg-gray-800/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span 
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${server.is_enabled ? 'bg-green-400' : 'bg-gray-500'}`}
                        />
                        <span className="text-gray-300 font-medium">{server.display_name}</span>
                        <span className="text-gray-600 text-[10px] flex-shrink-0">
                          {server.source === 'preset' ? '公共' : '自定义'}
                        </span>
                      </div>
                      {server.description && (
                        <p className="text-[10px] text-gray-500 mt-0.5 ml-3.5 line-clamp-2">{server.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteMcp(server.id)}
                      className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0 ml-2"
                      title="删除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 公共 MCP 浏览展开区域 */}
            {showMcpPresets && (
              <div 
                className="mt-3 rounded-lg p-3"
                style={{ 
                  backgroundColor: colors.mantle,
                  border: `1px solid ${colors.surface0}`
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: colors.subtext0 }}>公共 MCP Server</span>
                  <button
                    onClick={() => { setShowMcpPresets(false); setConfiguringPreset(null); }}
                    className="text-xs transition-colors duration-150"
                    style={{ color: colors.overlay0 }}
                    onMouseEnter={(e) => e.currentTarget.style.color = colors.text}
                    onMouseLeave={(e) => e.currentTarget.style.color = colors.overlay0}
                  >
                    关闭
                  </button>
                </div>
                <div className="space-y-2">
                  {mcpPresets.map(preset => (
                    <div 
                      key={preset.name} 
                      className="rounded p-2"
                      style={{ border: `1px solid ${colors.surface0}` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-medium" style={{ color: colors.text }}>{preset.display_name}</span>
                          <p className="text-[10px] mt-0.5" style={{ color: colors.overlay0 }}>{preset.description}</p>
                        </div>
                        {preset.is_enabled ? (
                          <span 
                            className="text-[10px] px-2 py-0.5 rounded flex-shrink-0"
                            style={{ 
                              color: colors.green, 
                              backgroundColor: `${colors.green}20`
                            }}
                          >
                            已启用
                          </span>
                        ) : preset.env_keys && preset.env_keys.length > 0 ? (
                          <button
                            onClick={() => setConfiguringPreset(configuringPreset === preset.name ? null : preset.name)}
                            className="text-[10px] px-2 py-0.5 rounded transition-colors duration-150 flex-shrink-0"
                            style={{ 
                              color: colors.mauve,
                              border: `1px solid ${colors.surface1}`,
                              backgroundColor: 'transparent'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = colors.mauve;
                              e.currentTarget.style.backgroundColor = `${colors.mauve}15`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = colors.surface1;
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            配置启用
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnableMcp(preset.name)}
                            className="text-[10px] px-2 py-0.5 rounded transition-colors duration-150 flex-shrink-0"
                            style={{ 
                              color: colors.mauve,
                              border: `1px solid ${colors.surface1}`,
                              backgroundColor: 'transparent'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = colors.mauve;
                              e.currentTarget.style.backgroundColor = `${colors.mauve}15`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = colors.surface1;
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            启用
                          </button>
                        )}
                      </div>
                      {/* API Key 配置表单 */}
                      {configuringPreset === preset.name && preset.env_keys && (
                        <div className="mt-2 space-y-1.5">
                          {preset.env_keys.map(key => (
                            <div key={key}>
                              <label className="text-[10px]" style={{ color: colors.overlay0 }}>{key}</label>
                              <input
                                type="password"
                                value={mcpEnvForm[key] || ''}
                                onChange={e => setMcpEnvForm(prev => ({ ...prev, [key]: e.target.value }))}
                                placeholder={`输入 ${key}`}
                                className="w-full mt-0.5 px-2 py-1 text-xs rounded outline-none transition-colors duration-150"
                                style={{
                                  backgroundColor: colors.surface0,
                                  border: `1px solid ${colors.surface1}`,
                                  color: colors.text
                                }}
                                onFocus={(e) => e.currentTarget.style.borderColor = colors.mauve}
                                onBlur={(e) => e.currentTarget.style.borderColor = colors.surface1}
                              />
                            </div>
                          ))}
                          <button
                            onClick={() => handleEnableMcp(preset.name, mcpEnvForm)}
                            className="w-full mt-1 text-xs py-1 rounded transition-colors duration-150"
                            style={{ 
                              backgroundColor: colors.mauve,
                              color: colors.crust
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                          >
                            确认启用
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  )
}
