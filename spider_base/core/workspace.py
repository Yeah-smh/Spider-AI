"""
VM 文件系统操作模块
通过 SSH 免密登录操作远程 VM 文件系统
"""
import subprocess
import os
import shlex
import tempfile
import logging
from typing import List, Optional, Dict, Any

from .config import settings

logger = logging.getLogger(__name__)


def _get_ssh_target() -> str:
    """获取 SSH 目标地址（延迟读取 settings）"""
    return f"{settings.WORKSPACE_SSH_USER}@{settings.WORKSPACE_SSH_HOST}"


def _ssh_run(cmd: str, timeout: int = 30) -> subprocess.CompletedProcess:
    """执行远程 SSH 命令
    
    Args:
        cmd: 远程执行的命令
        timeout: 超时时间（秒）
        
    Returns:
        subprocess.CompletedProcess 对象
    """
    ssh_target = _get_ssh_target()
    logger.debug(f"SSH 执行: {cmd}")
    return subprocess.run(
        ["ssh", "-q", ssh_target, cmd],
        capture_output=True,
        text=True,
        timeout=timeout,
        encoding='utf-8',
        errors='replace'
    )



def _ssh_run_with_input(cmd: str, input_text: str, timeout: int = 30) -> subprocess.CompletedProcess:
    """执行远程 SSH 命令（带 stdin 输入）
    
    Args:
        cmd: 远程执行的命令
        input_text: 输入到 stdin 的内容
        timeout: 超时时间（秒）
        
    Returns:
        subprocess.CompletedProcess 对象
    """
    ssh_target = _get_ssh_target()
    logger.debug(f"SSH 执行（带输入）: {cmd}")
    return subprocess.run(
        ["ssh", "-q", ssh_target, cmd],
        input=input_text,
        capture_output=True,
        text=True,
        timeout=timeout,
        encoding='utf-8',
        errors='replace'
    )


def _get_workspace_path(user_id: int, project_id: int, sub_path: str = "") -> str:
    """获取工作空间路径
    
    Args:
        user_id: 用户 ID
        project_id: 项目 ID
        sub_path: 子路径
        
    Returns:
        完整的远程路径
    """
    base = f"{settings.WORKSPACE_BASE_DIR}/{user_id}/{project_id}"
    if sub_path:
        sub_path = sub_path.lstrip("/")
        return f"{base}/{sub_path}"
    return base


def _validate_path(user_id: int, project_id: int, path: str) -> bool:
    """验证路径是否在允许的工作空间内（防止路径遍历攻击）
    
    Args:
        user_id: 用户 ID
        project_id: 项目 ID
        path: 要验证的路径
        
    Returns:
        True 如果路径安全
        
    Raises:
        ValueError: 如果路径不安全
    """
    # 使用正斜杠统一处理（远程 VM 是 Linux）
    workspace_base = f"{settings.WORKSPACE_BASE_DIR}/{user_id}/{project_id}"
    
    # 检查是否包含 ..（路径遍历攻击）
    if ".." in path:
        logger.warning(f"检测到路径遍历: {path}")
        raise ValueError(f"非法路径: {path}")
    
    # 构建完整路径
    if path.startswith("/"):
        full_path = path
    else:
        full_path = f"{workspace_base}/{path}" if path else workspace_base
    
    # 用正斜杠比较，不用 os.path.normpath（避免 Windows 反斜杠问题）
    full_path = full_path.replace("\\", "/")
    workspace_base = workspace_base.replace("\\", "/")
    
    # 验证路径是否在允许范围内
    if not full_path.startswith(workspace_base):
        logger.warning(f"路径超出范围: {full_path}")
        raise ValueError(f"路径超出工作空间范围: {full_path}")
    
    return True


def _detect_language(filename: str) -> Optional[str]:
    """根据文件扩展名检测语言
    
    Args:
        filename: 文件名
        
    Returns:
        语言标识，未知返回 None
    """
    ext_map = {
        '.py': 'python',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.html': 'html',
        '.css': 'css',
        '.json': 'json',
        '.md': 'markdown',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.txt': 'plaintext',
        '.sh': 'shell',
        '.sql': 'sql',
        '.xml': 'xml',
        '.java': 'java',
        '.go': 'go',
        '.rs': 'rust',
        '.c': 'c',
        '.cpp': 'cpp',
        '.h': 'c',
    }
    ext = os.path.splitext(filename)[1].lower()
    return ext_map.get(ext)


def ensure_workspace(user_id: int, project_id: int) -> str:
    """创建项目工作空间目录
    
    Args:
        user_id: 用户 ID
        project_id: 项目 ID
        
    Returns:
        远程工作空间路径
    """
    path = _get_workspace_path(user_id, project_id)
    quoted_path = shlex.quote(path)
    result = _ssh_run(f"mkdir -p {quoted_path}")
    
    if result.returncode != 0:
        logger.error(f"创建工作空间失败: {result.stderr}")
        raise RuntimeError(f"创建工作空间失败: {result.stderr}")
    
    logger.info(f"工作空间已就绪: {path}")
    return path


def list_files(user_id: int, project_id: int, path: str = "") -> List[Dict[str, Any]]:
    """递归列出目录内容，返回树形结构
    
    Args:
        user_id: 用户 ID
        project_id: 项目 ID
        path: 子目录路径（相对于项目根目录）
        
    Returns:
        树形结构的文件列表，格式如下：
        [
            {"name": "src", "path": "src", "is_folder": True, "children": [...]},
            {"name": "main.py", "path": "main.py", "is_folder": False, "size": 1234, "language": "python"}
        ]
        
    Raises:
        ValueError: 路径验证失败
        FileNotFoundError: 目录不存在
        ConnectionError: SSH 连接失败
    """
    logger.warning(f"[DEBUG] workspace.list_files 入口: user_id={user_id}, project_id={project_id}, path='{path}'")
    base_path = _get_workspace_path(user_id, project_id)
    target_path = _get_workspace_path(user_id, project_id, path)
    logger.warning(f"[DEBUG] workspace.list_files 路径: base_path={base_path}, target_path={target_path}")
    
    # 验证路径安全（失败时会抛出 ValueError）
    _validate_path(user_id, project_id, target_path)
    
    # 使用 find 命令获取文件列表
    # 格式: type\tpath\tsize
    quoted_path = shlex.quote(target_path)
    find_cmd = f"find {quoted_path} -mindepth 0 -printf '%y\t%P\t%s\\n'"
    
    try:
        result = _ssh_run(find_cmd, timeout=60)
        logger.warning(f"[DEBUG] SSH 执行完成: returncode={result.returncode}, stdout_len={len(result.stdout)}, stderr='{result.stderr[:200] if result.stderr else ''}'")
    except subprocess.TimeoutExpired:
        logger.error(f"SSH 命令超时: {find_cmd}")
        raise ConnectionError(f"SSH 连接超时")
    except Exception as e:
        logger.error(f"SSH 连接失败: {e}")
        raise ConnectionError(f"SSH 连接失败: {e}")
    
    # 检查 SSH 连接是否成功
    if result.returncode != 0:
        # 检查是否是目录不存在
        if "No such file" in result.stderr or "No such file" in result.stdout:
            logger.warning(f"工作空间目录不存在: {target_path}")
            raise FileNotFoundError(f"工作空间目录不存在: {target_path}")
        # 其他 SSH 错误
        logger.error(f"SSH 执行失败: {result.stderr}")
        raise ConnectionError(f"SSH 执行失败: {result.stderr}")
    
    lines = result.stdout.strip().split('\n')
    if not lines or lines == ['']:
        # 空目录 - 这是正常情况，返回空列表
        logger.warning(f"[DEBUG] workspace.list_files 返回空列表 (空目录)")
        return []
    
    # 解析 find 输出，构建文件列表
    items = []
    for line in lines:
        if not line.strip():
            continue
        parts = line.split('\t')
        if len(parts) < 3:
            continue
            
        item_type, item_path, size_str = parts[0], parts[1], parts[2]
        is_folder = item_type == 'd'
        
        # 跳过根目录本身
        if not item_path:
            continue
        
        # 获取相对于项目根目录的路径
        rel_path = item_path
        if path:
            rel_path = f"{path}/{item_path}"
        
        # 获取文件名
        name = os.path.basename(item_path)
        
        item = {
            "name": name,
            "path": rel_path,
            "is_folder": is_folder,
        }
        
        if not is_folder:
            try:
                item["size"] = int(size_str)
            except ValueError:
                item["size"] = 0
            item["language"] = _detect_language(name)
        
        items.append(item)
    
    # 构建树形结构
    def build_tree(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """将扁平列表转换为树形结构"""
        # 按路径层级组织
        path_map: Dict[str, Dict[str, Any]] = {}
        
        # 首先添加所有文件夹
        for item in items:
            if item["is_folder"]:
                path_map[item["path"]] = {**item, "children": []}
        
        # 然后添加文件并组织树结构
        root_items: List[Dict[str, Any]] = []
        
        for item in items:
            if item["is_folder"]:
                continue
            
            # 找到父目录
            parent_path = str(os.path.dirname(item["path"])).replace("\\", "/")
            if parent_path == ".":
                parent_path = ""
            
            item_copy = {**item}
            if "children" in item_copy:
                del item_copy["children"]
            
            if parent_path and parent_path in path_map:
                path_map[parent_path]["children"].append(item_copy)
            else:
                root_items.append(item_copy)
        
        # 将文件夹添加到树中
        folder_items = [item for item in items if item["is_folder"]]
        # 按路径深度排序（深度浅的先处理）
        folder_items.sort(key=lambda x: x["path"].count("/"))
        
        for folder in folder_items:
            parent_path = str(os.path.dirname(folder["path"])).replace("\\", "/")
            if parent_path == ".":
                parent_path = ""
            
            folder_node = path_map[folder["path"]]
            # 清理 children 中不需要的字段
            if "children" not in folder_node:
                folder_node["children"] = []
            
            if parent_path and parent_path in path_map:
                path_map[parent_path]["children"].append(folder_node)
            else:
                root_items.append(folder_node)
        
        # 递归排序：文件夹优先，同级按名称排序
        def sort_items(items_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
            items_list.sort(key=lambda x: (not x.get("is_folder", False), x["name"].lower()))
            for item in items_list:
                if "children" in item and item["children"]:
                    sort_items(item["children"])
            return items_list
        
        return sort_items(root_items)
    
    tree = build_tree(items)
    logger.warning(f"[DEBUG] workspace.list_files 返回树形结构: {len(tree)} 个顶层项")
    return tree


def read_file(user_id: int, project_id: int, file_path: str) -> Optional[str]:
    """读取远程文件内容
    
    Args:
        user_id: 用户 ID
        project_id: 项目 ID
        file_path: 文件路径（相对于项目根目录）
        
    Returns:
        文件内容，失败返回 None
    """
    full_path = _get_workspace_path(user_id, project_id, file_path)
    
    # 验证路径安全
    if not _validate_path(user_id, project_id, full_path):
        logger.error(f"非法路径访问: {full_path}")
        return None
    
    quoted_path = shlex.quote(full_path)
    result = _ssh_run(f"cat {quoted_path}")
    
    if result.returncode != 0:
        logger.error(f"读取文件失败: {result.stderr}")
        return None
    
    return result.stdout


def write_file(user_id: int, project_id: int, file_path: str, content: str) -> bool:
    """写入文件（通过 stdin pipe 写入远程文件）
    
    Args:
        user_id: 用户 ID
        project_id: 项目 ID
        file_path: 文件路径（相对于项目根目录）
        content: 文件内容
        
    Returns:
        成功返回 True，失败返回 False
    """
    full_path = _get_workspace_path(user_id, project_id, file_path)
    
    # 验证路径安全
    if not _validate_path(user_id, project_id, full_path):
        logger.error(f"非法路径访问: {full_path}")
        return False
    
    # 确保父目录存在
    parent_dir = os.path.dirname(full_path)
    if parent_dir:
        quoted_parent = shlex.quote(parent_dir)
        _ssh_run(f"mkdir -p {quoted_parent}")
    
    # 使用 cat 配合 stdin 写入文件
    quoted_path = shlex.quote(full_path)
    result = _ssh_run_with_input(f"cat > {quoted_path}", content)
    
    if result.returncode != 0:
        logger.error(f"写入文件失败: {result.stderr}")
        return False
    
    logger.info(f"文件已写入: {full_path}")
    return True


def delete_path(user_id: int, project_id: int, file_path: str) -> bool:
    """删除文件或目录
    
    Args:
        user_id: 用户 ID
        project_id: 项目 ID
        file_path: 路径（相对于项目根目录）
        
    Returns:
        成功返回 True，失败返回 False
    """
    full_path = _get_workspace_path(user_id, project_id, file_path)
    
    # 验证路径安全
    if not _validate_path(user_id, project_id, full_path):
        logger.error(f"非法路径访问: {full_path}")
        return False
    
    # 额外检查：不允许删除整个工作空间根目录
    workspace_root = _get_workspace_path(user_id, project_id)
    if os.path.normpath(full_path) == os.path.normpath(workspace_root):
        logger.error("不允许删除工作空间根目录")
        return False
    
    quoted_path = shlex.quote(full_path)
    result = _ssh_run(f"rm -rf {quoted_path}")
    
    if result.returncode != 0:
        logger.error(f"删除失败: {result.stderr}")
        return False
    
    logger.info(f"已删除: {full_path}")
    return True


def rename_path(user_id: int, project_id: int, old_path: str, new_path: str) -> bool:
    """重命名文件或文件夹
    
    Args:
        user_id: 用户 ID
        project_id: 项目 ID
        old_path: 原路径（相对于项目根目录）
        new_path: 新路径（相对于项目根目录）
        
    Returns:
        成功返回 True，失败返回 False
    """
    full_old_path = _get_workspace_path(user_id, project_id, old_path)
    full_new_path = _get_workspace_path(user_id, project_id, new_path)
    
    # 验证路径安全
    if not _validate_path(user_id, project_id, full_old_path):
        logger.error(f"非法路径访问: {full_old_path}")
        return False
    if not _validate_path(user_id, project_id, full_new_path):
        logger.error(f"非法路径访问: {full_new_path}")
        return False
    
    quoted_old = shlex.quote(full_old_path)
    quoted_new = shlex.quote(full_new_path)
    result = _ssh_run(f"mv {quoted_old} {quoted_new}")
    
    if result.returncode != 0:
        logger.error(f"重命名失败: {result.stderr}")
        return False
    
    logger.info(f"已重命名: {full_old_path} -> {full_new_path}")
    return True


def move_path(user_id: int, project_id: int, source_path: str, destination_path: str) -> bool:
    """移动文件或文件夹到新位置
    
    Args:
        user_id: 用户 ID
        project_id: 项目 ID
        source_path: 源路径（相对于项目根目录）
        destination_path: 目标路径（相对于项目根目录，包含文件名）
        
    Returns:
        成功返回 True，失败返回 False
    """
    full_source_path = _get_workspace_path(user_id, project_id, source_path)
    full_dest_path = _get_workspace_path(user_id, project_id, destination_path)
    
    # 验证路径安全
    if not _validate_path(user_id, project_id, full_source_path):
        logger.error(f"非法路径访问: {full_source_path}")
        return False
    if not _validate_path(user_id, project_id, full_dest_path):
        logger.error(f"非法路径访问: {full_dest_path}")
        return False
    
    # 确保目标目录存在
    dest_parent = os.path.dirname(full_dest_path)
    if dest_parent:
        quoted_parent = shlex.quote(dest_parent)
        _ssh_run(f"mkdir -p {quoted_parent}")
    
    quoted_source = shlex.quote(full_source_path)
    quoted_dest = shlex.quote(full_dest_path)
    result = _ssh_run(f"mv {quoted_source} {quoted_dest}")
    
    if result.returncode != 0:
        logger.error(f"移动失败: {result.stderr}")
        return False
    
    logger.info(f"已移动: {full_source_path} -> {full_dest_path}")
    return True


def create_folder(user_id: int, project_id: int, folder_path: str) -> bool:
    """创建文件夹
    
    Args:
        user_id: 用户 ID
        project_id: 项目 ID
        folder_path: 文件夹路径（相对于项目根目录）
        
    Returns:
        成功返回 True，失败返回 False
    """
    full_path = _get_workspace_path(user_id, project_id, folder_path)
    
    # 验证路径安全
    if not _validate_path(user_id, project_id, full_path):
        logger.error(f"非法路径访问: {full_path}")
        return False
    
    quoted_path = shlex.quote(full_path)
    result = _ssh_run(f"mkdir -p {quoted_path}")
    
    if result.returncode != 0:
        logger.error(f"创建文件夹失败: {result.stderr}")
        return False
    
    logger.info(f"文件夹已创建: {full_path}")
    return True


def upload_file(user_id: int, project_id: int, file_path: str, file_bytes: bytes) -> bool:
    """上传二进制文件
    
    Args:
        user_id: 用户 ID
        project_id: 项目 ID
        file_path: 目标文件路径（相对于项目根目录）
        file_bytes: 文件二进制内容
        
    Returns:
        成功返回 True，失败返回 False
    """
    full_path = _get_workspace_path(user_id, project_id, file_path)
    
    # 验证路径安全
    if not _validate_path(user_id, project_id, full_path):
        logger.error(f"非法路径访问: {full_path}")
        return False
    
    # 确保父目录存在
    parent_dir = os.path.dirname(full_path)
    quoted_parent = shlex.quote(parent_dir)
    _ssh_run(f"mkdir -p {quoted_parent}")
    
    # 创建本地临时文件
    try:
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        
        # 使用 scp 上传
        ssh_target = _get_ssh_target()
        remote_path = f"{ssh_target}:{shlex.quote(full_path)}"
        
        result = subprocess.run(
            ["scp", tmp_path, remote_path],
            capture_output=True,
            timeout=60,
            encoding='utf-8',
            errors='replace'
        )
        
        # 清理临时文件
        os.unlink(tmp_path)
        
        if result.returncode != 0:
            logger.error(f"上传文件失败: {result.stderr}")
            return False
        
        logger.info(f"文件已上传: {full_path}")
        return True
        
    except Exception as e:
        logger.error(f"上传文件异常: {e}")
        return False


def check_connection() -> bool:
    """检查 SSH 连接是否正常
    
    Returns:
        连接正常返回 True，否则返回 False
    """
    try:
        result = _ssh_run("echo 'OK'", timeout=5)
        return result.returncode == 0 and "OK" in result.stdout
    except Exception as e:
        logger.error(f"SSH 连接检查失败: {e}")
        return False

