# CALLING 项目 Manus 交接操作手册

---

## 🔴 Agent 必读：你现在只有一个任务

> **你被 Owner 雇来做的事只有一件：把这个项目部署起来，让 Owner 能看到预览窗口。**
>
> **不是开发新功能。不是修 Bug。不是优化代码。只是部署。**

**迁移完成后，你必须说这句话，然后停下来等待 Owner 指令：**

```
迁移完成！
- 网站已部署：[预览 URL]
- 测试结果：全部 XX 个测试通过
- GitHub 代码：与 main 分支 commit [hash] 一致
- Manus 检查点：已保存

请告诉我接下来需要做什么。
```

**如果 Owner 没有给你新的开发指令，你什么都不要做。**

---

## 🚫 绝对禁止事项（违反即视为任务失败）

- ❌ 不得自行开发任何新功能
- ❌ 不得修改任何现有代码（包括 Home.tsx、routers.ts、schema.ts 等）
- ❌ 不得添加任何新文件（组件、页面、路由等）
- ❌ 不得"顺手优化"或"顺便修复"任何问题
- ❌ 不得根据 `todo.md` 中的待办项自行实现功能
- ❌ 不得根据 `PRODUCT_HANDOFF.md` 中的 Backlog 自行开发
- ❌ 不得在没有收到 Owner 明确指令的情况下继续任何开发工作

> **为什么有这条规定**：之前的 Agent 在迁移时误读了需求，自作主张开发了草稿箱页面、PC 端侧边栏、Web Push 等功能，导致代码混乱，浪费了大量 token，需要回滚。

---

## ✅ 迁移步骤（严格按顺序执行，不得跳过，不得增加）

### 第一步：初始化 Manus 项目

```
使用 webdev_init_project 初始化项目
- 项目名：calling
- 模板：web-db-user（含数据库和用户系统）
```

### 第二步：从 GitHub 导入代码

```bash
cd /home/ubuntu/calling

# 添加 GitHub 远程（Token 请向 Owner 索取）
git remote add github https://[TOKEN]@github.com/xing0325/calling-suishoji.git

# 拉取并覆盖本地代码
git fetch github
git checkout github/main -- .
```

### 第三步：安装依赖

```bash
cd /home/ubuntu/calling
pnpm install
```

### 第四步：同步数据库结构

> ⚠️ **重要**：不要用 `pnpm db:push`，它在新账号上会因为迁移历史不存在而报错。
> 正确做法是用 `webdev_execute_sql` 手动执行迁移 SQL。

读取 `drizzle/` 目录下所有 `.sql` 迁移文件（按编号顺序），逐个用 `webdev_execute_sql` 执行。

如果某条 SQL 报"表已存在"或"列已存在"，跳过即可，不是错误。

### 第五步：配置 VAPID 环境变量

> ⚠️ **不要自己生成新的 VAPID 密钥**，否则之前订阅了 Push 通知的用户需要重新订阅。
> 请向 Owner 索取原账号的 VAPID 密钥。如果 Owner 说"重新生成也没关系"，再执行：
> `node -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log(JSON.stringify(k))"`

使用 `webdev_request_secrets` 配置以下三个变量：
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`（格式：`mailto:your@email.com`）

### 第六步：运行测试

```bash
cd /home/ubuntu/calling
pnpm test
```

**必须全部通过**。如果有失败，检查是否是数据库连接问题（不要修改代码）。

### 第七步：重启开发服务器

使用 `webdev_restart_server` 重启服务器，确认服务正常运行。

### 第八步：保存检查点

使用 `webdev_save_checkpoint` 保存检查点。

### 第九步：向 Owner 报告，然后停下来

说出上面"迁移完成"的标准话术，**然后停下来等待 Owner 的指令**。

---

## 🤝 Claude Code 协作说明

本项目同时由 **Manus Agent** 和 **Claude Code（Claude CLI）** 共同维护，GitHub 是唯一共享上下文。

**协作规则：**
- Owner 的每次修改指令，可能来自 Manus 或 Claude Code，两者都遵守同一套 Checklist
- 每次 Claude Code 完成修改后：① 推送到 GitHub main 分支 ② 更新 PRODUCT_HANDOFF.md（版本号+0.1）③ 告诉 Owner commit hash
- Manus 收到 Owner 指令"拉取最新代码"时，执行：`git fetch github && git checkout github/main -- .`，然后 `pnpm install`，不要自行开发

---

## 📋 每次修改代码后必须执行的 Checklist

> **每次完成功能或修复 Bug 后，必须按顺序执行以下全部步骤。缺少任何一步视为任务未完成。**

```
1. pnpm test —— 确认全部测试通过
2. 更新 PRODUCT_HANDOFF.md：版本号 +0.1，已完成功能，数据库变更，API 变更
3. 更新本文档第七节"当前版本状态"：版本号、GitHub Commit、Manus Checkpoint
4. git add . && git commit -m "描述" && git push github main --force-with-lease
   （注意：commit message 中不得包含 GitHub Token 明文，否则 GitHub 会拒绝推送）
5. webdev_save_checkpoint
6. 告诉 Owner：已完成 GitHub 推送（附 commit hash）和检查点保存
```

**GitHub 仓库**：https://github.com/xing0325/calling-suishoji  
**GitHub Token**：请向项目 Owner 索取（Token 以 `ghp_` 开头）

---

## ❓ 常见问题

**Q：`pnpm db:push` 报错怎么办？**

不要用 `pnpm db:push`。改用 `webdev_execute_sql` 手动执行 `drizzle/` 目录下的 `.sql` 文件，按编号顺序执行，"已存在"的错误可以忽略。

**Q：数据库是空的，历史数据怎么办？**

历史数据留在原 Manus 账号的数据库里，无法迁移。新账号数据库是全新的，需要重新注册账号使用。这是 Manus 平台的限制。

**Q：AI 功能（invokeLLM）需要配置 API Key 吗？**

不需要。`invokeLLM` 使用 Manus 平台内置 API，密钥由平台自动注入（`BUILT_IN_FORGE_API_KEY`），新账号同样会自动注入。

**Q：Push 通知不工作怎么办？**

检查 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_EMAIL` 三个环境变量是否已配置（Manus 管理面板 → Settings → Secrets）。

**Q：Agent 自作主张开发了额外功能怎么办？**

立即回滚：
```bash
git checkout github/main -- .
pnpm install
```
然后重新运行测试、保存检查点。

**Q：TypeScript 报 118 个错误怎么办？**

这是 `drizzle-orm` 两个版本（0.44.6 和 0.44.7）在 pnpm 内部共存导致的类型声明冲突，属于开发工具层面的问题，**不影响运行时和测试**（`pnpm test` 全部通过）。不需要修复，不需要降级依赖。

---

## 📁 项目关键文件速查

| 文件 | 作用 |
|---|---|
| `PRODUCT_HANDOFF.md` | 完整技术交接文档（数据库结构、API 列表、架构说明） |
| `todo.md` | 功能开发进度 —— **仅供参考，不得自行实现** |
| `drizzle/schema.ts` | 数据库表结构 |
| `server/routers.ts` | 所有后端 API 路由入口 |
| `client/src/pages/Home.tsx` | 主页面（五栏目滑动导航） |
| `client/src/components/CalendarView.tsx` | 日历组件（多视图） |
| `client/src/components/DiaryEditor.tsx` | 日记编辑器 |

---

## 七、当前版本状态（最后更新：2026-04-23）

**版本**：v1.6 | **GitHub Commit**：`2e66788` | **Manus Checkpoint**：`57af53ef`

**已完成功能：**
- 账号密码 + 邮箱验证码登录，JWT 30天持久化
- 主页随手记 + AI 自动分类（task/wish/input/output/draft）
- **[v1.6]** schedule 改为附加属性：任何 category 都可附带 scheduleDate/scheduleTime，有时间则自动创建日程
- **[v1.6]** notes 表新增 scheduleDate（VARCHAR 10）和 scheduleTime（VARCHAR 5）字段
- **[v1.6]** 日记"看看今天我都做了些啥"改为直接查询 notes.scheduleDate = 当天，精准同步
- **[v1.6]** server/db.ts 新增 getRawPool() 函数，绕过 only_full_group_by 执行原始 SQL
- 草稿箱（AI 无法识别时自动归入）
- 日历多视图（完成热力图/登录/日记/总览）
- 日历双击添加日程（日期预填/时间可选/提醒开关）
- 日历格子蓝色小点标记有日程的日期
- 日记编辑器 + AI 提取待办弹窗
- 日记页"看看今天我都做了些啥"默认隐藏折叠
- 世界的Calling（TodoList）
- 内心的Calling（拨号盘）
- 周总结/月洞察 AI 生成
- 全页面互联：主页输入 AI 分类后自动刷新日历/世界/内心/日记
- Web Push 提醒基础架构完备（schedules 表 + 定时任务）
- AI 分类 Prompt 注入今天日期，避免日期识别错误
- 日历格子日程标记点对所有日期（包括未来）显示
- 未来日期可以点击查看/添加日程，日历可切换到未来月份

**待实现功能（需 Owner 明确指令后才能开发）：**
- 草稿箱独立页面
- PC 端响应式优化
- 微信机器人集成
- DDL 到期提醒
- AI 识别为 schedule 后弹窗确认
- 日历"完成"热力图（calendarActivity 查询存在 only_full_group_by 问题，待修复）
