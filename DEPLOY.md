# Fitday 部署说明

面向一台全新的 Ubuntu 服务器。所有示例值都是占位符，部署时替换成你自己的域名和密码。

## 架构

| 容器 | 作用 | 暴露范围 |
| --- | --- | --- |
| `db` | PostgreSQL 16，数据在命名卷 `fitday_postgres_data` | 仅内部网络 |
| `api` | Node.js + Fastify，监听 8787 | 仅内部网络 |
| `web` | 构建后的 React 静态文件 + Nginx | 仅内部网络 |
| `caddy` | 唯一公网入口，自动申请并续期证书 | 80 / 443 |

不要把 5432、8787 映射到宿主机公网。

## 1. 准备服务器

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
```

如果服务器无法直连 Docker Hub，先配置镜像加速：

```bash
sudo mkdir -p /etc/docker
printf '{\n  "registry-mirrors": ["https://docker.m.daocloud.io"]\n}\n' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker
```

## 2. 获取代码

```bash
git clone https://github.com/<your-account>/fitness-app.git fitday
cd fitday
```

## 3. 动作媒体（可选但建议）

仓库不含动作 GIF。首次部署时拉取一次，离线也能用：

```bash
python3 scripts/fetch-media.py
```

脚本会从上游数据集把 1,324 个 GIF 下载到 `public/media/exercises/`，并把数据里的路径改为站内 `/media/`。媒体版权归 © Gym visual，公开商用前请自行确认授权。

## 4. 配置环境变量

```bash
umask 077
cat > .env <<EOF
DOMAIN=your-domain.example
POSTGRES_DB=fitday
POSTGRES_USER=fitday
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SESSION_DAYS=30
EOF
chmod 600 .env
```

| 变量 | 说明 |
| --- | --- |
| `DOMAIN` | 已解析到本机的域名；Caddy 用它申请证书 |
| `POSTGRES_PASSWORD` | 随机生成，不入库、不进 Git |
| `SESSION_DAYS` | 登录会话有效期 |

DNS 需要先添加 A 记录：`@` 与 `www` 指向服务器公网 IP。cloud 厂商安全组放行 22、80、443（HTTP/3 另需 443/UDP）。

## 5. 启动

```bash
sudo docker compose build
sudo docker compose up -d
sudo docker compose ps
curl http://127.0.0.1/api/health
```

首次启动时 API 会自动执行 `database/schema.sql`，创建账号、会话、训练和组记录表。

证书签发需要几十秒，随后验证：

```bash
curl -I https://your-domain.example
curl https://your-domain.example/api/health
```

## 6. 防火墙

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

## 7. 备份

`scripts/backup.sh` 会导出一份 PostgreSQL 自定义格式备份，保留最近 14 天：

```bash
chmod +x scripts/backup.sh
./scripts/backup.sh
```

加入每日任务：

```bash
(crontab -l 2>/dev/null; echo "30 3 * * * $PWD/scripts/backup.sh >> $PWD/backups/backup.log 2>&1") | crontab -
```

备份默认只落在本机，生产环境建议再同步到对象存储或另一台机器。

## 8. 更新

```bash
git pull
sudo docker compose build api web
sudo docker compose up -d
```

更新后检查容器状态、`/api/health` 和首页，并跑一次注册、登录、保存训练的流程。

## 9. 回滚

```bash
git checkout <previous-tag>
sudo docker compose build api web
sudo docker compose up -d
```

数据库结构变更需要单独回滚；本项目当前只做增量建表，回滚旧版本不会删除已有数据。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| `caddy` 反复重启 | 检查 80/443 是否被占用，DNS 是否已生效 |
| 证书申请失败 | 确认域名解析指向本机，且 80 端口对公网可达 |
| API 启动报数据库连接失败 | 检查 `.env` 的 `POSTGRES_PASSWORD` 与 `db` 容器是否健康 |
| 页面能开但动作无图 | 执行 `python3 scripts/fetch-media.py` 后重建 `web` |
| 登录后立刻掉线 | 生产环境 Cookie 带 `Secure`，必须通过 HTTPS 访问 |
