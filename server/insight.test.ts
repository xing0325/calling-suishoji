import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Mock invokeLLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

const mockUser = {
  id: 1,
  openId: "test_openid",
  name: "Test User",
  username: "testuser",
  passwordHash: null,
  email: null,
  emailVerified: false,
  loginMethod: "oauth",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const createMockContext = (): TrpcContext => ({
  req: {} as any,
  res: {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as any,
  user: mockUser,
});

describe("insight router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("weekSummary", () => {
    it("returns empty message when no data exists", async () => {
      const { getDb } = await import("./db");
      // weekNotes 有 orderBy， weekDiaries 没有 orderBy（直接由 where 返回）
      let whereCallCount0 = 0;
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => {
          whereCallCount0++;
          if (whereCallCount0 === 2) {
            return Promise.resolve([]); // diaries 查询返回空
          }
          return mockDb;
        }),
        orderBy: vi.fn().mockResolvedValueOnce([]), // notes 查询返回空
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.insight.weekSummary({ weekStart: "2026-04-14" });

      expect(result).toBeDefined();
      expect(result?.summary).toContain("还没有记录");
      expect(result?.highlights).toEqual([]);
    });

    it("calls AI and returns summary when data exists", async () => {
      const { getDb } = await import("./db");
      const { invokeLLM } = await import("./_core/llm");

      const mockNotes = [
        { id: 1, userId: 1, rawText: "完成作业", category: "task", title: "完成作业", createdAt: new Date() },
      ];
      const mockDiaries = [
        { id: 1, userId: 1, date: "2026-04-15", content: "今天很充实", title: "日记" },
      ];

      // weekNotes 查询有 orderBy， weekDiaries 查询没有 orderBy（直接由 where 返回）
      let whereCallCount = 0;
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => {
          whereCallCount++;
          if (whereCallCount === 2) {
            // 第二次 where 是 diaries 查询，直接返回
            return Promise.resolve(mockDiaries);
          }
          return mockDb; // 第一次返回自身以支持链式调用
        }),
        orderBy: vi.fn().mockResolvedValueOnce(mockNotes),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      vi.mocked(invokeLLM).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              summary: "本周你完成了一个任务，写了一篇日记，表现很棒！",
              highlights: ["完成了作业任务", "坚持写日记"],
            }),
          },
        }],
      } as any);

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.insight.weekSummary({ weekStart: "2026-04-14" });

      expect(result).toBeDefined();
      expect(result?.summary).toContain("本周");
      expect(result?.highlights).toHaveLength(2);
    });

    it("falls back gracefully when AI fails", async () => {
      const { getDb } = await import("./db");
      const { invokeLLM } = await import("./_core/llm");

      const mockNotes = [
        { id: 1, userId: 1, rawText: "测试笔记", category: "task", title: "测试", createdAt: new Date() },
      ];

      // weekNotes 有 orderBy， weekDiaries 没有 orderBy
      let whereCallCount2 = 0;
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => {
          whereCallCount2++;
          if (whereCallCount2 === 2) {
            return Promise.resolve([]); // diaries 查询返回空
          }
          return mockDb;
        }),
        orderBy: vi.fn().mockResolvedValueOnce(mockNotes),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      vi.mocked(invokeLLM).mockRejectedValue(new Error("AI service unavailable"));

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // Should not throw, should return fallback
      const result = await caller.insight.weekSummary({ weekStart: "2026-04-14" });

      expect(result).toBeDefined();
      expect(result?.summary).toContain("1");
      expect(result?.highlights).toEqual([]);
    });
  });

  describe("monthInsight", () => {
    it("returns empty message when no data exists", async () => {
      const { getDb } = await import("./db");
      // monthNotes 和 monthDiaries 都没有 orderBy，直接由 where 返回
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.insight.monthInsight({ month: "2026-04" });

      expect(result).toBeDefined();
      expect(result?.insight).toContain("没有记录");
    });
  });
});
