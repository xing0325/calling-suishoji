import React, { useState } from 'react';
import { ChevronLeft, Plus, Trash2, Loader2, Sparkles } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// 分类到subCategory的映射
const CATEGORY_TO_SUBCATEGORY: Record<string, string> = {
  'input-1': 'movie',
  'input-2': 'book',
  'input-3': 'article',
  'input-4': 'game',
  'input-5': 'podcast',
  'input-6': 'concept',
  'input-7': 'person',
  'input-8': 'course',
  'input-9': 'tool',
  'output-1': 'topic',
  'output-2': 'inspiration',
  'output-3': 'edit_idea',
  'output-4': 'drama_idea',
  'output-5': 'writing_topic',
  'output-6': 'design_idea',
  'output-7': 'game_design',
};

const MAIN_CATEGORY: Record<string, string> = {
  'input-1': 'input', 'input-2': 'input', 'input-3': 'input',
  'input-4': 'input', 'input-5': 'input', 'input-6': 'input',
  'input-7': 'input', 'input-8': 'input', 'input-9': 'input',
  'output-1': 'output', 'output-2': 'output', 'output-3': 'output',
  'output-4': 'output', 'output-5': 'output', 'output-6': 'output',
  'output-7': 'output',
};

interface InnerCallingDetailProps {
  category: string;
  categoryTitle: string;
  icon: string;
  onBack: () => void;
}

/**
 * 内心的Calling详情页面
 * 显示AI分类后的项目，从数据库加载
 */
export const InnerCallingDetail: React.FC<InnerCallingDetailProps> = ({
  category,
  categoryTitle,
  icon,
  onBack,
}) => {
  const [newItem, setNewItem] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const subCategory = CATEGORY_TO_SUBCATEGORY[category];
  const mainCategory = MAIN_CATEGORY[category];

  // 从数据库加载该分类的笔记
  const { data: notes, isLoading, refetch } = trpc.notes.list.useQuery(
    { category: mainCategory, subCategory: subCategory, limit: 50 },
    { enabled: !!mainCategory }
  );

  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      setNewItem('');
      setNewDescription('');
      toast.success('已添加！AI正在分类...', { duration: 2000 });
      setTimeout(() => refetch(), 3000); // 3秒后刷新，等待AI处理
    },
    onError: (err) => toast.error('添加失败', { description: err.message }),
  });

  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('已删除');
    },
  });

  const handleAddItem = () => {
    if (!newItem.trim()) return;
    // 构造带分类提示的文本，帮助AI正确分类
    const text = newDescription.trim()
      ? `${newItem}\n${newDescription}`
      : newItem;
    createNote.mutate({ rawText: text });
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-background overflow-hidden">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-10">
        <button
          onClick={onBack}
          className="p-2 hover:bg-secondary rounded-lg transition-colors duration-200"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <h1 className="text-lg font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {categoryTitle}
          </h1>
        </div>
        <div className="w-9" />
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto pb-20 px-4 pt-4">
        {/* 添加新项目 */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6 hover:border-primary/50 transition-all duration-300 shadow-sm">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <Sparkles className="w-4 h-4 text-primary" />
            AI智能记录
          </h2>
          <div className="space-y-3">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="名称（如：《三体》《星际穿越》）"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200"
            />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="描述（推荐人、感兴趣的原因等）"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200"
              rows={2}
            />
            <button
              onClick={handleAddItem}
              disabled={!newItem.trim() || createNote.isPending}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
            >
              {createNote.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />AI处理中...</>
              ) : (
                <><Plus className="w-4 h-4" />添加</>
              )}
            </button>
          </div>
        </div>

        {/* 项目列表 */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !notes || notes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">{icon}</p>
              <p className="text-muted-foreground text-sm mb-2">还没有{categoryTitle}记录</p>
              <p className="text-xs text-muted-foreground">在上方添加，AI会自动整理</p>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all duration-300 shadow-sm group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* AI处理状态 */}
                    {!note.aiProcessed && (
                      <div className="flex items-center gap-1 mb-2">
                        <Loader2 className="w-3 h-3 animate-spin text-primary/60" />
                        <span className="text-xs text-primary/60">AI分类中...</span>
                      </div>
                    )}
                    <h3 className="font-semibold text-sm text-foreground break-words">
                      {note.title || note.rawText.slice(0, 40)}
                    </h3>
                    {note.description && note.description !== note.rawText && (
                      <p className="text-xs text-muted-foreground mt-1 break-words">
                        {note.description}
                      </p>
                    )}
                    {/* 标签 */}
                    {note.tags && (note.tags as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(note.tags as string[]).map((tag, i) => (
                          <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* DDL */}
                    {note.deadline && (
                      <p className="text-xs text-amber-500 mt-2">
                        ⏰ {new Date(note.deadline).toLocaleDateString('zh-CN')}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(note.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteNote.mutate({ id: note.id })}
                    className="p-2 hover:bg-destructive/10 rounded-lg transition-colors duration-200 opacity-0 group-hover:opacity-100 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default InnerCallingDetail;
