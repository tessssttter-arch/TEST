/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { getTagColor } from '../types';
import { normalizeTag } from '../utils/tag-normalizer';
import { useLongPress } from '../hooks/useLongPress';
import { Tag, Layers, Hash, Sparkles, SlidersHorizontal, Plus, Trash2, Check, RefreshCw } from 'lucide-react';

interface TagNode {
  label: string;
  count: number;
  isActive: boolean;
  colorClass: string;
  fontSizeClass: string;
}

interface TagCloudButtonProps {
  node: TagNode;
  onClick: () => void;
  onContextMenu: (e: any) => void;
}

const TagCloudButton: React.FC<TagCloudButtonProps> = ({ node, onClick, onContextMenu }) => {
  const longPressProps = useLongPress((e) => {
    onContextMenu(e);
  }, { delay: 600 });

  return (
    <button
      {...longPressProps}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e);
      }}
      title={`Повторений: ${node.count}. Нажмите правой кнопкой или зажмите на мобильном для действий.`}
      className={`flex items-center gap-1.5 border hover:scale-[1.03] transition-all duration-150 cursor-pointer rounded-xl ${node.fontSizeClass} ${node.colorClass}`}
    >
      <Hash className="w-2.5 h-2.5 opacity-55" />
      <span>{node.label}</span>
      <span className="text-[8px] opacity-60 font-mono bg-black/5 px-1 py-0.2 rounded-full leading-none">
        {node.count}
      </span>
    </button>
  );
};

export const TagCategoryCloud: React.FC = () => {
  const {
    products,
    categories,
    tags,
    selectedCategory,
    setSelectedCategory,
    selectedTag,
    setSelectedTag,
    bulkApplyTags,
    showConfirm,
    addToast
  } = useCatalog();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tagLabel: string;
  } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const clickOutside = () => setContextMenu(null);
    window.addEventListener('click', clickOutside);
    window.addEventListener('contextmenu', clickOutside);
    return () => {
      window.removeEventListener('click', clickOutside);
      window.removeEventListener('contextmenu', clickOutside);
    };
  }, [contextMenu]);

  // Вычисление частотности тегов
  const tagNodes = useMemo((): TagNode[] => {
    const freq = new Map<string, number>();
    products.forEach((p) => {
      p.tags?.forEach((t) => {
        const clean = normalizeTag(t);
        if (clean) {
          freq.set(clean, (freq.get(clean) || 0) + 1);
        }
      });
    });

    if (freq.size === 0) return [];

    const counts = Array.from(freq.values());
    const maxCount = Math.max(...counts, 1);
    const minCount = Math.min(...counts, 1);

    return Array.from(freq.entries()).map(([label, count]) => {
      // Логарифмическое или линейное распределение для градаций шрифта (4 размера)
      let fontSizeClass = 'text-[10px] px-2 py-0.5';
      if (maxCount !== minCount) {
        const ratio = (count - minCount) / (maxCount - minCount);
        if (ratio > 0.75) {
          fontSizeClass = 'text-[13px] font-bold px-3 py-1.5';
        } else if (ratio > 0.45) {
          fontSizeClass = 'text-[12px] font-semibold px-2.5 py-1';
        } else if (ratio > 0.15) {
          fontSizeClass = 'text-[11px] font-medium px-2 py-1';
        }
      } else if (count > 5) {
        fontSizeClass = 'text-[12px] font-semibold px-2.5 py-1';
      }

      const isCurrentActive = selectedTag === label;
      const tagColors = getTagColor(label);

      return {
        label,
        count,
        isActive: isCurrentActive,
        colorClass: isCurrentActive ? tagColors.active : tagColors.bg,
        fontSizeClass
      };
    }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [products, selectedTag]);

  // Вычисление частотности категорий
  const categoryFreq = useMemo(() => {
    const freq = new Map<string, number>();
    products.forEach((p) => {
      if (p.group_products) {
        p.group_products.split(',').forEach((c) => {
          const clean = c.trim();
          if (clean) freq.set(clean, (freq.get(clean) || 0) + 1);
        });
      }
    });
    return freq;
  }, [products]);

  const handleTagClick = (label: string) => {
    if (selectedTag === label) {
      setSelectedTag('');
    } else {
      setSelectedTag(label);
    }
  };

  const handleCategoryClick = (cat: string) => {
    if (selectedCategory === cat) {
      setSelectedCategory('');
    } else {
      setSelectedCategory(cat);
    }
  };

  // Метод правого клика (Контекстное меню)
  const handleTagRightClick = (e: React.MouseEvent, tagLabel: string) => {
    e.preventDefault();
    const safeX = Math.min(e.clientX, window.innerWidth - 260); // меню шириной ~242px с запасом
    const safeY = Math.min(e.clientY, window.innerHeight - 200); // меню высотой ~160px с запасом
    setContextMenu({
      x: safeX,
      y: safeY,
      tagLabel
    });
  };

  // Операции массового применения через правый клик
  const applyTagToSelected = () => {
    if (!contextMenu) return;
    const { tagLabel } = contextMenu;
    const selectedIds = products.filter((p) => p.selected).map((p) => p.product_id);

    if (selectedIds.length === 0) {
      addToast('Сначала выделите чекбоксами несколько товаров!', 'info');
      setContextMenu(null);
      return;
    }

    showConfirm({
      title: `Добавить тег к выделенным?`,
      message: `Добавить тег "#${tagLabel}" к ${selectedIds.length} выделенным товарам каталога? Старые теги будут сохранены.`,
      confirmBtnText: 'Применить',
      cancelBtnText: 'Отмена',
      onConfirm: async () => {
        await bulkApplyTags(selectedIds, 'add', [tagLabel]);
      }
    });
    setContextMenu(null);
  };

  const removeTagFromSelected = () => {
    if (!contextMenu) return;
    const { tagLabel } = contextMenu;
    const selectedIds = products.filter((p) => p.selected).map((p) => p.product_id);

    if (selectedIds.length === 0) {
      addToast('Вы выделили 0 товаров!', 'info');
      setContextMenu(null);
      return;
    }

    showConfirm({
      title: `Исключить тег у выделенных?`,
      message: `Убрать тег "#${tagLabel}" у ${selectedIds.length} выделенных товаров?`,
      confirmBtnText: 'Убрать тег',
      cancelBtnText: 'Отмена',
      onConfirm: async () => {
        await bulkApplyTags(selectedIds, 'remove', [tagLabel]);
      }
    });
    setContextMenu(null);
  };

  const deleteTagGlobally = () => {
    if (!contextMenu) return;
    const { tagLabel } = contextMenu;
    const affectedCount = products.filter((p) => p.tags?.includes(tagLabel)).length;

    showConfirm({
      title: `Глобальное удаление тега "#${tagLabel}"?`,
      message: `Вы действительно хотите безвозвратно стереть тег "#${tagLabel}" у ВСЕХ товаров каталога (${affectedCount} шт.)?`,
      confirmBtnText: 'Удалить глобально',
      cancelBtnText: 'Отмена',
      onConfirm: async () => {
        const affectedIds = products.filter((p) => p.tags?.includes(tagLabel)).map((p) => p.product_id);
        await bulkApplyTags(affectedIds, 'remove', [tagLabel]);
        addToast(`Тег "#${tagLabel}" стёрт у всех товаров базы!`, 'success');
      }
    });
    setContextMenu(null);
  };

  // Закрытие по нажатию в пустую область
  React.useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  return (
    <div
      id="tag-category-cloud-container"
      className="bg-white border border-stone-200 rounded-2xl p-4 md:p-5 shadow-xs space-y-4 text-left"
    >
      <div className="flex flex-col lg:flex-row gap-5">
        
        {/* КАТЕГОРИИ КАРТОЧКИ */}
        <div className="lg:w-1/3 border-r border-stone-100 lg:pr-5 shrink-0">
          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-stone-400 flex items-center gap-1.5 mb-3 select-none">
            <Layers className="w-3.5 h-3.5 text-stone-500" />
            Быстрый выбор категории
          </span>
          <div className="flex flex-wrap lg:flex-col gap-1.5 max-h-[160px] lg:max-h-[220px] overflow-y-auto pr-1 select-none scrollbar-none">
            {categories.map((cat) => {
              const count = categoryFreq.get(cat) || 0;
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryClick(cat)}
                  className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border text-left cursor-pointer transition-all ${
                    isActive
                      ? "bg-stone-900 border-stone-900 text-white font-bold"
                      : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100/70"
                  }`}
                >
                  <span className="truncate">{cat}</span>
                  <span className={`text-[9px] font-mono ml-2 px-1.5 py-0.5 rounded ${
                    isActive ? "bg-white/20 text-white" : "bg-stone-200/50 text-stone-500"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
            {categories.length === 0 && (
              <span className="text-[10.5px] font-mono text-stone-400 italic">Сводка категорий пуста</span>
            )}
          </div>
        </div>

        {/* ОБЛАКО ТЕГОВ */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3 select-none">
            <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-stone-400 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-stone-500" />
              Интерактивное облако тегов (Правый клик для пакетных действий)
            </span>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag('')}
                className="text-[10px] font-mono font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 border-0 bg-transparent cursor-pointer"
              >
                Сбросить тег #{selectedTag} &times;
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 items-center content-start max-h-[160px] lg:max-h-[220px] overflow-y-auto pr-1 scrollbar-none py-1">
            {tagNodes.map((node) => (
              <TagCloudButton
                key={node.label}
                node={node}
                onClick={() => handleTagClick(node.label)}
                onContextMenu={(e) => handleTagRightClick(e, node.label)}
              />
            ))}
            {tagNodes.length === 0 && (
              <div className="col-span-full py-6 text-center w-full">
                <span className="text-xl block mb-1">🏷️</span>
                <span className="text-[10.5px] font-mono text-stone-400">Кураторские теги отсутствуют. Отредактируйте теги в карточках или импортируйте каталог.</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Выплывающее контекстное меню для правого клика */}
      {contextMenu && (
        <div
          className="fixed z-[10000] bg-stone-900 text-stone-100 rounded-xl shadow-2xl border border-stone-800 p-1.5 w-64 text-xs font-sans animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-stone-800 text-[10px] font-mono uppercase tracking-wider text-stone-400 font-bold">
            Тег: #{contextMenu.tagLabel}
          </div>
          <button
            onClick={applyTagToSelected}
            className="w-full text-left bg-transparent hover:bg-stone-800 py-2 px-3 rounded-lg flex items-center gap-2 cursor-pointer border-0 text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Применить к выбранным ({products.filter(p => p.selected).length} шт.)</span>
          </button>
          
          <button
            onClick={removeTagFromSelected}
            className="w-full text-left bg-transparent hover:bg-stone-800 py-2 px-3 rounded-lg flex items-center gap-2 cursor-pointer border-0 text-white transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-450 text-rose-450 text-rose-400" />
            <span>Убрать у выбранных ({products.filter(p => p.selected).length} шт.)</span>
          </button>

          <div className="h-px bg-stone-800 my-1" />

          <button
            onClick={deleteTagGlobally}
            className="w-full text-left bg-transparent hover:bg-rose-950/40 py-2 px-3 rounded-lg flex items-center gap-2 cursor-pointer border-0 text-rose-400 hover:text-white transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            <span className="font-semibold">Стереть у всех товаров БД</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default TagCategoryCloud;
