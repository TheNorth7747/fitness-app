#!/bin/bash
# ============================================================
#  域名 n0rth.asia → 绑定与 HTTPS 一键脚本
#  服务器公网 IP: 8.163.88.104
#
#  前提：DNS 已添加 A 记录 n0rth.asia → 8.163.88.104
#
#  用法：
#    1) 在阿里云 DNS 控制台添加 A 记录（见下方提示）
#    2) 等待解析生效后执行：
#       scp setup-domain.sh admin@8.163.88.104:/tmp/
#       ssh admin@8.163.88.104
#       sudo bash /tmp/setup-domain.sh
# ============================================================

if [ "$(id -u)" -ne 0 ]; then
    echo "需要 root 权限，请用：sudo bash $0"
    exit 1
fi

DOMAIN="n0rth.asia"
SERVER_IP="8.163.88.104"
WEBROOT="/var/www/fitness"

echo "=========================================="
echo "  域名配置：$DOMAIN"
echo "  服务器：$SERVER_IP"
echo "=========================================="
echo

# ---------- 步骤 1：DNS 检查 ----------
echo "[1/5] 检查 DNS 解析 ..."
DOMAIN_IP=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -1)
[ -z "$DOMAIN_IP" ] && DOMAIN_IP=$(host "$DOMAIN" 2>/dev/null | awk '/has address/{print $NF; exit}')

if [ -n "$DOMAIN_IP" ]; then
    echo "    ✓ $DOMAIN 已解析到 $DOMAIN_IP"
    if [ "$DOMAIN_IP" = "$SERVER_IP" ]; then
        echo "    ✓ 指向正确"
    else
        echo "    [!] 注意：解析到 $DOMAIN_IP，但服务器是 $SERVER_IP"
        echo "        如果这是 CDN 或其他 IP，请确认是否为预期行为"
    fi
else
    echo "    ✗ $DOMAIN 尚未解析到任何 IP"
    echo
    echo "    请先到阿里云 DNS 控制台添加记录："
    echo "      记录类型：A"
    echo "      主机记录：@"
    echo "      记录值  ：$SERVER_IP"
    echo "      TTL     ：默认 600"
    echo
    echo "    可选添加（推荐）："
    echo "      主机记录：www  → 同上记录值"
    echo
    echo "    添加后等待 10 分钟再执行本脚本。"
    echo "    （或用 dig 确认：dig +short $DOMAIN）"
    echo
    exit 1
fi
echo

# ---------- 步骤 2：Nginx 域名配置 ----------
echo "[2/5] 写入 Nginx 域名配置 ..."
cat > /etc/nginx/sites-available/fitness <<NGINX_CONF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    root $WEBROOT;
    index index.html;

    access_log /var/log/nginx/fitness.access.log;
    error_log  /var/log/nginx/fitness.error.log;

    # ---- gzip：919KB 数据文件 → 130KB ----
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript
               application/json image/svg+xml;
    gzip_comp_level 6;

    # ---- 静态资源缓存 ----
    location ~* \.(js|css|svg|png|jpg|gif|ico|woff2)\$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
        access_log off;
    }

    location / {
        add_header Cache-Control "no-cache";
        try_files \$uri \$uri/ =404;
    }

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    client_max_body_size 1m;
}
NGINX_CONF

# 移除裸 IP 的 default_server 站点（让域名配置接管 80）
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/fitness /etc/nginx/sites-enabled/fitness

nginx -t 2>&1 | sed 's/^/    /'
systemctl reload nginx 2>/dev/null || systemctl restart nginx
echo "    ✓ Nginx 已重载"
echo

# ---------- 步骤 3：安装 certbot ----------
echo "[3/5] 安装 Certbot ..."
if command -v certbot >/dev/null 2>&1; then
    echo "    ✓ certbot 已安装"
else
    apt update -qq 2>&1 | tail -1 | sed 's/^/    /'
    apt install -y -qq certbot python3-certbot-nginx 2>&1 | tail -2 | sed 's/^/    /'
    if command -v certbot >/dev/null 2>&1; then
        echo "    ✓ 安装完成"
    else
        echo "    ✗ 安装失败，可稍后手动重试"
    fi
fi
echo

# ---------- 步骤 4：申请证书 ----------
echo "[4/5] 申请 Let's Encrypt 证书 ..."
echo "    域名: $DOMAIN, www.$DOMAIN"
echo "    邮箱: 留空则自动注册"
echo
certbot --nginx \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email \
    --redirect 2>&1 | sed 's/^/    /'

CERT_OK=$?
echo

# ---------- 步骤 5：验证 ----------
echo "[5/5] 验证结果 ..."
sleep 2
echo "    --- HTTP ---"
curl -sI --max-time 10 "http://$DOMAIN" 2>/dev/null | head -3 | sed 's/^/      /'
echo "    --- HTTPS ---"
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "https://$DOMAIN" 2>/dev/null)
echo "      https://$DOMAIN → HTTP ${HTTPS_CODE:-连接失败}"
echo "    --- 证书信息 ---"
if [ "$HTTPS_CODE" = "200" ]; then
    echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null \
        | openssl x509 -noout -issuer -dates 2>/dev/null | sed 's/^/      /'
    echo
    echo "    ============================"
    echo "    ✓ HTTPS 配置成功"
    echo "    ============================"
    echo
    echo "    访问地址: https://$DOMAIN"
    echo "    自动续期: 已配置（certbot.timer），到期前自动续"
    echo
    echo "    验证续期定时器："
    echo "      systemctl list-timers | grep certbot"
else
    echo "    [!] HTTPS 未生效，排查："
    echo "        1. DNS 是否已生效：dig +short $DOMAIN"
    echo "        2. 阿里云安全组是否放行 443"
    echo "        3. 证书是否申请成功：certbot certificates"
    echo
    echo "    若 443 未放行，HTTP 访问仍可正常："
    echo "      http://$DOMAIN"
fi
echo
echo "=========================================="
