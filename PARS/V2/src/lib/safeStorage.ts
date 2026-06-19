/**
 * Обертка для безопасной работы с LocalStorage.
 * Автоматически сериализует Set/Map и обрабатывает ошибки переполнения квоты.
 */

export const safeStorage = {
  setItem(key: string, value: any): boolean {
    try {
      const serialized = JSON.stringify(value, (key, val) => {
        if (val instanceof Set) return Array.from(val);
        if (val instanceof Map) return Object.fromEntries(val);
        return val;
      });
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error('Ошибка записи в LocalStorage:', error);
      // Здесь можно добавить триггер для Toast-уведомления пользователю
      return false;
    }
  },

  getItem<T>(key: string, defaultValue: T): T {
    try {
      const serialized = localStorage.getItem(key);
      if (!serialized) return defaultValue;
      return JSON.parse(serialized);
    } catch (error) {
      console.error('Ошибка чтения из LocalStorage:', error);
      return defaultValue;
    }
  },

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
};
