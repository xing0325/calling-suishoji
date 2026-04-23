/**
 * CALLING 本地存储管理
 * 管理所有需要持久化的数据
 */

export interface CallingData {
  id: string;
  date: string; // YYYY-MM-DD 格式
  content: string;
  category: 'todo' | 'diary' | 'input' | 'output';
  completed: boolean;
  createdAt: string;
}

export interface StorageData {
  callings: CallingData[];
  lastUpdated: string;
}

const STORAGE_KEY = 'calling_data';

/**
 * 初始化存储数据
 */
export const initializeStorage = (): StorageData => {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return JSON.parse(existing);
  }

  // 创建初始数据
  const today = new Date();
  const initialData: StorageData = {
    callings: [
      {
        id: 'calling-1',
        date: formatDate(today),
        content: '完成CALLING前端开发',
        category: 'todo',
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'calling-2',
        date: formatDate(new Date(today.getTime() - 86400000)),
        content: '优化滑动交互',
        category: 'todo',
        completed: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'calling-3',
        date: formatDate(new Date(today.getTime() - 172800000)),
        content: '实现日历功能',
        category: 'todo',
        completed: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'calling-4',
        date: formatDate(new Date(today.getTime() - 259200000)),
        content: '设计UI布局',
        category: 'todo',
        completed: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'calling-5',
        date: formatDate(new Date(today.getTime() - 345600000)),
        content: '建立项目框架',
        category: 'todo',
        completed: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'calling-6',
        date: formatDate(new Date(today.getTime() - 432000000)),
        content: '需求分析和设计',
        category: 'todo',
        completed: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'calling-7',
        date: formatDate(new Date(today.getTime() - 518400000)),
        content: '产品规划',
        category: 'todo',
        completed: true,
        createdAt: new Date().toISOString(),
      },
    ],
    lastUpdated: new Date().toISOString(),
  };

  saveStorage(initialData);
  return initialData;
};

/**
 * 获取存储数据
 */
export const getStorage = (): StorageData => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    return initializeStorage();
  }
  return JSON.parse(data);
};

/**
 * 保存存储数据
 */
export const saveStorage = (data: StorageData): void => {
  data.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

/**
 * 添加calling
 */
export const addCalling = (calling: Omit<CallingData, 'id' | 'createdAt'>): CallingData => {
  const data = getStorage();
  const newCalling: CallingData = {
    ...calling,
    id: `calling-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  data.callings.push(newCalling);
  saveStorage(data);
  return newCalling;
};

/**
 * 更新calling
 */
export const updateCalling = (id: string, updates: Partial<CallingData>): void => {
  const data = getStorage();
  const index = data.callings.findIndex((c) => c.id === id);
  if (index >= 0) {
    data.callings[index] = { ...data.callings[index], ...updates };
    saveStorage(data);
  }
};

/**
 * 删除calling
 */
export const deleteCalling = (id: string): void => {
  const data = getStorage();
  data.callings = data.callings.filter((c) => c.id !== id);
  saveStorage(data);
};

/**
 * 获取指定日期的callings
 */
export const getCallingsByDate = (date: Date): CallingData[] => {
  const data = getStorage();
  const dateStr = formatDate(date);
  return data.callings.filter((c) => c.date === dateStr);
};

/**
 * 获取所有有callings的日期
 */
export const getDatesWithCallings = (): Date[] => {
  const data = getStorage();
  const dates = new Set<string>();

  data.callings.forEach((c) => {
    dates.add(c.date);
  });

  return Array.from(dates).map((dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  });
};

/**
 * 获取连胜天数
 */
export const getStreakDays = (): { current: number; max: number } => {
  const data = getStorage();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 获取所有完成的日期
  const completedDates = new Set<string>();
  data.callings.forEach((c) => {
    if (c.completed && c.category === 'todo') {
      completedDates.add(c.date);
    }
  });

  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;

  // 从今天往前数，计算连胜
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = formatDate(checkDate);

    if (completedDates.has(dateStr)) {
      tempStreak++;
      if (i === 0) {
        currentStreak = tempStreak;
      }
    } else {
      if (tempStreak > maxStreak) {
        maxStreak = tempStreak;
      }
      tempStreak = 0;
    }
  }

  return {
    current: currentStreak,
    max: Math.max(maxStreak, tempStreak),
  };
};

/**
 * 格式化日期为 YYYY-MM-DD
 */
export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 清空所有数据（仅用于测试）
 */
export const clearStorage = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
