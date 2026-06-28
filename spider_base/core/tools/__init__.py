"""内置工具函数 — 直接注入 Agent 的 LangChain Tool"""

from datetime import datetime
from langchain_core.tools import tool


@tool
def get_current_time() -> str:
    """获取当前系统时间（北京时间）。当用户询问现在几点、今天日期、星期几等时间相关问题时调用此工具。"""
    now = datetime.now()
    weekday_map = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    weekday = weekday_map[now.weekday()]
    return f"当前北京时间：{now.strftime('%Y年%m月%d日')}（{weekday}）{now.strftime('%H:%M:%S')}"
