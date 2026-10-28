# Fitday

手机优先的力量训练 PWA。打开直接进入首页，游客可浏览；登录与注册在「我的」里，登录后保存计划、动作偏好与每一组训练记录。

四套循环计划、按上次成绩自动预填重量、训练草稿跨刷新恢复、完成总结与个人记录、动作趋势曲线、JSON 数据导出、离线缓存与桌面安装。

## 界面

| 动作库 | 动作学习 | 训练记录 |
| --- | --- | --- |
| ![](docs/screenshots/01-library.png) | ![](docs/screenshots/02-exercise-detail.png) | ![](docs/screenshots/03-workout.png) |

## 功能

- **循环计划**：健身房三分化、四分化肩单练、四分化手臂单练、居家三分化；按训练日推进，不被星期几绑住
- **今日训练**：动作组按「选 N 个、共 M 组」拆分，组间倒计时，可替换同组候选动作
- **计划自定义**：每个动作默认 4–5 组；可自行勾选动作、调整各动作组数（1–8），卡片内展示推荐动作与对应组数作为参考，按训练日保存
- **渐进负荷**：读取该动作上一场表现，全部达到次数上限才加重量，否则保持重量冲次数，并说明推荐原因
- **训练连续性**：草稿按账号存在本机，刷新、切后台、退出、断网都不丢
- **动作库**：1,324 个动作，按 8 个肌群进入，再用器械和目标肌肉筛选；中文名称与分步教学
- **力量趋势**：每个动作的历史曲线、最佳预估 1RM、最佳重量与次数
- **数据导出**：包含账号计划与全部训练记录的 JSON
- **PWA**：安装到桌面，缓存应用外壳、动作数据和已访问媒体

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React 19 + Vite + TypeScript |
| 后端 | Node.js + Fastify + PostgreSQL |
| 样式 | 原生 CSS，深色训练主题 |
| 部署 | Docker Compose + Nginx + Caddy（自动 HTTPS） |
| 测试 | `node:test` + Playwright 端到端脚本 |

## 快速开始

```bash
npm install
npm run dev          # 前端 http://localhost:5173
```

前端把 `/api` 代理到 `http://127.0.0.1:8787`。启动后端需要可用的 PostgreSQL：

```bash
export DATABASE_URL="postgres://fitday:password@127.0.0.1:5432/fitday"
npm run dev:server
```

首次启动会自动执行 `database/schema.sql`。

### 动作媒体

仓库不含动作 GIF（1,324 个，约 130 MB，版权归 © Gym visual）。需要图片时拉取一次：

```bash
python3 scripts/fetch-media.py
```

脚本从上游开源数据集下载 GIF 到 `public/media/exercises/`，并把 `public/data/exercises.json` 的路径改写为站内 `/media/`。没有执行这一步时，界面会用占位块代替图片，其余功能不受影响。

### 构建与检查

```bash
npm run build        # 前端生产构建
npm run build:server # 后端 TypeScript 编译
npm test             # 16 项计划、渐进、密码与会话测试
npm run lint         # oxlint
```

## 目录

```text
src/               React 页面、组件与 API 客户端
shared/            前后端共享类型、计划规则、渐进负荷算法
server/src/        Fastify API、密码哈希、会话、数据访问
server/test/       计划、渐进、数据完整性与密码逻辑测试
database/          PostgreSQL 表结构
public/data/       1,324 个动作的中文说明数据
public/media/      动作 GIF（由脚本生成，不入库）
scripts/           动作名本地化、媒体拉取、数据库备份
docs/              产品需求与技术架构
```

## 数据与隐私

- 密码使用 scrypt 加盐哈希，数据库不保存明文
- 会话使用 HttpOnly、SameSite=Lax Cookie，生产环境启用 Secure
- 训练、训练组、动作替换偏好都按用户 ID 查询和写入，服务端校验归属
- 计划是代码内固定模板，用户只保存选择与训练记录
- 仓库不含任何服务器地址、域名、账号或密钥；部署配置走 `.env`

## 动作库

- 两级浏览：先按肌群进入，再按器械和目标肌肉缩小范围
- 中文名称覆盖全部 1,324 个动作，英文原名保留为副标题
- 支持中文、英文、肌群、器械和步骤内容搜索
- 详情页包含 GIF、标签、中文分步说明、练习提示和同部位动作
- 中文名由 `scripts/localize-exercise-names.py` 按健身术语词表生成，未使用第三方翻译数据
- 动作数据请求带版本号，Service Worker 对 `/data/` 走网络优先，避免旧缓存显示旧数据

## 部署

见 [DEPLOY.md](./DEPLOY.md)。一台全新 Ubuntu 服务器，四条命令起 PostgreSQL、API、Nginx 和 Caddy。

## 文档

- [部署与运维](./DEPLOY.md)
- [技术架构与数据边界](./docs/ARCHITECTURE.md)
- [产品需求](./docs/PRD.md)
- [第三方来源与授权](./THIRD_PARTY_NOTICES.md)

## 第三方授权

动作数据结构与文字说明来自 `hasaneyldrm/exercises-dataset`（MIT）。图片与 GIF 版权为 © Gym visual，仓库不再分发，需按 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) 自行确认商用授权。

## License

MIT
