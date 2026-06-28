import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器 - 注入 JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('spider_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// 发送消息
export const sendMessage = (prompt, sessionId = null, images = undefined) => {
  return api.post('/chat', { prompt, session_id: sessionId, images: images && images.length > 0 ? images : undefined })
}

// 发送双答案模式聊天（SSE 流式）
export const sendDualChat = (prompt, sessionId = null, images = undefined) => {
  const token = localStorage.getItem('spider_token')
  return fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      prompt,
      session_id: sessionId,
      mode: 'dual',
      images: images && images.length > 0 ? images : undefined
    })
  })
}

// 上传图片
export const uploadImage = (formData) => {
  return api.post('/chat/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

// 获取会话列表
export const getSessions = () => {
  return api.get('/sessions')
}

// 创建新会话
export const createSession = (data) => {
  return api.post('/sessions', data)
}

// 删除会话
export const deleteSession = (sessionId) => {
  return api.delete(`/sessions/${sessionId}`)
}

// 重命名会话
export const renameSession = (sessionId, title) => {
  return api.patch(`/sessions/${sessionId}`, { title })
}

// 获取会话消息
export const getSessionMessages = (sessionId) => {
  return api.get(`/sessions/${sessionId}/messages`)
}

// 获取好邻居指数
export const getNeighborIndex = () => {
  return api.get('/neighbor-index')
}

// 获取系统状态
export const getSystemStatus = () => {
  return api.get('/status')
}

// 获取 Dashboard 统计数据
export const getDashboardStats = (days = 7) => {
  return api.get('/dashboard/stats', { params: { days } })
}

// ============ Projects API ============
export const getProjects = () => api.get('/projects')
export const createProject = (data) => api.post('/projects', data)
export const deleteProject = (id) => api.delete(`/projects/${id}`)
export const updateProject = (id, data) => api.put(`/projects/${id}`, data)

// 文件列表 — 返回树形结构
export const getProjectFiles = (projectId) => api.get(`/projects/${projectId}/files`)

// 创建文件 — data: {name, content, parent_path}
export const createFile = (projectId, data) => api.post(`/projects/${projectId}/files`, data)

// 创建文件夹 — data: {name, parent_path}
export const createFolder = (projectId, data) => api.post(`/projects/${projectId}/folders`, data)

// 获取文件内容 — filePath 需要 URL 编码
export const getFileContent = (projectId, filePath) =>
  api.get(`/projects/${projectId}/files/${encodeURIComponent(filePath)}`)

// 更新文件 — filePath 需要 URL 编码
export const updateFile = (projectId, filePath, data) =>
  api.put(`/projects/${projectId}/files/${encodeURIComponent(filePath)}`, data)

// 删除文件 — filePath 需要 URL 编码
export const deleteFile = (projectId, filePath) =>
  api.delete(`/projects/${projectId}/files/${encodeURIComponent(filePath)}`)

// 上传文件 — formData 中使用 parent_path
export const uploadProjectFile = (projectId, formData) =>
  api.post(`/projects/${projectId}/files/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })

// 运行代码 — data: {file_path, language}
export const runCode = (projectId, data) =>
  api.post(`/projects/${projectId}/run`, data)

// 重命名文件/文件夹 — data: {new_name}
export const renameFile = (projectId, filePath, data) =>
  api.patch(`/projects/${projectId}/files/${encodeURIComponent(filePath)}`, data)

// 移动文件/文件夹 — data: {source_path, destination_path}
export const moveFile = (projectId, data) =>
  api.post(`/projects/${projectId}/files/move`, data)

// 项目聊天 - SSE 流式（使用 fetch 处理流式响应）
export const projectChat = (projectId, data) => {
  const token = localStorage.getItem('spider_token')
  return fetch(`/api/projects/${projectId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })
}

// ============ Skills API ============
// 获取技能列表
export const getSkills = (projectId) => api.get('/skills', { params: { project_id: projectId } })

// 获取技能详情（包含内容）
export const getSkillDetail = (skillId) => api.get(`/skills/${skillId}`)

// 删除技能
export const deleteSkill = (skillId) => api.delete(`/skills/${skillId}`)

// ==================== MCP API ====================

// 获取预置公共 MCP 列表
export async function getMcpPresets() {
  const res = await fetch('/api/mcp/presets', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('spider_token')}` },
  });
  if (!res.ok) throw new Error('获取 MCP 预置列表失败');
  return res.json();
}

// 启用预置 MCP Server
export async function enableMcp(data) {
  const res = await fetch('/api/mcp/enable', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${localStorage.getItem('spider_token')}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('启用 MCP Server 失败');
  return res.json();
}

// 获取用户已启用的 MCP Server 列表
export async function getMcpServers(projectId) {
  const params = projectId ? `?project_id=${projectId}` : '';
  const res = await fetch(`/api/mcp/servers${params}`, {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('spider_token')}` },
  });
  if (!res.ok) throw new Error('获取 MCP Server 列表失败');
  return res.json();
}

// 删除 MCP Server
export async function deleteMcpServer(serverId) {
  const res = await fetch(`/api/mcp/servers/${serverId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${localStorage.getItem('spider_token')}` },
  });
  if (!res.ok) throw new Error('删除 MCP Server 失败');
  return res.json();
}

// 更新 MCP Server 配置
export async function updateMcpServer(serverId, data) {
  const res = await fetch(`/api/mcp/servers/${serverId}`, {
    method: 'PUT',
    headers: { 
      'Authorization': `Bearer ${localStorage.getItem('spider_token')}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('更新 MCP Server 配置失败');
  return res.json();
}

// ========== SubAgent API ==========
export async function getSubAgents(projectId = null) {
  const params = projectId ? `?project_id=${projectId}` : '';
  const res = await fetch(`/api/sub-agents${params}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('spider_token')}` },
  });
  if (!res.ok) throw new Error('获取子代理列表失败');
  return res.json();
}

// 加载项目历史聊天消息
export async function getProjectMessages(projectId, sessionId = null) {
  let url = `/api/projects/${projectId}/messages`
  if (sessionId) url += `?session_id=${sessionId}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${localStorage.getItem('spider_token')}` },
  })
  if (!res.ok) throw new Error('获取项目历史消息失败')
  return res.json()
}

export async function deleteSubAgent(agentId) {
  const res = await fetch(`/api/sub-agents/${agentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('spider_token')}` },
  });
  if (!res.ok) throw new Error('删除子代理失败');
  return res.json();
}

// ===== 输入预测 API（SSE 流式） =====
export const predictInput = async (text, sessionId = null, signal, onToken, onDone) => {
  const token = localStorage.getItem('spider_token')
  const response = await fetch('/api/chat/predict', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ text, session_id: sessionId }),
    signal
  })

  if (!response.ok) {
    throw new Error(`predict request failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // 保留未完成的行

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const jsonStr = trimmed.slice(6)
      if (!jsonStr || jsonStr === '[DONE]') continue

      try {
        const parsed = JSON.parse(jsonStr)
        if (parsed.type === 'token' && onToken) {
          onToken(parsed.content)
        } else if (parsed.type === 'done' && onDone) {
          onDone(parsed.prediction)
        }
      } catch {
        // 忽略解析失败的行
      }
    }
  }
}

// ===== 预测反馈 API =====
export const sendPredictFeedback = (prediction, action, latencyMs, inputText) => {
  return api.post('/chat/predict/feedback', {
    prediction, action, latency_ms: latencyMs, input_text: inputText
  }).catch(() => {}) // 静默失败，不影响体验
}

// ===== 记忆管理 API =====
// 获取所有记忆
export const getMemories = () => api.get('/memory')

// 搜索记忆
export const searchMemories = (query) => api.get('/memory/search', { params: { q: query } })

// 添加记忆
export const addMemory = (data) => api.post('/memory', data)

// 删除记忆
export const deleteMemory = (id) => api.delete(`/memory/${id}`)

export default api
