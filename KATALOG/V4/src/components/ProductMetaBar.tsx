/**
 * Компонент управления метаданными товара (ProductMetaBar).
 * Управляет размерной сеткой куратора, сопоставлением изменений с парсером,
 * а также коллекцией тегов с подсказками категорий (Хит, Скидка, Люкс, Опт и др.).
 */

import React, { useState } from 'react';
import { Tag, AlertCircle, X, Plus } from 'lucide-react';
import { getTagColor } from '../types';

interface ProductMetaBarProps {
  productId: string;
  sizes: string[];
  sizesOriginal: string[];
  tags: string[];
  onUpdateSizes: (newSizes: string[]) => void;
  onUpdateTags: (newTags: string[]) => void;
  viewMode?: 'grid' | 'list';
}

export const ProductMetaBar: React.FC<ProductMetaBarProps> = ({
  productId,
  sizes,
  sizesOriginal,
  tags,
  onUpdateSizes,
  onUpdateTags,
  viewMode = 'list',
}) => {
  const [sizeInput, setSizeInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const checkIfSizesDiffer = (cur: string[], orig: string[]) => {
    if (!cur || !orig) return true;
    if (cur.length !== orig.length) return true;
    const sortedCur = [...cur].sort();
    const sortedOrig = [...orig].sort();
    return !sortedCur.every((val, index) => val === sortedOrig[index]);
  };

  const areSizesModified = checkIfSizesDiffer(sizes, sizesOriginal);

  const handleRemoveSize = (sizeToRemove: string) => {
    const nextSizes = sizes.filter((s) => s !== sizeToRemove);
    onUpdateSizes(nextSizes);
  };

  const handleAddSize = (e: React.FormEvent) => {
    e.preventDefault();
    const newParsedSizes = sizeInput
      .split(/[,/\\\s\-\u2013\u2014]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    if (newParsedSizes.length > 0) {
      const updatedSizes = Array.from(new Set([...sizes, ...newParsedSizes]));
      onUpdateSizes(updatedSizes);
      setSizeInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = newTagInput.trim();
    if (cleanTag) {
      if (!tags.includes(cleanTag)) {
        onUpdateTags([...tags, cleanTag]);
      }
      setNewTagInput('');
      setIsAddingTag(false);
    }
  };

  if (viewMode === 'grid') {
    return (
      <div className="space-y-2 pt-2 border-t border-stone-100 text-left">
        {/* Краткая размерная сетка для сетки */}
        <div className="flex flex-wrap items-center gap-1 select-none text-left">
          {areSizesModified && (
            <span className="text-[9.5px] text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded font-bold font-sans animate-pulse" title="Размеры изменены">
              ≠
            </span>
          )}
          {sizes.slice(0, 4).map((sz, szIdx) => (
            <span key={szIdx} className="text-[9.5px] font-mono font-semibold bg-stone-100 text-stone-700 px-1 py-0.5 rounded border border-stone-150">
              {sz}
            </span>
          ))}
          {sizes.length > 4 && (
            <span className="text-[9px] font-mono text-stone-400">+{sizes.length - 4}</span>
          )}
        </div>

        {/* Теги для сетки */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 select-none">
            {tags.slice(0, 2).map((tg, idx) => {
              const color = getTagColor(tg);
              return (
                <span key={idx} className={`text-[8.5px] font-semibold tracking-tight px-1.5 py-0.5 rounded border ${color.bg}`}>
                  #{tg}
                </span>
              );
            })}
            {tags.length > 2 && (
              <span className="text-[8.5px] text-stone-400">+{tags.length - 2}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-stone-100 pt-4 flex flex-col xl:flex-row xl:items-start justify-between gap-4 select-none">
      {/* Сетка размеров с компаративным анализом */}
      <div className="space-y-1.5 flex-1 select-none text-left">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block">Размеры в наличии</span>
          {areSizesModified && (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold font-sans border border-amber-100 animate-fade-in">
              <AlertCircle className="w-3.5 h-3.5" />
              Отличаются
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {sizes.map((sz, idx) => (
            <span 
              key={idx} 
              className="inline-flex items-center gap-1 font-mono text-xs font-semibold bg-stone-100 text-stone-800 border border-stone-200 px-2 py-0.5 rounded-md"
            >
              {sz}
              <button 
                onClick={() => handleRemoveSize(sz)}
                className="hover:bg-stone-200 text-stone-400 hover:text-stone-805 rounded p-0.5 ml-0.5 transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          <form onSubmit={handleAddSize} className="flex items-center">
            <input
              type="text"
              placeholder="+Размер"
              className="w-16 text-center font-mono text-xs border border-stone-200 bg-stone-50 rounded pl-1 pr-1 py-0.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-805 text-stone-800"
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
            />
          </form>
        </div>
        
        {/* Сопоставление с оригинальной парсеной сеткой */}
        {areSizesModified && (
          <div className="text-[9.5px] font-mono text-stone-400 pt-1 flex items-center gap-1.5 animate-fade-in">
            <span className="text-stone-500 font-bold block">Оригинал:</span>
            <div className="flex flex-wrap gap-1">
              {sizesOriginal.map((origS, oIdx) => {
                const wasRemoved = !sizes.includes(origS);
                return (
                  <span 
                    key={oIdx} 
                    className={`px-1 rounded border ${
                      wasRemoved 
                        ? "bg-rose-50 text-rose-500 line-through border-rose-100" 
                        : "bg-stone-50 text-stone-505 border-stone-100"
                    }`}
                  >
                    {origS}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Модераторские теги решения */}
      <div className="space-y-1.5 flex-1 text-left">
        <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block flex items-center gap-1">
          <Tag className="w-3 h-3 text-stone-400" /> Теги кодирования
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((tg, idx) => {
            const color = getTagColor(tg);
            return (
              <span 
                key={idx} 
                className={`inline-flex items-center gap-1 text-[10px] font-semibold border px-2 py-0.5 rounded-full ${color.bg}`}
              >
                #{tg}
                <button 
                  onClick={() => handleRemoveTag(tg)}
                  className="hover:opacity-85 rounded p-0.5 ml-0.5 transition-opacity cursor-pointer flex items-center justify-center border-0 bg-transparent text-stone-500 hover:text-stone-800"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })}

          {isAddingTag ? (
            <form onSubmit={handleAddTag} className="flex items-center gap-1 animate-fade-in">
              <input
                id={`tag-input-${productId}`}
                type="text"
                placeholder="Новый тег"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                className="bg-white border border-stone-200 text-stone-800 px-1.5 py-0.5 text-xs rounded focus:outline-none focus:ring-1 focus:ring-stone-400 w-24 font-mono text-[11px]"
                list={`tag-suggestions-${productId}`}
                autoFocus
              />
              <datalist id={`tag-suggestions-${productId}`}>
                <option value="🔥 Хит" />
                <option value="⚠️ Дорого" />
                <option value="🌸 Скидка" />
                <option value="💎 Люкс" />
                <option value="📦 Опт" />
                <option value="Новинка" />
              </datalist>
              <button
                type="submit"
                className="bg-stone-900 border border-stone-900 text-white p-1 rounded hover:bg-stone-850 transition-colors cursor-pointer flex items-center justify-center h-6 w-6"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsAddingTag(false)}
                type="button"
                className="bg-stone-100 text-stone-505 p-1 border border-stone-200 rounded hover:bg-stone-200 transition-colors cursor-pointer flex items-center justify-center h-6 w-6"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingTag(true)}
              className="inline-flex items-center gap-1 bg-white hover:bg-stone-50 text-stone-500 px-2.5 py-0.5 rounded-md text-[11px] border border-stone-200 cursor-pointer transition-colors font-medium font-mono"
            >
              + тег
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
