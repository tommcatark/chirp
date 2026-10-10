#!/usr/bin/env bash
# ============================================================================
# chirp 全栈停止脚本
#
# 用途：停止由 start-all.sh 启动的进程（前端 / 网关 / 认证服务）。
# 说明：不会停止 Docker 容器（数据库、缓存、注册中心保持运行）。
#
# 使用方式：bash stop-all.sh
# ============================================================================

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS="$ROOT/.run/pids"

stop_one() {
  local name="$1" pidfile="$PIDS/$1.pid"
  if [ -f "$pidfile" ]; then
    local pid
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      sleep 2
      kill -9 "$pid" 2>/dev/null
      printf '  \033[32m[已停止]\033[0m %s (PID %s)\n' "$name" "$pid"
    else
      printf '  \033[33m[未运行]\033[0m %s\n' "$name"
    fi
    rm -f "$pidfile"
  else
    printf '  \033[33m[无记录]\033[0m %s\n' "$name"
  fi
}

printf '\n停止应用进程\n'
stop_one chirp-auth
stop_one chirp-gateway
stop_one frontend

printf '\n端口检查\n'
for p in 4173 8080 8081; do
  if netstat -ano 2>/dev/null | grep -q ":$p .*LISTENING"; then
    pid=$(netstat -ano 2>/dev/null | grep ":$p .*LISTENING" | head -1 | awk '{print $NF}')
    printf '  \033[33m[仍占用]\033[0m %s (PID %s)，尝试强制终止\n' "$p" "$pid"
    if [ -n "${pid:-}" ]; then
      taskkill //F //PID "$pid" >/dev/null 2>&1 && printf '  \033[32m[已强制终止]\033[0m %s\n' "$p"
    fi
  else
    printf '  \033[32m[已释放]\033[0m %s\n' "$p"
  fi
done

cat <<'EOF'

Docker 容器未受影响，仍在运行：
  pg17 (5432) / redis (6379) / nacos (8848)
如需停止容器：docker stop pg17 redis nacos

EOF
