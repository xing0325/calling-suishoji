import React, { useState, useRef, useCallback } from 'react';
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
    return 'q3'; // has deadline + score but not important
  }
  if (hasScore && !hasDeadline) return 'b1'; // important, no deadline
  if (!hasScore && hasDeadline && isUrgent) return 'b2'; // urgent, no score
  return 'b3'; // only pinToHome or partial info
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
  onDragStart?: (e: React.DragEvent, taskId: number) => void;
  onComplete?: (id: number) => void;
  compact?: boolean;
}

function TaskChip({ task, draggable, onDragStart, onComplete, compact }: TaskChipProps) {
  const label = task.title || task.rawText.slice(0, 30);
  return (
    <div
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => onDragStart(e, task.id) : undefined}
      style={{
        background: '#13102a',
        border: '0.5px solid #2a2450',
        borderRadius: compact ? 8 : 10,
        padding: compact ? '5px 8px' : '8px 10px',
        cursor: draggable ? 'grab' : 'default',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        marginBottom: compact ? 4 : 6,
        userSelect: 'none',
        opacity: task.completed ? 0.5 : 1,
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
    </div>
  );
}

const QUADRANTS = [
  { id: 'q2', label: '重要不紧急', sub: '计划', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.3)' },
  { id: 'q1', label: '重要且紧急', sub: '立即做', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.35)' },
  { id: 'q3', label: '紧急不重要', sub: '委派', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)' },
] as const;

const BOXES = [
  { id: 'b1', label: '有重要分，无截止日', color: '#a855f7', bg: 'rgba(168,85,247,0.07)', border: 'rgba(168,85,247,0.3)' },
  { id: 'b2', label: '有截止日，无重要分', color: '#f97316', bg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.3)' },
  { id: 'b3', label: '被提到放首页', color: '#38bdf8', bg: 'rgba(56,189,248,0.07)', border: 'rgba(56,189,248,0.3)' },
] as const;

interface DropConfirm {
  task: Note;
  quadrant: Quadrant;
  importanceScore: number | null;
  deadline: string | null;
}

export default function UrgentTasksView() {
  const { isAuthenticated, isGuest } = useAuth();
  const [view, setView] = useState<'card' | 'quadrant'>('card');
  const [askOnDrop, setAskOnDrop] = useState(() => localStorage.getItem('calling-ask-on-drop') === '1');
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const [dropConfirm, setDropConfirm] = useState<DropConfirm | null>(null);
  const [confirmImportance, setConfirmImportance] = useState<number>(4.0);
  const [confirmDeadlineDays, setConfirmDeadlineDays] = useState<number>(3);
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

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragTaskId(taskId);
  };

  const handleDrop = useCallback((e: React.DragEvent, quadrant: Quadrant) => {
    e.preventDefault();
    if (dragTaskId === null) return;
    const task = tasks.find(t => t.id === dragTaskId);
    if (!task) { setDragTaskId(null); return; }

    const needsDeadline = (quadrant === 'q1' || quadrant === 'q3') && !task.deadline;
    const needsImportance = (quadrant === 'q1' || quadrant === 'q2') && (task.importanceScore === null || task.importanceScore < 3.5);
    const defaultDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const defaultImportance = quadrant === 'q3' ? 2.0 : 4.0;

    if (askOnDrop && (needsDeadline || needsImportance)) {
      setConfirmImportance(defaultImportance);
      setConfirmDeadlineDays(3);
      setDropConfirm({
        task,
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
    setDragTaskId(null);
  }, [dragTaskId, tasks, askOnDrop, updateImportance]);

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

  // Categorize tasks
  const byGroup: Record<string, Note[]> = { q1: [], q2: [], q3: [], b1: [], b2: [], b3: [] };
  tasks.forEach(t => byGroup[classify(t as Note)].push(t as Note));

  const allCount = tasks.filter(t => !t.completed).length;

  return (
    <div>
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
            tasks.filter(t => !t.completed).slice(0, 6).map(task => (
              <TaskChip key={task.id} task={task as Note} onComplete={handleComplete} />
            ))
          )}
        </div>
      )}

      {/* QUADRANT VIEW */}
      {view === 'quadrant' && (
        <div>
          {/* Labels */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 9, color: '#534AB7', letterSpacing: '0.1em' }}>↑ 重要</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
            {(['q2', 'q1', 'q3'] as const).map(qId => {
              const q = QUADRANTS.find(x => x.id === qId)!;
              const qTasks = byGroup[qId].filter(t => !t.completed);
              return (
                <div
                  key={qId}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDrop(e, qId)}
                  style={{
                    gridColumn: qId === 'q3' ? '1 / -1' : 'auto',
                    minHeight: 80,
                    borderRadius: 10,
                    border: `1px solid ${q.border}`,
                    background: q.bg,
                    padding: '8px 8px 4px',
                  }}
                >
                  <div style={{ fontSize: 9, color: q.color, fontWeight: 600, marginBottom: 4, letterSpacing: '0.04em' }}>
                    {q.label} <span style={{ opacity: 0.6, fontWeight: 400 }}>· {q.sub}</span>
                  </div>
                  {qTasks.length === 0 ? (
                    <div style={{ fontSize: 10, color: '#2a2450', textAlign: 'center', paddingTop: 8 }}>拖入任务</div>
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
            <div style={{ fontSize: 9, color: '#534AB7', letterSpacing: '0.08em', marginBottom: 6 }}>── 待分配 ──</div>
            {BOXES.map(box => {
              const boxTasks = byGroup[box.id];
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
                      onDragStart={handleDragStart}
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
              「{dropConfirm.task.title || dropConfirm.task.rawText.slice(0, 20)}」→ {QUADRANTS.find(q => q.id === dropConfirm.quadrant)?.label}
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
