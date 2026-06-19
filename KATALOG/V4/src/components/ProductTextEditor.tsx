/**
 * Редактор текстовых полей товара (ProductTextEditor).
 * Осуществляет редактирование кураторского описания и просмотр/модификацию сырого текста VK/Telegram.
 * Содержит раскрывающиеся блоки и диалоговое окно кураторской правки первоисточника.
 */

import React, { useState, useEffect } from 'react';
import { Edit3, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProductTextEditorProps {
  productId: string;
  description: string;
  originalText?: string;
  onSaveDesc: (newDesc: string) => void;
  onSaveOriginalText: (newOrigText: string) => void;
  viewMode?: 'grid' | 'list';
}

export const ProductTextEditor: React.FC<ProductTextEditorProps> = ({
  productId,
  description,
  originalText = '',
  onSaveDesc,
  onSaveOriginalText,
  viewMode = 'list',
}) => {
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState(description);
  const [showOriginalText, setShowOriginalText] = useState(false);
  const [isEditingOriginalModal, setIsEditingOriginalModal] = useState(false);
  const [tempOriginalText, setTempOriginalText] = useState(originalText);
  const [isGridDescExpanded, setIsGridDescExpanded] = useState(false);

  useEffect(() => {
    setEditedDesc(description);
  }, [description]);

  useEffect(() => {
    setTempOriginalText(originalText);
  }, [originalText]);

  const handleSaveDesc = () => {
    setIsEditingDesc(false);
    onSaveDesc(editedDesc);
  };

  const handleCancelDesc = () => {
    setEditedDesc(description);
    setIsEditingDesc(false);
  };

  if (viewMode === 'grid') {
    return (
      <div 
        id={`grid-desc-wrapper-${productId}`}
        onClick={() => setIsGridDescExpanded(prev => !prev)}
        className="group/desc cursor-pointer hover:bg-stone-50 p-1.5 rounded-lg border border-transparent hover:border-stone-200/50 transition-all duration-200 text-left"
        title="Переключить раскрытие текста описания"
      >
        <p className={`text-stone-600 text-xs leading-relaxed font-sans transition-all ${isGridDescExpanded ? "whitespace-pre-wrap" : "line-clamp-2"}`}>
          {description || <span className="text-stone-400 italic">Описание отсутствует</span>}
        </p>
        {description && description.length > 50 && (
          <span className="text-[8.5px] text-stone-400 font-mono mt-1.5 block text-right font-semibold group-hover/desc:text-stone-750 transition-colors uppercase">
            {isGridDescExpanded ? "Свернуть ↑" : "Развернуть ↓"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-left">
      {/* Шапка описания */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Кураторское описание</span>
        {!isEditingDesc && (
          <button
            onClick={() => setIsEditingDesc(true)}
            className="text-stone-400 hover:text-stone-900 transition-colors flex items-center gap-1 text-[11px] cursor-pointer font-semibold border-0 bg-transparent"
          >
            <Edit3 className="w-3.5 h-3.5" /> Редактировать
          </button>
        )}
      </div>

      {/* Инпуты или текст */}
      {isEditingDesc ? (
        <div className="space-y-2">
          <textarea
            rows={4}
            className="w-full text-xs p-3 border border-stone-200 rounded-lg bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 leading-relaxed text-stone-850"
            value={editedDesc}
            onChange={(e) => setEditedDesc(e.target.value)}
          />
          <div className="flex gap-2 justify-end font-mono">
            <button
              onClick={handleCancelDesc}
              className="px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs rounded cursor-pointer transition-colors font-medium border-0 bg-transparent"
            >
              Отмена
            </button>
            <button
              onClick={handleSaveDesc}
              className="px-3 py-1 bg-stone-900 hover:bg-stone-800 text-white text-xs rounded cursor-pointer transition-colors font-medium border-0 bg-transparent"
            >
              Сохранить
            </button>
          </div>
        </div>
      ) : (
        <div className="text-stone-800 text-xs leading-relaxed font-sans bg-stone-50/50 p-3 rounded-lg border border-stone-101 whitespace-pre-wrap text-left">
          {description || <span className="text-stone-400 italic">Описание отсутствует</span>}
        </div>
      )}

      {/* Просмотрщик исходного текста поста VK/TG */}
      {originalText && (
        <div className="border border-stone-200 rounded-lg overflow-hidden">
          <div className="w-full flex items-center justify-between px-3 py-1.5 bg-stone-100/30 text-xs font-medium border-b border-stone-200/30">
            <button
              onClick={() => setShowOriginalText(!showOriginalText)}
              className="flex-1 flex items-center justify-between text-left cursor-pointer text-[11px] text-stone-500 font-mono border-0 bg-transparent"
            >
              <span>⚡ {showOriginalText ? "Свернуть источник" : "Показать источник VK/TG"} ({originalText.length} симв.)</span>
              <span>{showOriginalText ? "▲" : "▼"}</span>
            </button>
            <button
              onClick={() => {
                setTempOriginalText(originalText);
                setIsEditingOriginalModal(true);
              }}
              className="ml-2 text-[10px] text-stone-600 hover:text-stone-900 font-bold font-mono cursor-pointer transition-colors border-0 bg-transparent"
              title="Править текст парсера"
            >
              [Изменить]
            </button>
          </div>
          {showOriginalText && (
            <div className="p-3 bg-stone-50/40 text-[11px] text-stone-605 text-stone-650 leading-relaxed font-sans whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar text-left select-text">
              {originalText}
            </div>
          )}
        </div>
      )}

      {/* Модальное окно редактирования первоисточника */}
      <AnimatePresence>
        {isEditingOriginalModal && (
          <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingOriginalModal(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]"
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] z-10"
            >
              <div className="p-5 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-950">Редактирование первоначального текста</h3>
                  <p className="text-[11px] text-stone-400 font-mono mt-0.5">Товар ID: {productId}</p>
                </div>
                <button
                  onClick={() => setIsEditingOriginalModal(false)}
                  className="text-stone-400 hover:text-stone-800 p-1 cursor-pointer border-0 bg-transparent"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 space-y-3">
                <span className="block text-[11px] uppercase tracking-wider font-bold text-stone-400 font-mono text-left">Исходный текст VK</span>
                <textarea
                  value={tempOriginalText}
                  onChange={(e) => setTempOriginalText(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-stone-700 font-sans leading-relaxed h-72 focus:outline-none focus:ring-1 focus:ring-stone-400 text-left"
                />
                <p className="text-[10px] text-stone-405 text-stone-400 leading-relaxed font-sans mt-2 text-left">
                  Изменение первоначального текста требуется для удаления мусорных ссылок, лишних веток или ошибочных цен. Это влияет на подсчет отклонений от парсера («Изменено»).
                </p>
              </div>
              <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-end gap-2 font-mono">
                <button
                  onClick={() => setIsEditingOriginalModal(false)}
                  className="px-4 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-605 hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    setIsEditingOriginalModal(false);
                    onSaveOriginalText(tempOriginalText);
                  }}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-850 border border-stone-900 rounded-xl text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Сохранить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
