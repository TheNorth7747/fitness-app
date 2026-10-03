#!/bin/bash
# ============================================================
#  Nginx 诊断 + 自动修复脚本
#  解决：curl http://127.0.0.1 连不上（port 80 无监听）
#
#  用法：
#    bash /tmp/diagnose-nginx.sh
#
#  设计要点：
#    - 非 root 自动提权（很多云服务器默认用户不是 root）
#    - 只诊断不破坏：先打印发现的问题，再逐项修复
#    - 幂等：可重复执行
#    - 兼容 systemd / sysvinit / 裸 nginx 三种启动方式
# ============================================================

# ---------- 自动提权 ----------
if [ "$(id -u)" -ne 0 ]; then
    echo "[!] 当前用户不是 root，尝试用 sudo 提权..."
    SUDO="sudo"
    if ! sudo -n true 2>/dev/null; then
        echo "[!] sudo 需要密码，请改用：sudo bash $0"
        exit 1
    fi
else
    SUDO=""
fi

echo "=========================================="
echo "  Nginx 诊断报告"
echo "=========================================="
echo "当前用户: $(whoami)  (uid=$(id -u))"
echo "系统: $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || uname -a)"
echo

# ---------- 检查 1：Nginx 是否安装 ----------
echo "--- [1] Nginx 安装状态 ---"
if command -v nginx >/dev/null 2>&1; then
    echo "  ✓ 已安装：$(nginx -v 2>&1)"
    HAS_NGINX=1
else
    echo "  ✗ 未安装"
    HAS_NGINX=0
fi
echo

# ---------- 检查 2：服务状态 ----------
echo "--- [2] 服务运行状态 ---"
if [ "$HAS_NGINX" = "1" ]; then
    if command -v systemctl >/dev/null 2>&1; then
        STATE=$(systemctl is-active nginx 2>/dev/null || echo "unknown")
        echo "  systemctl: $STATE"
        [ "$STATE" = "inactive" ] && echo "  → 问题：服务未启动"
        [ "$STATE" = "failed" ]  && echo "  → 问题：启动失败（配置可能有误）"
    elif command -v service >/dev/null 2>&1; then
        echo "  (sysvinit 系统)"
    else
        echo "  (无 systemd，可能是容器环境)"
    fi
    pgrep -x nginx >/dev/null 2>&1 && echo "  进程: 存在 nginx 进程" || echo "  进程: 无 nginx 进程"
fi
echo

# ---------- 检查 3：端口占用 ----------
echo "--- [3] 端口 80 占用情况 ---"
if command -v ss >/dev/null 2>&1; then
    LISTEN=$(ss -tlnp 2>/dev/null | grep -E ':80\s|:80$')
elif command -v netstat >/dev/null 2>&1; then
    LISTEN=$(netstat -tlnp 2>/dev/null | grep -E ':80\s|:80$')
else
    LISTEN=""
fi
if [ -n "$LISTEN" ]; then
    echo "  ✓ 端口 80 已被监听:"
    echo "$LISTEN" | sed 's/^/      /'
else
    echo "  ✗ 端口 80 无任何进程监听"
fi
# 检查端口冲突
if command -v ss >/dev/null 2>&1; then
    CONFLICT=$(ss -tlnp 2>/dev/null | grep -E ':(80|443|8080)\s' | grep -v nginx || true)
    [ -n "$CONFLICT" ] && { echo "  [!] 疑似端口冲突:"; echo "$CONFLICT" | sed 's/^/      /'; }
fi
if [ -x /etc/init.d/apache2 ]; then
    APACHE=$(pgrep -x apache2 >/dev/null 2>&1 && echo "运行中" || echo "已安装但未运行")
    echo "  [!] 检测到 apache2：$APACHE（如需 Nginx 可卸载：apt remove apache2）"
fi
echo

# ---------- 检查 4：配置与站点 ----------
echo "--- [4] 配置与站点文件 ---"
if [ "$HAS_NGINX" = "1" ]; then
    echo "  配置测试:"
    $SUDO nginx -t 2>&1 | sed 's/^/      /'
    echo
    if [ -f /etc/nginx/sites-available/fitness ]; then
        echo "  ✓ 存在 /etc/nginx/sites-available/fitness"
        ls -la /etc/nginx/sites-available/fitness | awk '{print "      权限:", $1, "大小:", $5, "字节"}'
    else
        echo "  ✗ 不存在 /etc/nginx/sites-available/fitness（部署脚本未完成？）"
    fi
    if [ -L /etc/nginx/sites-enabled/fitness ]; then
        echo "  ✓ 软链接已启用"
    elif [ -f /etc/nginx/sites-enabled/fitness ]; then
        echo "  [!] 是普通文件而非软链接"
    else
        echo "  ✗ 未启用（缺少 /etc/nginx/sites-enabled/fitness 软链接）"
    fi
    ls /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^/      已启用: /'
fi
echo

# ---------- 检查 5：网站文件 ----------
echo "--- [5] 网站文件 ---"
if [ -d /var/www/fitness ]; then
    echo "  ✓ /var/www/fitness 存在"
    echo "  内容:"
    ls -la /var/www/fitness | head -8 | sed 's/^/      /'
    [ -f /var/www/fitness/index.html ] && echo "  ✓ index.html 存在" || echo "  ✗ index.html 缺失"
    [ -d /var/www/fitness/assets ] && echo "  ✓ assets/ 存在" || echo "  ✗ assets/ 缺失"
    echo "  大小: $(du -sh /var/www/fitness 2>/dev/null | cut -f1)"
else
    echo "  ✗ /var/www/fitness 不存在（文件未部署）"
fi
echo

# ============================================================
#  修复阶段
# ============================================================
echo "=========================================="
echo "  开始修复"
echo "=========================================="

# 修复 1：安装 Nginx
if [ "$HAS_NGINX" = "0" ]; then
    echo "[修复1] 安装 Nginx ..."
    $SUDO apt update -qq 2>&1 | tail -2 | sed 's/^/    /'
    $SUDO apt install -y -qq nginx 2>&1 | tail -3 | sed 's/^/    /'
    if command -v nginx >/dev/null 2>&1; then
        echo "    ✓ 安装成功"
        HAS_NGINX=1
    else
        echo "    ✗ 安装失败，请手动检查网络与 apt 源"
        exit 1
    fi
    echo
fi

# 修复 2：释放端口冲突
if [ -x /etc/init.d/apache2 ] && pgrep -x apache2 >/dev/null 2>&1; then
    echo "[修复2] 停止占用 80 端口的 apache2 ..."
    $SUDO service apache2 stop 2>&1 | sed 's/^/    /'
    $SUDO a2dissite 000-default 2>/dev/null | sed 's/^/    /'
    echo "    ✓ 已停止"
    echo
fi

# 修复 3：确保站点配置存在
if [ ! -f /etc/nginx/sites-available/fitness ] && [ -d /var/www/fitness ]; then
    echo "[修复3] 生成 Nginx 配置 ..."
    $SUDO tee /etc/nginx/sites-available/fitness >/dev/null <<'CONF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root /var/www/fitness;
    index index.html;
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    location ~* \.(js|css|svg|png|jpg|gif|ico|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
        access_log off;
    }
    location / { add_header Cache-Control "no-cache"; try_files $uri $uri/ =404; }
    add_header X-Content-Type-Options nosniff always;
    client_max_body_size 1m;
}
CONF
    echo "    ✓ 配置已写入"
    echo
fi

# 修复 4：启用站点
$SUDO ln -sf /etc/nginx/sites-available/fitness /etc/nginx/sites-enabled/fitness 2>/dev/null
$SUDO rm -f /etc/nginx/sites-enabled/default
echo "[修复4] 站点已启用，default 站点已移除"
echo

# 修复 5：测试配置
echo "[修复5] 测试配置 ..."
if ! $SUDO nginx -t 2>&1 | sed 's/^/    /'; then
    echo "    ✗ 配置有误，请修正后重试"
    exit 1
fi
echo

# 修复 6：启动 Nginx（兼容三种方式）
echo "[修复6] 启动 Nginx ..."
STARTED=0
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    if $SUDO systemctl restart nginx 2>&1 | sed 's/^/    /'; then STARTED=1; fi
fi
if [ "$STARTED" = "0" ] && [ -x /etc/init.d/nginx ]; then
    $SUDO service nginx restart 2>&1 | sed 's/^/    /' && STARTED=1
fi
if [ "$STARTED" = "0" ] || ! pgrep -x nginx >/dev/null 2>&1; then
    echo "    尝试直接启动 ..."
    $SUDO nginx 2>&1 | sed 's/^/    /'
    sleep 1
fi
pgrep -x nginx >/dev/null 2>&1 && echo "    ✓ nginx 进程已运行" || echo "    ✗ 启动失败"
echo

# ---------- 最终验证 ----------
echo "=========================================="
echo "  验证结果"
echo "=========================================="
sleep 1
echo "--- 端口状态 ---"
if command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | grep -E ':80\s' | sed 's/^/  /' || echo "  ✗ 80 端口仍无监听"
fi
echo
echo "--- HTTP 请求 ---"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://127.0.0.1 2>/dev/null)
echo "  首页 HTTP: ${CODE:-连接失败}"
if [ "$CODE" = "200" ]; then
    echo
    echo "  ✓ 部署成功！"
    echo
    echo "  数据文件检查:"
    DC=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://127.0.0.1/assets/js/data/exercises-data.js)
    echo "    exercises-data.js: HTTP $DC $([ "$DC" = "200" ] && echo '✓' || echo '✗')"
    AC=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://127.0.0.1/assets/css/app.css)
    echo "    app.css:           HTTP $AC $([ "$AC" = "200" ] && echo '✓' || echo '✗')"
    GZ=$(curl -sI -H "Accept-Encoding: gzip" --max-time 10 http://127.0.0.1/assets/js/data/exercises-data.js | grep -i content-encoding | tr -d '\r')
    echo "    gzip:              ${GZ:-未启用}"
    echo
    echo "  外部访问（需在阿里云安全组放行 80 端口）:"
    IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
    echo "    http://$IP"
else
    echo
    echo "  ✗ 仍无法访问。请把上方诊断信息发出来。"
fi
echo
echo "=========================================="
