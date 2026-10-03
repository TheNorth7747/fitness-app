#!/bin/bash
# ============================================================
#  Fitness_APP 一键部署脚本（Ubuntu）
#  仓库为公开仓库，走 HTTPS 匿名克隆，无需 SSH 密钥
#
#  用法：
#    scp deploy-ubuntu.sh root@服务器IP:/tmp/
#    ssh root@服务器IP
#    bash /tmp/deploy-ubuntu.sh
# ============================================================
set -e

REPO="https://github.com/TheNorth7747/fitness-app.git"
WEBROOT="/var/www/fitness"

echo "=========================================="
echo "  Fitness_APP 部署脚本"
echo "=========================================="
echo

# ---------- 步骤 1：安装 Nginx ----------
echo "[1/5] 检查并安装 Nginx ..."
if command -v nginx >/dev/null 2>&1; then
    echo "      Nginx 已安装：$(nginx -v 2>&1)"
else
    echo "      正在安装 Nginx ..."
    apt update -qq
    apt install -y -qq nginx
    echo "      安装完成"
fi

# ---------- 步骤 2：拉取代码 ----------
echo
echo "[2/5] 拉取仓库（公开仓库 / HTTPS 匿名克隆）..."
rm -rf "$WEBROOT"
mkdir -p "$WEBROOT"
TMP_CLONE=$(mktemp -d)
git clone --depth 1 "$REPO" "$TMP_CLONE/repo" 2>&1 | sed 's/^/      /'

# 只同步部署必需文件，data/ 不会进入服务器
echo "      同步部署文件 ..."
cp -r "$TMP_CLONE/repo/index.html" "$WEBROOT/"
cp -r "$TMP_CLONE/repo/assets"     "$WEBROOT/"
rm -rf "$TMP_CLONE"

echo "      已部署内容："
ls -la "$WEBROOT" | sed 's/^/        /'
echo "      站点大小：$(du -sh "$WEBROOT" | cut -f1)"

# ---------- 步骤 3：权限 ----------
echo
echo "[3/5] 设置文件权限 ..."
chown -R www-data:www-data "$WEBROOT"
find "$WEBROOT" -type d -exec chmod 755 {} \;
find "$WEBROOT" -type f -exec chmod 644 {} \;
echo "      完成"

# ---------- 步骤 4：Nginx 配置 ----------
echo
echo "[4/5] 写入 Nginx 配置 ..."
cat > /etc/nginx/sites-available/fitness <<'NGINX_CONF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/fitness;
    index index.html;

    # ---- 关键 1：gzip ----
    # 919KB 的动作数据文件压缩后仅 130KB，首屏从 1.1MB 降到 168KB
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript
               application/json image/svg+xml;
    gzip_comp_level 6;

    # ---- 关键 2：静态资源长缓存 ----
    location ~* \.(js|css|svg|png|jpg|gif|ico|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
        access_log off;
    }

    # ---- HTML 不缓存，保证更新立即生效 ----
    location / {
        add_header Cache-Control "no-cache";
        try_files $uri $uri/ =404;
    }

    # ---- 安全响应头 ----
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    client_max_body_size 1m;
}
NGINX_CONF

ln -sf /etc/nginx/sites-available/fitness /etc/nginx/sites-enabled/fitness
# 移除默认站点，避免抢占 80 端口导致 404
rm -f /etc/nginx/sites-enabled/default

nginx -t 2>&1 | sed 's/^/      /'
systemctl reload nginx 2>/dev/null || systemctl restart nginx
echo "      Nginx 已重载"

# ---------- 步骤 5：验证 ----------
echo
echo "[5/5] 部署验证 ..."
echo "      --- 首页 ---"
curl -sI http://127.0.0.1 | head -1 | sed 's/^/      /'

echo "      --- 动作数据文件 ---"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/assets/js/data/exercises-data.js)
echo "      HTTP $HTTP  (期望 200)"
if [ "$HTTP" = "200" ]; then
    curl -s http://127.0.0.1/assets/js/data/exercises-data.js | head -c 60 | sed 's/^/      /'
    echo
fi

echo "      --- gzip 生效检查 ---"
curl -sI -H "Accept-Encoding: gzip" http://127.0.0.1/assets/js/data/exercises-data.js \
    | grep -i content-encoding | sed 's/^/      /' || echo "      未启用（检查 nginx.conf）"

echo
echo "=========================================="
echo "  部署完成"
echo "=========================================="
echo
echo "  本机访问：   http://127.0.0.1"
echo "  外部访问：   http://$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo '你的服务器公网IP')"
echo
echo "  接下来建议："
echo "    1. 云服务商安全组放行 80 端口"
echo "    2. 绑定域名并配置 HTTPS："
echo "       apt install -y certbot python3-certbot-nginx"
echo "       certbot --nginx -d your-domain.com"
echo "    3. 浏览器打开验证四个 Tab 是否正常"
echo
echo "  重新部署（代码更新后）："
echo "    cd /tmp && rm -rf fitness-app && git clone --depth 1 \\"
echo "      https://github.com/TheNorth7747/fitness-app.git"
echo "    cp -r fitness-app/index.html fitness-app/assets /var/www/fitness/"
echo "    systemctl reload nginx"
echo
