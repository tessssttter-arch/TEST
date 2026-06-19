/**
 * Модальной диалог подтверждения решений (Confirm dialog modal).
 * Заменяет дефолтный некрасивый window.confirm профессиональным сверкающим оверлеем.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { HelpCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export const ConfirmModal: React.FC = () => {
  const { confirmConfig, closeConfirm, addToast } = useCatalog();
  const [isLoading, setIsLoading] = useState(false);
  const modalBoxRef = useRef<HTMLDivElement>(null);

  const isDestructive = confirmConfig 
    ? confirmConfig.title.toLowerCase().includes('удалить') || 
      confirmConfig.title.toLowerCase().includes('сбросить') || 
      confirmConfig.message.toLowerCase().includes('будет полностью стёрто')
    : false;

  const handleConfirm = async () => {
    if (!confirmConfig) return;
    try {
      setIsLoading(true);
      await confirmConfig.onConfirm();
    } catch (err: any) {
      console.error('Ошибка выполнения операции подтверждения:', err);
      addToast('Ошибка операции: ' + (err.message || 'Произошел сбой в базе данных'), 'error');
    } finally {
      setIsLoading(false);
      closeConfirm();
    }
  };

  // Механизм Focus Trap для обеспечения высокой доступности интерфейса (WCAG AA)
  useEffect(() => {
    if (!confirmConfig) return;
    
    const timer = setTimeout(() => {
      const cancelBtn = document.getElementById('confirm-modal-cancel-btn');
      cancelBtn?.focus();
    }, 80);

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (!modalBoxRef.current) return;

      const focusable = modalBoxRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      
      const firstElement = focusable[0] as HTMLElement;
      const lastElement = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleTabKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleTabKey);
    };
  }, [confirmConfig]);

  return (
    <AnimatePresence>
      {confirmConfig && (
        <div id="confirm-modal-overlay-wrapper" className="fixed inset-0 z-[6000] flex items-center justify-center">
          {/* Backdrop screen */}
          <motion.div
            id="confirm-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            onClick={isLoading ? undefined : closeConfirm}
          />

          {/* Modal box container */}
          <motion.div
            ref={modalBoxRef}
            id="confirm-modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-message"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="relative bg-white border border-stone-200 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header/Accent bar color depending on danger or info */}
            <div className={`h-1.5 w-full ${isDestructive ? 'bg-rose-500' : 'bg-blue-500'}`} />
            
            <div className="p-6">
              <div className="flex gap-4 items-start">
                <div className={`p-2.5 rounded-xl shrink-0 ${isDestructive ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-sky-50 text-sky-500 border border-sky-100'}`}>
                  {isDestructive ? (
                    <AlertTriangle className="w-5.5 h-5.5" />
                  ) : (
                    <HelpCircle className="w-5.5 h-5.5" />
                  )}
                </div>
                
                <div className="space-y-1.5 flex-1 text-left">
                  <h3 id="confirm-modal-title" className="text-sm font-bold text-stone-900 font-sans tracking-tight">
                    {confirmConfig.title}
                  </h3>
                  <p id="confirm-modal-message" className="text-xs text-stone-550 leading-relaxed font-sans">
                    {confirmConfig.message}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-2.5 font-mono text-xs font-semibold">
              <button
                id="confirm-modal-cancel-btn"
                onClick={closeConfirm}
                disabled={isLoading}
                className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-200 text-stone-600 rounded-xl cursor-pointer transition-colors disabled:opacity-55 disabled:cursor-not-allowed"
              >
                {confirmConfig.cancelBtnText || 'Отмена'}
              </button>
              <button
                id="confirm-modal-submit-btn"
                onClick={handleConfirm}
                disabled={isLoading}
                className={`px-4 py-2 text-white border transition-colors rounded-xl cursor-pointer flex items-center gap-1.5 disabled:opacity-80 disabled:cursor-not-allowed ${
                  isDestructive 
                    ? 'bg-rose-600 border-rose-650 hover:bg-rose-700' 
                    : 'bg-stone-900 border-stone-950 hover:bg-stone-850'
                }`}
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isLoading ? 'Выполнение...' : (confirmConfig.confirmBtnText || 'Продолжить')}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
