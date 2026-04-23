# CALLING 项目 Manus 交接操作手册

> 本文档专门解决一个问题：**如何让另一个 Manus 账号无缝接手这个项目，继续开发，效果和原账号一模一样。**

---

## 🔴 每次修改代码后必须执行的 Checklist（Agent 不得跳过）

> **无论是修复 Bug、完成功能、还是任何代码改动，每次对话结束前必须按顺序执行以下全部步骤。缺少任何一步视为任务未完成。**

```
1. 运行 pnpm test，确认全部测试通过（不得有任何失败项）
2. 更新 PRODUCT_HANDOFF.md：
   - 版本号 +0.1
   - 已完成功能打 ✅
   - 新增 API 路由、数据库表变更
3. 更新 MANUS_HANDOFF_GUIDE.md 第七节"当前版本状态"：
   - 版本号、GitHub Commit、Manus Checkpoint
   - 已完成功能列表
4. git add . && git commit -m "描述本次改动" && git push github main --force-with-lease
5. 保存 Manus 检查点（webdev_save_checkpoint）
6. 告诉用户：已完成 GitHub 推送（附 commit hash）和检查点保存
```

**GitHub 仓库**：https://github.com/xing0325/calling-suishoji  
**GitHub Token**：请向项目 Owner 索取（Token 以 `ghp_` 开头）

> **为什么要这个 checklist**：之前的 Agent 在完成功能后忘记推送 GitHub 和更新文档，导致下一个 Agent 接手时代码和文档不同步。这个 checklist 是强制规范，每次必须执行。

---

## 🚨 最重要的事（必读，不得跳过）

> **Agent 请注意：你的唯一任务是"迁移部署"，不是"继续开发"。**

**你被允许做的事：**
1. 初始化 Manus 项目
2. 从 GitHub 导入代码（恢复到 `main` 分支最新提交）
3. 安装依赖、同步数据库、运行测试
4. 保存检查点、发布网站

**你绝对不能做的事：**
- ❌ 不得自行开发任何新功能
- ❌ 不得修改任何现有代码（包括 Home.tsx、routers.ts、schema.ts 等）
- ❌ 不得添加任何新文件（组件、页面、路由等）
- ❌ 不得"顺手优化"或"顺便修复"任何问题
- ❌ 不得根据 todo.md 中的待办项自行实现功能
- ❌ 不得根据 PRODUCT_HANDOFF.md 中的 Backlog 自行开发

**为什么有这条规定：**
上一个 Agent 在迁移时误读了需求，自作主张开发了草稿箱页面、PC端侧边栏、Web Push 等功能，导致代码混乱，需要回滚。所有新功能的开发必须等待 Owner 明确指令后才能进行。

**迁移完成后，你应该说：**
> "迁移完成！网站已部署到 [URL]，所有 X 个测试通过，代码与 GitHub main 分支一致。请告诉我接下来需要开发什么功能。"

**然后停下来，等待 Owner 的指令。**

---

## ⚡ 核心工作规范（每个 Manus 必须遵守）

> **这是本项目的"胎记"规范，无论哪个 Manus 账号接手，都必须严格执行。**

### 规范一：每次功能更新后必须同步 GitHub

**每完成一个功能或修复一个 Bug，必须执行以下操作：**

```bash
cd /home/ubuntu/calling

# 确认 GitHub 远程已配置
git remote get-url github 2>/dev/null || \
  git remote add github https://ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX  ← 请向项目 Owner 索取真实 Token@github.com/xing0325/calling-suishoji.git

# 推送到 GitHub
git push github main --force-with-lease
```

**GitHub 仓库**：https://github.com/xing0325/calling-suishoji
**GitHub Token**：请向项目 Owner（微信/私信）索取，Token 以 `ghp_` 开头，永久有效

### 规范二：每次推送前必须更新文档

推送代码前，必须同步更新以下两份文档：

1. **`PRODUCT_HANDOFF.md`**：更新版本号、已完成功能列表（Backlog 中打 ✅）、新增的 API 路由、数据库表变更
2. **`MANUS_HANDOFF_GUIDE.md`**（本文档）：更新第七节"当前版本状态"

### 规范三：文档必须包含在压缩包中

`PRODUCT_HANDOFF.md` 和 `MANUS_HANDOFF_GUIDE.md` 必须始终位于项目根目录（`/home/ubuntu/calling/`），不得删除或移动。用户下载压缩包时，这两份文档会自动包含在内。

---

## 一、先理解 Manus 项目的本质

Manus 的 webdev 项目不只是代码，它包含四个部分：

| 组成部分 | 存在哪里 | 能否迁移 |
|---|---|---|
| 代码 | GitHub 仓库 | ✅ 可以完整迁移 |
| 数据库（MySQL） | Manus 平台托管 | ❌ 绑定原账号，无法迁移 |
| 环境变量/密钥 | Manus 平台注入 | ❌ 新账号需重新配置 |
| 部署域名 | Manus 平台分配 | ❌ 新账号会分配新域名 |

**结论**：新账号可以完整接手代码和开发工作，但数据库是空的（历史数据留在原账号），域名也会变。如果只是继续开发（不需要原来的数据），完全没问题。

---

## 二、同事需要准备的东西

在开始之前，请准备好以下内容（发给同事）：

1. **GitHub 仓库链接**：`https://github.com/xing0325/calling-suishoji`
2. **GitHub Token**（永久有效）：`ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX  ← 请向项目 Owner 索取真实 Token`
3. **本文档**（MANUS_HANDOFF_GUIDE.md）
4. **产品交接文档**（PRODUCT_HANDOFF.md，在仓库根目录）
5. **VAPID 密钥**（Push 通知用，见 PRODUCT_HANDOFF.md 第八节）

---

## 三、同事的操作步骤（逐步执行）

### 第一步：新建 Manus 项目

在同事的 Manus 账号中，**新建一个对话**，发送以下这段话（直接复制粘贴）：

---

```
我要接手一个已有的全栈项目，请帮我迁移部署，不需要开发任何新功能。

项目信息：
- GitHub 仓库：https://github.com/xing0325/calling-suishoji
- 技术栈：React 19 + TypeScript + Tailwind 4 + Express + tRPC + Drizzle ORM + MySQL
- 这是一个已有完整代码的项目，不是从零开始，请不要修改任何现有代码

操作步骤（严格按顺序执行，不得增加额外步骤）：
1. 使用 webdev_init_project 初始化项目（项目名用 calling，模板选 web-db-user）
2. 初始化完成后，用 git 把 GitHub 仓库的代码拉取下来，覆盖到项目目录
3. 运行 pnpm install 安装依赖
4. 运行 pnpm db:push 同步数据库结构
5. 运行 pnpm test 确认所有测试通过
6. 重启开发服务器
7. 保存检查点
8. 告诉我迁移完成，等待我的下一步指令

重要约束：
- 只做迁移，不做开发
- 不得修改任何代码文件
- 不得添加任何新功能
- 不得根据 todo.md 或 PRODUCT_HANDOFF.md 中的待办项自行实现功能
- 完成迁移后，停下来等待我的指令
```

---

### 第二步：配置环境变量

项目启动后，Manus 会自动注入大部分系统环境变量（数据库、JWT、OAuth 等）。但有一个变量需要手动配置：

**VAPID 密钥**（浏览器 Push 通知用）

在同事的 Manus 对话中发送：

```
请帮我配置以下环境变量：
- VAPID_PUBLIC_KEY = [从原账号获取，见下方说明]
- VAPID_PRIVATE_KEY = [从原账号获取，见下方说明]
- VAPID_EMAIL = [你的邮箱，如 mailto:your@email.com]

配置完成后不需要做其他事，等待我的指令。
```

> **如何获取 VAPID 密钥**：在原 Manus 账号的项目管理面板 → Settings → Secrets 中查看。如果找不到，可以重新生成（运行 `npx web-push generate-vapid-keys`），但这样之前订阅了 Push 通知的用户需要重新订阅。

### 第三步：验证功能

让同事发送以下验证指令：

```
请验证以下功能是否正常（只验证，不修改代码）：
1. 访问首页，确认登录页面显示正常
2. 运行 pnpm test，确认所有测试通过
3. 截图给我看开发服务器是否正常运行

验证完成后，告诉我结果，然后等待我的下一步指令。
```

---

## 四、给同事的 Manus 发的"开场白"模板

以下是最高效的开场白，让同事直接发给他的 Manus：

---

```
github链接：https://github.com/xing0325/calling-suishoji
"请阅读 GitHub 仓库 xing0325/calling-suishoji 根目录的 MANUS_HANDOFF_GUIDE.md，按里面的步骤接手项目，GitHub Token 是 `[向 Owner 索取]`"

重要说明：你的任务只是迁移部署，恢复到 GitHub main 分支的最新代码状态即可。
不需要开发任何新功能，不需要修改任何代码。
迁移完成后，保存检查点，然后等待我的指令。
```

---

## 五、常见问题

**Q：同事的 Manus 说"webdev_init_project 只能用于初创项目"怎么办？**

这是正常的，`webdev_init_project` 会创建一个新的空项目。创建完成后，再用 git 把 GitHub 的代码拉进来覆盖即可。关键步骤：

```bash
# 在 Manus 的 shell 中执行
cd /home/ubuntu/calling
git remote add github https://[TOKEN]@github.com/xing0325/calling-suishoji.git
git fetch github
git checkout github/main -- .
pnpm install
pnpm db:push
```

**Q：数据库是空的，历史数据怎么办？**

历史数据（用户账号、日记、待办等）留在原 Manus 账号的数据库里，无法迁移。新账号的数据库是全新的，需要重新注册账号使用。这是 Manus 平台的限制，不是代码问题。

**Q：域名变了怎么办？**

新账号会分配一个新的 `.manus.space` 域名。如果想保持原域名（`calling.manus.space`），只能继续在原账号上开发和发布。如果想要一个固定域名，建议在 Manus 管理面板购买自定义域名（Settings → Domains），这样换账号也能重新绑定。

**Q：AI 功能（invokeLLM）需要配置 API Key 吗？**

不需要。`invokeLLM` 使用 Manus 平台内置的 API，密钥由平台自动注入（`BUILT_IN_FORGE_API_KEY`），新账号同样会自动注入，无需手动配置。

**Q：Push 通知不工作怎么办？**

检查 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_EMAIL` 三个环境变量是否已配置。可以在 Manus 管理面板 → Settings → Secrets 中查看和修改。

**Q：Agent 自作主张开发了额外功能怎么办？**

立即要求 Agent 回滚到 GitHub 原始代码：
```
请回滚到 GitHub main 分支的最新代码，不要保留任何你自己添加的修改：
git checkout github/main -- .
然后重新安装依赖、运行测试、保存检查点。
```

---

## 六、项目关键文件速查

| 文件 | 作用 |
|---|---|
| `PRODUCT_HANDOFF.md` | 完整技术交接文档（数据库结构、API 列表、架构说明） |
| `CALLING_用户说明书.md` | 产品功能说明（给用户看的） |
| `todo.md` | 功能开发进度（已完成 / 待完成）—— 仅供参考，不得自行实现 |
| `drizzle/schema.ts` | 数据库表结构 |
| `server/routers.ts` | 所有后端 API 路由入口 |
| `client/src/pages/Home.tsx` | 主页面（五栏目滑动导航） |
| `client/src/components/CalendarView.tsx` | 日历组件（多视图） |
| `client/src/components/DiaryEditor.tsx` | 日记编辑器 |

---

## 七、当前版本状态（最后更新：2026-04-23）

**版本**：v1.6 | **GitHub Commit**：`a3527f6` | **Manus Checkpoint**：待保存后更新

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
