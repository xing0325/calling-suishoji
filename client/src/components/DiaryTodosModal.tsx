import React, { useState } from 'react';
import { X, Check, Loader2, ChevronDown } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// 分类配置
const CATEGORY_OPTIONS = [
  { value: 'task', label: '对外负责', emoji: '📋', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  { value: 'wish', label: '愿望清单', emoji: '✨', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  { value: 'input', label: '输入收藏', emoji: '📥', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  { value: 'output', label: '输出创作', emoji: '📤', color: 'bg-green-500/20 text-green-400 border-green-500/40' },
];

// 子分类配置
const SUB_CATEGORY_OPTIONS: Record<string, { value: string; label: string }[]> = {
  task: [
    { value: 'homework', label: '作业' },
    { value: 'course_task', label: '课程任务' },
    { value: 'reading_progress', label: '阅读进度' },
    { value: 'external_task', label: '其他任务' },
  ],
  wish: [
    { value: 'todo_wish', label: '想做的事' },
    { value: 'place', label: '想去的地方' },
    { value: 'person_wish', label: '想见的人' },
    { value: 'shopping', label: '想买的东西' },
  ],
  input: [
    { value: 'movie', label: '电影' },
    { value: 'book', label: '书籍' },
    { value: 'article', label: '文章' },
    { value: 'game', label: '游戏' },
    { value: 'podcast', label: '播客' },
    { value: 'concept', label: '概念' },
    { value: 'person', label: '人物' },
    { value: 'course', label: '课程' },
    { value: 'tool', label: '工具' },
  ],
  output: [
    { value: 'topic', label: '选题' },
    { value: 'inspiration', label: '灵感' },
    { value: 'edit_idea', label: '剪辑灵感' },
    { value: 'drama_idea', label: '戏剧灵感' },
    { value: 'writing_topic', label: '写作选题' },
    { value: 'design_idea', label: '设计灵感' },
    { value: 'game_design', label: '游戏设计' },
  ],
};

export interface ExtractedTodo {
  title: string;
  category: string;
  subCategory: string;
  description: string;
}

interface TodoCardProps {
  todo: ExtractedTodo;
  index: number;
  onChange: (index: number, updated: ExtractedTodo) => void;
  onRemove: (index: number) => void;
}

function TodoCard({ todo, index, onChange, onRemove }: TodoCardProps) {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);

  const currentCategory = CATEGORY_OPTIONS.find(c => c.value === todo.category) ?? CATEGORY_OPTIONS[0];
  const subOptions = SUB_CATEGORY_OPTIONS[todo.category] ?? [];
  const currentSub = subOptions.find(s => s.value === todo.subCategory) ?? subOptions[0];

  const handleCategoryChange = (cat: string) => {
    const firstSub = SUB_CATEGORY_OPTIONS[cat]?.[0]?.value ?? '';
    onChange(index, { ...todo, category: cat, subCategory: firstSub });
    setShowCategoryMenu(false);
  };

  const handleSubChange = (sub: string) => {
    onChange(index, { ...todo, subCategory: sub });
    setShowSubMenu(false);
  };

  return (
    <div className="bg-secondary/50 border border-border rounded-xl p-3 space-y-2 relative">
      {/* 删除按钮 */}
      <button
        onClick={() => onRemove(index)}
        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
      >
        <X className="w-3 h-3" />
      </button>

      {/* 标题 */}
      <p className="text-sm font-medium pr-6 leading-snug">{todo.title}</p>

      {/* 描述（如有） */}
      {todo.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{todo.description}</p>
      )}

      {/* 分类标签行 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 主分类 */}
        <div className="relative">
          <button
            onClick={() => { setShowCategoryMenu(!showCategoryMenu); setShowSubMenu(false); }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium transition-all ${currentCategory.color}`}
          >
            <span>{currentCategory.emoji}</span>
            <span>{currentCategory.label}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {showCategoryMenu && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[120px]">
              {CATEGORY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleCategoryChange(opt.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary transition-colors ${
                    opt.value === todo.category ? 'bg-secondary font-medium' : ''
                  }`}
                >
                  <span>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 子分类 */}
        {subOptions.length > 0 && (
          <div className="relative">
            <button
              onClick={() => { setShowSubMenu(!showSubMenu); setShowCategoryMenu(false); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
            >
              <span>{currentSub?.label ?? '选择子类'}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
            {showSubMenu && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[120px] max-h-48 overflow-y-auto">
                {subOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleSubChange(opt.value)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors ${
                      opt.value === todo.subCategory ? 'bg-secondary font-medium' : ''
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface DiaryTodosModalProps {
  todos: ExtractedTodo[];
  onClose: () => void;
  onConfirm: (todos: ExtractedTodo[]) => void;
  isConfirming: boolean;
}

export function DiaryTodosModal({ todos: initialTodos, onClose, onConfirm, isConfirming }: DiaryTodosModalProps) {
  const [items, setItems] = useState<ExtractedTodo[]>(initialTodos);

  const handleChange = (index: number, updated: ExtractedTodo) => {
    setItems(prev => prev.map((item, i) => i === index ? updated : item));
  };

  const handleRemove = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 弹窗 */}
      <div className="fixed inset-x-4 bottom-4 z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-start justify-between p-4 pb-3 border-b border-border flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h3 className="font-semibold text-sm">检测到日记中的待办</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              AI 从日记中提取了 {items.length} 个待办事项，可修改分类后一键加入
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-secondary rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 卡片列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              已移除所有待办
            </div>
          ) : (
            items.map((todo, index) => (
              <TodoCard
                key={index}
                todo={todo}
                index={index}
                onChange={handleChange}
                onRemove={handleRemove}
              />
            ))
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 p-4 pt-3 border-t border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            跳过
          </button>
          <button
            onClick={() => items.length > 0 && onConfirm(items)}
            disabled={items.length === 0 || isConfirming}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                加入中...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                全部加入（{items.length}）
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

export default DiaryTodosModal;
