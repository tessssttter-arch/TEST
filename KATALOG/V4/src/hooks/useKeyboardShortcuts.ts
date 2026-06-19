/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onCloseModals: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export function useKeyboardShortcuts({
  onCloseModals,
  onSelectAll,
  onClearSelection
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isTyping =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable);

      // 1. ESC - Закрыть все модальные окна (работает всегда!)
      if (e.key === 'Escape') {
        onCloseModals();
        return;
      }

      // 2. Ctrl+F / Cmd+F - Фокус на строку поиска
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          (searchInput as HTMLInputElement).select();
        }
        return;
      }

      // Если пользователь печатает в инпут, не обрабатываем глобальные буквенные клавиши
      if (isTyping) {
        return;
      }

      // 3. Клавиша 'A' (или 'а') - Выделить все видимые товары
      if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onSelectAll();
        return;
      }

      // 4. Клавиша 'S' (или 'ы') - Снять выделение со всех товаров
      if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onClearSelection();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCloseModals, onSelectAll, onClearSelection]);
}

export default useKeyboardShortcuts;
