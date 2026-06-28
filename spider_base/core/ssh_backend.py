"""SSH Workspace Backend for deepagents - 让内置文件工具操作远程 SSH 工作空间"""
import logging
import shlex
import os
from datetime import datetime
from typing import Any

from deepagents.backends.protocol import (
    BackendProtocol, FileInfo, GrepMatch, WriteResult, EditResult,
    FileUploadResponse, FileDownloadResponse
)
from core.workspace import (
    _ssh_run, _get_workspace_path, _validate_path, _ssh_run_with_input
)

logger = logging.getLogger(__name__)


class SSHWorkspaceBackend(BackendProtocol):
    """通过 SSH 操作远程工作空间的 Backend"""

    def __init__(self, user_id: int, project_id: int):
        self.user_id = user_id
        self.project_id = project_id
        self._root = _get_workspace_path(user_id, project_id)

    def _to_remote_path(self, path: str) -> str:
        """将 deepagents 的绝对路径转换为远程工作空间路径

        deepagents 传入的路径是绝对路径（如 `/main.py`），
        需要映射到远程路径 `{workspace_root}/main.py`
        """
        # 去掉开头的斜杠，然后拼接到工作空间根目录
        sub_path = path.lstrip("/")
        return _get_workspace_path(self.user_id, self.project_id, sub_path)

    def _to_virtual_path(self, remote_path: str) -> str:
        """将远程路径转换为 deepagents 虚拟绝对路径"""
        if remote_path.startswith(self._root):
            rel = remote_path[len(self._root):].lstrip("/")
            return "/" + rel if rel else "/"
        return remote_path

    def ls_info(self, path: str) -> list[FileInfo]:
        """列出目录内容，返回 FileInfo 列表"""
        full_path = self._to_remote_path(path)

        try:
            _validate_path(self.user_id, self.project_id, full_path)
        except ValueError as e:
            logger.error(f"路径验证失败: {e}")
            return []

        quoted_path = shlex.quote(full_path)
        # 使用 find 获取文件信息: 修改时间、大小、类型、文件名
        cmd = f"find {quoted_path} -mindepth 1 -maxdepth 1 -printf '%T@ %s %y %P\\n' 2>/dev/null"
        result = _ssh_run(cmd, timeout=30)

        if result.returncode != 0:
            logger.error(f"ls_info 失败: {result.stderr}")
            return []

        files: list[FileInfo] = []
        for line in result.stdout.strip().split('\n'):
            if not line.strip():
                continue
            parts = line.split(' ', 3)
            if len(parts) < 4:
                continue

            mtime_str, size_str, ftype, name = parts[0], parts[1], parts[2], parts[3]

            try:
                # 转换时间戳为 ISO 格式
                mtime = float(mtime_str)
                modified_at = datetime.fromtimestamp(mtime).isoformat()
            except (ValueError, OSError):
                modified_at = None

            try:
                size = int(size_str)
            except ValueError:
                size = 0

            # 构建虚拟路径（相对于 deepagents 的根）
            virtual_path = os.path.join(path, name).replace('\\', '/')
            if not virtual_path.startswith('/'):
                virtual_path = '/' + virtual_path

            file_info: FileInfo = {
                "path": virtual_path,
                "is_dir": ftype == 'd',
                "size": size,
            }
            if modified_at:
                file_info["modified_at"] = modified_at

            files.append(file_info)

        return files

    def read(self, file_path: str, offset: int = 0, limit: int = 2000) -> str:
        """读取文件内容，返回带行号的格式（cat -n 格式）"""
        full_path = self._to_remote_path(file_path)

        try:
            _validate_path(self.user_id, self.project_id, full_path)
        except ValueError as e:
            return f"Error: {e}"

        # 先检查文件是否存在且是文件
        check_cmd = f"test -f {shlex.quote(full_path)} && echo 'FILE' || echo 'NOT_FILE'"
        check_result = _ssh_run(check_cmd, timeout=10)
        if check_result.stdout.strip() != 'FILE':
            return f"Error: File not found or is a directory: {file_path}"

        # 使用 sed 进行分页读取
        # sed -n 'start,endp' 是 1-indexed，所以 offset 需要 +1
        start_line = offset + 1
        end_line = offset + limit
        quoted_path = shlex.quote(full_path)
        cmd = f"sed -n '{start_line},{end_line}p' {quoted_path} 2>/dev/null"
        result = _ssh_run(cmd, timeout=30)

        if result.returncode != 0:
            return f"Error: Failed to read file: {result.stderr}"

        lines = result.stdout.split('\n')
        # 移除最后的空行（如果文件以换行符结尾）
        if lines and lines[-1] == '':
            lines = lines[:-1]

        # 添加行号（cat -n 格式）
        formatted_lines = []
        for i, line in enumerate(lines):
            line_num = offset + i + 1
            # 行号右对齐，宽度为 6，后跟制表符
            formatted_lines.append(f"{line_num:6}\t{line}")

        return '\n'.join(formatted_lines)

    def write(self, file_path: str, content: str) -> WriteResult:
        """写入新文件，如果文件已存在则报错"""
        full_path = self._to_remote_path(file_path)

        try:
            _validate_path(self.user_id, self.project_id, full_path)
        except ValueError as e:
            return WriteResult(error=str(e))

        # 检查文件是否已存在
        check_cmd = f"test -e {shlex.quote(full_path)} && echo 'EXISTS' || echo 'NOT_EXISTS'"
        check_result = _ssh_run(check_cmd, timeout=10)
        if check_result.stdout.strip() == 'EXISTS':
            return WriteResult(error=f"File already exists: {file_path}")

        # 写入文件（使用 workspace.write_file）
        # 需要将绝对路径转换为相对路径
        rel_path = file_path.lstrip('/')
        from core.workspace import write_file
        success = write_file(self.user_id, self.project_id, rel_path, content)

        if success:
            # 对外部存储 backend，files_update 始终为 None
            return WriteResult(path=file_path, files_update=None)
        else:
            return WriteResult(error=f"Failed to write file: {file_path}")

    def edit(self, file_path: str, old_string: str, new_string: str, replace_all: bool = False) -> EditResult:
        """编辑文件内容，执行字符串替换"""
        full_path = self._to_remote_path(file_path)

        try:
            _validate_path(self.user_id, self.project_id, full_path)
        except ValueError as e:
            return EditResult(error=str(e))

        # 检查文件是否存在
        check_cmd = f"test -f {shlex.quote(full_path)} && echo 'FILE' || echo 'NOT_FILE'"
        check_result = _ssh_run(check_cmd, timeout=10)
        if check_result.stdout.strip() != 'FILE':
            return EditResult(error=f"File not found: {file_path}")

        # 读取文件内容
        from core.workspace import read_file
        rel_path = file_path.lstrip('/')
        content = read_file(self.user_id, self.project_id, rel_path)

        if content is None:
            return EditResult(error=f"Failed to read file: {file_path}")

        # 执行替换
        if replace_all:
            new_content = content.replace(old_string, new_string)
            occurrences = content.count(old_string)
        else:
            occurrences = content.count(old_string)
            if occurrences == 0:
                return EditResult(error=f"String not found in file: {old_string[:50]}...")
            if occurrences > 1:
                return EditResult(error=f"String appears {occurrences} times in file. Use replace_all=True to replace all occurrences.")
            new_content = content.replace(old_string, new_string, 1)

        # 写回文件
        from core.workspace import write_file
        success = write_file(self.user_id, self.project_id, rel_path, new_content)

        if success:
            return EditResult(path=file_path, files_update=None, occurrences=occurrences)
        else:
            return EditResult(error=f"Failed to write file: {file_path}")

    def grep_raw(self, pattern: str, path: str | None = None, glob: str | None = None) -> list[GrepMatch] | str:
        """在文件中搜索文本模式"""
        # 确定搜索路径
        if path is None:
            search_path = self._root
        else:
            search_path = self._to_remote_path(path)

        try:
            _validate_path(self.user_id, self.project_id, search_path)
        except ValueError as e:
            return f"Error: {e}"

        quoted_path = shlex.quote(search_path)
        quoted_pattern = shlex.quote(pattern)

        # 构建 grep 命令
        if glob:
            # 使用 --include 过滤文件
            quoted_glob = shlex.quote(glob)
            cmd = f"grep -rn --include={quoted_glob} -e {quoted_pattern} {quoted_path} 2>/dev/null"
        else:
            cmd = f"grep -rn -e {quoted_pattern} {quoted_path} 2>/dev/null"

        result = _ssh_run(cmd, timeout=60)

        # grep 返回 1 表示没有找到匹配，这是正常情况
        if result.returncode not in (0, 1):
            return f"Error: grep failed: {result.stderr}"

        matches: list[GrepMatch] = []
        for line in result.stdout.strip().split('\n'):
            if not line.strip():
                continue

            # 解析 grep 输出格式: path:line:text
            # 注意：路径中可能包含冒号，所以从右边分割
            parts = line.split(':', 2)
            if len(parts) < 3:
                continue

            file_path_raw, line_num_str, text = parts[0], parts[1], parts[2]

            try:
                line_num = int(line_num_str)
            except ValueError:
                continue

            # 将远程路径转换为虚拟路径
            virtual_path = self._to_virtual_path(file_path_raw)

            matches.append({
                "path": virtual_path,
                "line": line_num,
                "text": text
            })

        return matches

    def glob_info(self, pattern: str, path: str = "/") -> list[FileInfo]:
        """使用 glob 模式查找文件"""
        search_path = self._to_remote_path(path)

        try:
            _validate_path(self.user_id, self.project_id, search_path)
        except ValueError as e:
            logger.error(f"路径验证失败: {e}")
            return []

        quoted_path = shlex.quote(search_path)
        # 使用 find 命令模拟 glob
        # 将 glob 模式转换为 find 的 -name 模式
        quoted_pattern = shlex.quote(pattern)

        # 对于 ** 递归模式，使用 find 的默认递归行为
        # 对于普通模式，限制 maxdepth
        if '**' in pattern:
            # 递归搜索
            cmd = f"find {quoted_path} -name {quoted_pattern} -printf '%T@ %s %y %P\\n' 2>/dev/null"
        else:
            # 非递归搜索
            cmd = f"find {quoted_path} -maxdepth 1 -name {quoted_pattern} -printf '%T@ %s %y %P\\n' 2>/dev/null"

        result = _ssh_run(cmd, timeout=60)

        if result.returncode != 0:
            logger.error(f"glob_info 失败: {result.stderr}")
            return []

        files: list[FileInfo] = []
        for line in result.stdout.strip().split('\n'):
            if not line.strip():
                continue
            parts = line.split(' ', 3)
            if len(parts) < 4:
                continue

            mtime_str, size_str, ftype, name = parts[0], parts[1], parts[2], parts[3]

            try:
                mtime = float(mtime_str)
                modified_at = datetime.fromtimestamp(mtime).isoformat()
            except (ValueError, OSError):
                modified_at = None

            try:
                size = int(size_str)
            except ValueError:
                size = 0

            # 构建虚拟路径
            virtual_path = os.path.join(path, name).replace('\\', '/')
            if not virtual_path.startswith('/'):
                virtual_path = '/' + virtual_path

            file_info: FileInfo = {
                "path": virtual_path,
                "is_dir": ftype == 'd',
                "size": size,
            }
            if modified_at:
                file_info["modified_at"] = modified_at

            files.append(file_info)

        return files

    def upload_files(self, files: list[tuple[str, bytes]]) -> list[FileUploadResponse]:
        """上传多个文件"""
        responses: list[FileUploadResponse] = []

        for file_path, content in files:
            full_path = self._to_remote_path(file_path)

            try:
                _validate_path(self.user_id, self.project_id, full_path)
            except ValueError as e:
                responses.append(FileUploadResponse(path=file_path, error="invalid_path"))
                continue

            # 确保父目录存在
            parent_dir = os.path.dirname(full_path)
            if parent_dir:
                quoted_parent = shlex.quote(parent_dir)
                _ssh_run(f"mkdir -p {quoted_parent}")

            # 写入文件（通过 stdin）
            try:
                content_str = content.decode('utf-8')
            except UnicodeDecodeError:
                # 二进制文件，使用 base64 编码传输
                import base64
                encoded = base64.b64encode(content).decode('utf-8')
                quoted_path = shlex.quote(full_path)
                cmd = f"echo {shlex.quote(encoded)} | base64 -d > {quoted_path}"
                result = _ssh_run(cmd, timeout=30)

                if result.returncode != 0:
                    responses.append(FileUploadResponse(path=file_path, error="permission_denied"))
                else:
                    responses.append(FileUploadResponse(path=file_path, error=None))
                continue

            # 文本文件直接写入
            quoted_path = shlex.quote(full_path)
            result = _ssh_run_with_input(f"cat > {quoted_path}", content_str, timeout=30)

            if result.returncode != 0:
                responses.append(FileUploadResponse(path=file_path, error="permission_denied"))
            else:
                responses.append(FileUploadResponse(path=file_path, error=None))

        return responses

    def download_files(self, paths: list[str]) -> list[FileDownloadResponse]:
        """下载多个文件"""
        responses: list[FileDownloadResponse] = []

        for file_path in paths:
            full_path = self._to_remote_path(file_path)

            try:
                _validate_path(self.user_id, self.project_id, full_path)
            except ValueError:
                responses.append(FileDownloadResponse(path=file_path, error="invalid_path"))
                continue

            # 检查路径类型
            check_cmd = f"test -f {shlex.quote(full_path)} && echo 'FILE' || test -d {shlex.quote(full_path)} && echo 'DIR' || echo 'NOT_FOUND'"
            check_result = _ssh_run(check_cmd, timeout=10)
            path_type = check_result.stdout.strip()

            if path_type == 'NOT_FOUND':
                responses.append(FileDownloadResponse(path=file_path, error="file_not_found"))
                continue
            elif path_type == 'DIR':
                responses.append(FileDownloadResponse(path=file_path, error="is_directory"))
                continue

            # 读取文件内容
            quoted_path = shlex.quote(full_path)
            result = _ssh_run(f"cat {quoted_path}", timeout=30)

            if result.returncode != 0:
                if "Permission denied" in result.stderr:
                    responses.append(FileDownloadResponse(path=file_path, error="permission_denied"))
                else:
                    responses.append(FileDownloadResponse(path=file_path, error="file_not_found"))
                continue

            content = result.stdout.encode('utf-8')
            responses.append(FileDownloadResponse(path=file_path, content=content, error=None))

        return responses
