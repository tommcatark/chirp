#!/usr/bin/env bash
# ============================================================================
# chirp 全栈一键启动脚本
#
# 用途：在本机启动 chirp 项目的全部组件（前端 + 网关 + 认证服务）。
# 说明：本脚本只启动进程，不修改任何项目文件。
#
# 使用方式（在你自己的终端里执行，不要在 AI 会话里执行）：
#   1. Git Bash:  bash start-all.sh
#   2. 停止:      bash stop-all.sh
#
# 前置条件：
#   - Docker Desktop 已启动，且三个容器在运行：pg17 / redis / nacos
#   - backend 各模块已打包（target/*.jar 存在）
# ============================================================================

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$ROOT/.run/logs"
PIDS="$ROOT/.run/pids"

JAVA="C:/Program Files/Java/jdk-25.0.4.1/bin/java"
NODE="$(command -v node || echo 'C:/Program Files/nodejs/node.exe')"

mkdir -p "$LOGS" "$PIDS"

say() { printf '\n\033[36m%s\033[0m\n' "$*"; }
ok()  { printf '  \033[32m[OK]\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m[FAIL]\033[0m %s\n' "$*"; }

# ---------------------------------------------------------------- 0. 前置检查
say "0. 前置检查"

if ! docker info >/dev/null 2>&1; then
  bad "Docker 守护进程未运行 —— 请先启动 Docker Desktop"
  exit 1
fi
ok "Docker 守护进程正常"

for c in pg17 redis nacos; do
  if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" = "true" ]; then
    ok "容器 $c 运行中"
  else
    echo "  ... 启动容器 $c"
    docker start "$c" >/dev/null 2>&1 && ok "容器 $c 已启动" || { bad "容器 $c 启动失败"; exit 1; }
  fi
done

AUTH_JAR="$ROOT/backend/chirp-auth/target/chirp-auth-0.0.1-SNAPSHOT.jar"
GW_JAR="$ROOT/backend/chirp-gateway/target/chirp-gateway-0.0.1-SNAPSHOT.jar"

if [ ! -f "$AUTH_JAR" ] || [ ! -f "$GW_JAR" ]; then
  bad "找不到后端 jar，请先打包："
  echo "     cd backend && mvn -DskipTests package"
  echo "  （注意：当前 chirp-gateway 存在一个编译缺陷，"
  echo "   需先应用 docs/fix-gateway-redis-dependency.patch）"
  exit 1
fi
ok "后端 jar 已就绪"

# 端口占用检查
for p in 4173 8080 8081; do
  if netstat -ano 2>/dev/null | grep -q ":$p .*LISTENING"; then
    bad "端口 $p 已被占用，请先释放（可能是上次未正常退出）"
  fi
done

# ------------------------------------------------------------- 1. 启动后端服务
say "1. 启动 chirp-auth (:8081)"
"$JAVA" -jar "$AUTH_JAR" --server.port=8081 > "$LOGS/chirp-auth.log" 2>&1 &
echo $! > "$PIDS/chirp-auth.pid"
ok "已拉起，PID $(cat "$PIDS/chirp-auth.pid")"

say "2. 启动 chirp-gateway (:8080)"
"$JAVA" -jar "$GW_JAR" --server.port=8080 > "$LOGS/chirp-gateway.log" 2>&1 &
echo $! > "$PIDS/chirp-gateway.pid"
ok "已拉起，PID $(cat "$PIDS/chirp-gateway.pid")"

# ----------------------------------------------------------------- 3. 启动前端
say "3. 启动前端静态服务 (:4173)"
( cd "$ROOT" && exec "$NODE" server.mjs ) > "$LOGS/frontend.log" 2>&1 &
echo $! > "$PIDS/frontend.pid"
ok "已拉起，PID $(cat "$PIDS/frontend.pid")"

# ------------------------------------------------------------------- 4. 等就绪
say "4. 等待服务就绪"
ready=0
for i in $(seq 1 40); do
  sleep 3
  A=$(netstat -ano 2>/dev/null | grep -c ':8081.*LISTENING')
  G=$(netstat -ano 2>/dev/null | grep -c ':8080.*LISTENING')
  F=$(netstat -ano 2>/dev/null | grep -c ':4173.*LISTENING')
  if [ "$A" -gt 0 ] && [ "$G" -gt 0 ] && [ "$F" -gt 0 ]; then
    ok "全部就绪（耗时 $((i*3)) 秒）"
    ready=1
    break
  fi
done

if [ "$ready" -eq 0 ]; then
  bad "部分服务未在 120 秒内就绪，请查看日志：$LOGS"
fi

say "5. 冒烟测试"
code() { curl -s -4 -o /dev/null -w '%{http_code}' --max-time 10 "$1"; }
C1=$(code "http://127.0.0.1:8080/api/posts")
C2=$(code "http://127.0.0.1:8080/api/auth/public-key")
C3=$(code "http://127.0.0.1:4173/")
printf '  GET  :8080/api/posts            -> %s\n' "$C1"
printf '  GET  :8080/api/auth/public-key  -> %s\n' "$C2"
printf '  GET  :4173/                     -> %s\n' "$C3"

say "启动完成"
cat <<EOF

  前端入口   http://localhost:4173
  网关入口   http://localhost:8080
  认证服务   http://localhost:8081
  Nacos控制台 http://localhost:8849

  测试账号   zhangsan@example.com / password123
            （另有 lisi / wangwu / zhaoliu / sunqi，同密码）

  日志目录   $LOGS
  停止服务   bash stop-all.sh

EOF
