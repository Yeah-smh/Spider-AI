# 创建测试文件：test_vllm.py
import os
# 必须在导入vLLM之前设置环境变量
os.environ["USE_LIBUV"] = "0"
# 关闭TensorFlow的oneDNN优化警告
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
# 可选：设置TensorFlow日志级别，减少信息输出
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

try:
    from vllm import LLM
    print("✅ vLLM导入成功！")
    print("✅ 安装完成，可以开始使用vLLM")
except ImportError as e:
    print(f"❌ 导入失败: {e}")
except Exception as e:
    print(f"⚠️ 其他错误: {e}")