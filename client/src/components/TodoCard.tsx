import React, { useState } from 'react';
import { Trash2, Plus, ChevronDown } from 'lucide-react';

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

interface TodoCardProps {
  title: string;
  count: number;
  items: TodoItem[];
  onAddItem?: () => void;
  onToggleItem?: (id: string) => void;
  onDeleteItem?: (id: string) => void;
}

/**
 * TodoList卡片组件 - 手机端优化版
 * 紧凑设计，减少高度占用
 */
export const TodoCard: React.FC<TodoCardProps> = ({
  title,
  count,
  items,
  onAddItem,
  onToggleItem,
  onDeleteItem,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const completedCount = items.filter((item) => item.completed).length;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md text-sm">
      {/* 卡片头部 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-secondary/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-2 flex-1 text-left min-w-0">
          <h3 className="font-semibold text-foreground text-xs">{title}</h3>
          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full flex-shrink-0">
            {completedCount}/{count}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddItem?.();
            }}
            className="p-1 hover:bg-primary/20 rounded transition-colors duration-200"
            title="添加"
          >
            <Plus className="w-3 h-3 text-foreground" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="p-1 hover:bg-secondary rounded transition-colors duration-200"
            title="更多"
          >
            <span className="text-foreground text-sm">⋯</span>
          </button>
          <ChevronDown
            className={`w-3 h-3 text-muted-foreground transition-transform duration-300 flex-shrink-0 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* 进度条 */}
      <div className="h-0.5 bg-secondary/30">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(completedCount / count) * 100}%` }}
        />
      </div>

      {/* 展开的内容 */}
      {isExpanded && (
        <div className="px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">暂无项目</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 p-1.5 rounded hover:bg-secondary/50 transition-colors duration-200 group"
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => onToggleItem?.(item.id)}
                  className="mt-0.5 w-3 h-3 rounded border-border cursor-pointer accent-primary flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs transition-all duration-200 line-clamp-1 ${
                      item.completed
                        ? 'line-through text-muted-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {item.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onDeleteItem?.(item.id)}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 rounded transition-all duration-200 flex-shrink-0"
                  title="删除"
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TodoCard;
