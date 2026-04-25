import React, { useState, useCallback, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';

type Note = {
  id: number;
  title: string | null;
  rawText: string;
  deadline: Date | null;
  importanceScore: number | null;
  pinToHome: boolean;
  completed: boolean;
  tags: string[] | null;
};

type Quadrant = 'q1' | 'q2' | 'q3';
type Box = 'b1' | 'b2' | 'b3';

const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;

function classify(task: Note): Quadrant | Box {
  const isImportant = task.importanceScore !== null && task.importanceScore >= 3.5;
  const isUrgent = task.deadline !== null && new Date(task.deadline).getTime() - Date.now() <= FIVE_DAYS;
  const hasDeadline = task.deadline !== null;
  const hasScore = task.importanceScore !== null;

  if (hasScore && hasDeadline) {
    if (isImportant && isUrgent) return 'q1';
    if (isImportant && !isUrgent) return 'q2';
    return 'q3';
  }
  if (hasScore && !hasDeadline) return 'b1';
  if (!hasScore && hasDeadline && isUrgent) return 'b2';
  return 'b3';
}

function daysLeft(deadline: Date | null): string {
  if (!deadline) return '';
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (d <= 0) return '今天到期';
  if (d === 1) return '明天到期';
  return `${d}天后到期`;
}

function ScoreDot({ score }: { score: number | null }) {
  if (!score) return null;
  const color = score >= 4.5 ? '#ef4444' : score >= 3.5 ? '#f97316' : score >= 2.5 ? '#eab308' : '#22c55e';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {score.toFixed(1)}
    </span>
  );
}

interface TaskChipProps {
  task: Note;
  draggable?: boolean;
  onTouchDragStart?: (taskId: number, e: React.TouchEvent) => void;
  onComplete?: (id: number) => void;
  compact?: boolean;
}

function TaskChip({ task, draggable, onTouchDragStart, onComplete, compact }: TaskChipProps) {
  const label = task.title || task.rawText.slice(0, 30);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressing, setPressing] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!draggable || !onTouchDragStart) return;
    // Long-press to start drag (300ms)
    longPressTimer.current = setTimeout(() => {
      setPressing(false);
      onTouchDragStart(task.id, e);
    }, 300);
    setPressing(true);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setPressing(false);
  };

  return (
    <div
      data-draggable={draggable ? 'true' : undefined}
      data-task-id={task.id}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        background: pressing ? '#1e1a3a' : '#13102a',
        border: `0.5px solid ${pressing ? '#534AB7' : '#2a2450'}`,
        borderRadius: compact ? 8 : 10,
        padding: compact ? '5px 8px' : '8px 10px',
        cursor: draggable ? 'grab' : 'default',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        marginBottom: compact ? 4 : 6,
        userSelect: 'none',
        opacity: task.completed ? 0.5 : 1,
        touchAction: draggable ? 'none' : 'auto',
        transition: 'background .15s, border-color .15s',
      }}
    >
      {onComplete && (
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onComplete(task.id)}
          style={{ marginTop: 2, flexShrink: 0, accentColor: '#7C3AED', cursor: 'pointer' }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 11 : 12, color: '#c8c4e8', lineHeight: 1.4, wordBreak: 'break-word' }}>
          {label.length > (compact ? 24 : 40) ? label.slice(0, compact ? 24 : 40) + '…' : label}
        </div>
        {!compact && (
          <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            {task.deadline && (
              <span style={{ fontSize: 10, color: new Date(task.deadline).getTime() - Date.now() < 86400000 ? '#ef4444' : '#f97316' }}>
                {daysLeft(task.deadline)}
              </span>
            )}
            <ScoreDot score={task.importanceScore} />
          </div>
        )}
      </div>
      {draggable && (
        <span style={{ fontSize: 10, color: '#3a3660', marginTop: 1, flexShrink: 0 }}>⠿</span>
      )}
    </div>
  );
}

const QUADRANT_GRID = [
  { id: 'q2' as const, label: '重要不紧急', sub: '计划', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.3)', activeBorder: 'rgba(124,58,237,0.7)' },
  { id: 'q1' as const, label: '重要且紧急', sub: '立即做', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.35)', activeBorder: 'rgba(239,68,68,0.75)' },
  { id: null, label: '不重要不紧急', sub: '暂缓', color: '#3a3660', bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.06)', activeBorder: 'rgba(255,255,255,0.06)' },
  { id: 'q3' as const, label: '紧急不重要', sub: '委派', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)', activeBorder: 'rgba(249,115,22,0.7)' },
];

const BOXES = [
  { id: 'b1' as const, label: '有重要分，无截止日', color: '#a855f7', bg: 'rgba(168,85,247,0.07)', border: 'rgba(168,85,247,0.3)' },
  { id: 'b2' as const, label: '有截止日，无重要分', color: '#f97316', bg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.3)' },
  { id: 'b3' as const, label: '被提到放首页', color: '#38bdf8', bg: 'rgba(56,189,248,0.07)', border: 'rgba(56,189,248,0.3)' },
] as const;

interface DropConfirm {
  task: Note;
  quadrant: Quadrant;
  importanceScore: number | null;
  deadline: string | null;
}

// Touch drag ghost overlay
function DragGhost({ label, x, y }: { label: string; x: number; y: number }) {
  return (
    <div style={{
      position: 'fixed', left: x - 60, top: y - 20, zIndex: 100,
      background: '#534AB7', color: 'white', fontSize: 11, fontWeight: 600,
      padding: '5px 12px', borderRadius: 8, pointerEvents: 'none',
      boxShadow: '0 4px 16px rgba(83,74,183,0.5)', opacity: 0.9,
      maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {label}
    </div>
  );
}

export default function UrgentTasksView() {
  const { isAuthenticated, isGuest } = useAuth();
  const [view, setView] = useState<'card' | 'quadrant'>('card');
  const [expanded, setExpanded] = useState(false);
  const [askOnDrop, setAskOnDrop] = useState(() => localStorage.getItem('calling-ask-on-drop') === '1');
  const [dragOverQuadrant, setDragOverQuadrant] = useState<string | null>(null);
  const [dropConfirm, setDropConfirm] = useState<DropConfirm | null>(null);
  const [confirmImportance, setConfirmImportance] = useState<number>(4.0);
  const [confirmDeadlineDays, setConfirmDeadlineDays] = useState<number>(3);

  // Touch drag state
  const [touchDrag, setTouchDrag] = useState<{ taskId: number; x: number; y: number; label: string } | null>(null);
  const quadrantRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const utils = trpc.useUtils();

  const { data: tasks = [], isLoading } = trpc.notes.listPriorityTasks.useQuery(undefined, {
    enabled: isAuthenticated && !isGuest,
    staleTime: 15_000,
  });

  const toggleComplete = trpc.notes.toggleComplete.useMutation({
    onSuccess: () => utils.notes.listPriorityTasks.invalidate(),
  });

  const updateImportance = trpc.notes.updateImportance.useMutation({
    onSuccess: () => {
      utils.notes.listPriorityTasks.invalidate();
      toast.success('已更新');
    },
  });

  const handleComplete = (id: number) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    toggleComplete.mutate({ id, completed: !task.completed });
  };

  // Find which quadrant a point is over
  const findQuadrantAt = useCallback((x: number, y: number): Quadrant | null => {
    const entries = Array.from(quadrantRefs.current.entries());
    for (const [qId, el] of entries) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return qId as Quadrant;
      }
    }
    return null;
  }, []);

  const executeDrop = useCallback((taskId: number, quadrant: Quadrant) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const needsDeadline = (quadrant === 'q1' || quadrant === 'q3') && !task.deadline;
    const needsImportance = (quadrant === 'q1' || quadrant === 'q2') && (task.importanceScore === null || task.importanceScore < 3.5);
    const defaultDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const defaultImportance = quadrant === 'q3' ? 2.0 : 4.0;

    if (askOnDrop && (needsDeadline || needsImportance)) {
      setConfirmImportance(defaultImportance);
      setConfirmDeadlineDays(3);
      setDropConfirm({
        task: task as Note,
        quadrant,
        importanceScore: needsImportance ? defaultImportance : null,
        deadline: needsDeadline ? defaultDeadline : null,
      });
    } else {
      updateImportance.mutate({
        id: task.id,
        ...(needsImportance ? { importanceScore: defaultImportance } : {}),
        ...(needsDeadline ? { deadline: defaultDeadline } : {}),
      });
    }
  }, [tasks, askOnDrop, updateImportance]);

  // Touch drag handlers
  const handleTouchDragStart = useCallback((taskId: number, _e: React.TouchEvent) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const label = (task as Note).title || (task as Note).rawText.slice(0, 20);
    // Vibrate for haptic feedback if available
    if (navigator.vibrate) navigator.vibrate(30);
    setTouchDrag({ taskId, x: 0, y: 0, label });
  }, [tasks]);

  // Global touch move/end for drag
  useEffect(() => {
    if (!touchDrag) return;

    const handleMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      setTouchDrag(prev => prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null);
      const q = findQuadrantAt(touch.clientX, touch.clientY);
      setDragOverQuadrant(q);
    };

    const handleEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const q = findQuadrantAt(touch.clientX, touch.clientY);
      if (q && touchDrag) {
        executeDrop(touchDrag.taskId, q);
      }
      setTouchDrag(null);
      setDragOverQuadrant(null);
    };

    const handleCancel = () => {
      setTouchDrag(null);
      setDragOverQuadrant(null);
    };

    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleCancel);

    return () => {
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleCancel);
    };
  }, [touchDrag, findQuadrantAt, executeDrop]);

  const confirmDrop = () => {
    if (!dropConfirm) return;
    const deadlineDate = dropConfirm.deadline
      ? new Date(Date.now() + confirmDeadlineDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    updateImportance.mutate({
      id: dropConfirm.task.id,
      ...(dropConfirm.importanceScore !== null ? { importanceScore: confirmImportance } : {}),
      ...(dropConfirm.deadline !== null ? { deadline: deadlineDate ?? null } : {}),
    });
    setDropConfirm(null);
  };

  const toggleAskOnDrop = () => {
    const next = !askOnDrop;
    setAskOnDrop(next);
    localStorage.setItem('calling-ask-on-drop', next ? '1' : '0');
  };

  if (isGuest) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: '#4a4470', fontSize: 13 }}>
        登录后查看紧急任务
      </div>
    );
  }

  if (isLoading) {
    return <div style={{ padding: 16, color: '#534AB7', fontSize: 12, textAlign: 'center' }}>加载中…</div>;
  }

  const byGroup: Record<string, Note[]> = { q1: [], q2: [], q3: [], b1: [], b2: [], b3: [] };
  tasks.forEach(t => byGroup[classify(t as Note)].push(t as Note));

  const incompleteTasks = tasks.filter(t => !t.completed);
  const allCount = incompleteTasks.length;
  const CARD_LIMIT = 6;
  const showExpandBtn = incompleteTasks.length > CARD_LIMIT && !expanded;
  const displayedTasks = expanded ? incompleteTasks : incompleteTasks.slice(0, CARD_LIMIT);

  return (
    <div>
      {/* Touch drag ghost */}
      {touchDrag && touchDrag.x > 0 && (
        <DragGhost label={touchDrag.label} x={touchDrag.x} y={touchDrag.y} />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e8e4ff' }}>紧急任务</span>
          {allCount > 0 && (
            <span style={{ fontSize: 10, background: '#2a1a4a', color: '#AFA9EC', borderRadius: 20, padding: '1px 7px' }}>
              {allCount}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['card', 'quadrant'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 8,
              background: view === v ? '#534AB7' : 'rgba(255,255,255,0.04)',
              color: view === v ? 'white' : '#534AB7',
              border: `1px solid ${view === v ? '#534AB7' : '#2a2450'}`,
              cursor: 'pointer',
            }}>
              {v === 'card' ? '卡片' : '四象限'}
            </button>
          ))}
        </div>
      </div>

      {/* CARD VIEW */}
      {view === 'card' && (
        <div>
          {tasks.length === 0 ? (
            <div style={{ color: '#2a2450', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
              暂无紧急或重要任务 ✨
            </div>
          ) : (
            <>
              {displayedTasks.map(task => (
                <TaskChip key={task.id} task={task as Note} onComplete={handleComplete} />
              ))}
              {showExpandBtn && (
                <button
                  onClick={() => setExpanded(true)}
                  style={{
                    width: '100%', padding: '6px 0', marginTop: 2,
                    background: 'rgba(83,74,183,0.08)', border: '1px dashed rgba(83,74,183,0.3)',
                    borderRadius: 8, color: '#534AB7', fontSize: 11, cursor: 'pointer',
                    transition: 'background .2s',
                  }}
                >
                  查看全部 {allCount} 条
                </button>
              )}
              {expanded && incompleteTasks.length > CARD_LIMIT && (
                <button
                  onClick={() => setExpanded(false)}
                  style={{
                    width: '100%', padding: '6px 0', marginTop: 2,
                    background: 'transparent', border: '1px dashed rgba(83,74,183,0.2)',
                    borderRadius: 8, color: '#3a3660', fontSize: 11, cursor: 'pointer',
                  }}
                >
                  收起
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* QUADRANT VIEW */}
      {view === 'quadrant' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, padding: '0 2px' }}>
            <span style={{ fontSize: 9, color: '#534AB7', letterSpacing: '0.08em' }}>↑ 重要</span>
            <span style={{ fontSize: 9, color: '#534AB7', letterSpacing: '0.08em' }}>紧急 →</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 4, marginBottom: 4 }}>
            {QUADRANT_GRID.map((q, idx) => {
              const qId = q.id;
              const qTasks = qId ? byGroup[qId].filter(t => !t.completed) : [];
              const isDropTarget = qId && dragOverQuadrant === qId;
              const isPlaceholder = qId === null;

              return (
                <div
                  key={idx}
                  ref={qId ? (el) => { if (el) quadrantRefs.current.set(qId, el); } : undefined}
                  data-quadrant={qId || undefined}
                  style={{
                    minHeight: 80,
                    borderRadius: 10,
                    border: `1.5px solid ${isDropTarget ? q.activeBorder : q.border}`,
                    background: isDropTarget ? `${q.bg.replace('0.08', '0.22').replace('0.02', '0.08')}` : q.bg,
                    padding: '8px 8px 4px',
                    transition: 'border-color .15s, background .15s, box-shadow .15s, transform .1s',
                    boxShadow: isDropTarget ? `0 0 16px ${q.activeBorder}` : 'none',
                    transform: isDropTarget ? 'scale(1.02)' : 'scale(1)',
                    opacity: isPlaceholder ? 0.5 : 1,
                  }}
                >
                  <div style={{ fontSize: 9, color: q.color, fontWeight: 600, marginBottom: 4, letterSpacing: '0.04em' }}>
                    {q.label} <span style={{ opacity: 0.6, fontWeight: 400 }}>· {q.sub}</span>
                  </div>
                  {isPlaceholder ? (
                    <div style={{ fontSize: 10, color: '#2a2450', textAlign: 'center', paddingTop: 8 }}>—</div>
                  ) : qTasks.length === 0 ? (
                    <div style={{ fontSize: 10, color: '#2a2450', textAlign: 'center', paddingTop: 8 }}>
                      {touchDrag ? '松手放入' : '长按拖入'}
                    </div>
                  ) : (
                    qTasks.slice(0, 4).map(t => (
                      <TaskChip key={t.id} task={t} onComplete={handleComplete} compact />
                    ))
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom holding boxes */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 9, color: '#534AB7', letterSpacing: '0.08em', marginBottom: 6 }}>── 待分配（长按拖入象限）──</div>
            {BOXES.map(box => {
              const boxTasks = byGroup[box.id].filter(t => !t.completed);
              if (boxTasks.length === 0) return null;
              return (
                <div key={box.id} style={{
                  marginBottom: 8, padding: '7px 8px 4px',
                  borderRadius: 10,
                  border: `1px dashed ${box.border}`,
                  background: box.bg,
                }}>
                  <div style={{ fontSize: 9, color: box.color, marginBottom: 5, letterSpacing: '0.04em' }}>
                    {box.label}
                  </div>
                  {boxTasks.map(t => (
                    <TaskChip
                      key={t.id}
                      task={t}
                      draggable
                      onTouchDragStart={handleTouchDragStart}
                      compact
                    />
                  ))}
                </div>
              );
            })}
            {(byGroup.b1.length + byGroup.b2.length + byGroup.b3.length === 0) && (
              <div style={{ fontSize: 10, color: '#2a2450', textAlign: 'center', padding: '6px 0' }}>
                所有任务已归位 ✓
              </div>
            )}
          </div>

          {/* Ask-on-drop toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, gap: 6 }}>
            <span style={{ fontSize: 9, color: '#2a2450' }}>拖入时询问</span>
            <button onClick={toggleAskOnDrop} style={{
              width: 28, height: 16, borderRadius: 8, cursor: 'pointer',
              background: askOnDrop ? '#534AB7' : '#1e1a3a',
              border: '1px solid #2a2450',
              position: 'relative', transition: 'background .2s',
            }}>
              <span style={{
                position: 'absolute', top: 2, width: 10, height: 10, borderRadius: '50%',
                background: 'white', transition: 'left .2s',
                left: askOnDrop ? 14 : 2,
              }} />
            </button>
          </div>
        </div>
      )}

      {/* Drop confirm dialog */}
      {dropConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#0f0c1e', border: '1px solid #2a2450', borderRadius: '16px 16px 0 0',
            padding: '20px 20px 32px', width: '100%', maxWidth: 440,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e4ff', marginBottom: 4 }}>确认移入象限</div>
            <div style={{ fontSize: 11, color: '#534AB7', marginBottom: 16 }}>
              「{dropConfirm.task.title || dropConfirm.task.rawText.slice(0, 20)}」→ {QUADRANT_GRID.find(q => q.id === dropConfirm.quadrant)?.label}
            </div>
            {dropConfirm.importanceScore !== null && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#AFA9EC', marginBottom: 6 }}>重要程度：{confirmImportance.toFixed(1)}</div>
                <input type="range" min={1} max={5} step={0.5} value={confirmImportance}
                  onChange={e => setConfirmImportance(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#7C3AED' }}
                />
              </div>
            )}
            {dropConfirm.deadline !== null && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#AFA9EC', marginBottom: 6 }}>截止日期：{confirmDeadlineDays} 天后</div>
                <input type="range" min={1} max={14} step={1} value={confirmDeadlineDays}
                  onChange={e => setConfirmDeadlineDays(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#7C3AED' }}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDropConfirm(null)} style={{
                flex: 1, padding: '10px', borderRadius: 10, fontSize: 13,
                background: 'transparent', border: '1px solid #2a2450', color: '#534AB7', cursor: 'pointer',
              }}>取消</button>
              <button onClick={confirmDrop} style={{
                flex: 2, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: '#534AB7', border: 'none', color: 'white', cursor: 'pointer',
              }}>确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
