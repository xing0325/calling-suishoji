import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { notesRouter, insightRouter } from "./routers/notes";
import { authRouter } from "./routers/auth";
import { schedulesRouter } from "./routers/schedules";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    // 账号密码注册
    register: authRouter.register,
    // 账号密码登录
    loginWithPassword: authRouter.loginWithPassword,
    // 发送邮箱验证码
    sendEmailCode: authRouter.sendEmailCode,
    // 邮箱验证码登录
    loginWithEmailCode: authRouter.loginWithEmailCode,
  }),

  notes: notesRouter,
  insight: insightRouter,
  schedules: schedulesRouter,
});

export type AppRouter = typeof appRouter;
