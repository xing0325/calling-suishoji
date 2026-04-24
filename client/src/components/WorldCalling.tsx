import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';

interface TaskGroup {
  title: string;
  subCategory: string;
  icon: string;
}

const TASK_GROUPS: TaskGroup[] = [
  { title: '必修课作业', subCategory: 'homework', icon: '📚' },
  { title: '做事课任务', subCategory: 'course_task', icon: '⚡' },
  { title: '必读书进度', subCategory: 'reading_progress', icon: '📖' },
  { title: '其他外部任务', subCategory: 'external_task', icon: '🌐' },
];

interface TaskGroupCardProps {
  group: TaskGroup;
}

const TaskGroupCard: React.FC<TaskGroupCardProps> = ({ group }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [importanceScore, setImportanceScore] = useState<number | null>(null);
  const { isAuthenticated } = useAuth();

  const { data: items = [], refetch } = trpc.notes.list.useQuery(
    { category: 'task', subCategory: group.subCategory },
    { enabled: isAuthenticated }
  );

  const toggleComplete = trpc.notes.toggleComplete.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('已删除');
    },
  });

  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      refetch();
      setNewTaskText('');
      setImportanceScore(null);
      setShowAddModal(false);
      toast.success('已添加，AI正在分类...');
    },
  });

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;

  const getPriorityColor = (deadline: Date | null) => {
    if (!deadline) return 'border-border';
    const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 1) return 'border-red-500/50';
    if (daysLeft <= 3) return 'border-orange-500/50';
    return 'border-border';
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
      {/* 卡片头部 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-secondary/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-2 flex-1 text-left min-w-0">
          <span className="text-base">{group.icon}</span>
          <h3 className="font-semibold text-foreground text-sm">{group.title}</h3>
          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full flex-shrink-0">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAddModal(true);
            }}
            className="p-1.5 hover:bg-primary/20 rounded-md transition-colors duration-200"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
          </button>
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-300 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* 进度条 */}
      {totalCount > 0 && (
        <div className="h-0.5 bg-secondary/30">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* 展开的内容 */}
      {isExpanded && (
        <div className="px-3 py-2 space-y-1.5">
          {items.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-muted-foreground">暂无任务</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-2 text-xs text-primary hover:underline"
              >
                + 添加任务
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-2 p-2 rounded-md border ${getPriorityColor(item.deadline)} hover:bg-secondary/30 transition-colors duration-200 group`}
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => toggleComplete.mutate({ id: item.id, completed: !item.completed })}
                  className="mt-0.5 w-3.5 h-3.5 rounded border-border cursor-pointer accent-primary flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs transition-all duration-200 ${
                      item.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    {item.title || item.rawText.slice(0, 40)}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  {item.deadline && (
                    <p className="text-xs text-orange-400 mt-0.5">
                      DDL: {new Date(item.deadline).toLocaleDateString('zh-CN')}
                    </p>
                  )}
                  {!item.aiProcessed && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Loader2 className="w-2.5 h-2.5 text-muted-foreground animate-spin" />
                      <span className="text-xs text-muted-foreground">AI分类中...</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteNote.mutate({ id: item.id })}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 rounded transition-all duration-200 flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* 添加任务弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-t-2xl w-full max-w-lg p-4 pb-8 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">添加到 {group.title}</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground text-lg leading-none"
              >
                ×
              </button>
            </div>
            <textarea
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder={`描述你的任务，AI会自动整理...\n例如：明天要交数据结构作业，DDL是4月25日`}
              className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:border-primary/50 min-h-24"
              autoFocus
            />

            {/* 重要程度热力图 */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">重要程度</span>
                <span className="text-xs" style={{ color: importanceScore && importanceScore >= 3.5 ? '#f97316' : '#6b7280' }}>
                  {importanceScore ? `${importanceScore.toFixed(1)} 级${importanceScore >= 3.5 ? ' · 将显示在首页' : ''}` : '不设置（AI 自动判断）'}
                </span>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((level) => {
                  const colors = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'];
                  const labels = ['低', '一般', '中', '高', '极高'];
                  const isSelected = importanceScore === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setImportanceScore(isSelected ? null : level)}
                      className="flex-1 rounded-md py-2 flex flex-col items-center gap-0.5 transition-all"
                      style={{
                        background: isSelected ? colors[level - 1] : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isSelected ? colors[level - 1] : 'rgba(255,255,255,0.1)'}`,
                        opacity: importanceScore && !isSelected ? 0.45 : 1,
                      }}
                    >
                      <div className="w-full h-1.5 rounded-full" style={{ background: colors[level - 1], opacity: isSelected ? 1 : 0.5 }} />
                      <span className="text-xs" style={{ color: isSelected ? 'white' : '#9ca3af' }}>{labels[level - 1]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setShowAddModal(false); setImportanceScore(null); }}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (newTaskText.trim()) {
                    createNote.mutate({
                      rawText: newTaskText.trim(),
                      ...(importanceScore !== null ? { importanceScore } : {}),
                    });
                  }
                }}
                disabled={!newTaskText.trim() || createNote.isPending}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {createNote.isPending ? '提交中...' : '记录'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 世界的Calling页面 - 从数据库读取AI分类的task类笔记
 */
const WorldCalling: React.FC = () => {
  return (
    <div className="space-y-2">
      {TASK_GROUPS.map((group) => (
        <TaskGroupCard key={group.subCategory} group={group} />
      ))}
    </div>
  );
};

export default WorldCalling;
