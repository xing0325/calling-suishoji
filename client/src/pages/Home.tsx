import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import Login from './Login';
import {
  Calendar,
  BookOpen,
  Home as HomeIcon,
  Globe,
  Download,
  Upload,
  Plus,
  History,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import DialPicker from '@/components/DialPicker';
import WorldCalling from '@/components/WorldCalling';
import DiaryEditor, { DiaryEntry } from '@/components/DiaryEditor';
import CalendarView from '@/components/CalendarView';
import InnerCallingDetail from '@/components/InnerCallingDetail';
import { getDatesWithCallings, getStreakDays, initializeStorage } from '@/lib/storage';
import WeeklyInsight from '@/components/WeeklyInsight';
import UrgentTasksView from '@/components/UrgentTasksView';

type TabType = 'calendar' | 'diary' | 'home' | 'world' | 'input' | 'output';

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  isDragging: boolean;
  offset: number; // 实时偏移量（像素）
}

/**
 * CALLING 主页面
 * 六栏目：日历 / 日记 / 主页 / 责任 / 输入 / 输出
 */
export default function Home() {
  let { user, loading, error, isAuthenticated, isGuest, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [calendarViewMode, setCalendarViewMode] = useState<'completed' | 'login' | 'diary' | 'overview'>('completed');
  const [callingInput, setCallingInput] = useState('');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
  const [daysWithCallings] = useState<Date[]>([]);

  // 从数据库读取连胜数据
  const { data: streakData } = trpc.notes.getStreak.useQuery(undefined, {
    enabled: isAuthenticated && !isGuest,
  });
  const streak = streakData?.currentStreak ?? 0;
  const [swipeState, setSwipeState] = useState<SwipeState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    isDragging: false,
    offset: 0,
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedInnerCategory, setSelectedInnerCategory] = useState<string | null>(null);
  const [selectedInnerTitle, setSelectedInnerTitle] = useState('');
  const [selectedInnerIcon, setSelectedInnerIcon] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);

  const tabs: TabType[] = ['calendar', 'diary', 'home', 'world', 'input', 'output'];
  const currentTabIndex = tabs.indexOf(activeTab);

  // 跟手滑动处理
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnimating) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    // 如果触摸目标在可拖拽元素内，不启动页面滑动（避免与四象限拖拽冲突）
    if (target.closest('[data-draggable="true"]')) return;

    const startX = e.targetTouches[0].clientX;
    const startY = e.targetTouches[0].clientY;
    setSwipeState({ startX, startY, currentX: startX, isDragging: true, offset: 0 });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeState.isDragging || isAnimating) return;

    const currentX = e.targetTouches[0].clientX;
    const currentY = e.targetTouches[0].clientY;
    const verticalDistance = Math.abs(currentY - swipeState.startY);
    const horizontalDistance = Math.abs(currentX - swipeState.startX);

    if (verticalDistance > horizontalDistance && verticalDistance > 10) {
      setSwipeState((prev) => ({ ...prev, isDragging: false }));
      return;
    }

    const pixelOffset = currentX - swipeState.startX;
    setSwipeState((prev) => ({ ...prev, currentX, offset: pixelOffset }));
  };

  const handleTouchEnd = () => {
    if (!swipeState.isDragging) return;

    const pixelDistance = swipeState.currentX - swipeState.startX;
    const viewportWidth = window.innerWidth;
    const THRESHOLD = viewportWidth * 0.2;
    let nextTabIndex = currentTabIndex;

    if (pixelDistance > THRESHOLD && currentTabIndex > 0) {
      nextTabIndex = currentTabIndex - 1;
    } else if (pixelDistance < -THRESHOLD && currentTabIndex < tabs.length - 1) {
      nextTabIndex = currentTabIndex + 1;
    } else if (pixelDistance > THRESHOLD && currentTabIndex === 0) {
      nextTabIndex = tabs.length - 1;
    } else if (pixelDistance < -THRESHOLD && currentTabIndex === tabs.length - 1) {
      nextTabIndex = 0;
    }

    setIsAnimating(true);
    const startOffset = pixelDistance;
    const targetOffset = -(nextTabIndex - currentTabIndex) * viewportWidth;
    const startTime = Date.now();
    const duration = 200;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentOffset = startOffset + (targetOffset - startOffset) * easeOut;
      setSwipeState((prev) => ({ ...prev, offset: currentOffset }));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setActiveTab(tabs[nextTabIndex]);
        setSwipeState({ startX: 0, startY: 0, currentX: 0, isDragging: false, offset: 0 });
        setIsAnimating(false);
      }
    };
    requestAnimationFrame(animate);
  };

  const handleTabChange = (tab: TabType) => {
    if (isAnimating) return;
    const newIndex = tabs.indexOf(tab);
    const viewportWidth = window.innerWidth;
    const distance = (newIndex - currentTabIndex) * viewportWidth;

    setIsAnimating(true);
    const startTime = Date.now();
    const duration = 200;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentOffset = distance * easeOut;
      setSwipeState((prev) => ({ ...prev, offset: currentOffset }));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setActiveTab(tab);
        setSwipeState({ startX: 0, startY: 0, currentX: 0, isDragging: false, offset: 0 });
        setIsAnimating(false);
      }
    };
    requestAnimationFrame(animate);
  };

  const utils = trpc.useUtils();

  const createNote = trpc.notes.create.useMutation({
    onSuccess: (_data, variables) => {
      setCallingInput('');
      toast.success(
        <span className="flex items-center gap-2">
          <span>已记录</span>
          <button
            onClick={() => {
              setHistoryOpen(true);
            }}
            className="text-violet-400 text-xs underline underline-offset-2 hover:text-violet-300"
          >
            查看历史
          </button>
        </span>,
        {
          duration: 3000,
          position: 'top-center',
          style: { maxWidth: '220px' },
        }
      );
      // AI 分类完成后刷新所有相关页面数据
      setTimeout(() => {
        utils.notes.list.invalidate();
        const now = new Date();
        utils.notes.calendarActivity.invalidate({ year: now.getFullYear(), month: now.getMonth() + 1 });
        utils.schedules.list.invalidate();
        utils.schedules.listByMonth.invalidate();
        checkDraftStatus(variables.rawText);
      }, 6000);
    },
    onError: (err) => {
      toast.error('记录失败', { description: err.message });
    },
  });

  const checkDraftStatus = async (rawText: string) => {
    try {
      const drafts = await utils.notes.listDrafts.fetch();
      const isDraft = drafts.some(d => d.rawText === rawText && d.category === 'draft');
      if (isDraft) {
        toast.info('未识别有效内容', {
          description: '已存入草稿箱，可稍后在草稿箱中查看',
          duration: 4000,
          icon: '📂',
        });
      }
    } catch {
      // 轮询失败静默处理
    }
  };

  const handleSubmitCalling = () => {
    if (callingInput.trim()) {
      if (!isAuthenticated) {
        toast.error('请先登录', { description: '登录后即可使用AI智能分类功能' });
        return;
      }
      if (isGuest) {
        toast.info('游客模式', { description: '注册账号后即可保存记录并使用AI分类' });
        return;
      }
      createNote.mutate({ rawText: callingInput.trim() });
    }
  };

  const displayOffset = -currentTabIndex * window.innerWidth + swipeState.offset;

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0F1419' }}>
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>CALLING</div>
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mt-4" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => window.location.reload()} />;
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 bg-background text-foreground overflow-hidden"
      style={{ width: '100vw', height: '100vh' }}
    >
      {/* 页面容器 */}
      <div
        ref={pagesRef}
        className={swipeState.isDragging ? '' : 'transition-transform duration-300 ease-out'}
        style={{
          transform: `translateX(${displayOffset}px)`,
          display: 'flex',
          width: `${tabs.length * 100}vw`,
          height: '100vh',
        }}
      >
        {/* 日历页面 */}
        <div className="w-screen flex-shrink-0 pt-6 px-4 overflow-y-auto pb-24 space-y-4">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>
            日历视图
          </h2>
          <CalendarView
            selectedDate={selectedCalendarDate}
            onDateSelect={setSelectedCalendarDate}
            streakDays={streak}
            initialViewMode={calendarViewMode}
          />
          <WeeklyInsight />
        </div>

        {/* 日记页面 */}
        <div className="w-screen flex-shrink-0 pt-6 px-4 overflow-y-auto pb-24">
          <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
            今日日记
          </h2>
          <DiaryEditor />
        </div>

        {/* 主页面 */}
        <div className="w-screen flex-shrink-0 space-y-4 pt-6 px-4 overflow-y-auto pb-24">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>
                CALLING
              </h1>
              <p className="text-sm text-muted-foreground mt-1">用爱呼唤你自己</p>
            </div>
            {/* 历史按鈕 */}
            <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
              <SheetTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-900/30 border border-violet-700/40 text-violet-300 text-xs hover:bg-violet-800/40 transition-all active:scale-95 mt-1">
                  <History className="w-3.5 h-3.5" />
                  历史
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[90vw] sm:w-[420px] overflow-y-auto bg-[#0F1419] border-violet-900/30">
                <SheetHeader className="mb-4">
                  <SheetTitle className="text-violet-300 text-base">AI 分类历史</SheetTitle>
                </SheetHeader>
                <ClassificationHistoryInline />
              </SheetContent>
            </Sheet>
          </div>

          {/* 无感输入纸片 */}
          <div className="bg-card border border-border rounded-lg p-3 min-h-28 flex flex-col hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md">
            <textarea
              value={callingInput}
              onChange={(e) => setCallingInput(e.target.value)}
              placeholder="随手记下你的想法、任务、灵感..."
              className="flex-1 bg-transparent text-foreground placeholder-muted-foreground resize-none focus:outline-none text-sm"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSubmitCalling}
                disabled={!callingInput.trim() || createNote.isPending}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 active:scale-95 flex items-center gap-1"
              >
                {createNote.isPending ? (
                  <>
                    <span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin inline-block" />
                    AI处理中...
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    记录
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 连胜显示 */}
          <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">连胜记录</p>
                <p className="text-2xl font-bold mt-1">{streak} 天</p>
              </div>
              <div className="text-3xl animate-bounce">🔥</div>
            </div>
          </div>

          {/* 紧急任务视图 */}
          <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
            <UrgentTasksView />
          </div>
        </div>

        {/* 责任的Calling页面（原世界） */}
        <div className="w-screen flex-shrink-0 pt-6 px-4 space-y-3 overflow-y-auto pb-24">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>
            责任的Calling
          </h2>
          <p className="text-xs text-muted-foreground">那些你需要对外界负责的东西</p>
          <WorldCalling />
        </div>

        {/* 输入的Calling页面 */}
        <div className="w-screen flex-shrink-0" style={{ height: 'calc(100vh - 56px)' }}>
          <DialPicker
            mainCategory="input"
            onEnter={(key, title, icon) => { setSelectedInnerCategory(key); setSelectedInnerTitle(title); setSelectedInnerIcon(icon); }}
          />
        </div>

        {/* 输出的Calling页面 */}
        <div className="w-screen flex-shrink-0" style={{ height: 'calc(100vh - 56px)' }}>
          <DialPicker
            mainCategory="output"
            onEnter={(key, title, icon) => { setSelectedInnerCategory(key); setSelectedInnerTitle(title); setSelectedInnerIcon(icon); }}
          />
        </div>
      </div>

      {/* 内心Calling详情页面（覆盖层） */}
      {selectedInnerCategory && (
        <div className="fixed inset-0 z-50 bg-background">
          <InnerCallingDetail
            category={selectedInnerCategory}
            categoryTitle={selectedInnerTitle}
            icon={selectedInnerIcon}
            onBack={() => setSelectedInnerCategory(null)}
          />
        </div>
      )}

      {/* 页面指示器 - Dots */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-40">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`transition-all duration-300 rounded-full ${
              index === currentTabIndex
                ? 'bg-primary w-6 h-2'
                : 'bg-muted-foreground/40 w-2 h-2 hover:bg-muted-foreground/60'
            }`}
            aria-label={`Go to ${tab}`}
          />
        ))}
      </div>

      {/* 底部导航栏 - 6个栏目 */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around items-center h-16 backdrop-blur-sm bg-opacity-95 z-50 pointer-events-auto">
        {[
          { tab: 'calendar', icon: Calendar, label: '日历' },
          { tab: 'diary', icon: BookOpen, label: '日记' },
          { tab: 'home', icon: HomeIcon, label: '主页' },
          { tab: 'world', icon: Globe, label: '责任' },
          { tab: 'input', icon: Download, label: '输入' },
          { tab: 'output', icon: Upload, label: '输出' },
        ].map(({ tab, icon: Icon, label }) => (
          <button
            key={tab}
            onClick={(e) => {
              e.stopPropagation();
              handleTabChange(tab as TabType);
            }}
            className={`flex flex-col items-center justify-center w-full h-full gap-0.5 transition-all duration-300 active:scale-95 cursor-pointer ${
              activeTab === tab
                ? 'text-primary scale-110'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- AI 分类历史面板（主页内联版）----
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

function ClassificationHistoryInline() {
  const { isAuthenticated } = useAuth();
  const { data: logs = [], isLoading } = trpc.notes.listClassificationLogs.useQuery(
    { limit: 50, offset: 0 },
    { enabled: isAuthenticated }
  );

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) return <p className="text-xs text-muted-foreground py-8 text-center">加载中...</p>;

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-3xl mb-3">🤖</p>
        <p className="text-sm text-muted-foreground">还没有历史记录</p>
        <p className="text-xs text-muted-foreground mt-1">在主页输入内容后，AI 分类历史会在这里显示</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground mb-2">共 {logs.length} 条记录</p>
      {logs.map((log) => (
        <div
          key={log.id}
          className="py-3 px-3 bg-[#0f0f23] rounded-lg border border-violet-800/20"
        >
          <p className="text-sm text-foreground mb-1.5 line-clamp-2">{log.rawText}</p>
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
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-muted-foreground">{formatTime(log.createdAt)}</span>
            {log.confidence && (
              <span className="text-xs text-muted-foreground">置信度 {(parseFloat(log.confidence) * 100).toFixed(0)}%</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
