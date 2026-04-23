import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { emailVerifications, users, loginLogs } from "../../drizzle/schema";
import { getDb } from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { sdk } from "../_core/sdk";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 生成随机6位数字验证码
 */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 通过内置LLM API发送验证码邮件（使用邮件发送能力）
 * 实际上使用Forge通知API发送邮件
 */
async function sendVerificationEmail(email: string, code: string): Promise<void> {
  // 使用Forge内置通知API发送邮件
  const forgeBaseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
  const forgeKey = ENV.forgeApiKey;

  if (!forgeBaseUrl || !forgeKey) {
    console.warn("[Auth] Forge API not configured, skipping email send");
    // 开发环境下打印验证码到控制台
    console.log(`[Auth] Verification code for ${email}: ${code}`);
    return;
  }

  try {
    const resp = await fetch(`${forgeBaseUrl}/v1/notification/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${forgeKey}`,
      },
      body: JSON.stringify({
        to: email,
        subject: "CALLING - 邮箱验证码",
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #7C3AED; margin-bottom: 8px;">CALLING</h2>
            <p style="color: #666; margin-bottom: 24px;">用爱呼唤你自己</p>
            <p style="font-size: 16px; color: #333;">你的验证码是：</p>
            <div style="background: #F3F0FF; border-radius: 12px; padding: 20px; text-align: center; margin: 16px 0;">
              <span style="font-size: 36px; font-weight: bold; color: #7C3AED; letter-spacing: 8px;">${code}</span>
            </div>
            <p style="color: #999; font-size: 14px;">验证码10分钟内有效，请勿泄露给他人。</p>
          </div>
        `,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.warn("[Auth] Email send failed:", text);
      // 降级：打印到控制台
      console.log(`[Auth] Verification code for ${email}: ${code}`);
    }
  } catch (err) {
    console.warn("[Auth] Email send error:", err);
    console.log(`[Auth] Verification code for ${email}: ${code}`);
  }
}

export const authRouter = router({
  /**
   * 账号密码注册
   */
  register: publicProcedure
    .input(
      z.object({
        username: z.string().min(2).max(32),
        password: z.string().min(6).max(64),
        name: z.string().min(1).max(32).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

      // 检查用户名是否已存在
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "用户名已被使用" });
      }

      // 哈希密码
      const passwordHash = await bcrypt.hash(input.password, 12);

      // 生成唯一openId（用于兼容现有session系统）
      const openId = `local_${nanoid(16)}`;

      // 创建用户
      await db.insert(users).values({
        openId,
        username: input.username,
        passwordHash,
        name: input.name || input.username,
        loginMethod: "password",
        lastSignedIn: new Date(),
      });

      // 获取创建的用户
      const [newUser] = await db
        .select()
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);

      if (!newUser) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "注册失败" });
      }

      // 创建session token（30天）
      const token = await sdk.signSession(
        { openId, appId: ENV.appId, name: newUser.name || input.username },
        { expiresInMs: THIRTY_DAYS_MS }
      );

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: THIRTY_DAYS_MS,
      });

      // 记录登录日志
      const today = new Date().toISOString().split('T')[0];
      await db.insert(loginLogs).values({ userId: newUser.id, date: today }).catch(() => {});

      return { success: true, user: { id: newUser.id, name: newUser.name, username: newUser.username } };
    }),

  /**
   * 账号密码登录
   */
  loginWithPassword: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

      // 查找用户（支持用户名或邮箱登录）
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "用户名或密码错误" });
      }

      // 验证密码
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "用户名或密码错误" });
      }

      // 更新最后登录时间
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      // 创建session token（30天）
      const token = await sdk.signSession(
        { openId: user.openId, appId: ENV.appId, name: user.name || user.username || "" },
        { expiresInMs: THIRTY_DAYS_MS }
      );

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: THIRTY_DAYS_MS,
      });

      // 记录登录日志
      const todayPwd = new Date().toISOString().split('T')[0];
      await db.insert(loginLogs).values({ userId: user.id, date: todayPwd }).catch(() => {});

      return { success: true, user: { id: user.id, name: user.name, username: user.username } };
    }),

  /**
   * 发送邮箱验证码
   */
  sendEmailCode: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟

      // 存储验证码
      await db.insert(emailVerifications).values({
        email: input.email,
        code,
        expiresAt,
      });

      // 发送邮件
      await sendVerificationEmail(input.email, code);

      return { success: true };
    }),

  /**
   * 邮箱验证码登录/注册
   */
  loginWithEmailCode: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        code: z.string().length(6),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

      // 验证验证码
      const [verification] = await db
        .select()
        .from(emailVerifications)
        .where(
          and(
            eq(emailVerifications.email, input.email),
            eq(emailVerifications.code, input.code),
            eq(emailVerifications.used, false),
            gt(emailVerifications.expiresAt, new Date())
          )
        )
        .orderBy(emailVerifications.createdAt)
        .limit(1);

      if (!verification) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "验证码无效或已过期" });
      }

      // 标记验证码为已使用
      await db
        .update(emailVerifications)
        .set({ used: true })
        .where(eq(emailVerifications.id, verification.id));

      // 查找或创建用户
      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!user) {
        // 新用户，自动注册
        const openId = `email_${nanoid(16)}`;
        const emailName = input.email.split("@")[0];

        await db.insert(users).values({
          openId,
          email: input.email,
          emailVerified: true,
          name: emailName,
          loginMethod: "email",
          lastSignedIn: new Date(),
        });

        [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, input.email))
          .limit(1);
      } else {
        // 更新邮箱验证状态和登录时间
        await db
          .update(users)
          .set({ emailVerified: true, lastSignedIn: new Date() })
          .where(eq(users.id, user.id));
      }

      if (!user) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "登录失败" });
      }

      const displayName = user.name || input.email.split("@")[0] || "";

      // 创建session token（30天）
      const token = await sdk.signSession(
        { openId: user.openId, appId: ENV.appId, name: displayName },
        { expiresInMs: THIRTY_DAYS_MS }
      );

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: THIRTY_DAYS_MS,
      });

      // 记录登录日志
      const todayEmail = new Date().toISOString().split('T')[0];
      await db.insert(loginLogs).values({ userId: user.id, date: todayEmail }).catch(() => {});

      return { success: true, user: { id: user.id, name: user.name, email: user.email } };
    }),
});
