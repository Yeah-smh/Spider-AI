# LangChain 系列精华指南

## 一、系列全景图

```
┌─────────────────────────────────────────────────────────────────┐
│                     LangChain 生态系统                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐         │
│  │  LangChain   │   │  LangGraph   │   │  DeepAgents  │         │
│  │  (基础抽象)   │ → │  (状态图)     │ → │  (高级封装)   │         │
│  └──────────────┘   └──────────────┘   └──────────────┘         │
│         ↓                  ↓                  ↓                  │
│     组件 & 链          循环 & 状态         规划 & 协作            │
└─────────────────────────────────────────────────────────────────┘
```

## 二、取舍原则

| 组件 | 精华（用） | 糟粕（弃） |
|------|-----------|-----------|
| LangChain | 模型抽象、工具定义、Prompt模板 | Chain过度封装、LCEL学习曲线陡 |
| LangGraph | 状态图、循环控制、检查点 | 简单任务过度复杂化 |
| DeepAgents | 规划思路、文件系统思路、子代理思路 | 直接用开销大，适合借鉴 |

---

## 三、LangChain 精华

### 1. 模型抽象（统一接口）

```python
from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama
from langchain_anthropic import ChatAnthropic

# 切换模型只需换一行
model = ChatOllama(model="qwen3:latest")
# model = ChatOpenAI(model="gpt-4o")
# model = ChatAnthropic(model="claude-sonnet-4-20250514")

# 统一调用
response = model.invoke("你好")
```

### 2. 工具定义（@tool装饰器）

```python
from langchain_core.tools import tool

@tool
def get_weather(city: str, unit: str = "celsius") -> str:
    """获取指定城市的天气信息
    
    Args:
        city: 城市名称
        unit: 温度单位
    """
    return f"{city} 今天 25°C"

# 自动生成 JSON Schema
print(get_weather.name)        # get_weather
print(get_weather.description) # 获取指定城市的天气信息
print(get_weather.args_schema) # Pydantic Schema
```

### 3. Prompt模板

```python
from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是{role}，专注于{domain}"),
    ("human", "{question}")
])

messages = prompt.invoke({
    "role": "AI助手",
    "domain": "技术问答",
    "question": "什么是LangGraph？"
})
```

---

## 四、LangGraph 精华

### 1. 状态图（核心）

```python
from langgraph.graph import StateGraph, MessagesState, START, END

def agent_node(state: MessagesState):
    response = model.invoke(state["messages"])
    return {"messages": [response]}

def tool_node(state: MessagesState):
    # 执行工具
    return {"messages": [tool_result]}

def should_continue(state: MessagesState) -> str:
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return END

# 构建图
graph = StateGraph(MessagesState)
graph.add_node("agent", agent_node)
graph.add_node("tools", tool_node)
graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_continue)
graph.add_edge("tools", "agent")

app = graph.compile()
```

### 2. 检查点（断点续传）

```python
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()
app = graph.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "user-123"}}
result = app.invoke({"messages": [...]}, config)

# 中断后可恢复
result = app.invoke({"messages": [...]}, config)
```

### 3. 预置工具节点

```python
from langgraph.prebuilt import ToolNode

tools = [search, get_weather]
tool_node = ToolNode(tools)  # 自动处理工具调用
```

---

## 五、DeepAgents 借鉴思路

### 1. 任务规划（不用DeepAgents，自己实现）

```python
def plan_task(task: str) -> list:
    """让模型分解任务"""
    prompt = f"将任务分解为步骤，返回JSON列表：{task}"
    response = model.invoke(prompt)
    return parse_steps(response)
```

### 2. 上下文卸载

```python
def handle_large_result(result: str):
    """大结果写文件，避免上下文溢出"""
    if len(result) > 10000:
        file_path = save_to_file(result)
        return f"结果已保存到 {file_path}"
    return result
```

### 3. 子任务隔离

```python
def delegate_subtask(subtask: str) -> str:
    """独立上下文处理子任务，只返回结论"""
    sub_messages = [{"role": "user", "content": subtask}]
    result = model.invoke(sub_messages)
    return extract_conclusion(result)
```

---

## 六、极简模板

```python
"""Agent 核心模板"""
from langchain_ollama import ChatOllama
from langchain_core.tools import tool
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode

# 1. 模型
model = ChatOllama(model="qwen3:latest", base_url="http://localhost:11434")

# 2. 工具
@tool
def search(query: str) -> str:
    """搜索信息"""
    return f"搜索结果：{query}"

tools = [search]
model_with_tools = model.bind_tools(tools)

# 3. 节点
def agent(state: MessagesState):
    return {"messages": [model_with_tools.invoke(state["messages"])]}

def should_continue(state: MessagesState) -> str:
    if state["messages"][-1].tool_calls:
        return "tools"
    return END

# 4. 图
graph = StateGraph(MessagesState)
graph.add_node("agent", agent)
graph.add_node("tools", ToolNode(tools))
graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_continue)
graph.add_edge("tools", "agent")

app = graph.compile()

# 5. 运行
result = app.invoke({"messages": [{"role": "user", "content": "搜索AI新闻"}]})
print(result["messages"][-1].content)
```

---

## 七、学习路径

```
阶段1：基础
├── LangChain 模型抽象
├── @tool 装饰器
└── PromptTemplate

阶段2：核心
├── LangGraph StateGraph
├── 条件边 add_conditional_edges
├── 循环执行
└── 检查点 MemorySaver

阶段3：进阶
├── Human-in-the-loop
├── 多代理协作
├── 长期记忆（Store）
└── 流式输出

阶段4：借鉴
├── DeepAgents 规划思路
├── DeepAgents 文件系统思路
└── DeepAgents 子代理思路
```
