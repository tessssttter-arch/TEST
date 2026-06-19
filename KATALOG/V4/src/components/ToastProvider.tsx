/**
 * Компонент всплывающих тост-уведомлений (Toast Notifications).
 * Обеспечивает красивую обратную связь с куратором при выполнении любых действий.
 */

import React from 'react';
import { useCatalog } from '../context/CatalogContext';
import { CheckCircle2, AlertOctagon, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export const ToastProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { toasts, removeToast } = useCatalog();

  return (
    <>
      {children}
      <div id="toast-container" className="fixed bottom-5 right-5 z-[5000] flex flex-col gap-2.5 max-w-sm w-full font-sans select-none pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            let bgColor = "bg-stone-900 text-stone-100 border-stone-800";
            let icon = <Info className="w-5 h-5 text-sky-400 shrink-0" />;

            if (toast.type === 'success') {
              bgColor = "bg-emerald-950/95 text-emerald-200 border-emerald-800/50";
              icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
            } else if (toast.type === 'error') {
              bgColor = "bg-rose-950/95 text-rose-200 border-rose-800/50";
              icon = <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />;
            }

            return (
              <motion.div
                key={toast.id}
                id={`toast-${toast.id}`}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`pointer-events-auto flex items-center justify-between gap-3.5 p-4 rounded-xl border shadow-xl backdrop-blur-sm ${bgColor}`}
              >
                <div className="flex items-center gap-3">
                  {icon}
                  <span className="text-xs font-semibold leading-relaxed">{toast.message}</span>
                </div>
                <button
                  id={`close-toast-${toast.id}`}
                  onClick={() => removeToast(toast.id)}
                  className="text-stone-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
};
