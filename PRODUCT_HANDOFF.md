# CALLING 产品交接文档

> **版本**：v2.2（2026-05-08）
> **当前 Checkpoint**：`57af53ef`（Manus）/ GitHub commit `0057718`
> **最近更新（v1.7）**：Windows 本地开发支持——package.json dev 脚本改用 cross-env
> **最近更新（v1.8）**：输入/输出页面 UI 重写为 DialPicker 组件，上下分栏布局，弧形拨盘+刻度盘，左右滑动切换分类
> **最近更新（v1.9）**：①修复页面切换弹跳动画 ②修复拨盘与页面滑动冲突 ③DialPicker 空数据时显示示例卡片 ④游客登录模式（只读体验）
> **最近更新（v2.0）**：首页新增紧急任务视图（替换快速导航）：卡片视图+重要紧急四象限；notes 表新增 importanceScore/pinToHome 字段；AI 自动评分；责任页手动设置重要程度热力图；拖入象限可更新数值（含确认弹窗可选）
> **最近更新（v2.1）**：修复 UrgentTasksView 两个 bug：①待分配框显示已完成任务 ②executeDrop stale closure
> **最近更新（v2.2）**：输入/输出新增「未归类」分类；新增自定义分类功能（拨盘"+"按钮，名称+emoji，AI 注入自定义分类）；DB 新增 custom_categories 表
> **GitHub**：https://github.com/xing0325/calling-suishoji
> **线上地址**：https://calling.manus.space
> **编写目的**：供其他 coding agent 或开发者无缝衔接后续开发任务

---

## 一、产品概述

CALLING 是一款面向个人的移动端随手记应用，核心理念是"用爱呼唤你自己"。用户随手写下想法，AI 自动分类整理，并通过日历视图、日记、周总结/月洞察等功能帮助用户回顾和成长。**所有页面互联**，主页输入经 AI 识别后自动同步到日历、日记、世界的Calling、内心的Calling各模块。

**设计风格**：深色简洁风（黑底紫色主题），移动端优先，字体 Poppins + 系统字体。

---

## 二、技术栈

| 层级 | 技术 |
|---|---|
| 前端框架 | React 19 + TypeScript |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 路由 | wouter |
| 状态/请求 | tRPC 11 + TanStack Query 5 |
| 后端框架 | Express 4 + Node.js |
| 数据库 | MySQL（通过 Drizzle ORM） |
| ORM | Drizzle ORM |
| 认证 | 自建（账号密码 + 邮箱验证码）+ JWT Cookie（30天） |
| AI | `invokeLLM`（OpenAI 兼容接口，目前指向 Manus Forge / Gemini 2.5 Flash） |
| 邮件 | Manus Forge 通知 API（`/v1/notification/email`） |
| Push 通知 | web-push（VAPID，浏览器 Push Notification） |
| 定时任务 | node-cron（每分钟检查到期提醒） |
| 测试 | Vitest |
| 包管理 | pnpm |

---

## 三、项目结构

```
calling/
├── client/
│   └── src/
│       ├── App.tsx                      # 路由配置（含路由守卫）
│       ├── main.tsx                     # 入口，含 OAuth redirect 拦截（游客模式绕过）
│       ├── pages/
│       │   ├── Home.tsx                 # 主页（六栏滑动：日历/日记/主页/责任/输入/输出）
│       │   └── Login.tsx                # 登录页（账号密码 + 邮箱验证码 + 游客登录）
│       ├── components/
│       │   ├── CalendarView.tsx         # 日历（4种视图，双击添加日程，蓝点标记）
│       │   ├── AddScheduleModal.tsx     # 添加日程弹窗
│       │   ├── DiaryEditor.tsx          # 日记编辑器（含AI提取待办，今日提示折叠）
│       │   ├── DiaryTodosModal.tsx      # 日记AI提取待办确认弹窗
│       │   ├── DialPicker.tsx           # 拨盘组件（输入/输出页，自带内置+自定义+未归类分类）
│       │   ├── WorldCalling.tsx         # 世界的Calling（任务看板，重要程度热力图）
│       │   ├── UrgentTasksView.tsx      # 紧急任务视图（首页，卡片+四象限，触摸拖拽）
│       │   ├── InnerCallingDetail.tsx   # 内心的Calling详情页
│       │   └── WeeklyInsight.tsx        # 周总结/月洞察AI组件
│       └── _core/
│           └── hooks/
│               └── useAuth.ts           # 认证 hook（含 isGuest 游客模式）
├── server/
│   ├── routers.ts                       # tRPC 路由注册总入口
│   └── routers/
│       ├── auth.ts                      # 登录/注册/邮箱验证码（含 login_logs 写入）
│       ├── notes.ts                     # 随手记 CRUD + AI分类 + insightRouter + calendarActivity + todayHints + listPriorityTasks + updateImportance
│       ├── schedules.ts                 # 日程 CRUD + Push订阅 + 定时提醒
│       └── customCategories.ts          # 自定义拨盘分类 CRUD
├── server/_core/
│   ├── llm.ts                           # invokeLLM 封装（OpenAI 兼容格式）
│   ├── oauth.ts                         # Manus OAuth 回调
│   └── index.ts                         # 服务器入口（含 Reminder Cron 启动）
├── drizzle/
│   ├── schema.ts                        # 数据库表定义（10张表）
│   └── 0009_custom_categories.sql       # v2.2 新增 custom_categories 表迁移
└── server/
    ├── notes.test.ts
    ├── draft.test.ts
    ├── auth.logout.test.ts
    ├── insight.test.ts
    └── schedules.test.ts
```

---

## 四、数据库表结构

### `users` — 用户表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK AUTO_INCREMENT | 自增主键 |
| openId | varchar(64) UNIQUE | Manus OAuth ID |
| username | varchar(64) UNIQUE | 账号（自建登录） |
| passwordHash | varchar(255) | bcrypt 哈希密码 |
| name | text | 显示名称 |
| email | varchar(320) UNIQUE | 邮箱 |
| emailVerified | boolean | 邮箱是否验证 |
| loginMethod | varchar(64) | 登录方式 |
| role | enum('user','admin') | 角色 |
| createdAt / updatedAt / lastSignedIn | timestamp | 时间戳 |

### `notes` — 随手记表（核心，所有信息库数据都写这里）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| userId | int | 外键 users.id |
| rawText | text | 原始输入文本 |
| category | varchar(64) | AI分类：task/wish/input/output/draft |
| subCategory | varchar(64) | 子分类（如 movie/book/homework 等，自定义分类以 custom_ 开头） |
| title | text | AI 生成的标题 |
| description | text | AI 生成的描述 |
| deadline | timestamp | 截止日期 |
| tags | json | AI 生成标签数组 |
| aiProcessed | boolean | AI 是否已处理 |
| aiRawResponse | text | AI 原始响应（调试用） |
| completed | boolean | 是否完成 |
| completedAt | timestamp | 完成时间 |
| scheduleDate | varchar(10) | **[v1.6]** 日程日期 YYYY-MM-DD（任何 category 都可附带） |
| scheduleTime | varchar(5) | **[v1.6]** 日程时间 HH:MM（可为空） |
| importanceScore | float | **[v2.0]** 重要程度 1.0-5.0，≥3.5 显示在首页紧急任务视图 |
| pinToHome | boolean | **[v2.0]** 用户明确说"放到首页"时 AI 标记为 true |
| createdAt / updatedAt | timestamp | 时间戳 |

### `diaries` — 日记表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| userId | int | 外键 users.id |
| date | varchar(10) | 日期 YYYY-MM-DD（每天唯一） |
| title | text | 日记标题 |
| content | text | 日记内容 |
| mood / weather | varchar(10) | 心情/天气 emoji |
| createdAt / updatedAt | timestamp | 时间戳 |

### `schedules` — 日程表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| userId | int | 外键 users.id |
| date | varchar(10) | 日期 YYYY-MM-DD |
| time | varchar(5) | 具体时间 HH:MM（可为空） |
| title | text | 日程标题 |
| description | text | 备注 |
| remindEnabled | boolean | 是否开启提醒 |
| remindAt | timestamp | 提醒时间（UTC） |
| reminded | boolean | 是否已发送提醒 |
| createdAt / updatedAt | timestamp | 时间戳 |

### `push_subscriptions` — Push 订阅表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| userId | int | 外键 users.id |
| endpoint | text | 订阅终端 URL |
| keys | json | 加密密钥 `{p256dh, auth}` |
| createdAt | timestamp | 时间戳 |

### `streaks` — 连胜记录表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| userId | int UNIQUE | 外键 users.id |
| currentStreak | int | 当前连胜天数 |
| longestStreak | int | 最长连胜天数 |
| lastActiveDate | varchar(10) | 最后活跃日期 |
| updatedAt | timestamp | 时间戳 |

### `login_logs` — 登录日志表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| userId | int | 外键 users.id |
| date | varchar(10) | 登录日期 YYYY-MM-DD |
| createdAt | timestamp | 时间戳 |

### `email_verifications` — 邮箱验证码表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| email | varchar(320) | 邮箱 |
| code | varchar(8) | 验证码 |
| expiresAt | timestamp | 过期时间（10分钟） |
| used | boolean | 是否已使用 |

### `classification_logs` — AI 分类日志表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| userId | int | 外键 users.id |
| rawText | text | 原始输入 |
| category / subCategory | varchar | AI 分类结果 |
| title | text | AI 生成标题 |
| confidence | varchar(10) | AI 置信度 |
| syncedTo | json | 同步到的页面数组 |
| noteId | int | 关联 note id |
| createdAt | timestamp | 时间戳 |

### `custom_categories` — 用户自定义拨盘分类表 **[v2.2 新增]**
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| userId | int | 外键 users.id |
| parentCategory | varchar(10) | 'input' 或 'output' |
| subCategory | varchar(100) | slug，格式 `custom_{timestamp}` |
| label | varchar(100) | 显示名称（用户输入） |
| icon | varchar(10) | emoji 图标 |
| createdAt | timestamp | 时间戳 |

---

## 五、AI 分类逻辑

主页随手记输入后，后端异步调用 `invokeLLM` 分类，返回：

```typescript
{
  category: 'task' | 'wish' | 'input' | 'output' | 'draft',
  subCategory: string,        // 子分类 slug，如 "movie"、"homework"、"uncategorized"、"custom_xxx"
  title: string,              // 简洁标题（≤20字）
  description: string,        // 详细描述
  deadline: string | null,    // ISO 8601 或 null
  tags: string[],             // 最多3个标签
  confidence: number,         // 0-1，< 0.35 归入 draft
  scheduleDate: string | null,   // YYYY-MM-DD，有日期时填写
  scheduleTime: string | null,   // HH:MM，有时间时填写
  needRemind: boolean,
  importanceScore: number | null,  // 1.0-5.0，仅明确表达重要性时给出
  pinToHome: boolean,              // 用户明确说"放到首页"时为 true
}
```

**分类规则简述：**
- `task`：对外负责的事（作业/课程任务/外部承诺）
- `input`：自主消费（看电影/读书/播客 等），子分类匹配不到时用 `uncategorized`
- `output`：创作灵感/选题，子分类匹配不到时用 `uncategorized`
- `wish`：个人愿望，无外部义务
- `draft`：无法识别 或 confidence < 0.35

**[v2.2] 自定义分类注入**：`classifyNote` 在调用 AI 前查询该用户的 `custom_categories`，将自定义分类名称动态注入 prompt，AI 会优先尝试匹配。

**[v1.6] schedule 为附加属性**：任何 category 只要有 `scheduleDate` 就自动在 `schedules` 表创建日程。

---

## 六、tRPC 路由列表

### `auth.*`
| 路由 | 类型 | 说明 |
|---|---|---|
| `auth.me` | query | 获取当前用户信息 |
| `auth.logout` | mutation | 退出登录 |
| `auth.register` | mutation | 账号密码注册 |
| `auth.loginWithPassword` | mutation | 账号密码登录 |
| `auth.sendEmailCode` | mutation | 发送邮箱验证码 |
| `auth.loginWithEmailCode` | mutation | 邮箱验证码登录 |

### `notes.*`
| 路由 | 类型 | 说明 |
|---|---|---|
| `notes.create` | mutation | 创建随手记（触发异步 AI 分类），支持传 `importanceScore` |
| `notes.list` | query | 获取随手记列表（支持 category/subCategory/limit/offset 过滤） |
| `notes.listDrafts` | query | 获取草稿箱列表 |
| `notes.listPriorityTasks` | query | **[v2.0]** 获取首页紧急/重要任务（deadline≤5天 或 score≥3.5 或 pinToHome） |
| `notes.toggleComplete` | mutation | 标记完成/未完成 |
| `notes.delete` | mutation | 删除随手记 |
| `notes.updateImportance` | mutation | **[v2.0]** 更新 importanceScore 或 deadline（拖入四象限时调用） |
| `notes.batchCreate` | mutation | 批量创建（日记提取待办后批量入库） |
| `notes.extractTodosFromDiary` | mutation | 从日记提取待办（AI分析） |
| `notes.saveDiary` | mutation | 保存日记 |
| `notes.listDiaries` | query | 获取日记列表 |
| `notes.getStreak` | query | 获取连胜数据 |
| `notes.calendarActivity` | query | 获取月度日历活动（登录/日记/完成任务） |
| `notes.todayHints` | query | 获取今日日程提示（scheduleDate = 今天） |
| `notes.listClassificationLogs` | query | 获取 AI 分类历史日志 |

### `insight.*`
| 路由 | 类型 | 说明 |
|---|---|---|
| `insight.weekSummary` | query | 周总结 AI 生成 |
| `insight.monthInsight` | query | 月洞察 AI 生成 |

### `schedules.*`
| 路由 | 类型 | 说明 |
|---|---|---|
| `schedules.list` | query | 获取指定日期的日程列表 |
| `schedules.listByMonth` | query | 获取指定月份有日程的日期列表 |
| `schedules.create` | mutation | 创建日程 |
| `schedules.delete` | mutation | 删除日程 |
| `schedules.getVapidPublicKey` | query | 获取 VAPID 公钥 |
| `schedules.savePushSubscription` | mutation | 保存 Push 订阅 |

### `customCategories.*` **[v2.2 新增]**
| 路由 | 类型 | 说明 |
|---|---|---|
| `customCategories.list` | query | 获取用户自定义分类（按 parentCategory 过滤） |
| `customCategories.create` | mutation | 创建自定义分类（label + icon + parentCategory），每个主分类最多20个 |
| `customCategories.delete` | mutation | 删除自定义分类 |

---

## 七、页面互联逻辑

主页输入提交后（`notes.create`），AI 分类在后台异步执行（约 3-8 秒）。前端在提交成功后：
- 立即在列表中显示未处理的 note（loading 状态）
- 约 6 秒后触发相关页面数据刷新（`invalidate` notes/schedules/calendarActivity）

---

## 八、Web Push 提醒

**工作流程**：
1. 用户添加日程时开启"到时提醒"
2. 前端请求 `Notification.requestPermission()`，获取 Push 订阅
3. 调用 `schedules.savePushSubscription` 保存订阅
4. 后端 node-cron 每分钟执行 `sendDueReminders()`，检查 `remindAt <= now` 的日程
5. 找到到期日程后调用 `web-push.sendNotification()`，标记 `reminded = true`

**iOS 注意**：需先将网页"添加到主屏幕"（PWA 模式）才能收到 Push。

---

## 九、环境变量

| 变量名 | 用途 | 说明 |
|---|---|---|
| `DATABASE_URL` | MySQL 连接字符串 | 格式：`mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | JWT 签名密钥 | 自行生成随机字符串 |
| `BUILT_IN_FORGE_API_URL` | LLM API 地址 | 默认 `https://forge.manus.im`，可替换为 OpenAI 等 |
| `BUILT_IN_FORGE_API_KEY` | LLM API 密钥 | Manus 平台自动注入，迁移时替换为对应平台密钥 |
| `VAPID_PUBLIC_KEY` | Push 通知公钥 | 生成命令见下 |
| `VAPID_PRIVATE_KEY` | Push 通知私钥 | 生成命令见下 |
| `VAPID_EMAIL` | Push 联系邮箱 | 格式：`mailto:xxx@example.com` |

生成 VAPID 密钥：
```bash
node -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log(JSON.stringify(k))"
```

---

## 十、本地开发 / Manus 部署

### Manus 平台（推荐，无需本地数据库）
```bash
pnpm install
pnpm test          # 运行测试
npx tsc --noEmit   # 类型检查
# 启动服务用 webdev_restart_server，不用 pnpm dev
```

### 本地开发（需自备数据库）
```bash
pnpm install
cp .env.example .env   # 填写 DATABASE_URL / JWT_SECRET / BUILT_IN_FORGE_API_KEY
pnpm dev
```

> **注意**：`BUILT_IN_FORGE_API_KEY` 是 Manus 平台专有，本地用 OpenAI/DeepSeek 替换时需同时修改 `server/_core/llm.ts` 里的 API URL。

### 数据库迁移说明（重要）

`drizzle/` 目录下有两类 SQL 文件：

**✅ 需要执行的（按此顺序）：**
1. `0000_goofy_ser_duncan.sql` — 初始表结构
2. `0001_medical_vindicator.sql` 到 `0007_tense_mattie_franklin.sql` — 历史迁移
3. `0008_priority_fields.sql` — 添加 importanceScore / pinToHome 字段
4. `0009_custom_categories.sql` — 创建 custom_categories 表

**❌ 忽略（历史遗留孤儿文件，不要执行）：**
- `0000_chemical_talkback.sql`
- `0000_lucky_black_widow.sql`
- `0000_wet_morph.sql`
- `0006_aspiring_bruce_banner.sql`

这几个是不同 Manus 账号 init 时留下的重复残留，执行会报"表已存在"冲突。

**后续新增迁移**：继续用手写 SQL 文件方式（如 `0010_xxx.sql`），在 Manus 上用 `webdev_execute_sql` 执行，不走 `drizzle-kit generate`（新账号没有迁移历史，`pnpm db:push` 会报错）。

---

## 十一、已知问题

1. **localStorage 残留**：`client/src/lib/storage.ts` 仍有部分本地存储逻辑，与数据库双轨并行，后续统一从 DB 读取。
2. **邮箱验证码依赖 Manus**：`sendEmailCode` 依赖 `BUILT_IN_FORGE_API_URL`，迁移其他平台需替换邮件服务（推荐 Resend）。
3. **AI 分类异步**：提交后约 3-8 秒完成，前端 6 秒后刷新。
4. **日历"完成"热力图**：calendarActivity 的 completedDates 查询用原始 SQL 绕过 only_full_group_by，在部分环境可能有兼容性问题。

---

## 十二、待实现功能（Backlog）

- 草稿箱独立页面
- PC 端响应式优化（侧边栏导航）
- 微信机器人集成
- DDL 到期邮件提醒
- AI 识别为 schedule 后弹窗确认

---

## 十三、版本历史

### v2.2（2026-05-08）
- 输入/输出拨盘新增「📌 未归类」分类，AI 识别为 input/output 但子类不明时归入
- 新增自定义分类：拨盘右下角"+"按钮，名称+20个预设 emoji，每主分类最多20个
- AI classifyNote 动态注入用户自定义分类，优先匹配
- DB 新增 `custom_categories` 表（drizzle/0009_custom_categories.sql）
- DialPicker 重构为自包含组件，不再依赖父组件传 items

### v2.1（2026-05-08）
- 修复 UrgentTasksView：待分配框（b1/b2/b3）未过滤已完成任务
- 修复 UrgentTasksView：executeDrop 未加入 useEffect 依赖导致 stale closure（+ 修复 TDZ 报错）

### v2.0（2026-05-08）
- 首页紧急任务视图：卡片视图 + 重要紧急四象限（Eisenhower matrix）
- notes 表新增 importanceScore（float）和 pinToHome（boolean）字段
- AI 自动判断 importanceScore 和 pinToHome
- WorldCalling 添加任务时可手动设置重要程度热力图（5级，≥3.5 显示在首页）
- 四象限触摸长按拖拽，松手更新 importanceScore/deadline
- 拖入时询问弹窗（可关闭，默认关）
- 游客模式：localStorage `calling-guest=1`，禁用所有 API 查询，isGuest=true

### v1.9（2026-04-24）
- 修复页面切换弹跳动画（去掉 pixelDistance 偏移）
- 修复拨盘与页面滑动冲突（stopPropagation）
- DialPicker 空数据时显示示例卡片
- 游客登录模式（只读体验，无需注册）
- 修复游客模式 OAuth redirect 崩溃（main.tsx 加 guest bypass）

### v1.8（2026-04-22）
- 输入/输出页面 UI 重写为 DialPicker 组件
- 上半区展示笔记卡片，下半区弧形拨盘+刻度盘
- 左右滑动切换分类，中心按钮进入详情页

### v1.7（2026-04-21）
- package.json dev 脚本改用 cross-env，支持 Windows/Claude Code 本地开发

### v1.6（2026-04-23）
- schedule 改为附加属性：任何 category 可附带 scheduleDate/scheduleTime
- notes 表新增 scheduleDate、scheduleTime 字段
- 日记"今日同步"改为直接查询 scheduleDate = 今天
- server/db.ts 新增 getRawPool()，绕过 only_full_group_by

### v1.5（2026-04-21）
- AI 分类精细化（责任/输入/输出三类精确规则）
- AI 分类历史日志（classification_logs 表）
- 日历历史 tab（展示 AI 归类记录）
- 日程提醒（双击日历添加，蓝点标记，Push 定时发送）
- 全页面互联（主页输入后自动刷新各页面）
- 日记今日提示默认折叠
