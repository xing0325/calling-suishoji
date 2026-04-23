import React, { useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DialPadItem {
  id: string;
  title: string;
  icon?: React.ReactNode;
  color?: string;
  onClick?: () => void;
}

interface DialPadProps {
  items: DialPadItem[];
  onItemClick?: (item: DialPadItem) => void;
  title?: string;
}

/**
 * 拨号盘UI组件 - 圆形卡片水平滚动
 * 用于展示"世界的calling"和"内心的calling"中的各个分类
 */
export const DialPad: React.FC<DialPadProps> = ({ items, onItemClick, title }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    container?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    return () => {
      container?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-sm font-semibold text-foreground mb-4 px-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
          {title}
        </h3>
      )}
      <div className="relative px-4">
        {/* 左滚动按钮 */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-gradient-to-r from-background to-transparent p-2 rounded-r-lg transition-opacity hover:opacity-100"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
        )}

        {/* 滚动容器 */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollBehavior: 'smooth' }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onItemClick?.(item) || item.onClick?.()}
              className="flex-shrink-0 w-28 h-28 rounded-full bg-card border border-border hover:bg-secondary transition-all duration-300 hover:shadow-lg active:scale-95 flex flex-col items-center justify-center gap-2 group"
            >
              {item.icon && (
                <div className="text-2xl group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </div>
              )}
              <span className="text-xs font-medium text-foreground text-center px-2 line-clamp-2">
                {item.title}
              </span>
            </button>
          ))}
        </div>

        {/* 右滚动按钮 */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-gradient-to-l from-background to-transparent p-2 rounded-l-lg transition-opacity hover:opacity-100"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
        )}
      </div>
    </div>
  );
};

export default DialPad;
