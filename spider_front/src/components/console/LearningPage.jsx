import { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Database,
  Brain,
  Cpu,
  Play,
  Clock,
  CheckCircle,
  RefreshCw,
  Search,
  Filter,
  Trash2
} from 'lucide-react';
import { useConsoleTheme } from '../../contexts/ConsoleThemeContext';
import axios from 'axios';

// API 实例
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 注入 JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('spider_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 类型标签颜色配置
const typeColors = {
  Chat: "bg-blue-100 text-blue-700",
  Project: "bg-indigo-100 text-indigo-700",
  Memory: "bg-teal-100 text-teal-700",
  File: "bg-green-100 text-green-700",
  Code: "bg-purple-100 text-purple-700",
  Web: "bg-orange-100 text-orange-700",
};

// 类别标签颜色配置
const categoryColors = {
  Preference: "bg-pink-100 text-pink-700",
  Knowledge: "bg-blue-100 text-blue-700",
  Habit: "bg-green-100 text-green-700",
  Skill: "bg-purple-100 text-purple-700",
};

// 状态图标渲染
function StatusBadge({ status }) {
  if (status === "Completed") {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 text-sm">
        <CheckCircle size={14} />
        Completed
      </span>
    );
  }
  if (status === "Available") {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 text-sm">
        <CheckCircle size={14} />
        Available
      </span>
    );
  }
  if (status === "Processing") {
    return (
      <span className="inline-flex items-center gap-1 text-blue-600 text-sm">
        <RefreshCw size={14} className="animate-spin" />
        Processing
      </span>
    );
  }
  if (status === "Queued") {
    return (
      <span className="inline-flex items-center gap-1 text-gray-500 text-sm">
        <Clock size={14} />
        Queued
      </span>
    );
  }
  return null;
}

// 统计卡片组件
function StatCard({ icon: Icon, title, value, subtitle, pulse = false, statusDot = false, isDark = false }) {
  return (
    <div className={`rounded-xl shadow-sm border p-5 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{title}</p>
          <div className="flex items-center gap-2">
            <p className={`text-2xl font-semibold ${pulse ? 'animate-pulse text-green-600' : isDark ? 'text-white' : 'text-gray-800'}`}>
              {value}
            </p>
            {statusDot && (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
          {subtitle && <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${pulse ? 'bg-green-100' : 'bg-blue-50'}`}>
          <Icon size={22} className={pulse ? 'text-green-600' : 'text-[#3182ce]'} />
        </div>
      </div>
    </div>
  );
}

export default function LearningPage() {
  // 学习状态
  const [learningStatus, setLearningStatus] = useState({ status: 'idle', progress: 0, stage: '', message: 'Ready to learn' });
  const [learningMode, setLearningMode] = useState('incremental'); // full | incremental | scheduled
  const [schedule, setSchedule] = useState('12h');
  const [statusText, setStatusText] = useState('Ready to learn');
  const pollIntervalRef = useRef(null);

  // 数据状态
  const [dataSources, setDataSources] = useState([]);
  const [generatedMemories, setGeneratedMemories] = useState([]);
  const [learningSessions, setLearningSessions] = useState([]);
  const [stats, setStats] = useState({ total_memories: 0, data_sources: 0 });
  const [loading, setLoading] = useState(true);

  // 搜索和筛选状态
  const [dataSearch, setDataSearch] = useState('');
  const [dataFilter, setDataFilter] = useState('All');
  const [memorySearch, setMemorySearch] = useState('');
  const [memoryFilter, setMemoryFilter] = useState('All');
  
  const { isDark } = useConsoleTheme();

  // API 调用函数
  const fetchDataSources = async () => {
    try {
      const res = await api.get('/learning/data-sources');
      // 转换后端 UTC 时间为本地时间
      const formattedSources = (res.data || []).map(item => ({
        ...item,
        collectedAt: item.collectedAt ? new Date(item.collectedAt.endsWith('Z') ? item.collectedAt : item.collectedAt + 'Z').toLocaleString('zh-CN') : ''
      }));
      setDataSources(formattedSources);
    } catch (err) {
      console.error('Fetch data sources error:', err);
    }
  };

  const fetchMemories = async () => {
    try {
      const res = await api.get('/learning/memories');
      // 转换后端数据格式为前端格式
      const formattedMemories = (res.data || []).map(m => ({
        id: m.id,
        content: m.content,
        category: m.type === 'preference' ? 'Preference' : 
                  m.type === 'skill' ? 'Skill' : 
                  m.type === 'habit' ? 'Habit' : 'Knowledge',
        confidence: Math.min((m.importance || 5) * 10, 100),
        generatedAt: m.created_at ? new Date(m.created_at.endsWith('Z') ? m.created_at : m.created_at + 'Z').toLocaleString('zh-CN') : '',
        cloudSync: 'Synced'
      }));
      setGeneratedMemories(formattedMemories);
    } catch (err) {
      console.error('Fetch memories error:', err);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await api.get('/learning/sessions');
      // 转换后端数据格式为前端格式
      const formattedSessions = (res.data || []).map(s => ({
        id: `#L-${String(s.id).padStart(3, '0')}`,
        rawId: s.id,  // 保留原始 id 用于删除操作
        startTime: s.start_time ? new Date(s.start_time.endsWith('Z') ? s.start_time : s.start_time + 'Z').toLocaleString('zh-CN') : '',
        duration: s.duration_seconds ? `${Math.floor(s.duration_seconds / 60)} min` : '-',
        dataProcessed: `${s.data_processed || 0} sources`,
        memoriesGenerated: `${s.memories_generated || 0} memories`,
        status: s.status === 'completed' ? 'Completed' : s.status === 'running' ? 'Running' : 'Failed'
      }));
      setLearningSessions(formattedSessions);
    } catch (err) {
      console.error('Fetch sessions error:', err);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await api.get('/learning/status');
      setLearningStatus(res.data || { status: 'idle', progress: 0, message: 'Ready to learn' });
      setStatusText(res.data?.message || 'Ready to learn');
    } catch (err) {
      console.error('Fetch status error:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/learning/stats');
      setStats(res.data || { total_memories: 0, data_sources: 0 });
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  };

  const startLearning = async (mode, intervalSeconds = null) => {
    try {
      const payload = { mode };
      if (mode === 'scheduled' && intervalSeconds) {
        payload.interval_seconds = intervalSeconds;
      }
      const res = await api.post('/learning/start', payload);
      return res.data;
    } catch (err) {
      console.error('Start learning error:', err);
      throw err;
    }
  };
  
  const stopScheduledLearning = async () => {
    try {
      await api.post('/learning/stop-scheduled');
      await fetchStatus();
    } catch (err) {
      console.error('Stop scheduled learning error:', err);
      alert('停止定时学习失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  const deleteMemory = async (id) => {
    try {
      await api.delete(`/learning/memories/${id}`);
      // 删除成功后刷新记忆列表
      await fetchMemories();
      await fetchStats();
    } catch (err) {
      console.error('Delete memory error:', err);
      alert('删除记忆失败');
    }
  };

  const deleteSession = async (rawId) => {
    try {
      await api.delete(`/learning/sessions/${rawId}`);
      // 删除成功后刷新会话列表和统计
      await fetchSessions();
      await fetchStats();
    } catch (err) {
      console.error('Delete session error:', err);
      alert('删除会话失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 初始化加载所有数据
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchDataSources(),
        fetchMemories(),
        fetchSessions(),
        fetchStatus(),
        fetchStats()
      ]);
      setLoading(false);
    };
    loadAll();
  }, []);

  // 学习进行中轮询
  useEffect(() => {
    if (learningStatus.status === 'running') {
      pollIntervalRef.current = setInterval(() => {
        fetchStatus();
        fetchMemories();
        fetchSessions();
        fetchStats();
      }, 5000);
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [learningStatus.status]);

  // 将 schedule 字符串转换为秒数
  const scheduleToSeconds = (scheduleValue) => {
    switch (scheduleValue) {
      case '6h': return 6 * 60 * 60;
      case '12h': return 12 * 60 * 60;
      case 'daily': return 24 * 60 * 60;
      case 'weekly': return 7 * 24 * 60 * 60;
      default: return 3600;
    }
  };
  
  // 开始/停止学习
  const toggleLearning = async () => {
    // 如果有定时学习在运行，点击按钮停止它
    if (learningStatus.scheduled) {
      await stopScheduledLearning();
      return;
    }
  
    if (learningStatus.status === 'idle' || learningStatus.status === 'completed' || learningStatus.status === 'failed') {
      try {
        if (learningMode === 'scheduled') {
          // 定时学习模式
          const intervalSeconds = scheduleToSeconds(schedule);
          await startLearning('scheduled', intervalSeconds);
        } else {
          // full 或 incremental 模式
          await startLearning(learningMode);
        }
        await fetchStatus();
        await fetchSessions();
      } catch (err) {
        alert('启动学习失败: ' + (err.response?.data?.detail || err.message));
      }
    }
  };

  // 过滤采集数据
  const filteredCollectedData = dataSources.filter(item => {
    const matchSearch = item.source.toLowerCase().includes(dataSearch.toLowerCase());
    const matchFilter = dataFilter === 'All' || item.type === dataFilter;
    return matchSearch && matchFilter;
  });

  // 过滤生成记忆
  const filteredMemories = generatedMemories.filter(item => {
    const matchSearch = item.content.toLowerCase().includes(memorySearch.toLowerCase());
    const matchFilter = memoryFilter === 'All' || item.category === memoryFilter;
    return matchSearch && matchFilter;
  });

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-[#0d1117]' : 'bg-gray-50'}`}>
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Learning Engine</h1>
        <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Autonomous offline learning powered by your local model</p>
      </div>

      {/* Loading 状态 */}
      {loading && (
        <div className={`rounded-xl shadow-sm border p-6 mb-6 flex items-center justify-center ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
          <RefreshCw size={24} className={`animate-spin mr-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>Loading data...</span>
        </div>
      )}

      {/* 顶部状态卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={GraduationCap}
          title="Learning Status"
          value={learningStatus.status === 'running' ? 'Learning...' : learningStatus.status === 'completed' ? 'Completed' : 'Idle'}
          pulse={learningStatus.status === 'running'}
          isDark={isDark}
        />
        <StatCard
          icon={Database}
          title="Data Sources"
          value={String(dataSources.length)}
          subtitle="Connected sources"
          isDark={isDark}
        />
        <StatCard
          icon={Brain}
          title="Generated Memories"
          value={String(stats.total_memories || generatedMemories.length)}
          subtitle={`${stats.auto_memories || 0} auto-generated`}
          isDark={isDark}
        />
        <StatCard
          icon={Cpu}
          title="Local Model"
          value="Qwen3-0.6B"
          subtitle="Connected"
          statusDot={true}
          isDark={isDark}
        />
      </div>

      {/* 学习控制面板 */}
      <div className={`rounded-xl shadow-sm border p-6 mb-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
        <h2 className={`text-lg font-semibold mb-5 ${isDark ? 'text-white' : 'text-gray-800'}`}>Learning Control</h2>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* 左侧：控制按钮和进度 */}
          <div className="flex-1">
            <button
              onClick={toggleLearning}
              disabled={learningStatus.status === 'running' && !learningStatus.scheduled}
              className={`w-full md:w-auto px-8 py-3 rounded-lg font-medium text-white flex items-center justify-center gap-2 transition-colors ${
                learningStatus.status === 'running' && !learningStatus.scheduled
                  ? 'bg-gray-400 cursor-not-allowed'
                  : learningStatus.scheduled
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-[#3182ce] hover:bg-blue-600'
              }`}
            >
              {learningStatus.scheduled ? (
                <>
                  <Clock size={18} />
                  Stop Scheduled
                </>
              ) : learningStatus.status === 'running' ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Learning...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Start Learning
                </>
              )}
            </button>

            {/* 进度条 */}
            <div className="mt-5">
              <div className={`flex justify-between text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <span>{statusText}</span>
                <span>{Math.round(learningStatus.progress || 0)}%</span>
              </div>
              <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                <div
                  className="h-full bg-[#3182ce] transition-all duration-300 ease-out"
                  style={{ width: `${learningStatus.progress || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* 右侧：学习模式 */}
          <div className={`flex-1 border-t lg:border-t-0 lg:border-l pt-6 lg:pt-0 lg:pl-8 ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
            <p className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Learning Mode</p>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="learningMode"
                  value="full"
                  checked={learningMode === 'full'}
                  onChange={(e) => setLearningMode(e.target.value)}
                  className="mt-1 accent-[#3182ce]"
                />
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>Full Scan</p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Complete analysis of all data sources</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="learningMode"
                  value="incremental"
                  checked={learningMode === 'incremental'}
                  onChange={(e) => setLearningMode(e.target.value)}
                  className="mt-1 accent-[#3182ce]"
                />
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>Incremental</p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Only process new and changed data</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="learningMode"
                  value="scheduled"
                  checked={learningMode === 'scheduled'}
                  onChange={(e) => setLearningMode(e.target.value)}
                  className="mt-1 accent-[#3182ce]"
                />
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>Scheduled</p>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Automatic learning at set intervals</p>
                </div>
              </label>
            </div>

            {/* Schedule 下拉 - 仅 Scheduled 模式显示 */}
            {learningMode === 'scheduled' && (
              <div className="mt-4">
                <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Schedule</label>
                <select
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className={`mt-1 block w-full md:w-48 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3182ce] focus:border-transparent ${isDark ? 'bg-[#1c2432] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                >
                  <option className={isDark ? 'bg-[#1c2432] text-white' : 'bg-white text-gray-800'} value="6h">Every 6h</option>
                  <option className={isDark ? 'bg-[#1c2432] text-white' : 'bg-white text-gray-800'} value="12h">Every 12h</option>
                  <option className={isDark ? 'bg-[#1c2432] text-white' : 'bg-white text-gray-800'} value="daily">Daily</option>
                  <option className={isDark ? 'bg-[#1c2432] text-white' : 'bg-white text-gray-800'} value="weekly">Weekly</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 采集数据表格 */}
      <div className={`rounded-xl shadow-sm border p-6 mb-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Collected Data</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search sources..."
                value={dataSearch}
                onChange={(e) => setDataSearch(e.target.value)}
                className={`pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3182ce] focus:border-transparent w-full sm:w-56 ${isDark ? 'bg-[#1c2432] border-white/10 text-white placeholder-gray-500' : 'border-gray-300'}`}
              />
            </div>
            <div className="relative">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={dataFilter}
                onChange={(e) => setDataFilter(e.target.value)}
                className={`pl-9 pr-8 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3182ce] focus:border-transparent appearance-none w-full sm:w-36 ${isDark ? 'bg-[#1c2432] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
              >
                <option className={isDark ? 'bg-[#1c2432] text-white' : 'bg-white text-gray-800'} value="All">All Types</option>
                <option className={isDark ? 'bg-[#1c2432] text-white' : 'bg-white text-gray-800'} value="Chat">Chat</option>
                <option className={isDark ? 'bg-[#1c2432] text-white' : 'bg-white text-gray-800'} value="Project">Project</option>
                <option className={isDark ? 'bg-[#1c2432] text-white' : 'bg-white text-gray-800'} value="Memory">Memory</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Source</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Type</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Size</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Collected At</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCollectedData.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? (isDark ? 'bg-[#161b22]' : 'bg-white') : (isDark ? 'bg-[#1c2432]' : 'bg-gray-50')}>
                  <td className={`py-3 px-4 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>{item.source}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${typeColors[item.type]}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className={`py-3 px-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.size}</td>
                  <td className={`py-3 px-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.collectedAt}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCollectedData.length === 0 && (
            <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No data found</div>
          )}
        </div>
      </div>

      {/* 生成记忆表格 */}
      <div className={`rounded-xl shadow-sm border p-6 mb-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Generated Memories</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search memories..."
                value={memorySearch}
                onChange={(e) => setMemorySearch(e.target.value)}
                className={`pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3182ce] focus:border-transparent w-full sm:w-56 ${isDark ? 'bg-[#1c2432] border-white/10 text-white placeholder-gray-500' : 'border-gray-300'}`}
              />
            </div>
            <div className="relative">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={memoryFilter}
                onChange={(e) => setMemoryFilter(e.target.value)}
                className={`pl-9 pr-8 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3182ce] focus:border-transparent appearance-none w-full sm:w-40 ${isDark ? 'bg-[#1c2432] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
              >
                <option className={isDark ? 'bg-[#1c2432] text-white' : 'bg-white text-gray-800'} value="All">All Categories</option>
                <option className={isDark ? 'bg-[#1c2432] text-white' : 'bg-white text-gray-800'} value="Preference">Preference</option>
                <option className={isDark ? 'bg-[#1c2432] text-white' : 'bg-white text-gray-800'} value="Knowledge">Knowledge</option>
                <option className={isDark ? 'bg-[#1c2432] text-white' : 'bg-white text-gray-800'} value="Habit">Habit</option>
                <option className={isDark ? 'bg-[#1c2432] text-white' : 'bg-white text-gray-800'} value="Skill">Skill</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Content</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Category</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Confidence</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Generated At</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMemories.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? (isDark ? 'bg-[#161b22]' : 'bg-white') : (isDark ? 'bg-[#1c2432]' : 'bg-blue-50/50')}>
                  <td className={`py-3 px-4 text-sm max-w-xs truncate ${isDark ? 'text-white' : 'text-gray-800'}`} title={item.content}>
                    {item.content}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${categoryColors[item.category]}`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium w-10 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.confidence}%</span>
                      <div className={`w-16 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                        <div
                          className="h-full bg-[#3182ce] rounded-full"
                          style={{ width: `${item.confidence}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className={`py-3 px-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.generatedAt}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => deleteMemory(item.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isDark 
                          ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/10' 
                          : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                      }`}
                      title="Delete memory"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMemories.length === 0 && (
            <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No memories found</div>
          )}
        </div>
      </div>

      {/* 学习会话日志 */}
      <div className={`rounded-xl shadow-sm border p-6 ${isDark ? 'bg-[#161b22] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
        <h2 className={`text-lg font-semibold mb-5 ${isDark ? 'text-white' : 'text-gray-800'}`}>Learning Sessions</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Session</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Start Time</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Duration</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Data Processed</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Memories Generated</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</th>
                <th className={`text-left text-xs font-medium uppercase py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {learningSessions.map((session, index) => (
                <tr key={session.id} className={index % 2 === 0 ? (isDark ? 'bg-[#161b22]' : 'bg-white') : (isDark ? 'bg-[#1c2432]' : 'bg-gray-50')}>
                  <td className="py-3 px-4 text-sm text-[#3182ce] font-medium">{session.id}</td>
                  <td className={`py-3 px-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{session.startTime}</td>
                  <td className={`py-3 px-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{session.duration}</td>
                  <td className={`py-3 px-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{session.dataProcessed}</td>
                  <td className={`py-3 px-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{session.memoriesGenerated}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 text-sm ${
                      session.status === 'Completed' ? 'text-green-600' : 
                      session.status === 'Running' ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      <CheckCircle size={14} />
                      {session.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => deleteSession(session.rawId)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isDark 
                          ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/10' 
                          : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                      }`}
                      title="Delete session"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {learningSessions.length === 0 && (
            <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No sessions found</div>
          )}
        </div>
      </div>
    </div>
  );
}
