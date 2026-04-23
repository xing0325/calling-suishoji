import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { notes, diaries, streaks, loginLogs, schedules, classificationLogs } from "../../drizzle/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

// 已知的有效分类
const VALID_CATEGORIES = ['task', 'wish', 'input', 'output', 'diary', 'schedule'];
// 日记提取待办可用的分类（不包含 diary）
const TODO_CATEGORIES = ['task', 'wish', 'input', 'output'] as const;
type TodoCategory = typeof TODO_CATEGORIES[number];

// AI分类的系统提示词
const CLASSIFY_SYSTEM_PROMPT = `你是CALLING应用的智能助手，专门负责分析用户的随手记并进行精准分类整理。

【核心分类原则】
1. 对外负责（责任）：需要向外界交代、有明确义务的事项 → category: "task"
2. 自我输入：自己消费/学习外界内容，不需要对外负责 → category: "input"
3. 自我输出：自己的创作灵感、选题想法 → category: "output"
4. 日程/事件：提到具体日期时间的计划 → category: "schedule"
5. 日记：情绪、感悟、日常记录 → category: "diary"
6. 愿望：想做但没有明确义务的事 → category: "wish"

【判断规则 - 责任 vs 输入/输出】
- 如果是"看了一部电影/读了一本书/听了一个播客"这类自己主动消费的行为 → "input"，不是"task"
- 如果是"老师布置的作业/课程任务/必须完成的阅读/对外承诺的事项" → "task"
- 如果是"我有个灵感/我想写一篇文章/我有个选题" → "output"，不是"task"
- 没有明确表明是作业、课程任务或必读书的，不要归入"task"，优先考虑"input"或"output"

【对外负责类 - category: "task"】
- 必修课作业 (subCategory: "homework")：课程作业、考试准备等
- 做事课任务 (subCategory: "course_task")：项目任务、团队协作等
- 必读书进度 (subCategory: "reading_progress")：老师要求的阅读计划
- 其他外部任务 (subCategory: "external_task")：实习任务、社团任务、对外承诺等
  ⚠️ 如果没有明确表明是对外负责的，归入"其他外部任务"而不是其他task子类

【愿望清单类 - category: "wish"】
- 想做的事 (subCategory: "todo_wish")
- 想去的地方 (subCategory: "place")
- 想见的人 (subCategory: "person_wish")
- 想买的东西 (subCategory: "shopping")

【输入类 - category: "input"，自己主动消费/学习的内容，不需要对外负责】
- 电影 (subCategory: "movie")：看过的/想看的电影
- 书籍 (subCategory: "book")：自己想读的书（非课程要求）
- 文章 (subCategory: "article")：推荐的文章
- 游戏 (subCategory: "game")：推荐的游戏
- 播客 (subCategory: "podcast")：推荐的播客
- 概念 (subCategory: "concept")：想了解的概念
- 人物 (subCategory: "person")：想了解的人物
- 课程 (subCategory: "course")：自己想学的课程（非必修）
- 工具 (subCategory: "tool")：想用的工具

【输出类 - category: "output"，自己的创作灵感，不需要对外负责】
- 选题 (subCategory: "topic")：内容创作选题
- 灵感 (subCategory: "inspiration")：创意灵感
- 剪辑灵感 (subCategory: "edit_idea")：视频剪辑相关
- 戏剧灵感 (subCategory: "drama_idea")：戏剧、故事相关
- 写作选题 (subCategory: "writing_topic")：写作相关
- 平面设计灵感 (subCategory: "design_idea")：设计相关
- 游戏设计灵感 (subCategory: "game_design")：游戏设计相关

【日记类 - category: "diary"】
- 日常记录、感悟、情绪等

【日程/事件类 - category: "schedule"】
- 提到了具体日期或时间的事件、约定、计划（如"明天下午3点开会"、"下周五去北京"、"5月1日飞盘比赛"）
- subCategory: "event"（活动/事件）、"meeting"（会议/约定）、"trip"（出行/旅行）、"reminder"（提醒事项）
- 必须提取：scheduleDate（具体日期，YYYY-MM-DD格式，如果是相对日期如"明天"请根据今天日期推算）、scheduleTime（具体时间HH:MM，没有则为null）、needRemind（是否需要提醒，boolean）

请分析用户输入，返回JSON格式的结果，包含：
- category: 主分类
- subCategory: 子分类
- title: 简洁的标题（不超过20字）
- description: 详细描述（保留重要信息，如推荐人、原因等）
- deadline: 截止日期（如果提到了，格式为ISO 8601，否则为null）
- tags: 相关标签数组（3个以内）
- confidence: 分类置信度（0-1之间的小数）
- scheduleDate: 日程日期（仅当category为schedule时填写，YYYY-MM-DD格式，否则为null）
- scheduleTime: 日程时间（仅当category为schedule时填写，HH:MM格式，否则为null）
- needRemind: 是否需要提醒（仅当category为schedule时填写，boolean，否则为false）

如果输入内容完全无法归入以上任何分类（例如：无意义字符、纯表情、无法理解的内容），请将 category 设为 "draft"，subCategory 设为 "unclassified"，confidence 设为 0。
只返回JSON，不要任何其他文字。`;

export const notesRouter = router({
  // 提交随手记并AI分类
  create: protectedProcedure
    .input(z.object({ rawText: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 先保存原始记录
      const [insertResult] = await db.insert(notes).values({
        userId: ctx.user.id,
        rawText: input.rawText,
        aiProcessed: false,
      });

      const noteId = (insertResult as any).insertId;

      // 异步调用AI分类（不阻塞响应）
      classifyNote(noteId, input.rawText, ctx.user.id).catch(console.error);

      return { id: noteId, rawText: input.rawText, aiProcessed: false, isDraft: false };
    }),

  // 获取草稿箱
  listDrafts: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];

      return await db
        .select()
        .from(notes)
        .where(and(eq(notes.userId, ctx.user.id), eq(notes.category, 'draft')))
        .orderBy(desc(notes.createdAt));
    }),

  // 获取用户所有随手记
  list: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
        subCategory: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(notes.userId, ctx.user.id)];
      if (input.category) conditions.push(eq(notes.category, input.category));
      if (input.subCategory) conditions.push(eq(notes.subCategory, input.subCategory));

      const result = await db
        .select()
        .from(notes)
        .where(and(...conditions))
        .orderBy(desc(notes.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return result;
    }),

  // 标记完成
  toggleComplete: protectedProcedure
    .input(z.object({ id: z.number(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(notes)
        .set({
          completed: input.completed,
          completedAt: input.completed ? new Date() : null,
        })
        .where(and(eq(notes.id, input.id), eq(notes.userId, ctx.user.id)));

      // 完成待办时也更新连胜
      if (input.completed) {
        updateStreakByActivity(ctx.user.id).catch(console.error);
      }

      return { success: true };
    }),

  // 删除随手记
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(notes)
        .where(and(eq(notes.id, input.id), eq(notes.userId, ctx.user.id)));

      return { success: true };
    }),

  // 从日记中提取待办事项（AI分析）
  extractTodosFromDiary: protectedProcedure
    .input(z.object({
      content: z.string().min(1).max(10000),
      date: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `你是CALLING应用的AI助手，专门从日记中提取待办事项。

请仔细阅读日记内容，找出其中提到的所有待办事项、计划、任务、愿望等。

对每个待办事项，按照以下分类体系进行初步分类：

【对外负责 - category: "task"】
- 作业、课程任务、项目任务、实习任务等有外部截止日期或他人期待的事项
- subCategory: "homework" / "course_task" / "reading_progress" / "external_task"

【愿望清单 - category: "wish"】
- 想做的事、想去的地方、想见的人、想买的东西等个人愿望
- subCategory: "todo_wish" / "place" / "person_wish" / "shopping"

【输入类 - category: "input"】
- 想看的电影/书/文章、想玩的游戏、想学的课程等
- subCategory: "movie" / "book" / "article" / "game" / "podcast" / "concept" / "person" / "course" / "tool"

【输出类 - category: "output"】
- 想写的文章、创作灵感、设计想法等
- subCategory: "topic" / "inspiration" / "edit_idea" / "drama_idea" / "writing_topic" / "design_idea" / "game_design"

注意：
- 只提取明确的待办/计划/愿望，不要提取已经完成的事情
- 每个待办事项要给出简洁的标题（不超过20字）
- 如果日记中没有任何待办事项，返回空数组
- 最多提取8个待办事项

只返回JSON，不要任何其他文字。`,
            },
            {
              role: 'user',
              content: `日期：${input.date}\n\n日记内容：\n${input.content}`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'diary_todos',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  todos: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: '待办标题，不超过20字' },
                        category: { type: 'string', description: 'task/wish/input/output' },
                        subCategory: { type: 'string', description: '子分类' },
                        description: { type: 'string', description: '从日记中提取的相关描述' },
                      },
                      required: ['title', 'category', 'subCategory', 'description'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['todos'],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices[0]?.message?.content;
        if (!rawContent) return { todos: [] };
        const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
        const parsed = JSON.parse(content);

        // 过滤无效分类（日记提取只允许 task/wish/input/output）
        const validTodos = (parsed.todos || []).filter((t: any) =>
          TODO_CATEGORIES.includes(t.category as TodoCategory)
        );

        console.log(`[AI] Extracted ${validTodos.length} todos from diary ${input.date}`);
        return { todos: validTodos };
      } catch (err) {
        console.error('[AI] Failed to extract todos from diary:', err);
        return { todos: [] };
      }
    }),

  // 批量创建待办（从日记提取后确认入库）
  batchCreate: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        rawText: z.string().min(1).max(500),
        title: z.string().min(1).max(100),
        category: z.enum(['task', 'wish', 'input', 'output']),
        subCategory: z.string().min(1).max(50),
        description: z.string().max(500).optional(),
      })).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const insertedIds: number[] = [];
      for (const item of input.items) {
        const [result] = await db.insert(notes).values({
          userId: ctx.user.id,
          rawText: item.rawText,
          category: item.category,
          subCategory: item.subCategory,
          title: item.title,
          description: item.description ?? null,
          aiProcessed: true,
        });
        insertedIds.push((result as any).insertId);
      }

      return { count: insertedIds.length, ids: insertedIds };
    }),

  // 日记相关
  saveDiary: protectedProcedure
    .input(
      z.object({
        date: z.string(),
        title: z.string().optional(),
        content: z.string().min(1),
        mood: z.string().optional(),
        weather: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 检查当天是否已有日记
      const existing = await db
        .select()
        .from(diaries)
        .where(and(eq(diaries.userId, ctx.user.id), eq(diaries.date, input.date)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(diaries)
          .set({
            title: input.title ?? null,
            content: input.content,
            mood: input.mood ?? null,
            weather: input.weather ?? null,
          })
          .where(and(eq(diaries.userId, ctx.user.id), eq(diaries.date, input.date)));
        return { success: true, action: "updated" };
      } else {
        await db.insert(diaries).values({
          userId: ctx.user.id,
          date: input.date,
          title: input.title ?? null,
          content: input.content,
          mood: input.mood ?? null,
          weather: input.weather ?? null,
        });
        // 新日记才更新连胜
        await updateStreakByActivity(ctx.user.id);
        return { success: true, action: "created" };
      }
    }),

  /**
   * 获取今日提示：扫描历史日记和随手记，找出提到今天可能发生的事件
   */
  todayHints: protectedProcedure
    .input(z.object({ targetDate: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { hints: [] };

      const targetDate = input.targetDate || new Date().toISOString().split('T')[0];

      // 获取最近30天的日记（排除今天）
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const recentDiaries = await db
        .select()
        .from(diaries)
        .where(
          and(
            eq(diaries.userId, ctx.user.id),
            gte(diaries.date, thirtyDaysAgoStr),
            lte(diaries.date, targetDate)
          )
        )
        .orderBy(desc(diaries.date))
        .limit(20);

      // 获取最近的随手记（含日程类）
      const recentNotes = await db
        .select()
        .from(notes)
        .where(
          and(
            eq(notes.userId, ctx.user.id),
            gte(notes.createdAt, thirtyDaysAgo)
          )
        )
        .orderBy(desc(notes.createdAt))
        .limit(50);

      // 获取今天的日程
      const todaySchedules = await db
        .select()
        .from(schedules)
        .where(
          and(
            eq(schedules.userId, ctx.user.id),
            eq(schedules.date, targetDate)
          )
        );

      if (recentDiaries.length === 0 && recentNotes.length === 0 && todaySchedules.length === 0) {
        return { hints: [] };
      }

      // 构建AI输入
      const diaryContext = recentDiaries
        .filter(d => d.date !== targetDate)
        .slice(0, 10)
        .map(d => `[${d.date}] ${d.content.slice(0, 200)}`)
        .join('\n');

      const notesContext = recentNotes
        .filter(n => n.category === 'schedule' || (n.rawText && n.rawText.includes(targetDate.slice(5))))
        .slice(0, 10)
        .map(n => `[随手记] ${n.title || n.rawText}`)
        .join('\n');

      const schedulesContext = todaySchedules
        .map(s => `[日程] ${s.time ? s.time + ' ' : ''}${s.title}`)
        .join('\n');

      if (!diaryContext && !notesContext && !schedulesContext) {
        return { hints: [] };
      }

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `你是CALLING应用的AI助手。请根据用户过去的日记和随手记，找出其中提到${targetDate}（今天）可能发生的事情。只提取明确提到这个日期或这一天的事件，不要臆测。如果没有找到相关内容，返回空数组。返回JSON格式，hints数组中每项包含：source（来源描述）、content（事件描述，不超过50字）、sourceDate（来源日期YYYY-MM-DD）。`,
            },
            {
              role: 'user',
              content: `目标日期：${targetDate}\n\n历史日记：\n${diaryContext || '无'}\n\n随手记：\n${notesContext || '无'}\n\n已有日程：\n${schedulesContext || '无'}\n\n请找出历史记录中提到${targetDate}这天可能发生的事情。`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'today_hints',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  hints: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        source: { type: 'string' },
                        content: { type: 'string' },
                        sourceDate: { type: 'string' },
                      },
                      required: ['source', 'content', 'sourceDate'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['hints'],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices[0]?.message?.content;
        if (!rawContent) return { hints: [] };
        const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
        const parsed = JSON.parse(content);
        return { hints: parsed.hints || [] };
      } catch (err) {
        console.error('[AI] todayHints failed:', err);
        // 降级：直接返回今天的日程作为提示
        return {
          hints: todaySchedules.map(s => ({
            source: '日程记录',
            content: `${s.time ? s.time + ' ' : ''}${s.title}`,
            sourceDate: s.date,
          })),
        };
      }
    }),

  listDiaries: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    return await db
      .select()
      .from(diaries)
      .where(eq(diaries.userId, ctx.user.id))
      .orderBy(desc(diaries.date));
  }),

  // 获取连胜信息
  getStreak: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { currentStreak: 0, longestStreak: 0 };

    const result = await db
      .select()
      .from(streaks)
      .where(eq(streaks.userId, ctx.user.id))
      .limit(1);

    if (result.length === 0) return { currentStreak: 0, longestStreak: 0 };
    return { currentStreak: result[0].currentStreak, longestStreak: result[0].longestStreak };
  }),

  /**
   * 查询指定月份的日历活动数据（登录/日记/完成待办）
   */
  calendarActivity: protectedProcedure
    .input(z.object({
      year: z.number().int().min(2020).max(2100),
      month: z.number().int().min(1).max(12),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { loginDates: [], diaryDates: [], completedDates: [] };

      // 计算月份范围
      const startDate = `${input.year}-${String(input.month).padStart(2, '0')}-01`;
      const endDay = new Date(input.year, input.month, 0).getDate();
      const endDate = `${input.year}-${String(input.month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

      // 查询登录日期（去重）
      const loginRows = await db
        .selectDistinct({ date: loginLogs.date })
        .from(loginLogs)
        .where(
          and(
            eq(loginLogs.userId, ctx.user.id),
            gte(loginLogs.date, startDate),
            lte(loginLogs.date, endDate)
          )
        );

      // 查询日记日期
      const diaryRows = await db
        .select({ date: diaries.date })
        .from(diaries)
        .where(
          and(
            eq(diaries.userId, ctx.user.id),
            gte(diaries.date, startDate),
            lte(diaries.date, endDate)
          )
        );

      // 查询完成待办日期及数量（按日期分组）
      const completedRows = await db
        .select({
          date: sql<string>`DATE(${notes.completedAt})`.as('date'),
          count: sql<number>`COUNT(*)`.as('count'),
        })
        .from(notes)
        .where(
          and(
            eq(notes.userId, ctx.user.id),
            eq(notes.completed, true),
            gte(notes.completedAt, new Date(`${startDate}T00:00:00.000Z`)),
            lte(notes.completedAt, new Date(`${endDate}T23:59:59.999Z`))
          )
        )
        .groupBy(sql`DATE(${notes.completedAt})`);

      return {
        loginDates: loginRows.map(r => r.date),
        diaryDates: diaryRows.map(r => r.date),
        completedDates: completedRows.map(r => ({ date: r.date, count: Number(r.count) })),
      };
    }),

  // 获取 AI 分类历史日志
  listClassificationLogs: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(classificationLogs)
        .where(eq(classificationLogs.userId, ctx.user.id))
        .orderBy(desc(classificationLogs.createdAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);
    }),
});

// 异步AI分类函数
async function classifyNote(noteId: number, rawText: string, userId: number) {
  const db = await getDb();
  if (!db) return;

  try {
    const todayStr = new Date().toISOString().split('T')[0]; // e.g. 2026-04-21
    const response = await invokeLLM({
      messages: [
        { role: "system", content: CLASSIFY_SYSTEM_PROMPT + `\n\n【重要】今天的日期是 ${todayStr}，请以此为基准推算所有相对日期（如"今天"、"明天"、"下周五"等）。` },
        { role: "user", content: rawText },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "note_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              category: { type: "string" },
              subCategory: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              deadline: { type: ["string", "null"] },
              tags: { type: "array", items: { type: "string" } },
              confidence: { type: "number" },
              scheduleDate: { type: ["string", "null"] },
              scheduleTime: { type: ["string", "null"] },
              needRemind: { type: "boolean" },
            },
            required: ["category", "subCategory", "title", "description", "deadline", "tags", "confidence", "scheduleDate", "scheduleTime", "needRemind"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) return;
    const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);

    const parsed = JSON.parse(content);

    // 置信度低或分类无效时，归入草稿箱
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 1;
    const isValidCategory = VALID_CATEGORIES.includes(parsed.category);
    const finalCategory = (!isValidCategory || confidence < 0.35) ? 'draft' : parsed.category;
    const finalSubCategory = finalCategory === 'draft' ? 'unclassified' : parsed.subCategory;

    await db
      .update(notes)
      .set({
        category: finalCategory,
        subCategory: finalSubCategory,
        title: parsed.title,
        description: parsed.description,
        deadline: parsed.deadline ? new Date(parsed.deadline) : null,
        tags: parsed.tags,
        aiProcessed: true,
        aiRawResponse: content,
      })
      .where(eq(notes.id, noteId));

    // 如果识别为日程类，自动创建日程记录
    if (finalCategory === 'schedule' && parsed.scheduleDate) {
      try {
        let remindAt: Date | undefined;
        if (parsed.needRemind) {
          const timeStr = parsed.scheduleTime || '09:00';
          remindAt = new Date(`${parsed.scheduleDate}T${timeStr}:00`);
        }
        await db.insert(schedules).values({
          userId,
          date: parsed.scheduleDate,
          time: parsed.scheduleTime || null,
          title: parsed.title,
          description: parsed.description || null,
          remindEnabled: !!parsed.needRemind,
          remindAt: remindAt ?? null,
          reminded: false,
        });
        console.log(`[AI] Auto-created schedule for note ${noteId}: ${parsed.scheduleDate} ${parsed.title}`);
      } catch (schedErr) {
        console.error(`[AI] Failed to create schedule for note ${noteId}:`, schedErr);
      }
    }
    // 记录 AI 分类日志
    const syncedPages: string[] = [];
    if (finalCategory === 'task') syncedPages.push('world');
    if (finalCategory === 'schedule') syncedPages.push('calendar', 'diary');
    if (finalCategory === 'input') syncedPages.push('input');
    if (finalCategory === 'output') syncedPages.push('output');
    if (finalCategory === 'diary') syncedPages.push('diary');
    if (finalCategory === 'wish') syncedPages.push('world');
    try {
      await db.insert(classificationLogs).values({
        userId,
        rawText,
        category: finalCategory,
        subCategory: finalSubCategory,
        title: parsed.title || null,
        confidence: String(confidence),
        syncedTo: syncedPages,
        aiRawResponse: content,
        noteId,
      });
    } catch (logErr) {
      console.error('[AI] Failed to save classification log:', logErr);
    }
    console.log(`[AI] Note ${noteId} classified as ${finalCategory}/${finalSubCategory} (confidence: ${confidence}), synced to: ${syncedPages.join(', ')}`);
  } catch (error) {
    console.error(`[AI] Failed to classify note ${noteId}:`, error);
  }
}

// 更新连胜逻辑（通过日记记录或完成待办触发）
async function updateStreakByActivity(userId: number) {
  const db = await getDb();
  if (!db) return;

  try {
    // 获取所有日记日期，按日期排序
    const allDiaries = await db
      .select({ date: diaries.date })
      .from(diaries)
      .where(eq(diaries.userId, userId))
      .orderBy(desc(diaries.date));

    if (allDiaries.length === 0) return;

    // 计算当前连胜天数
    let currentStreak = 1;
    let longestStreak = 1;
    const today = new Date().toISOString().split('T')[0];
    const dates = allDiaries.map((d) => d.date);

    // 检查今天是否有日记
    if (dates[0] !== today) {
      // 最新日记不是今天，连胜中断
      currentStreak = 0;
    } else {
      // 从今天开始往前数连续天数
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // 计算最长连胜
    let tempStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }

    // 更新或插入streak记录
    const existing = await db
      .select()
      .from(streaks)
      .where(eq(streaks.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(streaks)
        .set({
          currentStreak,
          longestStreak: Math.max(longestStreak, existing[0].longestStreak),
          lastActiveDate: today,
        })
        .where(eq(streaks.userId, userId));
    } else {
      await db.insert(streaks).values({
        userId,
        currentStreak,
        longestStreak,
        lastActiveDate: today,
      });
    }

    console.log(`[Streak] User ${userId}: current=${currentStreak}, longest=${longestStreak}`);
  } catch (error) {
    console.error(`[Streak] Failed to update streak for user ${userId}:`, error);
  }
}

// 周总结/月洞察AI生成路由（追加到notesRouter中）
// 注意：此处通过扩展notesRouter的方式添加，需要在routers.ts中注册
export const insightRouter = router({
  /**
   * 生成周总结
   */
  weekSummary: protectedProcedure
    .input(z.object({
      // 周开始日期（ISO格式，如 "2026-04-14"）
      weekStart: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const weekStartDate = new Date(input.weekStart);
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 6);

      const weekStartStr = weekStartDate.toISOString().split('T')[0];
      const weekEndStr = weekEndDate.toISOString().split('T')[0];

      // 获取本周的笔记
      const { gte, lte } = await import('drizzle-orm');
      const weekNotes = await db
        .select()
        .from(notes)
        .where(
          and(
            eq(notes.userId, ctx.user.id),
            gte(notes.createdAt, weekStartDate),
            lte(notes.createdAt, weekEndDate)
          )
        )
        .orderBy(desc(notes.createdAt));

      // 获取本周日记
      const weekDiaries = await db
        .select()
        .from(diaries)
        .where(
          and(
            eq(diaries.userId, ctx.user.id),
            gte(diaries.date, weekStartStr),
            lte(diaries.date, weekEndStr)
          )
        );

      if (weekNotes.length === 0 && weekDiaries.length === 0) {
        return {
          summary: "这周还没有记录，开始你的CALLING之旅吧！",
          highlights: [],
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
        };
      }

      // 构建AI输入
      const notesText = weekNotes
        .map(n => `[${n.category || '未分类'}] ${n.title || n.rawText}`)
        .join('\n');
      const diariesText = weekDiaries
        .map(d => `[${d.date}] ${d.title || ''}: ${d.content.slice(0, 100)}`)
        .join('\n');

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `你是CALLING应用的AI助手，负责生成温暖、鼓励性的周总结。
请根据用户本周的笔记和日记，生成一份简洁的周总结。
要求：
1. 语气温暖、鼓励，像一位关心用户的朋友
2. 总结不超过150字
3. 提取2-3个本周亮点
4. 返回JSON格式`,
            },
            {
              role: "user",
              content: `本周（${weekStartStr} 至 ${weekEndStr}）的记录：

笔记：
${notesText || '无'}

日记：
${diariesText || '无'}

请生成周总结。`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "week_summary",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "温暖的周总结文字" },
                  highlights: {
                    type: "array",
                    items: { type: "string" },
                    description: "本周2-3个亮点",
                  },
                },
                required: ["summary", "highlights"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices[0]?.message?.content;
        if (!rawContent) throw new Error("No AI response");
        const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
        const parsed = JSON.parse(content);

        return {
          summary: parsed.summary,
          highlights: parsed.highlights,
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
          noteCount: weekNotes.length,
          diaryCount: weekDiaries.length,
        };
      } catch (err) {
        console.error('[Insight] Week summary failed:', err);
        return {
          summary: `本周共记录了 ${weekNotes.length} 条笔记，写了 ${weekDiaries.length} 篇日记。继续保持！`,
          highlights: [],
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
          noteCount: weekNotes.length,
          diaryCount: weekDiaries.length,
        };
      }
    }),

  /**
   * 生成月洞察
   */
  monthInsight: protectedProcedure
    .input(z.object({
      // 月份（格式 "2026-04"）
      month: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const [year, monthNum] = input.month.split('-').map(Number);
      const monthStart = new Date(year, monthNum - 1, 1);
      const monthEnd = new Date(year, monthNum, 0, 23, 59, 59);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      const monthEndStr = monthEnd.toISOString().split('T')[0];

      const { gte, lte, sql } = await import('drizzle-orm');

      // 获取本月笔记统计
      const monthNotes = await db
        .select()
        .from(notes)
        .where(
          and(
            eq(notes.userId, ctx.user.id),
            gte(notes.createdAt, monthStart),
            lte(notes.createdAt, monthEnd)
          )
        );

      // 获取本月日记
      const monthDiaries = await db
        .select()
        .from(diaries)
        .where(
          and(
            eq(diaries.userId, ctx.user.id),
            gte(diaries.date, monthStartStr),
            lte(diaries.date, monthEndStr)
          )
        );

      // 统计各分类数量
      const categoryStats: Record<string, number> = {};
      monthNotes.forEach(n => {
        const cat = n.category || 'other';
        categoryStats[cat] = (categoryStats[cat] || 0) + 1;
      });

      const completedTasks = monthNotes.filter(n => n.completed).length;
      const totalTasks = monthNotes.filter(n => n.category === 'task').length;

      if (monthNotes.length === 0 && monthDiaries.length === 0) {
        return {
          insight: "这个月还没有记录，现在开始也不晚！",
          stats: { noteCount: 0, diaryCount: 0, completedTasks: 0, totalTasks: 0 },
          categoryStats: {},
          month: input.month,
        };
      }

      // 构建AI输入
      const statsText = Object.entries(categoryStats)
        .map(([cat, count]) => `${cat}: ${count}条`)
        .join(', ');

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `你是CALLING应用的AI助手，负责生成深度月洞察。
请根据用户本月的数据，生成一份有洞察力的月度总结。
要求：
1. 发现用户的行为模式和趋势
2. 给出一个有价值的洞察或建议
3. 语气温暖、智慧
4. 不超过200字
5. 返回JSON格式`,
            },
            {
              role: "user",
              content: `${input.month} 月度数据：

总笔记数：${monthNotes.length}
总日记数：${monthDiaries.length}
各分类：${statsText}
完成任务：${completedTasks}/${totalTasks}

日记摘要：
${monthDiaries.slice(0, 5).map(d => `${d.date}: ${d.content.slice(0, 80)}`).join('\n')}

请生成月洞察。`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "month_insight",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  insight: { type: "string", description: "月度洞察文字" },
                  pattern: { type: "string", description: "发现的行为模式" },
                  suggestion: { type: "string", description: "给用户的建议" },
                },
                required: ["insight", "pattern", "suggestion"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices[0]?.message?.content;
        if (!rawContent) throw new Error("No AI response");
        const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
        const parsed = JSON.parse(content);

        return {
          insight: parsed.insight,
          pattern: parsed.pattern,
          suggestion: parsed.suggestion,
          stats: {
            noteCount: monthNotes.length,
            diaryCount: monthDiaries.length,
            completedTasks,
            totalTasks,
          },
          categoryStats,
          month: input.month,
        };
      } catch (err) {
        console.error('[Insight] Month insight failed:', err);
        return {
          insight: `本月共记录了 ${monthNotes.length} 条笔记，写了 ${monthDiaries.length} 篇日记，完成了 ${completedTasks} 个任务。`,
          pattern: "持续记录中",
          suggestion: "继续保持记录的习惯！",
          stats: {
            noteCount: monthNotes.length,
            diaryCount: monthDiaries.length,
            completedTasks,
            totalTasks,
          },
          categoryStats,
          month: input.month,
        };
      }
    }),
});
