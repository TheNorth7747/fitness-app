# Fitday 架构

## 总览

```text
Browser / PWA
  ├─ React 页面与组件
  ├─ localStorage：训练草稿、最近登录用户
  └─ Service Worker：外壳、动作数据、已访问媒体
        │ HTTPS / Cookie
        ▼
Caddy → Nginx
        ├─ /       React 静态文件
        ├─ /media  1,324 个动作 GIF
        └─ /api    Fastify
                     └─ PostgreSQL
```

## 前端

- `src/App.tsx`：会话恢复、页面状态、训练草稿、离线身份和路由壳。
- `src/components/WorkoutScreen.tsx`：组次记录、建议原因、休息计时和草稿写入。
- `src/components/LibraryScreen.tsx`：肌群入口、器械/目标筛选、中文搜索、动作学习详情和最近浏览。
- `src/components/ProfileScreen.tsx`：训练统计、动作趋势、历史详情、数据导出与安装入口。
- `shared/progression.ts`：纯函数，负责次数区间、Epley e1RM、下次重量建议、训练总结和趋势聚合。
- `src/workoutDraft.ts`：按用户保存到本机，避免刷新或退出丢失未完成训练。
- `src/offlineCache.ts`：仅缓存最近登录用户的公开资料，离线时恢复只读会话和草稿；不缓存密码或令牌。

动作数据在构建阶段由 `scripts/localize-exercise-names.py` 生成中文显示名。术语表按器械、动作、身体部位、握法和姿态组合翻译，并保留英文原名作为副标题；该词表和翻译结果是 Fitday 自有数据，不使用 openGym 的 AGPL 翻译文件。

训练建议只从已完成历史推导，不把建议写回历史。规则是：

1. 没有历史：不编造起始重量。
2. 全部组达到次数上限：下次增加 2.5 kg；腿部动作增加 5 kg。
3. 有组低于下限：保持重量，先补足次数。
4. 处于区间中：保持重量，下次多冲 1 次。
5. 徒手动作达到上限：提示更换更难变式或增加负重。
6. 预估 1RM 采用 Epley：`weight × (1 + reps / 30)`，无效或超过 30 次不计算。

## 动作分类

客户端载入数据后计算两个稳定分类字段：

- `primaryGroup`：胸、背、肩、手臂、腿、臀、核心、有氧、其他
- `equipmentGroup`：自重、哑铃、杠铃、绳索、器械、弹力带、壶铃、其他

分类用于动作库首屏入口和筛选；目标肌群则使用数据中的 `target` 字段做第三级筛选。搜索覆盖中英文名称、目标、器械和步骤文本。

### 动作数据缓存

- 前端请求 `/data/exercises.json?v=3`，版本号变化即绕过旧缓存
- 加载后校验中文名覆盖率，低于 90% 时用带时间戳的地址重取一次
- Service Worker `fitday-shell-v3`：`/data/` 走网络优先（5 秒超时回退缓存），导航网络优先，媒体缓存优先
- nginx 对 `/data/` 设 `expires -1`，浏览器每次校验
- 新 worker 接管时页面自动刷新一次，避免新旧资源混用

## 后端

- `server/src/app.ts`：全部路由、会话校验、输入校验和权限过滤。
- `server/src/auth.ts`：scrypt 加盐密码哈希与会话令牌。
- `database/schema.sql`：用户、会话、训练和组记录。
- 所有个人数据查询都带 `user_id` 条件。
- API 不对外暴露端口，只经 Nginx 内部代理。

训练保存使用数据库事务。训练日必须属于当前计划，未选计划或跨计划提交会被拒绝。

## 数据存储边界

| 数据 | 位置 | 原因 |
|---|---|---|
| 账号、计划选择、训练记录 | PostgreSQL | 跨设备、可恢复、可备份 |
| 未完成训练草稿 | 设备 localStorage | 刷新和离线时先保留，保存成功后清除 |
| 最近登录用户公开资料 | 设备 localStorage | 离线打开时恢复界面身份 |
| 动作字典与媒体 | 静态文件 | 全局只读，可缓存 |
| 登录令牌 | HttpOnly Cookie | 前端脚本不可读取 |

## 离线边界

Service Worker 缓存应用外壳、动作字典和已访问的动作 GIF。离线时：

- 可打开已缓存页面、动作库和最近账号上下文
- 可开始或继续训练，进度写入本机草稿
- 不能登录、读取最新服务端历史或提交训练
- 联网后重新打开页面，服务端会话恢复，草稿可继续并再次保存

这不是完整的离线写队列。避免在 API 响应丢失时重复写入训练，当前版本选择明确提示用户联网后再次保存。

## 测试

- `server/test/progression.test.ts`：次数解析、e1RM、建议、PR、趋势
- `server/test/plans.test.ts`：计划结构、动作名匹配、全部媒体文件存在
- `server/test/password.test.ts`：密码哈希与会话令牌
- 浏览器端到端：游客、注册、计划、草稿恢复、30 组保存、总结、趋势、导出、重登与离线缓存

## 产品参考与许可证隔离

产品方向参考 openGym 展示的“训练连续性、渐进负荷、PR、数据导出、离线使用”思路。openGym 为 AGPL-3.0，本项目未复制其源码、样式或文案；相同能力按本项目的关系型数据模型独立实现。详见 `THIRD_PARTY_NOTICES.md`。
