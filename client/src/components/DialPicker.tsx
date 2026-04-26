import React, { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';

// ── 内置分类 ──────────────────────────────────────────────
interface DialItem {
  id: string;
  subCategory: string;
  title: string;
  icon: string;
  isCustom?: boolean;
  customDbId?: number;
}

const BASE_INPUT_ITEMS: DialItem[] = [
  { id: 'movie',   subCategory: 'movie',   title: '电影',   icon: '🎬' },
  { id: 'book',    subCategory: 'book',    title: '书籍',   icon: '📕' },
  { id: 'article', subCategory: 'article', title: '文章',   icon: '📰' },
  { id: 'game',    subCategory: 'game',    title: '游戏',   icon: '🎮' },
  { id: 'podcast', subCategory: 'podcast', title: '播客',   icon: '🎙️' },
  { id: 'concept', subCategory: 'concept', title: '概念',   icon: '💡' },
  { id: 'person',  subCategory: 'person',  title: '人物',   icon: '👤' },
  { id: 'course',  subCategory: 'course',  title: '课程',   icon: '🎓' },
  { id: 'tool',    subCategory: 'tool',    title: '工具',   icon: '🔧' },
];

const BASE_OUTPUT_ITEMS: DialItem[] = [
  { id: 'topic',         subCategory: 'topic',         title: '选题',     icon: '📝' },
  { id: 'inspiration',   subCategory: 'inspiration',   title: '灵感',     icon: '✨' },
  { id: 'edit_idea',     subCategory: 'edit_idea',     title: '剪辑灵感', icon: '✂️' },
  { id: 'drama_idea',    subCategory: 'drama_idea',    title: '戏剧灵感', icon: '🎭' },
  { id: 'writing_topic', subCategory: 'writing_topic', title: '写作选题', icon: '✍️' },
  { id: 'design_idea',   subCategory: 'design_idea',   title: '设计灵感', icon: '🎨' },
  { id: 'game_design',   subCategory: 'game_design',   title: '游戏设计', icon: '🕹️' },
];

// 未归类始终排在最后
const UNCATEGORIZED_ITEM: DialItem = {
  id: 'uncategorized', subCategory: 'uncategorized', title: '未归类', icon: '📌',
};

// ── 示例卡片 ──────────────────────────────────────────────
const EXAMPLE_CARDS: Record<string, { title: string; tag: string }> = {
  movie:         { title: '《千与千寻》中，无脸男的孤独感让我深思社会认同的本质', tag: '宫崎骏' },
  book:          { title: '《思考，快与慢》第三章——小数定律的陷阱，决策者如何被样本量误导', tag: '心理学' },
  article:       { title: 'Paul Graham：保持初心的最大障碍不是能力，而是对"失败"的定义', tag: '创业' },
  game:          { title: '《空洞骑士》的地图设计——用迷失感制造探索欲的哲学', tag: '游戏设计' },
  podcast:       { title: '硅谷101：为什么 AI 公司的护城河比 SaaS 窄？网络效应的变形', tag: '科技' },
  concept:       { title: '二阶效应：每个决策都会产生我们没有预见的后果，而那些后果才是关键', tag: '思维模型' },
  person:        { title: '费曼：用"橡皮鸭教学法"把复杂系统讲给六岁孩子听', tag: '物理学家' },
  course:        { title: 'MIT 6.824 — Raft 共识算法的领导人选举机制', tag: '分布式系统' },
  tool:          { title: 'Obsidian 双向链接 + Dataview 插件，把笔记变成个人知识图谱', tag: '效率工具' },
  topic:         { title: '为什么年轻人开始逃离城市？反城镇化浪潮的背后逻辑', tag: '社会观察' },
  inspiration:   { title: '用"倒叙剪辑"重剪一期播客，把最高潮的片段放到片头90秒', tag: '创作灵感' },
  edit_idea:     { title: '字幕节奏卡点：把采访停顿压缩到0.3秒，语速感觉加快40%', tag: '剪辑技巧' },
  drama_idea:    { title: '主角不说谎，但每句真话都被误解——信息不对称的戏剧张力', tag: '编剧' },
  writing_topic: { title: '当代年轻人如何重新定义"成功"——用三个真实人物结构论点', tag: '非虚构写作' },
  design_idea:   { title: '"留白即信息"：去掉50%元素后，重要内容反而更突出', tag: 'UI设计' },
  game_design:   { title: '动态难度调整：敌人血量根据玩家失败次数隐性下降', tag: '游戏机制' },
  uncategorized: { title: '这条记录 AI 识别为输入/输出，但暂时无法归入具体分类', tag: '待归类' },
};

// ── 预设 emoji ─────────────────────────────────────────────
const PRESET_EMOJIS = [
  '🎨','🎵','🏃','🍳','✈️','💻','🔬','🌱','💬','📸',
  '🏋️','🌙','⚽','🎤','🧩','🔮','🌊','🦋','🎯','🧠',
];

// ── 拨盘几何常数 ──────────────────────────────────────────
const R = 96, CX = 120, CY = 120;
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const angle = i * (Math.PI * 2 / 60);
  const r1 = 118, r2 = i % 5 === 0 ? 110 : 114;
  return {
    x1: +(CX + r1 * Math.sin(angle)).toFixed(1),
    y1: +(CY - r1 * Math.cos(angle)).toFixed(1),
    x2: +(CX + r2 * Math.sin(angle)).toFixed(1),
    y2: +(CY - r2 * Math.cos(angle)).toFixed(1),
    major: i % 5 === 0,
  };
});

// ── Props ─────────────────────────────────────────────────
interface DialPickerProps {
  mainCategory: 'input' | 'output';
  onEnter: (key: string, title: string, icon: string) => void;
}

const DialPicker: React.FC<DialPickerProps> = ({ mainCategory, onEnter }) => {
  const { isAuthenticated, isGuest } = useAuth();
  const utils = trpc.useUtils();

  // 加载自定义分类
  const { data: customCats = [] } = trpc.customCategories.list.useQuery(
    { parentCategory: mainCategory },
    { enabled: isAuthenticated && !isGuest, staleTime: 60_000 }
  );

  // 合并：内置 + 自定义 + 未归类
  const baseItems = mainCategory === 'input' ? BASE_INPUT_ITEMS : BASE_OUTPUT_ITEMS;
  const customItems: DialItem[] = customCats.map(c => ({
    id: c.subCategory,
    subCategory: c.subCategory,
    title: c.label,
    icon: c.icon,
    isCustom: true,
    customDbId: c.id,
  }));
  const items: DialItem[] = [...baseItems, ...customItems, UNCATEGORIZED_ITEM];

  // 拨盘状态
  const [current, setCurrent] = useState(0);
  const startXRef = useRef<number | null>(null);
  const isDragging = useRef(false);
  const n = items.length;
  const safeIndex = Math.min(current, n - 1);
  const currentItem = items[safeIndex];

  // 笔记查询
  const { data: notes = [] } = trpc.notes.list.useQuery(
    { category: mainCategory, subCategory: currentItem.subCategory, limit: 50 },
    { staleTime: 30_000 }
  );

  // 拨盘滑动
  const navigate = (dir: number) => setCurrent(prev => ((prev + dir) % n + n) % n);
  const onPointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX;
    isDragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || startXRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 26) { navigate(dx < 0 ? 1 : -1); startXRef.current = e.clientX; }
  };
  const onPointerUp = () => { isDragging.current = false; startXRef.current = null; };

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });

  // ── 创建自定义分类 Modal ───────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('');

  const createMutation = trpc.customCategories.create.useMutation({
    onSuccess: (data) => {
      utils.customCategories.list.invalidate({ parentCategory: mainCategory });
      toast.success(`已添加「${data.label}」分类`);
      setShowCreate(false);
      setNewLabel('');
      setNewIcon('');
      // 自动跳到新增分类
      setTimeout(() => {
        const newIdx = items.findIndex(i => i.subCategory === data.subCategory);
        if (newIdx >= 0) setCurrent(newIdx);
      }, 300);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.customCategories.delete.useMutation({
    onSuccess: () => {
      utils.customCategories.list.invalidate({ parentCategory: mainCategory });
      toast.success('已删除分类');
      setCurrent(0);
    },
  });

  const handleCreate = () => {
    if (!newLabel.trim()) return toast.error('请输入分类名称');
    if (!newIcon) return toast.error('请选择一个图标');
    createMutation.mutate({ parentCategory: mainCategory, label: newLabel.trim(), icon: newIcon });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0f', overflow: 'hidden' }}>

      {/* ── 上半：标题 + 卡片 ── */}
      <div style={{ flex: '0 0 54%', display: 'flex', flexDirection: 'column', padding: '20px 20px 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '22px', fontWeight: 500, color: '#e8e4ff', transition: 'opacity .2s' }}>
            {currentItem.title}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {currentItem.isCustom && (
              <button
                onClick={() => deleteMutation.mutate({ id: currentItem.customDbId! })}
                style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
              >
                删除分类
              </button>
            )}
            <span style={{ fontSize: '12px', color: '#534AB7' }}>{notes.length} 条记录</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#333' }} />
          <span style={{ fontSize: '11px', color: '#333', letterSpacing: '0.04em' }}>无置顶</span>
        </div>

        {/* 卡片区 */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notes.length === 0 ? (() => {
            const ex = EXAMPLE_CARDS[currentItem.subCategory];
            return ex ? (
              <div style={{ background: 'transparent', border: '0.5px dashed #2a2450', borderRadius: '14px', padding: '12px 14px', position: 'relative' }}>
                <span style={{ position: 'absolute', top: '10px', right: '12px', fontSize: '9px', color: '#534AB7', background: '#1a1640', padding: '1px 7px', borderRadius: '20px', letterSpacing: '0.04em' }}>示例</span>
                <div style={{ fontSize: '10px', color: '#2a2450', marginBottom: '4px', letterSpacing: '0.03em' }}>示例笔记</div>
                <div style={{ fontSize: '13px', color: '#4a4470', lineHeight: 1.55, paddingRight: '40px' }}>{ex.title}</div>
                <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '10px', color: '#3d375a', background: '#13102a', padding: '2px 8px', borderRadius: '20px' }}>{ex.tag}</span>
              </div>
            ) : (
              <div style={{ color: '#2a2450', fontSize: '13px', textAlign: 'center', marginTop: '24px' }}>
                还没有{currentItem.title}记录
              </div>
            );
          })() : (
            notes.slice(0, 3).map((note, i) => (
              <div key={note.id} style={{ background: '#13102a', border: '0.5px solid #2a2450', borderRadius: '14px', padding: '12px 14px', opacity: i === 2 ? 0.35 : 1, flexShrink: 0 }}>
                <div style={{ fontSize: '10px', color: '#534AB7', marginBottom: '4px', letterSpacing: '0.03em' }}>{formatDate(note.createdAt)}</div>
                <div style={{ fontSize: '13px', color: '#c8c4e8', lineHeight: 1.55 }}>{note.title || note.rawText}</div>
                {Array.isArray(note.tags) && note.tags.length > 0 && (
                  <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '10px', color: '#7F77DD', background: '#1e1a42', padding: '2px 8px', borderRadius: '20px' }}>{note.tags[0]}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── 下半：拨盘 ── */}
      <div style={{ flex: '0 0 46%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: '8px' }}>
        <div
          style={{ position: 'relative', width: '240px', height: '240px', touchAction: 'none', userSelect: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* 刻度 */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 240 240">
            {TICKS.map((t, i) => (
              <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#534AB7" strokeWidth={t.major ? 1 : 0.5} opacity={t.major ? 0.45 : 0.15} />
            ))}
          </svg>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '0.5px solid #1e1a3a' }} />
          <div style={{ position: 'absolute', inset: '12px', borderRadius: '50%', border: '0.5px solid #161330' }} />

          {/* 弧形节点 */}
          {([-2, -1, 0, 1, 2] as const).map(d => {
            const idx = ((safeIndex + d) % n + n) % n;
            const cat = items[idx];
            const angle = (d / 4) * Math.PI * 0.85;
            const x = CX + R * Math.sin(angle) - 19;
            const y = CY - R * Math.cos(angle) - 28;
            const isActive = d === 0;
            const isDim = Math.abs(d) > 1;
            return (
              <div
                key={d}
                onClick={() => setCurrent(((safeIndex + d) % n + n) % n)}
                style={{ position: 'absolute', left: `${x.toFixed(1)}px`, top: `${y.toFixed(1)}px`, zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', opacity: isDim ? 0.35 : 1, transition: 'opacity .2s' }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: isActive ? '#1a1640' : '#0e0c1e', border: `0.5px solid ${isActive ? '#7F77DD' : '#2a2450'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', transition: 'border-color .2s, background .2s', position: 'relative' }}>
                  {cat.icon}
                  {/* 自定义分类标记 */}
                  {cat.isCustom && isActive && (
                    <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', background: '#534AB7', border: '1px solid #0a0a0f' }} />
                  )}
                </div>
                <span style={{ fontSize: '9px', color: isActive ? '#AFA9EC' : '#555', whiteSpace: 'nowrap', transition: 'color .2s' }}>{cat.title}</span>
              </div>
            );
          })}

          {/* 中心按钮 */}
          <button
            onClick={() => onEnter(`${mainCategory}-${currentItem.id}`, currentItem.title, currentItem.icon)}
            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '72px', height: '72px', borderRadius: '50%', background: '#13102a', border: '1.5px solid #534AB7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5, animation: 'dialPulse 2s infinite' }}
          >
            <span style={{ fontSize: '22px', lineHeight: 1 }}>{currentItem.icon}</span>
            <span style={{ fontSize: '10px', color: '#AFA9EC', marginTop: '2px', fontWeight: 500 }}>进入</span>
          </button>

          {/* + 新增自定义分类按钮（右下角） */}
          {!isGuest && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowCreate(true); }}
              style={{ position: 'absolute', bottom: 10, right: 10, width: 28, height: 28, borderRadius: '50%', background: '#13102a', border: '1px dashed #534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 6, fontSize: 16, color: '#534AB7' }}
              title="添加自定义分类"
            >
              +
            </button>
          )}
        </div>

        <span style={{ fontSize: '10px', color: '#2a2450', letterSpacing: '0.06em', marginTop: '8px' }}>左右滑动切换</span>
      </div>

      {/* ── 创建自定义分类 Modal ── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#0f0c1e', border: '1px solid #2a2450', borderRadius: '16px 16px 0 0', padding: '20px 20px 36px', width: '100%', maxWidth: 440 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e4ff', marginBottom: 16 }}>
              添加自定义分类
            </div>

            {/* 名称输入 */}
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="分类名称（最多10字）"
              maxLength={10}
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', background: '#13102a', border: '1px solid #2a2450', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#e8e4ff', outline: 'none', marginBottom: 14 }}
            />

            {/* Emoji 选择 */}
            <div style={{ fontSize: 11, color: '#AFA9EC', marginBottom: 8 }}>
              选择图标 {newIcon && <span style={{ marginLeft: 6, fontSize: 16 }}>{newIcon}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6, marginBottom: 20 }}>
              {PRESET_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setNewIcon(emoji)}
                  style={{ fontSize: 20, background: newIcon === emoji ? '#2a1a4a' : 'transparent', border: `1px solid ${newIcon === emoji ? '#534AB7' : 'transparent'}`, borderRadius: 8, padding: '4px 0', cursor: 'pointer', transition: 'background .15s' }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowCreate(false); setNewLabel(''); setNewIcon(''); }}
                style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, background: 'transparent', border: '1px solid #2a2450', color: '#534AB7', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                style={{ flex: 2, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: '#534AB7', border: 'none', color: 'white', cursor: 'pointer', opacity: createMutation.isPending ? 0.6 : 1 }}
              >
                {createMutation.isPending ? '创建中…' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dialPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(83,74,183,0.3); }
          50%       { box-shadow: 0 0 0 8px rgba(83,74,183,0); }
        }
      `}</style>
    </div>
  );
};

export default DialPicker;
