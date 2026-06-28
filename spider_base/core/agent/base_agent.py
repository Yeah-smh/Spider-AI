from deepagents import create_deep_agent
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI

from core.config import settings


class BaseAgent:
    def __init__(self, tools=None, system_prompt=None, skills=None, skill_files=None, 
                 enable_search=True, tool_choice=None, backend=None):
        self.system_prompt = system_prompt or """
你是 Spider AI 好邻居智能助手。

## 你的人格
- 友善、主动、像一个靠谱的好邻居
- 能力越大，责任越大
- 记住用户的习惯和偏好
- 保护用户隐私

## 记忆能力
- 你拥有长期记忆搜索能力，可以回忆用户之前告诉你的信息
- 当用户提到“之前说过”、“你还记得吗”、个人偏好、历史信息等时，主动使用记忆搜索工具查找相关记忆
- 不要编造用户没有告诉你的信息，如果不确定就搜索记忆或直接询问用户

## 回复要求
- 使用中文回复
- 使用 Markdown 格式
- 简洁准确，不啰嗦
- 关键信息加粗标注
"""
        self.tools = tools or []
        self.skills = skills          # ["/skills/user/", "/skills/project/"]
        self.skill_files = skill_files  # {"/skills/user/xxx/SKILL.md": "content"}
        self.tool_choice = tool_choice  # "auto", "required", "none" 或特定工具名
        self.backend = backend  # BackendProtocol 实例/工厂函数，或 None 表示用 create_agent
        
        model_kwargs = {"enable_search": enable_search}
        # tool_choice 不再放在 extra_body 里，改为 bind_tools 时使用
            
        self.model = ChatOpenAI(
            model=settings.DASHSCOPE_MODEL,
            base_url=settings.DASHSCOPE_BASE_URL,
            api_key=settings.DASHSCOPE_API_KEY,
            timeout=60,
            extra_body=model_kwargs,
            stream_usage=True  # 开启流式 usage 报告
        )

    def _create_agent(self, model):
        """根据配置创建 agent"""
        if self.backend is not None:
            # 使用 create_deep_agent（带内置文件工具，通过 backend 操作）
            return create_deep_agent(
                model=model,
                system_prompt=self.system_prompt,
                tools=self.tools if self.tools else None,
                skills=self.skills if self.skills else None,
                backend=self.backend,
            )
        else:
            # 使用 create_agent（轻量级，只有自定义工具，无内置文件工具）
            return create_agent(
                model,
                system_prompt=self.system_prompt,
                tools=self.tools if self.tools else None,
            )

    def _get_model(self):
        """获取 model，如果需要绑定 tool_choice 则绑定"""
        model = self.model
        if self.tools and self.tool_choice:
            model = model.bind_tools(self.tools, tool_choice=self.tool_choice)
        return model

    def quick_start(self, prompt):
        """同步调用"""
        model = self._get_model()
        agent = self._create_agent(model)
        invoke_input = {"messages": [{"role": "user", "content": prompt}]}
        if self.skill_files:
            invoke_input["files"] = self.skill_files
        result = agent.invoke(invoke_input)
        return result

    def quick_start_stream(self, messages: list, extra_tools: list = None, temperature: float = None, use_vl_model: bool = False):
        """流式调用 - SSE 依赖此方法
        
        Args:
            messages: 消息列表
            extra_tools: 额外的请求级别 tools（如记忆搜索工具，每次请求动态创建）
            temperature: 可选温度参数，传入时创建临时模型实例覆盖默认温度
        """
        # 临时合并 tools
        original_tools = self.tools
        if extra_tools:
            self.tools = list(self.tools) + list(extra_tools)
        
        try:
            # 选择模型：有图片时用 VL 模型
            model_name = settings.DASHSCOPE_VL_MODEL if use_vl_model else settings.DASHSCOPE_MODEL
            
            # 如果指定了 temperature 或使用 VL 模型，创建临时模型实例
            if temperature is not None or use_vl_model:
                temp_model = ChatOpenAI(
                    model=model_name,
                    base_url=settings.DASHSCOPE_BASE_URL,
                    api_key=settings.DASHSCOPE_API_KEY,
                    timeout=60,
                    temperature=temperature if temperature is not None else 0.7,
                    extra_body={"enable_search": False},
                    stream_usage=True,
                )
                if self.tools and self.tool_choice:
                    temp_model = temp_model.bind_tools(self.tools, tool_choice=self.tool_choice)
                model = temp_model
            else:
                model = self._get_model()
            
            agent = self._create_agent(model)
            invoke_input = {"messages": messages}
            if self.skill_files:
                invoke_input["files"] = self.skill_files
            for chunk in agent.stream(invoke_input, stream_mode="messages"):
                yield chunk
        finally:
            # 恢复原始 tools
            self.tools = original_tools


if __name__ == "__main__":
    agent = BaseAgent()
    print(agent.quick_start("你好"))
