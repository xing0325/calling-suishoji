import React, { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';

const INPUT_SUBCAT: Record<string, string> = {
  '1': 'movie', '2': 'book', '3': 'article', '4': 'game',
  '5': 'podcast', '6': 'concept', '7': 'person', '8': 'course', '9': 'tool',
};
const OUTPUT_SUBCAT: Record<string, string> = {
  '1': 'topic', '2': 'inspiration', '3': 'edit_idea', '4': 'drama_idea',
  '5': 'writing_topic', '6': 'design_idea', '7': 'game_design',
};

const R = 96, CX = 120, CY = 120;

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
};

// 60 tick marks around the dial ring
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const angle = i * (Math.PI * 2 / 60);
  const r1 = 118;
  const r2 = i % 5 === 0 ? 110 : 114;
  return {
    x1: +(CX + r1 * Math.sin(angle)).toFixed(1),
    y1: +(CY - r1 * Math.cos(angle)).toFixed(1),
    x2: +(CX + r2 * Math.sin(angle)).toFixed(1),
    y2: +(CY - r2 * Math.cos(angle)).toFixed(1),
    major: i % 5 === 0,
  };
});

interface DialItem {
  id: string;
  title: string;
  icon: string;
}

interface DialPickerProps {
  mainCategory: 'input' | 'output';
  items: DialItem[];
  onEnter: (key: string) => void;
}

const DialPicker: React.FC<DialPickerProps> = ({ mainCategory, items, onEnter }) => {
  const [current, setCurrent] = useState(0);
  const startXRef = useRef<number | null>(null);
  const isDragging = useRef(false);
  const n = items.length;

  const subcatMap = mainCategory === 'input' ? INPUT_SUBCAT : OUTPUT_SUBCAT;
  const currentItem = items[current];
  const subCat = subcatMap[currentItem.id];

  const { data: notes = [] } = trpc.notes.list.useQuery(
    { category: mainCategory, subCategory: subCat, limit: 50 },
    { enabled: !!subCat, staleTime: 30_000 }
  );

  const navigate = (dir: number) => {
    setCurrent(prev => ((prev + dir) % n + n) % n);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX;
    isDragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || startXRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 26) {
      navigate(dx < 0 ? 1 : -1);
      startXRef.current = e.clientX;
    }
  };

  const onPointerUp = () => {
    isDragging.current = false;
    startXRef.current = null;
  };

  const formatDate = (d: string | Date) => {
    const date = new Date(d);
    return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#0a0a0f', overflow: 'hidden',
    }}>
      {/* ── Top half: title + cards ── */}
      <div style={{
        flex: '0 0 54%', display: 'flex', flexDirection: 'column',
        padding: '20px 20px 0', overflow: 'hidden',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '22px', fontWeight: 500, color: '#e8e4ff', transition: 'opacity .2s' }}>
            {currentItem.title}
          </span>
          <span style={{ fontSize: '12px', color: '#534AB7' }}>
            {notes.length} 条记录
          </span>
        </div>

        {/* Pin row — placeholder (no pin field in schema yet) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#333' }} />
          <span style={{ fontSize: '11px', color: '#333', letterSpacing: '0.04em' }}>无置顶</span>
        </div>

        {/* Card stack */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notes.length === 0 ? (() => {
            const ex = EXAMPLE_CARDS[subCat];
            return ex ? (
              <div style={{
                background: 'transparent',
                border: '0.5px dashed #2a2450',
                borderRadius: '14px',
                padding: '12px 14px',
                position: 'relative',
              }}>
                <span style={{
                  position: 'absolute', top: '10px', right: '12px',
                  fontSize: '9px', color: '#534AB7', background: '#1a1640',
                  padding: '1px 7px', borderRadius: '20px', letterSpacing: '0.04em',
                }}>示例</span>
                <div style={{ fontSize: '10px', color: '#2a2450', marginBottom: '4px', letterSpacing: '0.03em' }}>示例笔记</div>
                <div style={{ fontSize: '13px', color: '#4a4470', lineHeight: 1.55, paddingRight: '40px' }}>
                  {ex.title}
                </div>
                <span style={{
                  display: 'inline-block', marginTop: '6px', fontSize: '10px',
                  color: '#3d375a', background: '#13102a', padding: '2px 8px', borderRadius: '20px',
                }}>
                  {ex.tag}
                </span>
              </div>
            ) : (
              <div style={{ color: '#2a2450', fontSize: '13px', textAlign: 'center', marginTop: '24px' }}>
                还没有{currentItem.title}记录
              </div>
            );
          })() : (
            notes.slice(0, 3).map((note, i) => (
              <div key={note.id} style={{
                background: '#13102a',
                border: '0.5px solid #2a2450',
                borderRadius: '14px',
                padding: '12px 14px',
                opacity: i === 2 ? 0.35 : 1,
                flexShrink: 0,
              }}>
                <div style={{ fontSize: '10px', color: '#534AB7', marginBottom: '4px', letterSpacing: '0.03em' }}>
                  {formatDate(note.createdAt)}
                </div>
                <div style={{ fontSize: '13px', color: '#c8c4e8', lineHeight: 1.55 }}>
                  {note.title || note.rawText}
                </div>
                {Array.isArray(note.tags) && note.tags.length > 0 && (
                  <span style={{
                    display: 'inline-block', marginTop: '6px', fontSize: '10px',
                    color: '#7F77DD', background: '#1e1a42', padding: '2px 8px', borderRadius: '20px',
                  }}>
                    {note.tags[0]}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Bottom half: dial ── */}
      <div style={{
        flex: '0 0 46%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', paddingBottom: '8px',
      }}>
        <div
          style={{ position: 'relative', width: '240px', height: '240px', touchAction: 'none', userSelect: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Tick marks */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            viewBox="0 0 240 240"
          >
            {TICKS.map((t, i) => (
              <line
                key={i}
                x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                stroke="#534AB7"
                strokeWidth={t.major ? 1 : 0.5}
                opacity={t.major ? 0.45 : 0.15}
              />
            ))}
          </svg>

          {/* Outer ring */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '0.5px solid #1e1a3a' }} />
          {/* Inner ring */}
          <div style={{ position: 'absolute', inset: '12px', borderRadius: '50%', border: '0.5px solid #161330' }} />

          {/* Arc nodes: show d = -2…+2 */}
          {([-2, -1, 0, 1, 2] as const).map(d => {
            const idx = ((current + d) % n + n) % n;
            const cat = items[idx];
            const angle = (d / 4) * Math.PI * 0.85;
            const x = CX + R * Math.sin(angle) - 19;
            const y = CY - R * Math.cos(angle) - 28;
            const isActive = d === 0;
            const isDim = Math.abs(d) > 1;
            return (
              <div
                key={d}
                onClick={() => setCurrent(((current + d) % n + n) % n)}
                style={{
                  position: 'absolute',
                  left: `${x.toFixed(1)}px`,
                  top: `${y.toFixed(1)}px`,
                  zIndex: 4,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                  cursor: 'pointer',
                  opacity: isDim ? 0.35 : 1,
                  transition: 'opacity .2s',
                }}
              >
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  background: isActive ? '#1a1640' : '#0e0c1e',
                  border: `0.5px solid ${isActive ? '#7F77DD' : '#2a2450'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px',
                  transition: 'border-color .2s, background .2s',
                }}>
                  {cat.icon}
                </div>
                <span style={{
                  fontSize: '9px',
                  color: isActive ? '#AFA9EC' : '#555',
                  whiteSpace: 'nowrap',
                  transition: 'color .2s',
                }}>
                  {cat.title}
                </span>
              </div>
            );
          })}

          {/* Center button */}
          <button
            onClick={() => onEnter(`${mainCategory}-${currentItem.id}`)}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '72px', height: '72px', borderRadius: '50%',
              background: '#13102a', border: '1.5px solid #534AB7',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 5,
              animation: 'dialPulse 2s infinite',
            }}
          >
            <span style={{ fontSize: '22px', lineHeight: 1 }}>{currentItem.icon}</span>
            <span style={{ fontSize: '10px', color: '#AFA9EC', marginTop: '2px', fontWeight: 500 }}>进入</span>
          </button>
        </div>

        <span style={{ fontSize: '10px', color: '#2a2450', letterSpacing: '0.06em', marginTop: '8px' }}>
          左右滑动切换
        </span>
      </div>

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
