# 构建 MCP 容器镜像
docker build -t spider-mcp -f docker/Dockerfile.mcp docker/

# 启动 MCP 容器（如果没有运行的话）
$running = docker ps -q -f name=spider-mcp
if (-not $running) {
    # 先移除可能存在的停止容器
    docker rm -f spider-mcp 2>$null
    docker run -d --name spider-mcp spider-mcp
    Write-Host "MCP 容器已启动: spider-mcp"
} else {
    Write-Host "MCP 容器已在运行中"
}

# 验证
docker exec spider-mcp npx --version
docker exec spider-mcp python3 --version
Write-Host "MCP 容器就绪"
