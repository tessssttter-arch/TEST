/**
 * Специализированный хук долгого нажатия (тача) для раскрытия контекстных меню на смартфонах/планшетах.
 */

import React, { useCallback, useRef } from 'react';

interface UseLongPressOptions {
  delay?: number;
  shouldPreventDefault?: boolean;
}

export function useLongPress(
  callback: (e: any) => void,
  { delay = 600, shouldPreventDefault = true }: UseLongPressOptions = {}
) {
  const timeoutRef = useRef<number | null>(null);
  const targetRef = useRef<EventTarget | null>(null);

  const preventDefault = useCallback((e: Event) => {
    if (e.cancelable) {
      e.preventDefault();
    }
  }, []);

  const start = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      // Предотвращаем дефолтные жесты прокрутки или лупы при долгом зажатии на iOS/Android
      if (shouldPreventDefault && event.target) {
        event.target.addEventListener('touchend', preventDefault, { passive: false });
        targetRef.current = event.target;
      }
      
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

      const customEvent = {
        clientX,
        clientY,
        preventDefault: () => event.preventDefault()
      };

      timeoutRef.current = window.setTimeout(() => {
        callback(customEvent);
      }, delay);
    },
    [callback, delay, shouldPreventDefault, preventDefault]
  );

  const clear = useCallback(
    () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (shouldPreventDefault && targetRef.current) {
        targetRef.current.removeEventListener('touchend', preventDefault);
        targetRef.current = null;
      }
    },
    [shouldPreventDefault, preventDefault]
  );

  return {
    onMouseDown: start,
    onTouchStart: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchEnd: clear
  };
}

export default useLongPress;
