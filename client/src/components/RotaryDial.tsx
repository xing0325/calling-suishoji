import React, { useRef, useState, useEffect } from 'react';

interface RotaryDialItem {
  id: string;
  title: string;
  icon: React.ReactNode;
}

interface RotaryDialProps {
  items: RotaryDialItem[];
  onSelect?: (item: RotaryDialItem) => void;
  type?: 'moon' | 'sun';
}

/**
 * 电话拨号盘UI组件
 * 长按旋转表盘，顶部高亮格子中的项目为选中项
 * 锁定左右和上下滑动，只允许旋转
 */
export const RotaryDial: React.FC<RotaryDialProps> = ({
  items,
  onSelect,
  type = 'sun',
}) => {
  const dialRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [startAngle, setStartAngle] = useState(0);
  const [startRotation, setStartRotation] = useState(0);

  const itemCount = items.length;
  const anglePerItem = 360 / itemCount;

  // 计算中心点到触摸点的角度
  const calculateAngle = (e: React.TouchEvent | React.PointerEvent) => {
    if (!dialRef.current) return 0;

    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left - centerX;
    const y = clientY - rect.top - centerY;

    // 计算角度（-90是因为我们要把顶部作为0度）
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    return angle;
  };

  // 处理触摸开始
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSnapping) return;

    const angle = calculateAngle(e);
    setStartAngle(angle);
    setStartRotation(rotation);
    setIsDragging(true);
  };

  // 处理触摸移动
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isSnapping) return;

    const currentAngle = calculateAngle(e);
    const angleDiff = currentAngle - startAngle;

    // 旋转表盘（负数是顺时针）
    setRotation(startRotation - angleDiff);
  };

  // 处理触摸结束
  const handleTouchEnd = () => {
    if (!isDragging) return;

    setIsDragging(false);

    // 计算最接近高亮位置的项目
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const closestIndex = Math.round(normalizedRotation / anglePerItem) % itemCount;

    // 平滑吸附到最近的项目
    const targetRotation = (closestIndex * anglePerItem) % 360;

    snapToTarget(targetRotation, closestIndex);
  };

  // 平滑吸附到目标旋转角度
  const snapToTarget = (targetRotation: number, index: number) => {
    setIsSnapping(true);

    const startRot = rotation;
    const startTime = Date.now();
    const duration = 300;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // 缓动函数：cubic-out
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      setRotation(startRot + (targetRotation - startRot) * easeProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setRotation(targetRotation);
        setIsSnapping(false);
        onSelect?.(items[index]);
      }
    };

    requestAnimationFrame(animate);
  };

  // 获取高亮位置的项目索引
  const getHighlightedIndex = () => {
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    return Math.round(normalizedRotation / anglePerItem) % itemCount;
  };

  const highlightedIndex = getHighlightedIndex();

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 高亮指示器 - 顶部圆格子 */}
      <div className="relative w-20 h-20 flex items-center justify-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 border-2 border-primary rounded-lg bg-primary/10 flex items-center justify-center z-10">
          <span className="text-xs font-bold text-primary">选择</span>
        </div>
      </div>

      {/* 拨号盘容器 */}
      <div
        ref={dialRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative w-64 h-64 rounded-full border-4 border-primary/30 bg-gradient-to-br from-card via-card to-card/80 shadow-2xl cursor-grab active:cursor-grabbing flex items-center justify-center overflow-hidden"
        style={{
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {/* 中心圆点 */}
        <div className="absolute w-3 h-3 bg-primary rounded-full z-20" />

        {/* 拨号盘项目 */}
        <div className="relative w-full h-full">
          {items.map((item, index) => {
            const angle = (index * anglePerItem - rotation) % 360;
            const isHighlighted = index === highlightedIndex;

            // 将角度转换为弧度并计算位置
            const radian = (angle * Math.PI) / 180;
            const radius = 90; // 项目距离中心的距离
            const x = Math.cos(radian - Math.PI / 2) * radius;
            const y = Math.sin(radian - Math.PI / 2) * radius;

            return (
              <div
                key={item.id}
                className="absolute w-20 h-20 flex flex-col items-center justify-center"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  transition: isDragging ? 'none' : 'all 0.3s ease-out',
                }}
              >
                <button
                  className={`w-16 h-16 rounded-full flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
                    isHighlighted
                      ? 'bg-primary text-primary-foreground shadow-lg scale-110 border-2 border-primary'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-2 border-transparent'
                  }`}
                  disabled={isDragging}
                >
                  <div className="text-2xl">{item.icon}</div>
                  <span className="text-xs font-semibold text-center line-clamp-1">
                    {item.title}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* 旋转指示线 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-8 bg-gradient-to-b from-primary to-transparent opacity-60 z-10" />
      </div>

      {/* 当前选中项显示 */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-2">当前选中</p>
        <p className="text-sm font-semibold text-primary">
          {items[highlightedIndex]?.title || '未选择'}
        </p>
      </div>

      {/* 使用说明 */}
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        长按表盘旋转，顶部高亮格子中的项目为选中项
      </p>
    </div>
  );
};

export default RotaryDial;
