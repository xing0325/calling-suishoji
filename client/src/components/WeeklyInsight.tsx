import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Sparkles, ChevronLeft, ChevronRight, RefreshCw, TrendingUp, Calendar } from 'lucide-react';

/**
 * 周总结/月洞察组件
 * 在日历页面底部展示 AI 生成的周总结和月洞察
 */
export const WeeklyInsight: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'week' | 'month'>('week');
  const [weekOffset, setWeekOffset] = useState(0); // 0 = 本周, -1 = 上周, etc.
  const [monthOffset, setMonthOffset] = useState(0); // 0 = 本月

  // 计算当前周的开始日期（周一）
  const weekStart = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=周日, 1=周一...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  }, [weekOffset]);

  // 计算当前月份
  const month = useMemo(() => {
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
  }, [monthOffset]);

  const weekSummaryQuery = trpc.insight.weekSummary.useQuery(
    { weekStart },
    { enabled: activeTab === 'week', staleTime: 5 * 60 * 1000 }
  );

  const monthInsightQuery = trpc.insight.monthInsight.useQuery(
    { month },
    { enabled: activeTab === 'month', staleTime: 5 * 60 * 1000 }
  );

  const isLoading = activeTab === 'week' ? weekSummaryQuery.isLoading : monthInsightQuery.isLoading;
  const isRefetching = activeTab === 'week' ? weekSummaryQuery.isFetching : monthInsightQuery.isFetching;

  const handleRefresh = () => {
    if (activeTab === 'week') {
      weekSummaryQuery.refetch();
    } else {
      monthInsightQuery.refetch();
    }
  };

  // 格式化周标题
  const weekTitle = useMemo(() => {
    if (weekOffset === 0) return '本周总结';
    if (weekOffset === -1) return '上周总结';
    const start = new Date(weekStart);
    return `${start.getMonth() + 1}月${start.getDate()}日那周`;
  }, [weekOffset, weekStart]);

  // 格式化月标题
  const monthTitle = useMemo(() => {
    const [year, monthNum] = month.split('-');
    const now = new Date();
    if (parseInt(year) === now.getFullYear() && parseInt(monthNum) === now.getMonth() + 1) {
      return '本月洞察';
    }
    return `${year}年${monthNum}月洞察`;
  }, [month]);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md">
      {/* 标签切换 */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('week')}
          className={`flex-1 py-3 text-xs font-medium transition-colors duration-200 flex items-center justify-center gap-1.5 ${
            activeTab === 'week'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          周总结
        </button>
        <button
          onClick={() => setActiveTab('month')}
          className={`flex-1 py-3 text-xs font-medium transition-colors duration-200 flex items-center justify-center gap-1.5 ${
            activeTab === 'month'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          月洞察
        </button>
      </div>

      <div className="p-4">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => activeTab === 'week' ? setWeekOffset(w => w - 1) : setMonthOffset(m => m - 1)}
              className="p-1 hover:bg-secondary rounded transition-colors duration-200"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-semibold">
              {activeTab === 'week' ? weekTitle : monthTitle}
            </span>
            <button
              onClick={() => activeTab === 'week' ? setWeekOffset(w => Math.min(w + 1, 0)) : setMonthOffset(m => Math.min(m + 1, 0))}
              disabled={(activeTab === 'week' && weekOffset >= 0) || (activeTab === 'month' && monthOffset >= 0)}
              className="p-1 hover:bg-secondary rounded transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefetching}
            className="p-1.5 hover:bg-secondary rounded-lg transition-colors duration-200 disabled:opacity-50"
            title="重新生成"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 内容区域 */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">AI 正在生成洞察...</p>
          </div>
        ) : activeTab === 'week' && weekSummaryQuery.data ? (
          <WeekSummaryContent data={weekSummaryQuery.data} />
        ) : activeTab === 'month' && monthInsightQuery.data ? (
          <MonthInsightContent data={monthInsightQuery.data} />
        ) : (
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground">暂无数据</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 周总结内容
function WeekSummaryContent({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      {/* AI总结文字 */}
      <div className="flex gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-primary" />
        </div>
        <p className="text-xs leading-relaxed text-foreground/90">{data.summary}</p>
      </div>

      {/* 亮点列表 */}
      {data.highlights && data.highlights.length > 0 && (
        <div className="space-y-1.5 mt-2">
          <p className="text-xs font-medium text-muted-foreground">本周亮点</p>
          {data.highlights.map((highlight: string, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-primary text-xs mt-0.5">✦</span>
              <p className="text-xs text-foreground/80">{highlight}</p>
            </div>
          ))}
        </div>
      )}

      {/* 统计数字 */}
      {(data.noteCount !== undefined || data.diaryCount !== undefined) && (
        <div className="flex gap-3 pt-2 border-t border-border">
          <div className="text-center">
            <p className="text-lg font-bold text-primary">{data.noteCount || 0}</p>
            <p className="text-xs text-muted-foreground">条笔记</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-primary">{data.diaryCount || 0}</p>
            <p className="text-xs text-muted-foreground">篇日记</p>
          </div>
        </div>
      )}
    </div>
  );
}

// 月洞察内容
function MonthInsightContent({ data }: { data: any }) {
  const categoryLabels: Record<string, string> = {
    task: '任务',
    wish: '愿望',
    input: '输入',
    output: '输出',
    diary: '日记',
    other: '其他',
  };

  return (
    <div className="space-y-3">
      {/* AI洞察文字 */}
      <div className="flex gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-primary" />
        </div>
        <p className="text-xs leading-relaxed text-foreground/90">{data.insight}</p>
      </div>

      {/* 行为模式 */}
      {data.pattern && (
        <div className="bg-primary/10 rounded-lg p-3">
          <p className="text-xs font-medium text-primary mb-1">发现的模式</p>
          <p className="text-xs text-foreground/80">{data.pattern}</p>
        </div>
      )}

      {/* 建议 */}
      {data.suggestion && (
        <div className="bg-secondary/50 rounded-lg p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">AI建议</p>
          <p className="text-xs text-foreground/80">{data.suggestion}</p>
        </div>
      )}

      {/* 统计数字 */}
      {data.stats && (
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border">
          <div className="text-center">
            <p className="text-base font-bold text-primary">{data.stats.noteCount}</p>
            <p className="text-xs text-muted-foreground">笔记</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-primary">{data.stats.diaryCount}</p>
            <p className="text-xs text-muted-foreground">日记</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-primary">{data.stats.completedTasks}</p>
            <p className="text-xs text-muted-foreground">完成</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-primary">{data.stats.totalTasks}</p>
            <p className="text-xs text-muted-foreground">总任务</p>
          </div>
        </div>
      )}

      {/* 分类分布 */}
      {data.categoryStats && Object.keys(data.categoryStats).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">分类分布</p>
          {Object.entries(data.categoryStats as Record<string, number>)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 4)
            .map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-10">
                  {categoryLabels[cat] || cat}
                </span>
                <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (count / (data.stats?.noteCount || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default WeeklyInsight;
