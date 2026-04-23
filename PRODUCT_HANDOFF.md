# CALLING 产品交接文档

> **版本**：v1.6（2026-04-23）
> **当前 Checkpoint**：`57af53ef`
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
| 数据库 | MySQL（TiDB，通过 Drizzle ORM） |
| ORM | Drizzle ORM |
| 认证 | 自建（账号密码 + 邮箱验证码）+ JWT Cookie（30天） |
| AI | Manus 内置 `invokeLLM`（服务端调用） |
| 邮件 | Manus Forge 通知 API（`/v1/notification/email`） |
| Push 通知 | web-push（VAPID，浏览器 Push Notification） |
| 定时任务 | node-cron（每分钟检查到期提醒） |
| 测试 | Vitest（23个测试，全部通过） |
| 包管理 | pnpm |

---

## 三、项目结构

```
calling/
├── client/
│   └── src/
│       ├── App.tsx                    # 路由配置（含路由守卫）
│       ├── pages/
│       │   ├── Home.tsx               # 主页面（五栏目滑动布局）
│       │   └── Login.tsx              # 登录页面（账号密码+邮箱验证码）
│       ├── components/
│       │   ├── CalendarView.tsx       # 日历组件（4种视图切换，双击添加日程，蓝点标记）
│       │   ├── AddScheduleModal.tsx   # 添加日程弹窗（日期/时间/提醒开关）
│       │   ├── DiaryEditor.tsx        # 日记编辑器（含AI提取待办弹窗，今日提示折叠）
│       │   ├── DiaryTodosModal.tsx    # 日记AI提取待办确认弹窗
│       │   ├── RotaryDial.tsx         # 拨号盘UI（内心的Calling）
│       │   ├── TodoCard.tsx           # 待办卡片（世界的Calling）
│       │   ├── WorldCalling.tsx       # 世界的Calling页面
│       │   ├── InnerCallingDetail.tsx # 内心的Calling详情页
│       │   └── WeeklyInsight.tsx      # 周总结/月洞察AI组件
│       └── lib/
│           └── storage.ts             # localStorage工具（部分功能仍用本地存储，待迁移）
├── server/
│   ├── routers.ts                     # tRPC路由注册总入口
│   └── routers/
│       ├── auth.ts                    # 登录/注册/邮箱验证码路由（含login_logs写入）
│       ├── notes.ts                   # 随手记CRUD + AI分类 + insightRouter + calendarActivity + todayHints
│       └── schedules.ts               # 日程CRUD + Push订阅 + sendDueReminders定时任务
├── server/_core/
│   ├── oauth.ts                       # Manus OAuth回调（含login_logs写入）
│   ├── llm.ts                         # invokeLLM封装
│   └── index.ts                       # 服务器入口（含Reminder Cron启动）
├── drizzle/
│   └── schema.ts                      # 数据库表定义（9张表）
└── server/
    ├── auth.logout.test.ts            # 登出测试
    ├── draft.test.ts                  # 草稿箱+日记提取待办测试
    ├── insight.test.ts                # 周总结/月洞察路由测试
    ├── calendar.test.ts               # calendarActivity路由测试
    └── schedules.test.ts              # 日程路由测试
```

---

## 四、数据库表结构

### `users` — 用户表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| openId | varchar(64) UNIQUE | Manus OAuth ID |
| username | varchar(64) UNIQUE | 账号（自建登录） |
| passwordHash | varchar(255) | bcrypt 哈希密码 |
| name | text | 显示名称 |
| email | varchar(320) UNIQUE | 邮箱 |
| emailVerified | boolean | 邮箱是否验证 |
| loginMethod | varchar(64) | 登录方式 |
| role | enum('user','admin') | 角色 |
| createdAt / updatedAt / lastSignedIn | timestamp | 时间戳 |

### `notes` — 随手记表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| userId | int | 外键 users.id |
| rawText | text | 原始输入文本 |
| category | varchar(32) | AI分类：task/wish/input/output/draft |
| tags | json | AI生成标签数组 |
| deadline | varchar(10) | 截止日期 YYYY-MM-DD |
| scheduleDate | varchar(10) | **[v1.6新增]** 日程日期 YYYY-MM-DD（任何 category 都可附带） |
| scheduleTime | varchar(5) | **[v1.6新增]** 日程时间 HH:MM（可为空） |
| completed | boolean | 是否完成 |
| createdAt / updatedAt | timestamp | 时间戳 |

### `diaries` — 日记表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| userId | int | 外键 users.id |
| date | varchar(10) | 日期 YYYY-MM-DD（唯一） |
| content | text | 日记内容（富文本/纯文本） |
| createdAt / updatedAt | timestamp | 时间戳 |

### `schedules` — 日程表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| userId | int | 外键 users.id |
| date | varchar(10) | 日期 YYYY-MM-DD |
| time | varchar(5) | 具体时间 HH:MM（可为空） |
| title | text | 日程标题 |
| description | text | 备注（可为空） |
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
| loginAt | timestamp | 登录时间 |
| loginDate | varchar(10) | 登录日期 YYYY-MM-DD |

### `email_verifications` — 邮箱验证码表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int PK | 自增主键 |
| email | varchar(320) | 邮箱 |
| code | varchar(6) | 6位验证码 |
| expiresAt | timestamp | 过期时间（10分钟） |
| used | boolean | 是否已使用 |

---

## 五、AI 分类逻辑

主页随手记输入后，后端调用 `invokeLLM` 进行分类，返回以下字段：

```typescript
{
  category: 'task' | 'wish' | 'input' | 'output' | 'draft',  // [v1.6] schedule 已移除
  tags: string[],           // 2-4个标签
  deadline: string | null,  // YYYY-MM-DD 格式
  // [v1.6] 任何 category 都可附带以下字段：
  scheduleDate: string | null,   // 日期 YYYY-MM-DD
  scheduleTime: string | null,   // 时间 HH:MM（可为空）
  scheduleTitle: string | null,  // 日程标题
  remindEnabled: boolean,        // 是否需要提醒
}
```

**分类规则**：
- `task`：明确的待办事项（"我要去买菜"）
- `wish`：愿望/目标（"我想学钉琴"）
- `input`：输入型内容（看了什么书/电影/文章）
- `output`：输出型内容（写了什么/做了什么）
- `draft`：无法识别有效内容时归入草稿箱

**[v1.6] schedule 属性变更**：`schedule` 不再是独立的 category，改为附加属性。任何 category 都可以附带 scheduleDate/scheduleTime，只要有 scheduleDate 就自动在 schedules 表创建日程记录。例："今晚七点看电影『美国x档案』"→ category=input + scheduleDate=2026-04-23 + scheduleTime=19:00

---

## 六、tRPC 路由列表

### `auth.*`
| 路由 | 类型 | 说明 |
|---|---|---|
| `auth.me` | query | 获取当前用户信息 |
| `auth.logout` | mutation | 退出登录 |
| `auth.register` | mutation | 账号密码注册 |
| `auth.login` | mutation | 账号密码登录 |
| `auth.sendVerificationEmail` | mutation | 发送邮箱验证码 |
| `auth.loginWithEmail` | mutation | 邮箱验证码登录 |

### `notes.*`
| 路由 | 类型 | 说明 |
|---|---|---|
| `notes.create` | mutation | 创建随手记（触发AI分类） |
| `notes.list` | query | 获取随手记列表（支持分类过滤） |
| `notes.listDrafts` | query | 获取草稿箱列表 |
| `notes.update` | mutation | 更新随手记（含分类修改） |
| `notes.delete` | mutation | 删除随手记 |
| `notes.complete` | mutation | 标记完成/未完成 |
| `notes.batchCreate` | mutation | 批量创建（日记提取待办后批量入库） |
| `notes.saveDiary` | mutation | 保存日记 |
| `notes.getDiary` | query | 获取指定日期日记 |
| `notes.listDiaries` | query | 获取日记列表 |
| `notes.calendarActivity` | query | 获取月度活动数据（登录/日记/完成） |
| `notes.todayHints` | query | 获取今日可能发生的事（AI扫描历史） |
| `notes.insight.weekly` | query | 周总结AI生成 |
| `notes.insight.monthly` | query | 月洞察AI生成 |
| `notes.insight.extractTodosFromDiary` | mutation | 从日记提取待办 |

### `schedules.*`
| 路由 | 类型 | 说明 |
|---|---|---|
| `schedules.list` | query | 获取指定日期的日程列表 |
| `schedules.listByMonth` | query | 获取指定月份的日程日期列表 |
| `schedules.create` | mutation | 创建日程（含提醒时间计算） |
| `schedules.delete` | mutation | 删除日程 |
| `schedules.getVapidPublicKey` | query | 获取 VAPID 公钥（Push 订阅用） |
| `schedules.savePushSubscription` | mutation | 保存浏览器 Push 订阅 |

### `system.*`
| 路由 | 类型 | 说明 |
|---|---|---|
| `system.notifyOwner` | mutation | 向项目 Owner 发送通知 |

---

## 七、页面互联逻辑（v1.5新增）

主页输入提交后（`notes.create`），AI 分类在后台异步执行（约 3-8 秒）。前端在 6 秒后触发以下刷新：

```typescript
// Home.tsx createNote onSuccess 中
setTimeout(() => {
  utils.notes.list.invalidate();
  utils.notes.calendarActivity.invalidate({ year, month });
  utils.schedules.list.invalidate();
  utils.schedules.listByMonth.invalidate();
  checkDraftStatus(rawText);
}, 6000);
```

**AI 识别为 `schedule` 类型时**：后端自动在 `schedules` 表创建对应日程记录，日历格子左上角蓝色小点即时反映。

---

## 八、Web Push 提醒

**VAPID 密钥**（已内置测试密钥，正式上线建议替换）：
```
VAPID_PUBLIC_KEY=BD60H7AtI9uWox_6a5WrbZ1jF7Q0nTLkLjRxUC4DMcF--Iq7Zdbq6m-aNjDsMyZpuHt3yZGQJhZ6Sv_b6QWjN_I
VAPID_PRIVATE_KEY=sfQn-U6PesokMHJcy4JhJh36ZrEbIDnaZwNJ8b4K79A
```

**工作流程**：
1. 用户添加日程时开启"到时提醒"开关
2. 前端请求 `Notification.requestPermission()`，获取 Push 订阅对象
3. 调用 `schedules.savePushSubscription` 保存订阅到数据库
4. 后端 `node-cron` 每分钟执行 `sendDueReminders()`，检查 `remindAt <= now` 的日程
5. 找到到期日程后调用 `web-push.sendNotification()` 推送通知，并标记 `reminded = true`

**iOS 注意**：需要先将网页"添加到主屏幕"（PWA模式）才能收到 Push 通知。

---

## 九、环境变量

以下变量在 Manus 平台**自动注入**，迁移到其他平台时需手动配置：

| 变量名 | 用途 | 迁移时替换方案 |
|---|---|---|
| `DATABASE_URL` | MySQL 连接字符串 | 任意 MySQL 数据库 |
| `JWT_SECRET` | JWT 签名密钥 | 自行生成随机字符串 |
| `BUILT_IN_FORGE_API_URL` | Manus 内置 API 地址 | 替换邮件/AI服务 |
| `BUILT_IN_FORGE_API_KEY` | Manus 内置 API 密钥 | 替换邮件/AI服务 |

以下变量需手动配置（已有默认测试值，可直接使用）：

| 变量名 | 默认值 | 说明 |
|---|---|---|
| `VAPID_PUBLIC_KEY` | 见上方第八节 | Push 通知公钥 |
| `VAPID_PRIVATE_KEY` | 见上方第八节 | Push 通知私钥 |

---

## 十、本地开发启动

```bash
pnpm install
cp .env.example .env   # 填写 DATABASE_URL / JWT_SECRET / BUILT_IN_FORGE_API_KEY
pnpm db:push
pnpm dev
pnpm test
```

---

## 十一、待实现功能（Backlog）

### ✅ 1. 日程提醒功能（已完成 v1.5）
- ✅ `schedules` 表和 `push_subscriptions` 表已建立
- ✅ 日历双击添加日程弹窗（日期/时间/提醒开关）
- ✅ 日历格子左上角蓝色小点标记有日程的日期
- ✅ 后端定时任务每分钟检查到期提醒并发送 Push
- ⏳ 正式上线前建议替换 VAPID 密钥

### ✅ 2. 全页面互联（已完成 v1.5）
- ✅ 主页输入 AI 分类后自动刷新日历/世界/内心/日记各页面
- ✅ AI 识别为 schedule 类型时自动创建日程

### ✅ 3. 日记页"今天可能发生的事"（已完成 v1.5）
- ✅ 默认隐藏，点击"看看今天我都做了些啥"按钮展开
- ✅ 后端 `notes.todayHints` API 扫描历史 notes/diaries 提取今日相关事件

### 4. 草稿箱页面
**目标**：为 `draft` 分类的 notes 提供独立查看和手动分类页面。

### 5. PC端响应式优化
**现状**：应用为移动端优先设计（固定宽度，底部导航栏），PC端显示不佳。
**建议方案**：PC端使用侧边栏导航替代底部导航，主内容区域限制最大宽度或改为双栏布局。

### 6. 微信机器人集成
通过企业微信机器人 Webhook 或 WeChatFerry，后端新增 `/api/webhook/wechat` 接口，接收消息后调用 `notes.create` 逻辑。

### 7. DDL 提醒功能
`notes` 表已有 `deadline` 字段，后端新增定时任务，每天早上检查当天/明天到期的 notes，通过邮件或 Push 通知提醒。

---

## 十二、已知问题与注意事项

1. **本地存储残留**：`client/src/lib/storage.ts` 中仍有部分 localStorage 逻辑，与数据库数据存在双轨并行，后续应统一从数据库读取。
2. **邮箱验证码仅限 Manus 平台**：`sendVerificationEmail` 依赖 `BUILT_IN_FORGE_API_URL`，迁移到其他平台需替换为独立邮件服务（推荐 Resend）。
3. **AI 分类为异步**：随手记提交后立即返回，AI 分类在后台异步执行（约3-8秒）。前端在6秒后刷新相关页面数据。
4. **世界/内心页面数据源**：`WorldCalling.tsx` 和 `InnerCallingDetail.tsx` 部分数据仍为 mock，需改为从数据库读取。

---

## 十三、代码规范

- 所有数据库操作通过 Drizzle ORM，仅在无法用 ORM 表达的查询（如 only_full_group_by 限制）时才用 getRawPool() 执行原始 SQL
- 所有 API 通过 tRPC，禁止直接 REST 路由
- 所有后端调用通过 `trpc.*.useQuery/useMutation`，禁止 axios/fetch
- 新增路由必须配套 Vitest 测试，运行 `pnpm test` 确保全部通过
- 禁止使用 `any`，运行 `npx tsc --noEmit` 确保 TypeScript 无错误
- 修改 `drizzle/schema.ts` 后必须运行 `pnpm db:push`

---

*文档由 Manus AI 生成，最后更新：2026-04-23 v1.6*


### v1.6 新增功能（2026-04-23）
- **schedule 改为附加属性**：任何 category 都可附带 scheduleDate/scheduleTime，有时间则自动创建日程
- **notes 表新增字段**：scheduleDate（VARCHAR 10）和 scheduleTime（VARCHAR 5）
- **日记今日同步优化**：直接查询 notes.scheduleDate = 当天，不再依赖 AI 推断
- **getRawPool()**：server/db.ts 新增，绕过 only_full_group_by 执行原始 SQL
- **强制 Checklist**：Manus_HANDOFF_GUIDE.md 顶部新增每次修改后必须执行的 6 步规范

### v1.5 新增功能（2026-04-21）
- **AI 分类精细化**：责任/输入/输出三类精确规则，避免误分类
  - 外部任务（作业/课程/必读书）→ 责任
  - 自主消费（看电影/读书/播客）→ 输入，不进责任
  - 创作灵感（选题/灵感/设计）→ 输出，不进责任
  - 无明确对外负责的任务 → 其他外部任务
- **AI 分类历史记录**：classification_logs 表记录每次分类的原文、结果、同步页面
- **日历历史 tab**：日历页顶部新增「历史」tab，展示 AI 归类记录（原文+分类+同步到哪里+置信度）
- **Toast 优化**：提示移到屏幕中上方，缩短文字，右侧加「查看历史」小字，点击直接跳转日历历史 tab
- **日程提醒**：双击日历日期添加日程，日程格子显示蓝色标记点
- **全页面互联**：主页输入 AI 识别后自动刷新日历/日记/责任/输入/输出各页面
- **日记今日提示**：「看看今天我都做了些啥」默认隐藏，点击展开 AI 扫描历史提示
