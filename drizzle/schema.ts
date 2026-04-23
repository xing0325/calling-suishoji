import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  /** 用户名（账号密码登录用） */
  username: varchar("username", { length: 64 }).unique(),
  /** 密码哈希（bcrypt） */
  passwordHash: varchar("passwordHash", { length: 255 }),
  email: varchar("email", { length: 320 }).unique(),
  /** 邮箱是否已验证 */
  emailVerified: boolean("emailVerified").default(false).notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 邮箱验证码表
 */
export const emailVerifications = mysqlTable("email_verifications", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  code: varchar("code", { length: 8 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailVerification = typeof emailVerifications.$inferSelect;

/**
 * 随手记表 - 存储用户的原始输入和AI解析结果
 */
export const notes = mysqlTable("notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  rawText: text("rawText").notNull(),
  category: varchar("category", { length: 64 }),
  subCategory: varchar("subCategory", { length: 64 }),
  title: text("title"),
  description: text("description"),
  deadline: timestamp("deadline"),
  tags: json("tags").$type<string[]>(),
  aiProcessed: boolean("aiProcessed").default(false).notNull(),
  aiRawResponse: text("aiRawResponse"),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  /** 日程日期（YYYY-MM-DD），任何 category 都可附带 */
  scheduleDate: varchar("scheduleDate", { length: 10 }),
  /** 日程时间（HH:MM），可为空 */
  scheduleTime: varchar("scheduleTime", { length: 5 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

/**
 * 日记表
 */
export const diaries = mysqlTable("diaries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  title: text("title"),
  content: text("content").notNull(),
  mood: varchar("mood", { length: 10 }),
  weather: varchar("weather", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Diary = typeof diaries.$inferSelect;
export type InsertDiary = typeof diaries.$inferInsert;

/**
 * 连胜记录表
 */
export const streaks = mysqlTable("streaks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  currentStreak: int("currentStreak").default(0).notNull(),
  longestStreak: int("longestStreak").default(0).notNull(),
  lastActiveDate: varchar("lastActiveDate", { length: 10 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Streak = typeof streaks.$inferSelect;

/**
 * 登录日志表 - 每次登录记录一条，用于日历登录视图
 */
export const loginLogs = mysqlTable('login_logs', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull(),
  /** 登录日期，格式 YYYY-MM-DD */
  date: varchar('date', { length: 10 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type LoginLog = typeof loginLogs.$inferSelect;

/**
 * 日程表 - 存储用户添加的日程和任务
 */
export const schedules = mysqlTable('schedules', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull(),
  /** 日期 YYYY-MM-DD */
  date: varchar('date', { length: 10 }).notNull(),
  /** 具体时间 HH:MM（可为空） */
  time: varchar('time', { length: 5 }),
  title: text('title').notNull(),
  description: text('description'),
  /** 是否开启提醒 */
  remindEnabled: boolean('remindEnabled').default(false).notNull(),
  /** 提醒时间（UTC） */
  remindAt: timestamp('remindAt'),
  /** 是否已发送提醒 */
  reminded: boolean('reminded').default(false).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;

/**
 * Push订阅表 - 存储浏览器Push订阅对象
 */
export const pushSubscriptions = mysqlTable('push_subscriptions', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull(),
  /** 订阅终纨 URL */
  endpoint: text('endpoint').notNull(),
  /** 加密密鑰（JSON字符串） */
  keys: json('keys').$type<{ p256dh: string; auth: string }>().notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;

/**
 * AI 分类日志表 - 记录每次主页输入的 AI 归类历史
 */
export const classificationLogs = mysqlTable('classification_logs', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull(),
  /** 原始输入文字 */
  rawText: text('rawText').notNull(),
  /** AI 分类结果 */
  category: varchar('category', { length: 64 }),
  subCategory: varchar('subCategory', { length: 64 }),
  title: text('title'),
  /** AI 置信度 */
  confidence: varchar('confidence', { length: 10 }),
  /** 同步到了哪些页面（JSON数组，如 ["calendar", "diary", "world"]） */
  syncedTo: json('syncedTo').$type<string[]>(),
  /** AI 原始响应 */
  aiRawResponse: text('aiRawResponse'),
  /** 关联的 note id */
  noteId: int('noteId'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});
export type ClassificationLog = typeof classificationLogs.$inferSelect;
export type InsertClassificationLog = typeof classificationLogs.$inferInsert;