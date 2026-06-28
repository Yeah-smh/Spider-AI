import re
from sqlmodel import create_engine, Session, SQLModel
from sqlalchemy.dialects.postgresql.psycopg2 import PGDialect_psycopg2
from sqlalchemy import text, inspect
from core.config import settings

# openGauss 版本号兼容：openGauss 返回格式与标准 PostgreSQL 不同
_orig_get_server_version_info = PGDialect_psycopg2._get_server_version_info

def _opengauss_get_server_version_info(self, connection):
    try:
        return _orig_get_server_version_info(self, connection)
    except AssertionError:
        # openGauss 格式: (openGauss 7.0.0-RC1 build ...)
        v = connection.exec_driver_sql("select version()").scalar()
        m = re.search(r'openGauss\s+(\d+)\.(\d+)\.(\d+)', v)
        if m:
            return (int(m.group(1)), int(m.group(2)), int(m.group(3)))
        # 兜底：伪装为 PostgreSQL 9.6
        return (9, 6, 0)

PGDialect_psycopg2._get_server_version_info = _opengauss_get_server_version_info

engine = create_engine(
    settings.DATABASE_URL,
    echo=True,
    pool_pre_ping=True,      # 每次用连接前先 ping，死连接自动丢弃
    pool_recycle=3600,        # 连接最多活1小时就回收
)


def init_db():
    """创建所有表"""
    from core.models import ProjectChatMessage, LearningSession  # noqa: F401 - 确保相关表被创建
    from core.skills.models import Skill  # noqa: F401 - 确保 skills 表被创建
    from core.mcp.models import McpServer  # noqa: F401 - 确保 mcp_servers 表被创建
    from core.agent.models import SubAgent  # noqa: F401 - 确保 sub_agents 表被创建
    SQLModel.metadata.create_all(engine)
    
    # openGauss 兼容：尝试为已存在的 users 表添加 phone 字段
    # create_all 不会自动 ALTER TABLE 添加新字段
    try:
        with engine.connect() as conn:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN phone VARCHAR(20) UNIQUE")
            )
            conn.commit()
            print("[DB] Added phone column to users table")
    except Exception as e:
        # 字段已存在或其他错误，忽略
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            print(f"[DB] Note: phone column might already exist: {e}")
    
    # 允许 password_hash 为 NULL（手机号登录用户无密码）
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL"))
            conn.commit()
            print("[DB] password_hash column now allows NULL")
    except Exception:
        # 已经是 nullable 或其他错误，忽略
        pass
    
    # 自动迁移：检查并添加 messages 表的新字段
    _migrate_messages_table()
    
    # 技能表迁移：script -> content
    _migrate_skills_table()
    
    # 学习会话表迁移：确保 learning_sessions 表存在
    _migrate_learning_sessions_table()


def _migrate_messages_table():
    """自动迁移：检查并添加 messages 表缺少的列"""
    inspector = inspect(engine)
    
    # 检查 messages 表是否存在
    if 'messages' not in inspector.get_table_names():
        return
    
    columns = [col['name'] for col in inspector.get_columns('messages')]
    new_columns = [
        ('input_tokens', 'INTEGER DEFAULT 0'),
        ('output_tokens', 'INTEGER DEFAULT 0'),
        ('total_tokens', 'INTEGER DEFAULT 0'),
        ('images', 'TEXT DEFAULT NULL'),
    ]
    
    added = []
    with engine.begin() as conn:
        for col_name, col_def in new_columns:
            if col_name not in columns:
                try:
                    conn.execute(text(f'ALTER TABLE messages ADD COLUMN {col_name} {col_def}'))
                    added.append(col_name)
                except Exception as e:
                    # 字段已存在或其他错误，忽略
                    if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
                        print(f"[Migration] Warning: {col_name}: {e}")
    
    if added:
        print(f"[Migration] messages 表添加新字段: {', '.join(added)}")
    else:
        print("[Migration] messages 表字段检查完成，无需迁移")


def _migrate_skills_table():
    """技能表迁移：script -> content, 移除 params_schema"""
    inspector = inspect(engine)
    if 'skills' not in inspector.get_table_names():
        return
    
    columns = [col['name'] for col in inspector.get_columns('skills')]
    
    with engine.begin() as conn:
        # 重命名 script -> content
        if 'script' in columns and 'content' not in columns:
            try:
                conn.execute(text('ALTER TABLE skills RENAME COLUMN script TO content'))
                print("[Migration] skills: script -> content")
            except Exception as e:
                print(f"[Migration] skills rename: {e}")
        
        # 删除 params_schema
        if 'params_schema' in columns:
            try:
                conn.execute(text('ALTER TABLE skills DROP COLUMN params_schema'))
                print("[Migration] skills: dropped params_schema")
            except Exception as e:
                print(f"[Migration] skills drop params_schema: {e}")


def _migrate_learning_sessions_table():
    """学习会话表迁移：确保 learning_sessions 表存在"""
    inspector = inspect(engine)
    
    # 如果表已存在，无需迁移
    if 'learning_sessions' in inspector.get_table_names():
        print("[Migration] learning_sessions 表已存在，跳过创建")
        return
    
    # 创建表（使用 IF NOT EXISTS 确保幂等性）
    with engine.begin() as conn:
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS learning_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    start_time TIMESTAMP DEFAULT NOW(),
                    end_time TIMESTAMP,
                    duration_seconds INTEGER,
                    data_processed INTEGER DEFAULT 0,
                    memories_generated INTEGER DEFAULT 0,
                    status VARCHAR DEFAULT 'running',
                    mode VARCHAR DEFAULT 'incremental'
                )
            """))
            print("[Migration] learning_sessions 表创建成功")
        except Exception as e:
            # 表已存在或其他错误
            if "already exists" not in str(e).lower():
                print(f"[Migration] learning_sessions 创建警告: {e}")


def get_db():
    """数据库会话依赖注入"""
    with Session(engine) as session:
        yield session
