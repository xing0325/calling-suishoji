import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import AddScheduleModal from './AddScheduleModal';

type CalendarViewMode = 'completed' | 'login' | 'diary' | 'overview';

interface CalendarViewProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  streakDays?: number;
  initialViewMode?: CalendarViewMode;
  onHistoryOpen?: () => void;
}

/**
 * CALLING 日历组件 - 多视图版
 * - 完成视图（默认）：热力图4档亮度
 * - 登录视图：登录日期淡紫背景+高亮边框
 * - 日记视图：日记日期淡紫背景+右上角火苗
 * - 总览视图：3色小点（紫=登录/橙=日记/绿=完成）
 */
const CalendarView: React.FC<CalendarViewProps> = ({
  selectedDate = new Date(),
  onDateSelect,
  streakDays = 0,
  initialViewMode,
}) => {
  const { isAuthenticated } = useAuth();
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date(selectedDate));
  const [viewMode, setViewMode] = useState<CalendarViewMode>(initialViewMode ?? 'completed');
  // 当父组件传入新的 initialViewMode 时（如点击 toast 的"查看历史"），同步切换 tab
  useEffect(() => {
    if (initialViewMode) setViewMode(initialViewMode);
  }, [initialViewMode]);
  // 双击添加日程
  const [addScheduleDate, setAddScheduleDate] = useState<string | null>(null);
  const [showScheduleList, setShowScheduleList] = useState<string | null>(null); // 点击查看日程
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef = useRef(0);

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth() + 1;

  const { data: activity, isLoading } = trpc.notes.calendarActivity.useQuery(
    { year, month },
    { enabled: isAuthenticated }
  );
  // 月度日程数据（用于日历格子标记）
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const { data: monthSchedules = [] } = trpc.schedules.listByMonth.useQuery(
    { month: monthStr },
    { enabled: isAuthenticated }
  );

  // 月份第一天是星期几（0=周日）
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  // 格式化日期为 YYYY-MM-DD
  const fmtDate = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const today = fmtDate(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    new Date().getDate()
  );

  // 构建当月每天的数据集合
  const loginSet = useMemo(() => new Set(activity?.loginDates ?? []), [activity]);
  const diarySet = useMemo(() => new Set(activity?.diaryDates ?? []), [activity]);
  const completedMap = useMemo(() => {
    const m = new Map<string, number>();
    (activity?.completedDates ?? []).forEach(({ date, count }) => m.set(date, count));
    return m;
  }, [activity]);
  // 日程数据集合（按日期分组，返回的是 string[]）
  const scheduleMap = useMemo(() => {
    const m = new Map<string, number>();
    (monthSchedules as string[]).forEach((dateStr: string) => m.set(dateStr, (m.get(dateStr) ?? 0) + 1));
    return m;
  }, [monthSchedules]);

  // 热力图档位：0=无, 1=淡(1项), 2=中(2-4项), 3=亮(5+项)
  const getHeatLevel = (count: number) => {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 4) return 2;
    return 3;
  };

  // 连胜计算（基于完成视图数据）
  const streakInfo = useMemo(() => {
    if (!activity) return { currentStreak: streakDays, maxStreak: streakDays };
    // 简单用props传入的连胜数据
    return { currentStreak: streakDays, maxStreak: streakDays };
  }, [activity, streakDays]);

  const prevMonth = () => {
    const d = new Date(displayMonth);
    d.setMonth(d.getMonth() - 1);
    setDisplayMonth(d);
  };

  const nextMonth = () => {
    const d = new Date(displayMonth);
    d.setMonth(d.getMonth() + 1);
    setDisplayMonth(d); // 允许切换到未来月份
  };

  // 处理日期格子点击（单击选择，双击添加日程）
  const handleDayClick = (day: number, _isFuture: boolean) => {
    const dateStr = fmtDate(year, month, day);
    clickCountRef.current += 1;
    if (clickCountRef.current === 1) {
      clickTimerRef.current = setTimeout(() => {
        // 单击：选择日期，显示当天日程列表
        onDateSelect?.(new Date(year, month - 1, day));
        setShowScheduleList(dateStr);
        clickCountRef.current = 0;
      }, 250);
    } else if (clickCountRef.current === 2) {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickCountRef.current = 0;
      // 双击：打开添加日程弹窗
      setAddScheduleDate(dateStr);
    }
  };

  const isNextDisabled = () => false; // 允许切换到未来月份

  // 渲染单个日期格子
  const renderDay = (day: number) => {
    const dateStr = fmtDate(year, month, day);
    const isToday = dateStr === today;
    const isFuture = dateStr > today;
    const isSelected = selectedDate &&
      fmtDate(selectedDate.getFullYear(), selectedDate.getMonth() + 1, selectedDate.getDate()) === dateStr;

    const hasLogin = loginSet.has(dateStr);
    const hasDiary = diarySet.has(dateStr);
    const completedCount = completedMap.get(dateStr) ?? 0;
    const heatLevel = getHeatLevel(completedCount);

    // 背景色和边框
    let bgClass = '';
    // 今天始终保留白色细边框，选中时叠加紫色外圈
    let borderClass = isToday ? 'ring-1 ring-white/60' : '';
    if (isSelected) borderClass = isToday ? 'ring-1 ring-white/60 outline outline-2 outline-violet-400 outline-offset-1' : 'ring-2 ring-violet-400';

    if (!isFuture) {
      if (viewMode === 'login' && hasLogin) {
        bgClass = 'bg-violet-900/50';
        if (!isSelected) borderClass += ' ring-1 ring-violet-500';
      } else if (viewMode === 'diary' && hasDiary) {
        bgClass = 'bg-violet-900/50';
      } else if (viewMode === 'completed') {
        if (heatLevel === 1) bgClass = 'bg-violet-900/30';
        else if (heatLevel === 2) bgClass = 'bg-violet-700/50';
        else if (heatLevel === 3) bgClass = 'bg-violet-500/70';
      }
    }

    return (
      <div
        key={day}
        onClick={() => handleDayClick(day, isFuture)}
        className={`
          relative flex flex-col items-center justify-center
          w-9 h-9 rounded-lg text-sm font-medium
          transition-all duration-200 cursor-pointer select-none
          ${isFuture ? 'opacity-60' : 'hover:bg-violet-800/30'}
          ${bgClass} ${borderClass}
          ${isSelected ? 'text-white font-bold' : isFuture ? 'text-muted-foreground' : 'text-foreground'}
        `}
      >
        <span className="leading-none">{day}</span>

        {/* 日记视图：右上角火苗 */}
        {viewMode === 'diary' && hasDiary && !isFuture && (
          <span className="absolute top-0 right-0.5 text-[9px] leading-none">🔥</span>
        )}

        {/* 总览视图：底逈3色小点 */}
        {viewMode === 'overview' && !isFuture && (hasLogin || hasDiary || completedCount > 0) && (
          <div className="absolute bottom-0.5 flex gap-[2px] items-center">
            {hasLogin && <span className="w-[4px] h-[4px] rounded-full bg-violet-400 inline-block" />}
            {hasDiary && <span className="w-[4px] h-[4px] rounded-full bg-orange-400 inline-block" />}
            {completedCount > 0 && <span className="w-[4px] h-[4px] rounded-full bg-emerald-400 inline-block" />}
          </div>
        )}
        {/* 日程标记：左上角蓝色小点（包括未来日期） */}
        {scheduleMap.has(dateStr) && (
          <span className="absolute top-0.5 left-0.5 w-[5px] h-[5px] rounded-full bg-sky-400" />
        )}
      </div>
    );
  };

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  // 月份统计
  const monthStats = useMemo(() => {
    const loginCount = loginSet.size;
    const diaryCount = diarySet.size;
    const completedDayCount = completedMap.size;
    const totalCompleted = Array.from(completedMap.values()).reduce((a, b) => a + b, 0);
    return { loginCount, diaryCount, completedDayCount, totalCompleted };
  }, [loginSet, diarySet, completedMap]);

  const viewLabels: { key: CalendarViewMode; label: string }[] = [
    { key: 'completed', label: '完成' },
    { key: 'login', label: '登录' },
    { key: 'diary', label: '日记' },
    { key: 'overview', label: '总览' },
  ];

  return (
    <div className="space-y-4">
      {/* 连胜卡片 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm hover:border-primary/50 transition-all">
          <p className="text-xs text-muted-foreground mb-1">当前连胜</p>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-primary">{streakInfo.currentStreak}</p>
            <span className="text-2xl mb-1">🔥</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">天</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm hover:border-primary/50 transition-all">
          <p className="text-xs text-muted-foreground mb-1">本月完成</p>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-primary">{monthStats.totalCompleted}</p>
            <span className="text-2xl mb-1">✅</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">项待办</p>
        </div>
      </div>

      {/* 日历主体 */}
      <div className="bg-card border border-border rounded-lg p-4 shadow-sm hover:border-primary/50 transition-all">
        {/* 月份导航 */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {displayMonth.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
          </h3>
          <div className="flex gap-1">
            <button onClick={prevMonth} className="p-1 hover:bg-secondary rounded transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              disabled={isNextDisabled()}
              className="p-1 hover:bg-secondary rounded transition-colors disabled:opacity-30 disabled:cursor-default"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 视图切换分段控制器 */}
        <div className="flex bg-secondary/50 rounded-lg p-0.5 mb-4 gap-0.5">
          {viewLabels.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={`
                flex-1 text-xs py-1.5 rounded-md font-medium transition-all duration-200
                ${viewMode === key
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 mb-1">
          {weekDays.map(d => (
            <div key={d} className="text-center text-xs text-muted-foreground py-1 font-semibold">
              {d}
            </div>
          ))}
        </div>

        {/* 日期格子 */}
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            加载中...
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-y-1">
            {/* 空白占位（月份第一天前的空格） */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {/* 日期 */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => renderDay(day))}
          </div>
        )}

        {/* 图例 */}
        <div className="mt-3 pt-3 border-t border-border/50">
          {viewMode === 'completed' && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>完成数：</span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-violet-900/30 inline-block" /> 1项
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-violet-700/50 inline-block" /> 2-4项
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-violet-500/70 inline-block" /> 5+项
              </span>
            </div>
          )}
          {viewMode === 'login' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-3 h-3 rounded bg-violet-900/50 ring-1 ring-violet-500 inline-block" />
              <span>登录日期 · 本月共 {monthStats.loginCount} 天</span>
            </div>
          )}
          {viewMode === 'diary' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>🔥</span>
              <span>写了日记 · 本月共 {monthStats.diaryCount} 篇</span>
            </div>
          )}
          {viewMode === 'overview' && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> 登录
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> 日记
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> 完成待办
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 选中日期的日程列表 */}
      {showScheduleList && (
        <ScheduleListPanel
          date={showScheduleList}
          onClose={() => setShowScheduleList(null)}
          onAddNew={() => setAddScheduleDate(showScheduleList)}
        />
      )}

      {/* 本月统计 */}
      <div className="bg-card border border-border rounded-lg p-4 shadow-sm hover:border-primary/50 transition-all">
        <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
          📊 本月统计
        </h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">登录天数</span>
            <span className="font-semibold text-violet-400">{monthStats.loginCount} 天</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">写日记天数</span>
            <span className="font-semibold text-orange-400">{monthStats.diaryCount} 天</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">有完成的天数</span>
            <span className="font-semibold text-emerald-400">{monthStats.completedDayCount} 天</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">完成待办总数</span>
            <span className="font-semibold text-primary">{monthStats.totalCompleted} 项</span>
          </div>
        </div>
      </div>

      {/* 添加日程弹窗 */}
      {addScheduleDate && (
        <AddScheduleModal
          open={!!addScheduleDate}
          date={addScheduleDate}
          onClose={() => setAddScheduleDate(null)}
          onAdded={() => {
            const d = addScheduleDate;
            setAddScheduleDate(null);
            setShowScheduleList(d);
          }}
        />
      )}
    </div>
  );
};

// ---- AI 分类历史面板 ----
const CATEGORY_LABELS: Record<string, string> = {
  task: '责任',
  wish: '愿望',
  input: '输入',
  output: '输出',
  diary: '日记',
  schedule: '日程',
  draft: '草稿筱',
};
const SYNC_PAGE_LABELS: Record<string, string> = {
  world: '责任',
  calendar: '日历',
  diary: '日记',
  input: '输入',
  output: '输出',
};
const CATEGORY_COLORS: Record<string, string> = {
  task: 'text-orange-400',
  wish: 'text-pink-400',
  input: 'text-sky-400',
  output: 'text-emerald-400',
  diary: 'text-amber-400',
  schedule: 'text-violet-400',
  draft: 'text-muted-foreground',
};

function ClassificationHistoryPanel() {
  const { isAuthenticated } = useAuth();
  const { data: logs = [], isLoading } = trpc.notes.listClassificationLogs.useQuery(
    { limit: 50, offset: 0 },
    { enabled: isAuthenticated }
  );

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-violet-300">🤖 AI 分类历史</h3>
        <span className="text-xs text-muted-foreground">共 {logs.length} 条</span>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">加载中...</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-xs text-muted-foreground">还没有历史记录</p>
          <p className="text-xs text-muted-foreground mt-1">在主页输入内容后，AI 分类历史会在这里显示</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className="py-2.5 px-3 bg-[#0f0f23] rounded-lg border border-violet-800/20"
            >
              {/* 原始输入 */}
              <p className="text-sm text-foreground mb-1.5 line-clamp-2">{log.rawText}</p>
              {/* AI 分类结果 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold ${CATEGORY_COLORS[log.category ?? 'draft'] ?? 'text-muted-foreground'}`}>
                  → {CATEGORY_LABELS[log.category ?? 'draft'] ?? log.category}
                </span>
                {log.subCategory && (
                  <span className="text-xs text-muted-foreground">/ {log.subCategory}</span>
                )}
                {log.title && (
                  <span className="text-xs text-foreground/70">「{log.title}」</span>
                )}
              </div>
              {/* 同步页面 */}
              {log.syncedTo && (log.syncedTo as string[]).length > 0 && (
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">同步到：</span>
                  {(log.syncedTo as string[]).map((page) => (
                    <span key={page} className="text-xs px-1.5 py-0.5 bg-violet-900/40 text-violet-300 rounded">
                      {SYNC_PAGE_LABELS[page] ?? page}
                    </span>
                  ))}
                </div>
              )}
              {/* 时间和置信度 */}
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-muted-foreground">{formatTime(log.createdAt)}</span>
                {log.confidence && (
                  <span className="text-xs text-muted-foreground">置信度 {(parseFloat(log.confidence) * 100).toFixed(0)}%</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- 日程列表面板 ----
interface ScheduleListPanelProps {
  date: string;
  onClose: () => void;
  onAddNew: () => void;
}

function ScheduleListPanel({ date, onClose, onAddNew }: ScheduleListPanelProps) {
  const utils = trpc.useUtils();
  const { data: scheduleList = [], isLoading } = trpc.schedules.list.useQuery({ date });
  const deleteSchedule = trpc.schedules.delete.useMutation({
    onSuccess: () => utils.schedules.list.invalidate({ date }),
  });

  const displayDate = (() => {
    const d = new Date(date + 'T00:00:00');
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  })();

  return (
    <div className="bg-card border border-violet-800/30 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-violet-300">
          📅 {displayDate} 的日程
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onAddNew}
            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            <Plus className="w-3 h-3" /> 添加
          </button>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            收起
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-2">加载中...</p>
      ) : scheduleList.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-2">这天还没有日程</p>
          <button
            onClick={onAddNew}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            双击日期 或 点击「添加」来创建
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {scheduleList.map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between gap-2 py-2 px-3 bg-[#0f0f23] rounded-lg border border-violet-800/20"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {s.time && (
                    <span className="text-xs text-violet-400 font-mono shrink-0">{s.time}</span>
                  )}
                  <p className="text-sm text-foreground truncate">{s.title}</p>
                  {s.remindEnabled && (
                    <span className="text-xs">🔔</span>
                  )}
                </div>
                {s.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.description}</p>
                )}
              </div>
              <button
                onClick={() => deleteSchedule.mutate({ id: s.id })}
                className="shrink-0 p-1 text-muted-foreground hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CalendarView;
