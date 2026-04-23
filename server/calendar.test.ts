import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getDb: vi.fn(),
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
  res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  user: mockUser,
});

describe("notes.calendarActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty arrays when no activity exists", async () => {
    const { getDb } = await import("./db");
    let whereCallCount = 0;
    const mockDb = {
      selectDistinct: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount <= 2) return Promise.resolve([]); // loginLogs + diaries
        return { groupBy: vi.fn().mockResolvedValue([]) }; // notes completed
      }),
      groupBy: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notes.calendarActivity({ year: 2026, month: 4 });

    expect(result.loginDates).toHaveLength(0);
    expect(result.diaryDates).toHaveLength(0);
    expect(result.completedDates).toHaveLength(0);
  });

  it("returns login dates for the month", async () => {
    const { getDb } = await import("./db");
    let queryIndex = 0;
    const mockDb = {
      selectDistinct: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        queryIndex++;
        if (queryIndex === 1) {
          // loginLogs query
          return Promise.resolve([{ date: "2026-04-01" }, { date: "2026-04-05" }]);
        }
        if (queryIndex === 2) {
          // diaries query
          return Promise.resolve([]);
        }
        // notes completed query - needs groupBy
        return { groupBy: vi.fn().mockResolvedValue([]) };
      }),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notes.calendarActivity({ year: 2026, month: 4 });

    expect(result.loginDates).toHaveLength(2);
    expect(result.loginDates).toContain("2026-04-01");
    expect(result.loginDates).toContain("2026-04-05");
  });

  it("returns completed dates with counts", async () => {
    const { getDb } = await import("./db");
    let queryIndex = 0;
    const mockDb = {
      selectDistinct: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        queryIndex++;
        if (queryIndex <= 2) return Promise.resolve([]);
        // notes completed query - needs groupBy
        return {
          groupBy: vi.fn().mockResolvedValue([
            { date: "2026-04-10", count: 3 },
            { date: "2026-04-15", count: 7 },
          ])
        };
      }),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const caller = appRouter.createCaller(createMockContext());
    const result = await caller.notes.calendarActivity({ year: 2026, month: 4 });

    expect(result.completedDates).toHaveLength(2);
    expect(result.completedDates[0]).toEqual({ date: "2026-04-10", count: 3 });
    expect(result.completedDates[1]).toEqual({ date: "2026-04-15", count: 7 });
  });

  it("rejects invalid year/month", async () => {
    const caller = appRouter.createCaller(createMockContext());

    await expect(
      caller.notes.calendarActivity({ year: 2019, month: 4 })
    ).rejects.toThrow();

    await expect(
      caller.notes.calendarActivity({ year: 2026, month: 13 })
    ).rejects.toThrow();
  });
});
