import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { schedules, pushSubscriptions } from "../../drizzle/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import webpush from "web-push";

// VAPID 配置（优先使用环境变量）
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BD60H7AtI9uWox_6a5WrbZ1jF7Q0nTLkLjRxUC4DMcF--Iq7Zdbq6m-aNjDsMyZpuHt3yZGQJhZ6Sv_b6QWjN_I";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "sfQn-U6PesokMHJcy4JhJh36ZrEbIDnaZwNJ8b4K79A";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:calling@manus.space";

webpush.setVapidDetails(
  VAPID_EMAIL,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export const schedulesRouter = router({
  /** 获取指定日期的日程列表 */
  list: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const dbConn = await getDb();
      if (!dbConn) return [];
      return dbConn
        .select()
        .from(schedules)
        .where(
          and(
            eq(schedules.userId, ctx.user.id),
            eq(schedules.date, input.date)
          )
        )
        .orderBy(schedules.time);
    }),

  /** 获取指定月份的日程日期列表（用于日历标记） */
  listByMonth: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const [year, mon] = input.month.split("-");
      const startDate = `${year}-${mon}-01`;
      const endDate = `${year}-${mon}-31`;
      const dbConn = await getDb();
      if (!dbConn) return [];
      const rows = await dbConn
        .select({ date: schedules.date })
        .from(schedules)
        .where(eq(schedules.userId, ctx.user.id));
      // 过滤月份范围
      return rows
        .filter((r: { date: string }) => r.date >= startDate && r.date <= endDate)
        .map((r: { date: string }) => r.date);
    }),

  /** 创建日程 */
  create: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        remindEnabled: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let remindAt: Date | undefined;
      if (input.remindEnabled && input.time) {
        // 把日期+时间组合成 UTC 时间戳
        remindAt = new Date(`${input.date}T${input.time}:00`);
      } else if (input.remindEnabled && !input.time) {
        // 没有具体时间则设为当天早上9点
        remindAt = new Date(`${input.date}T09:00:00`);
      }

      const dbConn = await getDb();
      if (!dbConn) throw new Error('Database not available');
      const [result] = await dbConn.insert(schedules).values({
        userId: ctx.user.id,
        date: input.date,
        time: input.time ?? null,
        title: input.title,
        description: input.description ?? null,
        remindEnabled: input.remindEnabled,
        remindAt: remindAt ?? null,
        reminded: false,
      });

      return { id: (result as any).insertId as number };
    }),

  /** 删除日程 */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dbConn = await getDb();
      if (!dbConn) throw new Error('Database not available');
      await dbConn
        .delete(schedules)
        .where(
          and(
            eq(schedules.id, input.id),
            eq(schedules.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  /** 保存浏览器 Push 订阅 */
  savePushSubscription: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbConn = await getDb();
      if (!dbConn) throw new Error('Database not available');
      // 先删除该用户旧的订阅（同一浏览器重新订阅）
      await dbConn
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, ctx.user.id));

      await dbConn.insert(pushSubscriptions).values({
        userId: ctx.user.id,
        endpoint: input.endpoint,
        keys: input.keys,
      });

      return { success: true };
    }),

  /** 获取 VAPID 公钥（前端订阅时需要） */
  getVapidPublicKey: protectedProcedure.query(() => {
    return { publicKey: VAPID_PUBLIC_KEY };
  }),
});

/**
 * 定时任务：每分钟检查到期提醒并发送 Web Push
 * 在 server/_core/index.ts 中调用 startReminderCron() 启动
 */
export async function sendDueReminders() {
  const now = new Date();
  // 查找 remindAt <= now 且 reminded = false 的日程
  const dbConn = await getDb();
  if (!dbConn) return;
  const dueSchedules = await dbConn
    .select({
      id: schedules.id,
      userId: schedules.userId,
      title: schedules.title,
      date: schedules.date,
      time: schedules.time,
    })
    .from(schedules)
    .where(
      and(
        lte(schedules.remindAt, now),
        eq(schedules.reminded, false),
        isNotNull(schedules.remindAt)
      )
    );

  for (const schedule of dueSchedules) {
    // 查找该用户的 Push 订阅
    const [sub] = await dbConn
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, schedule.userId));

    if (sub) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys as { p256dh: string; auth: string },
          },
          JSON.stringify({
            title: "CALLING 提醒",
            body: `${schedule.time ? schedule.time + " " : ""}${schedule.title}`,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
          })
        );
      } catch (err) {
        console.error("[Push] 发送失败:", err);
      }
    }

    // 标记为已提醒
    await dbConn
      .update(schedules)
      .set({ reminded: true })
      .where(eq(schedules.id, schedule.id));
  }
}
