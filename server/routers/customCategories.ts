import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { customCategories } from "../../drizzle/schema";
import { and, eq, asc } from "drizzle-orm";

export const customCategoriesRouter = router({
  /** 获取当前用户某一主分类下的所有自定义子分类 */
  list: protectedProcedure
    .input(z.object({ parentCategory: z.enum(['input', 'output']) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(customCategories)
        .where(
          and(
            eq(customCategories.userId, ctx.user.id),
            eq(customCategories.parentCategory, input.parentCategory)
          )
        )
        .orderBy(asc(customCategories.createdAt));
    }),

  /** 创建自定义子分类 */
  create: protectedProcedure
    .input(z.object({
      parentCategory: z.enum(['input', 'output']),
      label: z.string().min(1).max(20),
      icon: z.string().min(1).max(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 同一用户同一主分类最多 20 个自定义分类
      const existing = await db
        .select()
        .from(customCategories)
        .where(
          and(
            eq(customCategories.userId, ctx.user.id),
            eq(customCategories.parentCategory, input.parentCategory)
          )
        );
      if (existing.length >= 20) throw new Error("最多创建 20 个自定义分类");

      const subCategory = `custom_${Date.now()}`;
      const [result] = await db.insert(customCategories).values({
        userId: ctx.user.id,
        parentCategory: input.parentCategory,
        subCategory,
        label: input.label,
        icon: input.icon,
      });
      return { id: (result as any).insertId, subCategory, label: input.label, icon: input.icon };
    }),

  /** 删除自定义子分类 */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .delete(customCategories)
        .where(and(eq(customCategories.id, input.id), eq(customCategories.userId, ctx.user.id)));
      return { success: true };
    }),
});
