import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Save, Plus, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { DiaryTodosModal, ExtractedTodo } from './DiaryTodosModal';

export interface DiaryEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  mood?: string;
  weather?: string;
}

/**
 * 日记编辑和查看组件（接入数据库版本）
 * - 保存日记后，AI 自动扫描全文提取待办事项
 * - 若有待办，弹窗展示卡片列表，用户可修改分类后一键入库
 * - 「今天可能发生的事」默认隐藏，点击展开后 AI 扫描历史记录
 */
export const DiaryEditor: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editMood, setEditMood] = useState('😊');
  const [editWeather, setEditWeather] = useState('☀️');

  // 日记待办弹窗状态
  const [extractedTodos, setExtractedTodos] = useState<ExtractedTodo[]>([]);
  const [showTodosModal, setShowTodosModal] = useState(false);

  // 今日提示折叠状态（默认隐藏，点击才触发 AI 查询）
  const [showTodayHints, setShowTodayHints] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const utils = trpc.useUtils();

  // 从数据库加载日记
  const { data: diaries, isLoading, refetch } = trpc.notes.listDiaries.useQuery();

  // 今日提示（只有 showTodayHints 为 true 时才请求）
  const { data: todayHintsData, isLoading: hintsLoading } = trpc.notes.todayHints.useQuery(
    { targetDate: today },
    { enabled: showTodayHints }
  );
  const todayHints = todayHintsData?.hints ?? [];

  // AI 提取日记中的待办
  const extractTodos = trpc.notes.extractTodosFromDiary.useMutation({
    onSuccess: (data) => {
      if (data.todos.length > 0) {
        setExtractedTodos(data.todos);
        setShowTodosModal(true);
      }
    },
    onError: () => {
      // 提取失败静默处理，不影响日记保存
    },
  });

  // 批量创建待办
  const batchCreate = trpc.notes.batchCreate.useMutation({
    onSuccess: (data) => {
      toast.success(`已加入 ${data.count} 个待办`, {
        description: '可在"世界的Calling"或"内心的Calling"中查看',
        duration: 3000,
      });
      setShowTodosModal(false);
      setExtractedTodos([]);
      utils.notes.list.invalidate();
    },
    onError: (err) => {
      toast.error('加入失败', { description: err.message });
    },
  });

  const saveDiary = trpc.notes.saveDiary.useMutation({
    onSuccess: (result, variables) => {
      toast.success(result.action === 'created' ? '日记已保存' : '日记已更新');
      setIsEditing(false);
      refetch();
      // 保存成功后，异步提取待办（不阻塞UI）
      if (variables.content.trim().length > 20) {
        extractTodos.mutate({ content: variables.content, date: variables.date });
      }
    },
    onError: (err) => toast.error('保存失败', { description: err.message }),
  });

  const sortedDiaries = diaries
    ? [...diaries].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const currentDiary = sortedDiaries[currentIndex];

  const handleNewDiary = () => {
    setEditDate(today);
    setEditTitle('');
    setEditContent('');
    setEditMood('😊');
    setEditWeather('☀️');
    setIsEditing(true);
  };

  const handleEditCurrent = () => {
    if (currentDiary) {
      setEditDate(currentDiary.date);
      setEditTitle(currentDiary.title || '');
      setEditContent(currentDiary.content);
      setEditMood(currentDiary.mood || '😊');
      setEditWeather(currentDiary.weather || '☀️');
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (!editContent.trim()) {
      toast.error('内容不能为空');
      return;
    }
    saveDiary.mutate({
      date: editDate,
      title: editTitle || undefined,
      content: editContent,
      mood: editMood,
      weather: editWeather,
    });
  };

  const handleConfirmTodos = (todos: ExtractedTodo[]) => {
    const VALID_CATS = ['task', 'wish', 'input', 'output'] as const;
    type ValidCat = typeof VALID_CATS[number];
    batchCreate.mutate({
      items: todos
        .filter(t => VALID_CATS.includes(t.category as ValidCat))
        .map(t => ({
          rawText: t.title,
          title: t.title,
          category: t.category as ValidCat,
          subCategory: t.subCategory,
          description: t.description,
        })),
    });
  };

  const moods = ['😊', '😌', '😔', '😤', '🤔', '😴', '🥰', '😰'];
  const weathers = ['☀️', '⛅', '🌧️', '❄️', '🌈', '🌙'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isEditing) {
    return (
      <>
        <div className="space-y-4">
          {/* 编辑头部 */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsEditing(false)}
              className="p-2 hover:bg-secondary rounded-lg transition-colors duration-200"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-sm text-muted-foreground">{editDate}</div>
            <button
              onClick={handleSave}
              disabled={saveDiary.isPending}
              className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              {saveDiary.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存
            </button>
          </div>

          {/* 心情和天气 */}
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">心情</p>
              <div className="flex flex-wrap gap-1">
                {moods.map((mood) => (
                  <button
                    key={mood}
                    onClick={() => setEditMood(mood)}
                    className={`text-lg p-1 rounded-lg transition-all duration-200 ${
                      editMood === mood ? 'bg-primary/20 scale-110' : 'hover:bg-secondary'
                    }`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">天气</p>
              <div className="flex flex-wrap gap-1">
                {weathers.map((weather) => (
                  <button
                    key={weather}
                    onClick={() => setEditWeather(weather)}
                    className={`text-lg p-1 rounded-lg transition-all duration-200 ${
                      editWeather === weather ? 'bg-primary/20 scale-110' : 'hover:bg-secondary'
                    }`}
                  >
                    {weather}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 标题 */}
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="标题（可选）"
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all duration-200"
          />

          {/* 内容 */}
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="今天发生了什么？有什么感悟？"
            className="w-full bg-card border border-border rounded-lg px-3 py-3 text-sm resize-none focus:outline-none focus:border-primary transition-all duration-200 min-h-48"
            rows={10}
            autoFocus
          />

          {/* AI提取提示 */}
          <p className="text-xs text-muted-foreground text-center">
            💡 保存后 AI 将自动识别日记中的待办事项
          </p>
        </div>

        {/* 日记待办弹窗 */}
        {showTodosModal && (
          <DiaryTodosModal
            todos={extractedTodos}
            onClose={() => { setShowTodosModal(false); setExtractedTodos([]); }}
            onConfirm={handleConfirmTodos}
            isConfirming={batchCreate.isPending}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* 连续记录天数 */}
        <div className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">已连续记录</p>
            <p className="text-xl font-bold mt-0.5">{sortedDiaries.length} 篇日记</p>
          </div>
          <button
            onClick={handleNewDiary}
            className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            写今日日记
          </button>
        </div>

        {/* 今天可能发生的事 - 默认折叠，点击才触发 AI 查询 */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowTodayHints(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-secondary/50 transition-colors duration-200"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary/70" />
              <span>看看今天我都做了些啥</span>
              {showTodayHints && todayHints.length > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                  {todayHints.length}
                </span>
              )}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                showTodayHints ? 'rotate-180' : ''
              }`}
            />
          </button>
          {showTodayHints && (
            <div className="px-4 pb-4 border-t border-border/50">
              {hintsLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI 正在回忆今天的事...
                </div>
              ) : todayHints.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">
                  没有找到关于今天的历史记录，先自己回忆一下吧 ✨
                </p>
              ) : (
                <div className="space-y-2 pt-3">
                  {todayHints.map((hint: { content: string; sourceDate: string; source: string }, i: number) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <span className="text-primary mt-0.5 shrink-0">•</span>
                      <div>
                        <p className="text-foreground/90">{hint.content}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          来自 {hint.sourceDate} 的{hint.source}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {sortedDiaries.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📖</p>
            <p className="text-muted-foreground text-sm mb-2">还没有日记</p>
            <p className="text-xs text-muted-foreground">记录你的每一天</p>
          </div>
        ) : (
          <>
            {/* 当前日记导航 */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentIndex(Math.min(currentIndex + 1, sortedDiaries.length - 1))}
                disabled={currentIndex >= sortedDiaries.length - 1}
                className="p-2 hover:bg-secondary rounded-lg transition-colors duration-200 disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-xs text-muted-foreground">
                {currentIndex + 1} / {sortedDiaries.length}
              </span>
              <button
                onClick={() => setCurrentIndex(Math.max(currentIndex - 1, 0))}
                disabled={currentIndex <= 0}
                className="p-2 hover:bg-secondary rounded-lg transition-colors duration-200 disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* 当前日记卡片 */}
            {currentDiary && (
              <div
                className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-all duration-300 shadow-sm"
                onClick={handleEditCurrent}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{currentDiary.mood || '😊'}</span>
                    <span className="text-xl">{currentDiary.weather || '☀️'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{currentDiary.date}</span>
                </div>
                {currentDiary.title && (
                  <h3 className="font-semibold text-sm mb-2">{currentDiary.title}</h3>
                )}
                <p className="text-sm text-foreground/80 leading-relaxed line-clamp-6 whitespace-pre-wrap">
                  {currentDiary.content}
                </p>
                <p className="text-xs text-primary/60 mt-3">点击编辑</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 日记待办弹窗（在查看模式也可能触发，如编辑后返回） */}
      {showTodosModal && (
        <DiaryTodosModal
          todos={extractedTodos}
          onClose={() => { setShowTodosModal(false); setExtractedTodos([]); }}
          onConfirm={handleConfirmTodos}
          isConfirming={batchCreate.isPending}
        />
      )}
    </>
  );
};

export default DiaryEditor;
