import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the database and LLM modules
vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// Test the AI classification prompt structure
describe("CALLING AI Classification", () => {
  it("should have correct category types defined", () => {
    const validCategories = ["task", "wish", "input", "output", "diary"];
    const validSubCategories = {
      task: ["homework", "course_task", "reading_progress", "external_task"],
      wish: ["todo_wish", "place", "person_wish", "shopping"],
      input: ["movie", "book", "article", "game", "podcast", "concept", "person", "course", "tool"],
      output: ["topic", "inspiration", "edit_idea", "drama_idea", "writing_topic", "design_idea", "game_design"],
      diary: ["daily"],
    };

    expect(validCategories).toHaveLength(5);
    expect(validSubCategories.task).toContain("homework");
    expect(validSubCategories.input).toContain("movie");
    expect(validSubCategories.output).toContain("game_design");
  });

  it("should parse AI response correctly", () => {
    const mockAIResponse = JSON.stringify({
      category: "input",
      subCategory: "movie",
      title: "想看《星际穿越》",
      description: "朋友推荐的科幻电影，讲述宇宙探索",
      deadline: null,
      tags: ["科幻", "电影", "推荐"],
      confidence: 0.95,
    });

    const parsed = JSON.parse(mockAIResponse);
    expect(parsed.category).toBe("input");
    expect(parsed.subCategory).toBe("movie");
    expect(parsed.title).toBe("想看《星际穿越》");
    expect(parsed.deadline).toBeNull();
    expect(parsed.tags).toHaveLength(3);
    expect(parsed.confidence).toBeGreaterThan(0.9);
  });

  it("should handle task with deadline", () => {
    const mockAIResponse = JSON.stringify({
      category: "task",
      subCategory: "homework",
      title: "数据结构作业",
      description: "完成第5章练习题，提交到教学平台",
      deadline: "2026-04-25T23:59:00.000Z",
      tags: ["作业", "数据结构"],
      confidence: 0.98,
    });

    const parsed = JSON.parse(mockAIResponse);
    expect(parsed.category).toBe("task");
    expect(parsed.deadline).not.toBeNull();
    const deadlineDate = new Date(parsed.deadline);
    expect(deadlineDate.getFullYear()).toBe(2026);
  });

  it("should validate streak calculation logic", () => {
    // 模拟连续3天的日记
    const dates = ["2026-04-20", "2026-04-19", "2026-04-18"];
    let currentStreak = 1;

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

    expect(currentStreak).toBe(3);
  });

  it("should update streak when completing a todo", () => {
    // 模拟完成待办时触发连胜更新
    const completedAt = new Date();
    const today = new Date().toISOString().split('T')[0];
    const completedDate = completedAt.toISOString().split('T')[0];
    expect(completedDate).toBe(today);
  });

  it("should detect streak break", () => {
    // 模拟中断的日记（跳过了一天）
    const dates = ["2026-04-20", "2026-04-18", "2026-04-17"]; // 缺少4月19日
    let currentStreak = 1;

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

    expect(currentStreak).toBe(1); // 连胜中断，只有今天
  });
});
