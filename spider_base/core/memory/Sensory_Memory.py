"""感觉记忆 - 单次交互的内存缓冲，不持久化"""

from datetime import datetime, timezone


class SensoryMemory:
    """
    感觉记忆：记录当前这一轮的用户输入和AI回复。
    纯内存操作，不写DB不写Redis。
    生命周期 = 一次交互（一问一答）。
    用途：供记忆分析器使用，判断本轮对话是否需要存为长期记忆。
    """
    
    def __init__(self, user_id: int, session_id: str):
        self.user_id = user_id
        self.session_id = session_id
        self.user_input: str = ""
        self.ai_response: str = ""
        self.timestamp: datetime | None = None
    
    def record_input(self, content: str):
        """记录用户输入"""
        self.user_input = content
        self.timestamp = datetime.now(timezone.utc)
    
    def record_response(self, content: str):
        """记录AI回复（流式场景下可能多次追加）"""
        self.ai_response += content
    
    def get_current_turn(self) -> dict:
        """获取当前轮的完整记录"""
        return {
            "user_input": self.user_input,
            "ai_response": self.ai_response,
            "timestamp": self.timestamp,
            "user_id": self.user_id,
            "session_id": self.session_id,
        }
    
    def reset(self):
        """重置（新一轮交互开始时调用）"""
        self.user_input = ""
        self.ai_response = ""
        self.timestamp = None
