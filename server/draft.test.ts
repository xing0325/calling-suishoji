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

describe("notes.listDrafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns draft notes for the user", async () => {
    const { getDb } = await import("./db");
    const mockDrafts = [
      {
        id: 1,
        userId: 1,
        rawText: "asdfghjkl",
        category: "draft",
        subCategory: "unclassified",
        title: "asdfghjkl",
        aiProcessed: true,
        createdAt: new Date(),
      },
    ];

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockDrafts),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notes.listDrafts();

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("draft");
  });

  it("returns empty array when no drafts", async () => {
    const { getDb } = await import("./db");
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notes.listDrafts();

    expect(result).toHaveLength(0);
  });
});

describe("notes.extractTodosFromDiary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts todos from diary content", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              todos: [
                {
                  title: "完成数据结构作业",
                  category: "task",
                  subCategory: "homework",
                  description: "第5章练习题",
                },
                {
                  title: "看《活着》",
                  category: "input",
                  subCategory: "book",
                  description: "余华的小说",
                },
              ],
            }),
          },
        },
      ],
    } as any);

    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notes.extractTodosFromDiary({
      content: "今天想到要完成数据结构作业，还想看余华的《活着》",
      date: "2026-04-21",
    });

    expect(result.todos).toHaveLength(2);
    expect(result.todos[0].category).toBe("task");
    expect(result.todos[1].category).toBe("input");
  });

  it("returns empty todos when diary has no actionable items", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ todos: [] }),
          },
        },
      ],
    } as any);

    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notes.extractTodosFromDiary({
      content: "今天天气很好，心情不错，就这样。",
      date: "2026-04-21",
    });

    expect(result.todos).toHaveLength(0);
  });

  it("filters out invalid categories", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              todos: [
                {
                  title: "有效任务",
                  category: "task",
                  subCategory: "homework",
                  description: "",
                },
                {
                  title: "无效分类",
                  category: "unknown_category",
                  subCategory: "something",
                  description: "",
                },
              ],
            }),
          },
        },
      ],
    } as any);

    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notes.extractTodosFromDiary({
      content: "测试内容",
      date: "2026-04-21",
    });

    // 无效分类应被过滤掉
    expect(result.todos).toHaveLength(1);
    expect(result.todos[0].title).toBe("有效任务");
  });

  it("returns empty todos when AI call fails", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockRejectedValue(new Error("AI service unavailable"));

    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notes.extractTodosFromDiary({
      content: "今天要完成很多任务",
      date: "2026-04-21",
    });

    expect(result.todos).toHaveLength(0);
  });
});

describe("notes.batchCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates multiple notes at once", async () => {
    const { getDb } = await import("./db");
    let insertCount = 0;
    const mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockImplementation(() => {
        insertCount++;
        return Promise.resolve([{ insertId: insertCount }]);
      }),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notes.batchCreate({
      items: [
        { rawText: "任务1", title: "任务1", category: "task", subCategory: "homework", description: "" },
        { rawText: "任务2", title: "任务2", category: "wish", subCategory: "todo_wish", description: "" },
      ],
    });

    expect(result.count).toBe(2);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it("returns count 0 for empty items", async () => {
    const { getDb } = await import("./db");
    const mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notes.batchCreate({ items: [] });

    expect(result.count).toBe(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
