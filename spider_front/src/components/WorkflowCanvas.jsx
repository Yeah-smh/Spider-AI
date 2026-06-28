import { useState, useEffect, useRef } from 'react'
import { X, Plus, Play, Save, Upload, Download, Settings, Zap, Database, MessageSquare, Code, Search, Brain, GitBranch, ChevronRight, Maximize2, MousePointer2, Hand, Grid3x3, Image, MoreHorizontal, Square, FileText, ChevronDown, Package } from 'lucide-react'

export default function WorkflowCanvas({ onClose }) {
  const [selectedNode, setSelectedNode] = useState(null)
  const [isDarkCanvas, setIsDarkCanvas] = useState(true) // 默认黑色背景
  const [zoom, setZoom] = useState(100) // 缩放百分比
  const [isPanning, setIsPanning] = useState(false) // 是否正在拖动
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 }) // 平移偏移量
  const [showMinimap, setShowMinimap] = useState(true) // 是否显示缩略图
  const [selectedTool, setSelectedTool] = useState('hand') // 当前选中的工具：'add', 'note', 'pointer', 'hand', 'grid', 'fit'
  const [showNodeLibraryModal, setShowNodeLibraryModal] = useState(false) // 是否显示节点库弹窗
  const [isDraggingScrollbar, setIsDraggingScrollbar] = useState(false) // 是否正在拖动滚动条
  const [isAddingNote, setIsAddingNote] = useState(false) // 是否正在添加描述
  const [showGridBackground, setShowGridBackground] = useState(false) // 是否显示网格背景
  const [expandedCategory, setExpandedCategory] = useState(null) // 当前展开的分类ID
  const [selectionBox, setSelectionBox] = useState(null) // 框选区域 {startX, startY, endX, endY}
  const [selectedNodes, setSelectedNodes] = useState([]) // 被选中的节点ID数组
  const [selectedNotes, setSelectedNotes] = useState([]) // 被选中的注释ID数组
  const [notes, setNotes] = useState([]) // 注释列表
  const [editingNote, setEditingNote] = useState(null) // 正在编辑的注释
  const noteInputRef = useRef(null) // 注释输入框引用
  const [draggingElement, setDraggingElement] = useState(null) // 正在拖动的元素 {type: 'node'|'note', id: number}
  const [dragStart, setDragStart] = useState(null) // 拖动起始位置 {x, y}
  const isDraggingRef = useRef(false) // 是否正在拖动（用 ref 避免重渲染）
  const canvasRef = useRef(null)
  const lastScaleRef = useRef(1)
  
  // 虚拟画布的范围（用于滚动条）
  const virtualCanvasWidth = 5000
  const virtualCanvasHeight = 3000
  const [scrollPos, setScrollPos] = useState({ x: 2000, y: 1200 }) // 初始在中间
  
  const [nodes, setNodes] = useState([
    { id: 1, type: 'start', x: 400, y: 300, label: '开始', icon: 'Play' },
    { id: 2, type: 'llm', x: 700, y: 300, label: 'LLM 对话', icon: 'MessageSquare' },
    { id: 3, type: 'code', x: 1000, y: 300, label: '代码执行', icon: 'Code' },
    { id: 4, type: 'end', x: 1300, y: 300, label: '结束', icon: 'Zap' }
  ])

  // 处理画布拖放
  const handleCanvasDrop = (e) => {
    e.preventDefault()
    const nodeData = JSON.parse(e.dataTransfer.getData('nodeType'))
    const canvasRect = canvasRef.current.getBoundingClientRect()
    
    // 计算放置位置（考虑缩放和平移）
    const x = (e.clientX - canvasRect.left - panOffset.x) / (zoom / 100)
    const y = (e.clientY - canvasRect.top - 64 - panOffset.y) / (zoom / 100) // 64 = 顶部工具栏高度
    
    // 创建新节点
    const newNode = {
      id: Date.now(),
      type: nodeData.type,
      label: nodeData.label,
      icon: nodeData.icon,
      x: x - 96, // 减去节点宽度的一半居中
      y: y - 40  // 减去节点高度的一半居中
    }
    
    setNodes(prev => [...prev, newNode])
  }

  const handleCanvasDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  // 节点分类定义（不包括常用）
  const nodeCategories = [
    { id: 'basic', label: '基础逻辑节点', icon: 'GitBranch' },
    { id: 'intelligence', label: '智能节点', icon: 'Brain' },
    { id: 'tool', label: '工具节点', icon: 'Code' },
    { id: 'memory', label: '记忆节点', icon: 'Database' },
    { id: 'advanced', label: '封装节点(高级)', icon: 'Package' }
  ]

  // 常用节点（单独定义，直接显示）
  const commonNodes = [
    { type: 'start', label: '开始', icon: 'Play', color: 'emerald', desc: '工作流入口' },
    { type: 'llm', label: 'LLM', icon: 'MessageSquare', color: 'blue', desc: '大模型对话' },
    { type: 'code', label: '代码', icon: 'Code', color: 'purple', desc: 'Python执行' },
    { type: 'end', label: '结束', icon: 'Zap', color: 'red', desc: '工作流出口' }
  ]

  // 工具节点库（左侧面板）- 添加category字段
  const nodeLibrary = [
    { type: 'start', label: '开始', icon: 'Play', color: 'emerald', desc: '工作流入口', category: 'basic' },
    { type: 'end', label: '结束', icon: 'Zap', color: 'red', desc: '工作流出口', category: 'basic' },
    { type: 'condition', label: '条件', icon: 'GitBranch', color: 'pink', desc: '条件分支', category: 'basic' },
    { type: 'llm', label: 'LLM', icon: 'MessageSquare', color: 'blue', desc: '大模型对话', category: 'intelligence' },
    { type: 'agent', label: 'Agent', icon: 'Brain', color: 'indigo', desc: '智能代理', category: 'intelligence' },
    { type: 'code', label: '代码', icon: 'Code', color: 'purple', desc: 'Python执行', category: 'tool' },
    { type: 'search', label: '搜索', icon: 'Search', color: 'cyan', desc: '网络搜索', category: 'tool' },
    { type: 'knowledge', label: '知识库', icon: 'Database', color: 'amber', desc: '向量检索', category: 'memory' }
  ]

  // 按分类获取节点
  const getNodesByCategory = (categoryId) => {
    return nodeLibrary.filter(node => node.category === categoryId)
  }

  // 图标映射
  const iconMap = {
    Play, MessageSquare, Code, Database, Search, GitBranch, Brain, Zap, FileText, Package
  }

  // 渲染图标
  const renderIcon = (iconName, className) => {
    const Icon = iconMap[iconName]
    return Icon ? <Icon className={className} /> : null
  }

  // 缩放控制
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 5, 200)) // 最大200%，每次5%
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 5, 50)) // 最小50%，每次5%
  }

  const handleResetZoom = () => {
    setZoom(100)
    setPanOffset({ x: 0, y: 0 }) // 重置时也重置平移
  }

  // 设置缩放值（用于触控板手势）
  const setZoomValue = (newZoom) => {
    setZoom(Math.min(Math.max(newZoom, 50), 200))
  }

  // 处理滚动条拖动
  const handleScrollBarChange = (axis, newValue) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return
    
    if (axis === 'x') {
      const newPanOffset = {
        x: canvasRect.width / 2 - newValue,
        y: panOffset.y
      }
      setPanOffset(newPanOffset)
      setScrollPos(prev => ({ ...prev, x: newValue }))
    } else if (axis === 'y') {
      const newPanOffset = {
        x: panOffset.x,
        y: canvasRect.height / 2 - newValue
      }
      setPanOffset(newPanOffset)
      setScrollPos(prev => ({ ...prev, y: newValue }))
    }
  }

  // 同步滚动位置和平移偏移
  useEffect(() => {
    const canvasElement = canvasRef.current
    if (!canvasElement) return
    
    const rect = canvasElement.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    setPanOffset({
      x: centerX - scrollPos.x,
      y: centerY - scrollPos.y
    })
  }, [scrollPos])

  // 自适应画布：将所有节点和注释聚拢并居中
  const handleFitCanvas = () => {
    if (nodes.length === 0 && notes.length === 0) return
    
    // 重新排列所有节点：网格布局
    if (nodes.length > 0) {
      const cols = Math.ceil(Math.sqrt(nodes.length))
      const spacing = 250 // 节点间距
      
      setNodes(prev => prev.map((node, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        return {
          ...node,
          x: col * spacing,
          y: row * spacing
        }
      }))
    }
    
    // 延迟计算边界并居中，等待节点位置更新
    setTimeout(() => {
      const allElements = []
      
      // 添加所有节点
      nodes.forEach((node, idx) => {
        const cols = Math.ceil(Math.sqrt(nodes.length))
        const spacing = 250
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const x = col * spacing
        const y = row * spacing
        
        allElements.push({
          minX: x,
          maxX: x + 192,
          minY: y,
          maxY: y + 80
        })
      })
      
      // 添加所有注释
      notes.forEach(note => {
        allElements.push({
          minX: note.x,
          maxX: note.x + 200,
          minY: note.y,
          maxY: note.y + 100
        })
      })
      
      if (allElements.length === 0) return
      
      // 计算所有元素的整体边界
      const minX = Math.min(...allElements.map(el => el.minX))
      const maxX = Math.max(...allElements.map(el => el.maxX))
      const minY = Math.min(...allElements.map(el => el.minY))
      const maxY = Math.max(...allElements.map(el => el.maxY))
      
      const contentCenterX = (minX + maxX) / 2
      const contentCenterY = (minY + maxY) / 2
      
      // 获取画布中心
      const canvasRect = canvasRef.current?.getBoundingClientRect()
      if (!canvasRect) return
      
      const canvasCenterX = canvasRect.width / 2
      const canvasCenterY = canvasRect.height / 2
      
      // 计算需要的平移量
      const offsetX = canvasCenterX - contentCenterX * (zoom / 100)
      const offsetY = canvasCenterY - contentCenterY * (zoom / 100)
      
      setPanOffset({ x: offsetX, y: offsetY })
      setScrollPos({
        x: canvasCenterX - offsetX,
        y: canvasCenterY - offsetY
      })
    }, 50)
  }

  // 添加描述：在画布上点击添加文本描述
  const handleCanvasClickForNote = (e) => {
    if (!isAddingNote) return
    
    const canvasRect = canvasRef.current.getBoundingClientRect()
    // 注释现在在画布坐标系统中，需要转换为虚拟坐标
    const x = (e.clientX - canvasRect.left - panOffset.x) / (zoom / 100)
    const y = (e.clientY - canvasRect.top - 64 - panOffset.y) / (zoom / 100)
    
    // 创建一个新的注释，默认为编辑状态
    const newNote = {
      id: Date.now(),
      text: '',
      x: x,
      y: y
    }
    setNotes(prev => [...prev, newNote])
    setEditingNote(newNote.id)
    
    // 不自动退出添加模式，用户可以继续添加多个注释
    // 用户可以通过点击其他工具按钮来退出
  }

  // 获取画布光标样式
  const getCanvasCursor = () => {
    if (selectedTool === 'pointer') return 'crosshair'
    if (selectedTool === 'hand') return isPanning ? 'grabbing' : 'grab'
    if (selectedTool === 'note') return `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="%23fff" stroke="%23000" stroke-width="2" rx="2"/><line x1="8" y1="9" x2="16" y2="9" stroke="%23000" stroke-width="1.5"/><line x1="8" y1="13" x2="16" y2="13" stroke="%23000" stroke-width="1.5"/><line x1="8" y1="17" x2="13" y2="17" stroke="%23000" stroke-width="1.5"/></svg>') 12 12, text`
    return 'default'
  }

  // 阻止背景滚动和键盘事件
  useEffect(() => {
    // 禁止背景滚动
    document.body.style.overflow = 'hidden'
    
    // ESC 键关闭
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      // 恢复背景滚动
      document.body.style.overflow = 'auto'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // 画布触摸板滑动和鼠标滚轮事件处理（使用原生 addEventListener 以支持 passive: false）
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e) => {
      e.preventDefault()
      e.stopPropagation()
      
      // 判断是缩放操作还是滑动操作
      // 缩放：Ctrl键 + 滚轮（触摸板双指捏合）或者手模式下的鼠标滚轮
      // 滑动：触摸板双指滑动（有deltaX或deltaY，但没有Ctrl键）
      
      if (e.ctrlKey || (selectedTool === 'hand' && Math.abs(e.deltaX) === 0 && Math.abs(e.deltaY) >= 50)) {
        // 缩放画布（触摸板双指捏合 或 手模式下的鼠标滚轮）
        const delta = -e.deltaY
        const zoomChange = Math.abs(delta) > 50 ? (delta > 0 ? 3 : -3) : (delta > 0 ? 2 : -2)
        setZoom(prev => {
          const newZoom = prev + zoomChange
          return Math.min(Math.max(newZoom, 50), 200)
        })
      } else {
        // 触摸板滑动：移动画布
        const newPanOffset = {
          x: panOffset.x - e.deltaX,
          y: panOffset.y - e.deltaY
        }
        setPanOffset(newPanOffset)
        
        // 同步更新滚动条位置
        const canvasRect = canvas.getBoundingClientRect()
        if (canvasRect) {
          setScrollPos({
            x: canvasRect.width / 2 - newPanOffset.x,
            y: canvasRect.height / 2 - newPanOffset.y
          })
        }
      }
    }

    // 必须使用 addEventListener 并设置 passive: false
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [panOffset, selectedTool]) // 添加依赖

  // 当编辑注释时，手动设置焦点
  useEffect(() => {
    if (editingNote && noteInputRef.current) {
      // 延迟设置焦点，确保 DOM 已渲染
      setTimeout(() => {
        noteInputRef.current?.focus()
      }, 50)
    }
  }, [editingNote])

  // 指针模式下的键盘事件：Del 键删除选中的元素
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 只在指针模式下响应
      if (selectedTool !== 'pointer') return
      // 如果正在编辑注释，不响应
      if (editingNote) return
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        
        // 删除选中的节点
        if (selectedNodes.length > 0) {
          setNodes(prev => prev.filter(node => !selectedNodes.includes(node.id)))
          setSelectedNodes([])
        }
        // 删除选中的注释
        if (selectedNotes.length > 0) {
          setNotes(prev => prev.filter(note => !selectedNotes.includes(note.id)))
          setSelectedNotes([])
        }
        // 删除选中的单个节点
        if (selectedNode && selectedNodes.length === 0) {
          setNodes(prev => prev.filter(node => node.id !== selectedNode.id))
          setSelectedNode(null)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTool, selectedNodes, selectedNotes, selectedNode, editingNote])

  return (
    <div 
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div 
        className={`w-[90vw] h-[90vh] rounded-2xl shadow-2xl relative flex overflow-hidden transition-colors ${
          isDarkCanvas ? 'bg-gray-900' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧工具栏 */}
        <div className={`w-56 border-r flex flex-col transition-colors ${
          isDarkCanvas ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}>
          {/* 工具栏头部 */}
          <div className={`p-4 border-b transition-colors ${
            isDarkCanvas ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <h3 className={`text-sm font-semibold mb-3 transition-colors ${
              isDarkCanvas ? 'text-white' : 'text-gray-700'
            }`}>节点库</h3>
            
            {/* 搜索框 */}
            <div className="relative">
              <input 
                type="text"
                placeholder="搜索节点..."
                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  isDarkCanvas 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
              <Search className={`absolute right-3 top-2.5 w-4 h-4 transition-colors ${
                isDarkCanvas ? 'text-gray-400' : 'text-gray-400'
              }`} />
            </div>
          </div>

          {/* 常用节点 + 分类列表 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* 常用节点区域 - 始终显示 */}
            <div>
              <div className={`text-xs font-medium mb-2 px-1 ${
                isDarkCanvas ? 'text-white/50' : 'text-gray-500'
              }`}>常用节点</div>
              <div className="space-y-1.5">
                {commonNodes.map((node, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('nodeType', JSON.stringify(node))
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    className={`p-3 border rounded-lg cursor-move transition-all group/node ${
                      isDarkCanvas 
                        ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-700 hover:border-gray-500' 
                        : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 bg-${node.color}-100 rounded-lg flex items-center justify-center group-hover/node:scale-105 transition-transform`}>
                        {renderIcon(node.icon, `w-5 h-5 text-${node.color}-600`)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${
                          isDarkCanvas ? 'text-white' : 'text-gray-900'
                        }`}>{node.label}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 分隔线 */}
            <div className={`border-t ${
              isDarkCanvas ? 'border-gray-700' : 'border-gray-200'
            }`} />

            {/* 分类列表 - 可折叠 */}
            <div className="space-y-2">
              <div className={`text-xs font-medium mb-2 px-1 ${
                isDarkCanvas ? 'text-white/50' : 'text-gray-500'
              }`}>按分类查看</div>
              {nodeCategories.map((category) => {
                const categoryNodes = getNodesByCategory(category.id)
                return (
                  <div key={category.id} className="relative">
                    {/* 分类按钮 */}
                    <button
                      onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
                      className={`w-full px-3 py-2.5 border rounded-lg text-sm text-left transition-all flex items-center justify-between group ${
                        isDarkCanvas 
                          ? 'bg-transparent border-white/10 text-white/90 hover:bg-white/5' 
                          : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {renderIcon(category.icon, `w-4 h-4 ${
                          isDarkCanvas ? 'text-white/70' : 'text-gray-600'
                        }`)}
                        <span className="font-medium">{category.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          isDarkCanvas ? 'bg-white/10 text-white/60' : 'bg-gray-200 text-gray-600'
                        }`}>{categoryNodes.length}</span>
                      </div>
                      <svg 
                        className={`w-4 h-4 transition-transform duration-300 ${
                          isDarkCanvas ? 'text-white/70' : 'text-gray-500'
                        }`}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        {expandedCategory === category.id ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        )}
                      </svg>
                    </button>
                    
                    {/* 展开的节点列表 */}
                    {expandedCategory === category.id && (
                      <div className={`mt-1.5 p-2 border rounded-lg space-y-1.5 ${
                        isDarkCanvas 
                          ? 'bg-gray-800/50 border-gray-700' 
                          : 'bg-gray-50 border-gray-200'
                      }`}>
                        {categoryNodes.length === 0 ? (
                          <div className={`text-center py-4 text-xs ${
                            isDarkCanvas ? 'text-gray-500' : 'text-gray-400'
                          }`}>
                            暂无节点
                          </div>
                        ) : (
                          categoryNodes.map((node, idx) => (
                            <div
                              key={idx}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('nodeType', JSON.stringify(node))
                                e.dataTransfer.effectAllowed = 'copy'
                              }}
                              className={`p-2.5 border rounded-lg cursor-move transition-all group/node ${
                                isDarkCanvas 
                                  ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-700 hover:border-gray-500' 
                                  : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 bg-${node.color}-100 rounded-lg flex items-center justify-center group-hover/node:scale-105 transition-transform`}>
                                  {renderIcon(node.icon, `w-4 h-4 text-${node.color}-600`)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-xs font-medium ${
                                    isDarkCanvas ? 'text-white' : 'text-gray-900'
                                  }`}>{node.label}</div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 中间画布区域 */}
        <div className={`flex-1 relative transition-colors ${isDarkCanvas ? 'bg-gray-900' : 'bg-gray-100'}`}>
          {/* 左侧工具栏 - 居中 */}
          <div className={`absolute left-6 top-1/2 -translate-y-1/2 w-14 rounded-2xl shadow-xl border flex flex-col items-center py-4 gap-1.5 transition-colors z-20 pointer-events-none ${
            isDarkCanvas ? 'bg-gray-900/95 border-gray-700 backdrop-blur-sm' : 'bg-white/95 border-gray-200 backdrop-blur-sm'
          }`}>
            {/* 1. 添加节点 */}
            <button
              onClick={() => {
                setSelectedTool('add')
                setShowNodeLibraryModal(true)
                setIsAddingNote(false)
              }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all pointer-events-auto ${
                selectedTool === 'add'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : isDarkCanvas
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
              title="添加节点"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* 2. 添加描述 */}
            <button
              onClick={() => {
                setSelectedTool('note')
                setIsAddingNote(true)
              }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all pointer-events-auto ${
                selectedTool === 'note'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : isDarkCanvas
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
              title="添加描述"
            >
              <FileText className="w-4 h-4" />
            </button>

            {/* 3. 指针模式 */}
            <button
              onClick={() => {
                setSelectedTool('pointer')
                setIsAddingNote(false)
              }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all pointer-events-auto ${
                selectedTool === 'pointer'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : isDarkCanvas
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
              title="指针模式（框选）"
            >
              <MousePointer2 className="w-4 h-4" />
            </button>

            {/* 4. 手模式（拖动画布） */}
            <button
              onClick={() => {
                setSelectedTool('hand')
                setIsAddingNote(false)
              }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all pointer-events-auto ${
                selectedTool === 'hand'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : isDarkCanvas
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
              title="手模式（拖动画布）"
            >
              <Hand className="w-4 h-4" />
            </button>

            {/* 5. 切换网格/点状背景 */}
            <button
              onClick={() => setShowGridBackground(!showGridBackground)}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all pointer-events-auto ${
                showGridBackground
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : isDarkCanvas
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
              title={showGridBackground ? '切换为点状背景' : '切换为网格背景'}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>

            {/* 6. 自适应画布 */}
            <button
              onClick={handleFitCanvas}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all pointer-events-auto ${
                isDarkCanvas
                  ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
              title="自适应画布（居中所有节点）"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          
          {/* 顶部工具栏 */}
          <div className={`absolute top-0 left-0 right-0 h-16 border-b flex items-center justify-between px-6 z-10 transition-colors ${
            isDarkCanvas ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <h2 className={`text-lg font-semibold transition-colors ${
                isDarkCanvas ? 'text-white' : 'text-gray-900'
              }`}>新建工作流</h2>
              <input 
                type="text"
                placeholder="未命名工作流"
                className={`px-3 py-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48 transition-colors ${
                  isDarkCanvas 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-gray-50 border-gray-200 text-gray-900'
                }`}
              />
            </div>
            
            <div className="flex items-center gap-2">
              {/* 背景色切换按钮 */}
              <button
                onClick={() => setIsDarkCanvas(!isDarkCanvas)}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all hover:scale-110 ${
                  isDarkCanvas ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20'
                }`}
                title={`切换画布背景（当前：${isDarkCanvas ? '黑色' : '白色'}）`}
              >
                <svg className={`w-6 h-6 transition-colors ${
                  isDarkCanvas ? 'text-white' : 'text-black'
                }`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C12 2 9 4 9 7C9 7 7 9 4 9C4 9 6 10 6 12C6 12 4 13 2 13C2 13 4 14 4 16C4 14 6 14 6 16C6 18 4 20 4 22C6 20 8 18 10 18C10 20 11 22 12 22C13 22 14 20 14 18C16 18 18 20 20 22C20 20 18 18 18 16C18 14 20 14 20 16C20 14 22 13 22 13C20 13 18 12 18 12C18 10 20 9 20 9C17 9 15 7 15 7C15 4 12 2 12 2M12 9A1 1 0 0 1 13 10A1 1 0 0 1 12 11A1 1 0 0 1 11 10A1 1 0 0 1 12 9Z" />
                </svg>
              </button>
              
              <button 
                className={`p-2 rounded-lg transition-colors ${
                  isDarkCanvas ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="导入"
              >
                <Upload className="w-5 h-5" />
              </button>
              <button 
                className={`p-2 rounded-lg transition-colors ${
                  isDarkCanvas ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="导出"
              >
                <Download className="w-5 h-5" />
              </button>
              <div className={`w-px h-6 transition-colors ${
                isDarkCanvas ? 'bg-gray-600' : 'bg-gray-300'
              }`} />
              
              <button 
                className="p-2 text-blue-600 hover:bg-blue-600/10 rounded-lg transition-colors"
                title="保存"
              >
                <Save className="w-5 h-5" />
              </button>
              <button 
                className="p-2 text-emerald-600 hover:bg-emerald-600/10 rounded-lg transition-colors"
                title="运行"
              >
                <Play className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 画布网格背景 - 无限画布实现 */}
          <div 
            ref={canvasRef}
            className="absolute inset-0 top-16 overflow-hidden"
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
          >
            {/* 画布内容 - 虚拟坐标系 */}
            <div 
              className="relative w-full h-full select-none"
              style={{
                cursor: getCanvasCursor(),
                // 背景样式：点状或网格
                backgroundImage: showGridBackground
                  ? (isDarkCanvas 
                      ? 'linear-gradient(to right, #4b5563 1px, transparent 1px), linear-gradient(to bottom, #4b5563 1px, transparent 1px)'
                      : 'linear-gradient(to right, #d1d5db 1px, transparent 1px), linear-gradient(to bottom, #d1d5db 1px, transparent 1px)')
                  : (isDarkCanvas 
                      ? 'radial-gradient(circle, #4b5563 1px, transparent 1px)'
                      : 'radial-gradient(circle, #d1d5db 1px, transparent 1px)'),
                backgroundSize: `${20 * (zoom / 100)}px ${20 * (zoom / 100)}px`,
                backgroundPosition: `${panOffset.x}px ${panOffset.y}px`
              }}
              onMouseDown={(e) => {
                // 添加描述模式
                if (isAddingNote) {
                  handleCanvasClickForNote(e)
                  return
                }
                
                // 指针模式：开始框选
                if (selectedTool === 'pointer' && e.button === 0) {
                  const canvasRect = canvasRef.current.getBoundingClientRect()
                  const startX = (e.clientX - canvasRect.left - panOffset.x) / (zoom / 100)
                  const startY = (e.clientY - canvasRect.top - 64 - panOffset.y) / (zoom / 100)
                  setSelectionBox({ startX, startY, endX: startX, endY: startY })
                  e.preventDefault()
                  return
                }
                
                // 手模式下可以拖动画布
                if (selectedTool === 'hand' && (e.button === 0 || e.button === 1 || (e.button === 0 && e.shiftKey))) {
                  setIsPanning(true)
                  e.preventDefault()
                }
              }}
              onMouseMove={(e) => {
                // 指针模式：拖动元素（节点或注释）
                if (selectedTool === 'pointer' && draggingElement && dragStart) {
                  const canvasRect = canvasRef.current.getBoundingClientRect()
                  
                  if (draggingElement.type === 'node') {
                    // 节点在 transform 容器内，使用虚拟坐标
                    const currentX = (e.clientX - canvasRect.left - panOffset.x) / (zoom / 100)
                    const currentY = (e.clientY - canvasRect.top - 64 - panOffset.y) / (zoom / 100)
                    const deltaX = currentX - dragStart.x
                    const deltaY = currentY - dragStart.y
                    
                    // 检测是否移动了足够的距离（超过 3 像素算拖动）
                    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                      isDraggingRef.current = true
                    }
                    
                    setNodes(prev => prev.map(node => 
                      node.id === draggingElement.id 
                        ? { ...node, x: dragStart.nodeX + deltaX, y: dragStart.nodeY + deltaY }
                        : node
                    ))
                  } else if (draggingElement.type === 'note') {
                    // 注释在画布坐标系统中，使用画布坐标
                    const currentX = e.clientX - canvasRect.left
                    const currentY = e.clientY - canvasRect.top - 64
                    const deltaX = (currentX - dragStart.x) / (zoom / 100)
                    const deltaY = (currentY - dragStart.y) / (zoom / 100)
                    
                    // 检测是否移动了足够的距离
                    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                      isDraggingRef.current = true
                    }
                    
                    setNotes(prev => prev.map(note => 
                      note.id === draggingElement.id 
                        ? { ...note, x: dragStart.noteX + deltaX, y: dragStart.noteY + deltaY }
                        : note
                    ))
                  }
                  return
                }
                
                // 指针模式：更新框选区域
                if (selectedTool === 'pointer' && selectionBox) {
                  const canvasRect = canvasRef.current.getBoundingClientRect()
                  const endX = (e.clientX - canvasRect.left - panOffset.x) / (zoom / 100)
                  const endY = (e.clientY - canvasRect.top - 64 - panOffset.y) / (zoom / 100)
                  setSelectionBox({ ...selectionBox, endX, endY })
                  return
                }
                
                // 手模式：拖动画布
                if (isPanning && !isDraggingScrollbar) {
                  const newPanOffset = {
                    x: panOffset.x + e.movementX,
                    y: panOffset.y + e.movementY
                  }
                  setPanOffset(newPanOffset)
                  
                  // 同步更新滚动条位置
                  const canvasRect = canvasRef.current?.getBoundingClientRect()
                  if (canvasRect) {
                    setScrollPos({
                      x: canvasRect.width / 2 - newPanOffset.x,
                      y: canvasRect.height / 2 - newPanOffset.y
                    })
                  }
                }
              }}
              onMouseUp={() => {
                // 结束拖动
                if (draggingElement) {
                  setDraggingElement(null)
                  setDragStart(null)
                  // 延迟重置 isDraggingRef，防止 onClick 被立即触发
                  requestAnimationFrame(() => {
                    isDraggingRef.current = false
                  })
                  return
                }
                
                // 指针模式：完成框选，选中框内节点和注释
                if (selectedTool === 'pointer' && selectionBox) {
                  const minX = Math.min(selectionBox.startX, selectionBox.endX)
                  const maxX = Math.max(selectionBox.startX, selectionBox.endX)
                  const minY = Math.min(selectionBox.startY, selectionBox.endY)
                  const maxY = Math.max(selectionBox.startY, selectionBox.endY)
                  
                  // 选中节点
                  const selectedNodeIds = nodes.filter(node => {
                    const nodeCenterX = node.x + 96 // 节点宽度一半
                    const nodeCenterY = node.y + 40 // 节点高度一半
                    return nodeCenterX >= minX && nodeCenterX <= maxX && 
                           nodeCenterY >= minY && nodeCenterY <= maxY
                  }).map(n => n.id)
                  
                  // 选中注释
                  const selectedNoteIds = notes.filter(note => {
                    const noteCenterX = note.x + 100 // 注释宽度一半
                    const noteCenterY = note.y + 50  // 注释高度一半
                    return noteCenterX >= minX && noteCenterX <= maxX && 
                           noteCenterY >= minY && noteCenterY <= maxY
                  }).map(n => n.id)
                  
                  setSelectedNodes(selectedNodeIds)
                  setSelectedNotes(selectedNoteIds)
                  setSelectionBox(null)
                }
                
                setIsPanning(false)
              }}
              onMouseLeave={() => {
                setIsPanning(false)
                setSelectionBox(null)
                setDraggingElement(null)
                setDragStart(null)
                isDraggingRef.current = false
              }}
            >
              {/* 节点容器 - 使用transform映射到虚拟坐标 */}
              <div
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom / 100})`,
                  transformOrigin: '0 0',
                  willChange: 'transform',
                  position: 'absolute',
                  left: 0,
                  top: 0
                }}
              >
              {/* 节点 */}
              {nodes.map((node) => (
                <div
                  key={node.id}
                  onClick={(e) => {
                    if (selectedTool === 'pointer' && !isDraggingRef.current) {
                      // 指针模式下单击选中（仅当不是拖动时）
                      e.stopPropagation()
                      setSelectedNode(node)
                    }
                  }}
                  onDoubleClick={(e) => {
                    if (selectedTool === 'pointer') {
                      // 指针模式下双击进入编辑（预留，后续可实现节点编辑）
                      e.stopPropagation()
                      console.log('双击节点:', node.label)
                    }
                  }}
                  onMouseDown={(e) => {
                    if (selectedTool === 'pointer' && e.button === 0) {
                      // 指针模式下开始拖动
                      e.stopPropagation()
                      isDraggingRef.current = false // 初始化为 false
                      setDraggingElement({ type: 'node', id: node.id })
                      const canvasRect = canvasRef.current.getBoundingClientRect()
                      setDragStart({
                        x: (e.clientX - canvasRect.left - panOffset.x) / (zoom / 100),
                        y: (e.clientY - canvasRect.top - 64 - panOffset.y) / (zoom / 100),
                        nodeX: node.x,
                        nodeY: node.y
                      })
                    }
                  }}
                  className={`absolute w-48 rounded-xl shadow-lg border-2 transition-all hover:shadow-xl select-none ${
                    selectedTool === 'pointer' ? 'cursor-move' : 'cursor-pointer'
                  } ${
                    isDarkCanvas ? 'bg-gray-800' : 'bg-white'
                  } ${
                    selectedNodes.includes(node.id)
                      ? 'border-blue-500 ring-4 ring-blue-500/30'
                      : selectedNode?.id === node.id 
                      ? 'border-blue-500 ring-4 ring-blue-100' 
                      : isDarkCanvas ? 'border-gray-600' : 'border-gray-200'
                  }`}
                  style={{ 
                    left: node.x, 
                    top: node.y 
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isDarkCanvas ? 'bg-blue-900/50' : 'bg-blue-100'
                      }`}>
                        {renderIcon(node.icon, `w-5 h-5 ${
                          isDarkCanvas ? 'text-blue-400' : 'text-blue-600'
                        }`)}
                      </div>
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${
                          isDarkCanvas ? 'text-white' : 'text-gray-900'
                        }`}>{node.label}</div>
                        <div className={`text-xs ${
                          isDarkCanvas ? 'text-gray-400' : 'text-gray-500'
                        }`}>{node.type}</div>
                      </div>
                    </div>
                    
                    {/* 输入输出端口 */}
                    <div className={`flex justify-between items-center text-xs ${
                      isDarkCanvas ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${
                          isDarkCanvas ? 'bg-gray-600' : 'bg-gray-300'
                        }`} />
                        输入
                      </div>
                      <div className="flex items-center gap-1">
                        输出
                        <div className={`w-2 h-2 rounded-full ${
                          isDarkCanvas ? 'bg-gray-600' : 'bg-gray-300'
                        }`} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* 连接线（示例） */}
              <svg 
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  overflow: 'visible'
                }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3, 0 6" fill={isDarkCanvas ? '#6b7280' : '#94a3b8'} />
                  </marker>
                </defs>
                {nodes.slice(0, -1).map((node, idx) => {
                  const nextNode = nodes[idx + 1]
                  return (
                    <line
                      key={idx}
                      x1={node.x + 192}
                      y1={node.y + 40}
                      x2={nextNode.x}
                      y2={nextNode.y + 40}
                      stroke={isDarkCanvas ? '#6b7280' : '#94a3b8'}
                      strokeWidth="2"
                      markerEnd="url(#arrowhead)"
                    />
                  )
                })}
              </svg>
              </div>

              {/* 注释层 - 独立于 transform 容器，直接在画布坐标系统中 */}
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`absolute rounded-lg shadow-lg border-2 transition-all ${
                    isAddingNote ? 'pointer-events-none' : 'pointer-events-auto'
                  } ${
                    selectedTool === 'pointer' ? 'cursor-move' : ''
                  } ${
                    selectedNotes.includes(note.id)
                      ? 'border-blue-500 ring-4 ring-blue-500/30'
                      : isDarkCanvas ? 'bg-yellow-900/20 border-yellow-600/50' : 'bg-yellow-50 border-yellow-400'
                  }`}
                  style={{ 
                    left: note.x * (zoom / 100) + panOffset.x,
                    top: note.y * (zoom / 100) + panOffset.y,
                    minWidth: '200px',
                    minHeight: '100px',
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: '0 0'
                  }}
                  onClick={(e) => {
                    if (!isAddingNote && selectedTool !== 'pointer') {
                      e.stopPropagation()
                    }
                    if (selectedTool === 'pointer') {
                      e.stopPropagation()
                    }
                  }}
                  onDoubleClick={(e) => {
                    if (selectedTool === 'pointer') {
                      // 指针模式下双击进入编辑
                      e.stopPropagation()
                      setEditingNote(note.id)
                    }
                  }}
                  onMouseDown={(e) => {
                    if (selectedTool === 'pointer' && e.button === 0 && editingNote !== note.id) {
                      // 指针模式下开始拖动（非编辑状态）
                      e.stopPropagation()
                      setDraggingElement({ type: 'note', id: note.id })
                      const canvasRect = canvasRef.current.getBoundingClientRect()
                      // 注释现在在画布坐标系统中，直接使用屏幕坐标
                      setDragStart({
                        x: e.clientX - canvasRect.left,
                        y: e.clientY - canvasRect.top - 64,
                        noteX: note.x,
                        noteY: note.y
                      })
                    }
                  }}
                >
                  {/* 注释图标 */}
                  <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center shadow-md ${
                    isDarkCanvas ? 'bg-yellow-600' : 'bg-yellow-400'
                  }`}>
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  
                  {/* 文本区域 */}
                  {editingNote === note.id ? (
                    <textarea
                      ref={noteInputRef}
                      value={note.text}
                      onChange={(e) => {
                        setNotes(prev => prev.map(n => 
                          n.id === note.id ? { ...n, text: e.target.value } : n
                        ))
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                      }}
                      onBlur={() => {
                        // 延迟检查，避免刚创建就被删除
                        setTimeout(() => {
                          if (editingNote === note.id && !note.text.trim()) {
                            // 如果没有输入内容，删除注释
                            setNotes(prev => prev.filter(n => n.id !== note.id))
                          }
                          if (editingNote === note.id) {
                            setEditingNote(null)
                          }
                        }, 150)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          if (!note.text.trim()) {
                            setNotes(prev => prev.filter(n => n.id !== note.id))
                          }
                          setEditingNote(null)
                          e.stopPropagation()
                        }
                      }}
                      className={`w-full h-full p-4 rounded-lg resize-none outline-none transition-colors ${
                        isDarkCanvas 
                          ? 'bg-yellow-900/30 text-yellow-100 placeholder-yellow-500/50' 
                          : 'bg-yellow-50 text-gray-900 placeholder-gray-400'
                      }`}
                      placeholder="输入注释..."
                      style={{ minHeight: '100px' }}
                    />
                  ) : (
                    <div
                      onClick={(e) => {
                        if (selectedTool !== 'pointer') {
                          // 非指针模式下点击进入编辑
                          setEditingNote(note.id)
                        }
                      }}
                      onDoubleClick={(e) => {
                        if (selectedTool === 'pointer') {
                          // 指针模式下双击进入编辑
                          setEditingNote(note.id)
                        }
                      }}
                      className={`p-4 whitespace-pre-wrap transition-colors ${
                        selectedTool === 'pointer' ? '' : 'cursor-pointer'
                      } ${
                        isDarkCanvas ? 'text-yellow-100' : 'text-gray-900'
                      }`}
                      style={{ minHeight: '100px' }}
                    >
                      {note.text || '点击编辑...'}
                    </div>
                  )}
                  
                  {/* 删除按钮 */}
                  {!editingNote && (
                    <button
                      onClick={() => setNotes(prev => prev.filter(n => n.id !== note.id))}
                      className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-colors ${
                        isDarkCanvas 
                          ? 'bg-gray-700 hover:bg-red-600 text-gray-300' 
                          : 'bg-white hover:bg-red-500 text-gray-600 hover:text-white'
                      }`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              
              {/* 框选区域 */}
              {selectionBox && (
                <div
                  className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                  style={{
                    left: Math.min(selectionBox.startX, selectionBox.endX) * (zoom / 100) + panOffset.x,
                    top: Math.min(selectionBox.startY, selectionBox.endY) * (zoom / 100) + panOffset.y,
                    width: Math.abs(selectionBox.endX - selectionBox.startX) * (zoom / 100),
                    height: Math.abs(selectionBox.endY - selectionBox.startY) * (zoom / 100)
                  }}
                />
              )}
            </div>
            
            {/* 水平滚动条 - 扣子空间风格 */}
            <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 h-2 rounded-full transition-all z-30 ${
              isDarkCanvas ? 'bg-gray-800/60' : 'bg-gray-200/80'
            }`}
            style={{
              width: `${Math.max(100, Math.min(300, (canvasRef.current?.getBoundingClientRect().width || 1000) * 0.3))}px`
            }}>
              <div
                className={`h-full rounded-full transition-all relative ${
                  isDarkCanvas ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-400 hover:bg-gray-500'
                }`}
                style={{
                  width: `${Math.max(20, Math.min(100, ((canvasRef.current?.getBoundingClientRect().width || 1000) / virtualCanvasWidth) * 100))}%`,
                  left: `${(scrollPos.x / virtualCanvasWidth) * 100}%`,
                  cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="%23dc2626" stroke="%23000" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="%23fff"/><circle cx="20" cy="12" r="3" fill="%23fff"/><path d="M 10 20 Q 16 24 22 20" stroke="%23000" stroke-width="2" fill="none"/><path d="M 16 2 L 14 8 M 16 2 L 18 8" stroke="%23dc2626" stroke-width="1.5"/></svg>') 16 16, grab`
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  setIsDraggingScrollbar(true)
                  
                  // 设置拖动时的光标样式
                  document.body.style.cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="%23dc2626" stroke="%23000" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="%23fff"/><circle cx="20" cy="12" r="3" fill="%23fff"/><path d="M 10 20 Q 16 24 22 20" stroke="%23000" stroke-width="2" fill="none"/><path d="M 16 2 L 14 8 M 16 2 L 18 8" stroke="%23dc2626" stroke-width="1.5"/></svg>') 16 16, grabbing`
                  
                  const startX = e.clientX
                  const startScrollX = scrollPos.x
                  const scrollBarWidth = canvasRef.current?.getBoundingClientRect().width * 0.3 || 300
                  
                  const handleMouseMove = (moveE) => {
                    moveE.preventDefault()
                    const deltaX = moveE.clientX - startX
                    const scrollDelta = (deltaX / scrollBarWidth) * virtualCanvasWidth
                    handleScrollBarChange('x', startScrollX + scrollDelta)
                  }
                  
                  const handleMouseUp = () => {
                    setIsDraggingScrollbar(false)
                    document.body.style.cursor = '' // 恢复默认光标
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }
                  
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                }}
              />
            </div>

            {/* 垂直滚动条 - 扣子空间风格 */}
            <div className={`absolute right-2 top-1/2 -translate-y-1/2 w-2 rounded-full transition-all z-30 ${
              isDarkCanvas ? 'bg-gray-800/60' : 'bg-gray-200/80'
            }`}
            style={{
              height: `${Math.max(100, Math.min(300, (canvasRef.current?.getBoundingClientRect().height || 800) * 0.3))}px`
            }}>
              <div
                className={`w-full rounded-full transition-all relative ${
                  isDarkCanvas ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-400 hover:bg-gray-500'
                }`}
                style={{
                  height: `${Math.max(20, Math.min(100, ((canvasRef.current?.getBoundingClientRect().height || 800) / virtualCanvasHeight) * 100))}%`,
                  top: `${(scrollPos.y / virtualCanvasHeight) * 100}%`,
                  cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="%23dc2626" stroke="%23000" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="%23fff"/><circle cx="20" cy="12" r="3" fill="%23fff"/><path d="M 10 20 Q 16 24 22 20" stroke="%23000" stroke-width="2" fill="none"/><path d="M 16 2 L 14 8 M 16 2 L 18 8" stroke="%23dc2626" stroke-width="1.5"/></svg>') 16 16, grab`
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  setIsDraggingScrollbar(true)
                  
                  // 设置拖动时的光标样式
                  document.body.style.cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="%23dc2626" stroke="%23000" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="%23fff"/><circle cx="20" cy="12" r="3" fill="%23fff"/><path d="M 10 20 Q 16 24 22 20" stroke="%23000" stroke-width="2" fill="none"/><path d="M 16 2 L 14 8 M 16 2 L 18 8" stroke="%23dc2626" stroke-width="1.5"/></svg>') 16 16, grabbing`
                  
                  const startY = e.clientY
                  const startScrollY = scrollPos.y
                  const scrollBarHeight = canvasRef.current?.getBoundingClientRect().height * 0.3 || 300
                  
                  const handleMouseMove = (moveE) => {
                    moveE.preventDefault()
                    const deltaY = moveE.clientY - startY
                    const scrollDelta = (deltaY / scrollBarHeight) * virtualCanvasHeight
                    handleScrollBarChange('y', startScrollY + scrollDelta)
                  }
                  
                  const handleMouseUp = () => {
                    setIsDraggingScrollbar(false)
                    document.body.style.cursor = '' // 恢复默认光标
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }
                  
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                }}
              />
            </div>
          </div>

          {/* 缩略图 */}
          {showMinimap && (
            <div className={`absolute bottom-6 right-24 w-48 h-32 rounded-lg shadow-2xl border overflow-hidden backdrop-blur-sm transition-colors ${
              isDarkCanvas ? 'bg-gray-800/80 border-gray-700/50' : 'bg-white/80 border-gray-300/50'
            }`}>
              {/* 缩略图画布 */}
              <div className="relative w-full h-full">
                <div className={`w-full h-full transition-colors ${
                  isDarkCanvas ? 'bg-gray-900/50' : 'bg-gray-100/50'
                }`}>
                  {/* 网格背景 */}
                  <div 
                    className="absolute inset-0 opacity-30"
                    style={{
                      backgroundImage: isDarkCanvas 
                        ? 'linear-gradient(to right, #4b5563 1px, transparent 1px), linear-gradient(to bottom, #4b5563 1px, transparent 1px)'
                        : 'linear-gradient(to right, #d1d5db 1px, transparent 1px), linear-gradient(to bottom, #d1d5db 1px, transparent 1px)',
                      backgroundSize: '10px 10px'
                    }}
                  />
                  
                  {/* 缩小的节点 */}
                  {nodes.map((node) => {
                    const scale = 0.1 // 缩放比例
                    // 计算节点在缩略图中的位置
                    const miniX = (node.x * scale * (zoom / 100)) + (panOffset.x * scale) + 70
                    const miniY = (node.y * scale * (zoom / 100)) + (panOffset.y * scale) + 50
                    return (
                      <div
                        key={node.id}
                        className="absolute w-3 h-3 rounded transition-all"
                        style={{
                          left: `${miniX}px`,
                          top: `${miniY}px`,
                          backgroundColor: isDarkCanvas ? '#60a5fa' : '#3b82f6',
                          boxShadow: '0 0 4px rgba(59, 130, 246, 0.5)'
                        }}
                      />
                    )
                  })}
                  
                  {/* 当前视图框 */}
                  <div 
                    className="absolute border-2 rounded pointer-events-none"
                    style={{
                      borderColor: isDarkCanvas ? '#60a5fa' : '#3b82f6',
                      left: '50%',
                      top: '50%',
                      width: `${80 / (zoom / 100)}px`,
                      height: `${50 / (zoom / 100)}px`,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: isDarkCanvas ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.1)'
                    }}
                  />
                </div>
                
                {/* 关闭按钮 */}
                <button
                  onClick={() => setShowMinimap(false)}
                  className={`absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center transition-colors ${
                    isDarkCanvas ? 'hover:bg-gray-700/50' : 'hover:bg-gray-200/50'
                  }`}
                >
                  <X className={`w-3 h-3 transition-colors ${
                    isDarkCanvas ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                </button>
              </div>
            </div>
          )}
          
          {/* 显示/隐藏缩略图按钮 */}
          {!showMinimap && (
            <button
              onClick={() => setShowMinimap(true)}
              className={`absolute bottom-6 right-24 px-3 py-2 rounded-lg shadow-lg border transition-all flex items-center gap-2 ${
                isDarkCanvas 
                  ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              title="显示缩略图"
            >
              <Maximize2 className="w-4 h-4" />
              <span className="text-xs">缩略图</span>
            </button>
          )}

          {/* 右下角缩放控制 */}
          <div className={`absolute bottom-6 right-6 flex items-center gap-2 rounded-lg shadow-lg border p-2 transition-colors ${
            isDarkCanvas ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <button 
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                isDarkCanvas ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="缩小 (最小50%)"
            >
              <span className="text-lg">-</span>
            </button>
            <button
              onClick={handleResetZoom}
              className={`text-sm w-16 text-center transition-colors cursor-pointer hover:font-semibold ${
                isDarkCanvas ? 'text-gray-300' : 'text-gray-600'
              }`}
              title="重置缩放"
            >
              {zoom}%
            </button>
            <button 
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                isDarkCanvas ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="放大 (最大200%)"
            >
              <span className="text-lg">+</span>
            </button>
          </div>
        </div>

        {/* 右侧属性面板 */}
        {selectedNode && (
          <div className={`w-80 border-l flex flex-col transition-colors ${
            isDarkCanvas ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between transition-colors ${
              isDarkCanvas ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <h3 className={`text-sm font-semibold transition-colors ${
                isDarkCanvas ? 'text-white' : 'text-gray-700'
              }`}>节点配置</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                  isDarkCanvas ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <X className={`w-4 h-4 transition-colors ${
                  isDarkCanvas ? 'text-gray-400' : 'text-gray-500'
                }`} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-2 transition-colors ${
                  isDarkCanvas ? 'text-gray-300' : 'text-gray-700'
                }`}>节点名称</label>
                <input 
                  type="text"
                  value={selectedNode.label}
                  className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    isDarkCanvas 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              
              <div>
                <label className={`block text-xs font-medium mb-2 transition-colors ${
                  isDarkCanvas ? 'text-gray-300' : 'text-gray-700'
                }`}>节点类型</label>
                <div className={`px-3 py-2 text-sm border rounded-lg transition-colors ${
                  isDarkCanvas 
                    ? 'bg-gray-700 border-gray-600 text-gray-300' 
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}>
                  {selectedNode.type}
                </div>
              </div>

              {selectedNode.type === 'llm' && (
                <>
                  <div>
                    <label className={`block text-xs font-medium mb-2 transition-colors ${
                      isDarkCanvas ? 'text-gray-300' : 'text-gray-700'
                    }`}>模型选择</label>
                    <select className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      isDarkCanvas 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}>
                      <option>GPT-4</option>
                      <option>Claude-3</option>
                      <option>Qwen-Max</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className={`block text-xs font-medium mb-2 transition-colors ${
                      isDarkCanvas ? 'text-gray-300' : 'text-gray-700'
                    }`}>提示词模板</label>
                    <textarea 
                      className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-colors ${
                        isDarkCanvas 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                      rows="4"
                      placeholder="输入提示词模板..."
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-xs font-medium mb-2 transition-colors ${
                      isDarkCanvas ? 'text-gray-300' : 'text-gray-700'
                    }`}>温度</label>
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      defaultValue="0.7"
                      className="w-full"
                    />
                    <div className={`flex justify-between text-xs mt-1 transition-colors ${
                      isDarkCanvas ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      <span>精确</span>
                      <span>0.7</span>
                      <span>创意</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 节点库弹窗 */}
        {showNodeLibraryModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowNodeLibraryModal(false)}
          >
            <div 
              className={`w-[600px] max-h-[70vh] rounded-2xl shadow-2xl border overflow-hidden transition-colors ${
                isDarkCanvas ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 弹窗头部 */}
              <div className={`p-4 border-b flex items-center justify-between transition-colors ${
                isDarkCanvas ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <h3 className={`text-lg font-semibold transition-colors ${
                  isDarkCanvas ? 'text-white' : 'text-gray-900'
                }`}>添加节点</h3>
                <button
                  onClick={() => setShowNodeLibraryModal(false)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isDarkCanvas ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 搜索框 */}
              <div className={`p-4 border-b transition-colors ${
                isDarkCanvas ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="搜索节点..."
                    className={`w-full px-4 py-2.5 pl-10 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      isDarkCanvas 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                  <Search className={`absolute left-3 top-3 w-4 h-4 transition-colors ${
                    isDarkCanvas ? 'text-gray-400' : 'text-gray-400'
                  }`} />
                </div>
              </div>

              {/* 节点列表 */}
              <div className="p-4 overflow-y-auto max-h-[calc(70vh-180px)]">
                <div className="grid grid-cols-2 gap-3">
                  {nodeLibrary.map((node, idx) => (
                    <div
                      key={idx}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('nodeType', JSON.stringify(node))
                        setShowNodeLibraryModal(false)
                      }}
                      className={`p-4 border rounded-xl cursor-move hover:shadow-lg transition-all group ${
                        isDarkCanvas ? 'bg-gray-700 border-gray-600 hover:border-blue-500' : 'bg-white border-gray-200 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 bg-${node.color}-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0`}>
                          {renderIcon(node.icon, `w-6 h-6 text-${node.color}-600`)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium mb-1 transition-colors ${
                            isDarkCanvas ? 'text-white' : 'text-gray-900'
                          }`}>{node.label}</div>
                          <div className={`text-xs leading-relaxed transition-colors ${
                            isDarkCanvas ? 'text-gray-400' : 'text-gray-500'
                          }`}>{node.desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 弹窗底部提示 */}
              <div className={`p-3 border-t flex items-center justify-center gap-2 transition-colors ${
                isDarkCanvas ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
              }`}>
                <div className={`text-xs transition-colors ${
                  isDarkCanvas ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  💡 拖动节点到画布中添加
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
