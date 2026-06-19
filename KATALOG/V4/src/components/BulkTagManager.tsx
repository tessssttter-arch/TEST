/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { normalizeTag } from '../utils/tag-normalizer';
import { Tag, HelpCircle, Plus, Trash2, RefreshCw, AlertTriangle, CheckSquare, ListFilter, Archive } from 'lucide-react';

export const BulkTagManager: React.FC = () => {
  const {
    products,
    filteredProducts,
    bulkApplyTags,
    showConfirm,
    addToast
  } = useCatalog();

  const [targetScope, setTargetScope] = useState<'selected' | 'filtered' | 'all'>('selected');
  const [tagOperation, setTagOperation] = useState<'add' | 'remove' | 'replace'>('add');
  const [rawTagsInput, setRawTagsInput] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Парсинг введенных тегов из инпута
  const parsedTagsList = useMemo(() => {
    return rawTagsInput
      .split(',')
      .map(normalizeTag)
      .filter((t) => t.length > 0);
  }, [rawTagsInput]);

  // Выгружаем товары, которые попадут под действие операции
  const affectedProducts = useMemo(() => {
    switch (targetScope) {
      case 'selected':
        return products.filter((p) => p.selected);
      case 'filtered':
        return filteredProducts;
      case 'all':
        return products;
      default:
        return [];
    }
  }, [products, filteredProducts, targetScope]);

  // Вычисление диффа "До -> После" для превью
  const previewDiffs = useMemo(() => {
    if (parsedTagsList.length === 0 || affectedProducts.length === 0) return [];

    return affectedProducts.slice(0, 15).map((p) => {
      const oldTags = p.tags || [];
      let newTags = [...oldTags];

      if (tagOperation === 'add') {
        newTags = Array.from(new Set([...oldTags, ...parsedTagsList]));
      } else if (tagOperation === 'remove') {
        newTags = oldTags.filter((t) => !parsedTagsList.includes(t));
      } else {
        newTags = [...parsedTagsList];
      }

      return {
        id: p.product_id,
        image: p.main_image,
        description: p.description,
        oldTags,
        newTags
      };
    });
  }, [affectedProducts, parsedTagsList, tagOperation]);

  const handleApplyBulkTags = () => {
    if (affectedProducts.length === 0) {
      addToast('Выборка товаров пуста! Не к чему применить операцию.', 'error');
      return;
    }
    if (parsedTagsList.length === 0) {
      addToast('Укажите список тегов для обработки через запятую!', 'info');
      return;
    }

    const opText = tagOperation === 'add' ? 'добавить' : tagOperation === 'remove' ? 'удалить' : 'перезаписать';
    const warning = tagOperation === 'replace' ? '\n⚠️ ВНИМАНИЕ: Все старые теги выбранных товаров будут полностью стерты!' : '';

    showConfirm({
      title: `Массовое редактирование тегов?`,
      message: `Вы действительно хотите ${opText} теги [${parsedTagsList.join(', ')}] в ${affectedProducts.length} карточках?${warning}`,
      confirmBtnText: 'Утвердить и записать',
      cancelBtnText: 'Отмена',
      onConfirm: async () => {
        const targetIds = affectedProducts.map((p) => p.product_id);
        await bulkApplyTags(targetIds, tagOperation, parsedTagsList);
        setSuccessMsg(`Успешно обработано ${affectedProducts.length} товаров!`);
        setRawTagsInput('');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    });
  };

  return (
    <div id="bulk-tag-manager" className="bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden h-full flex flex-col justify-between">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-left flex-1 overflow-auto">
        
        {/* Левая панель параметров массовых операций */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-400 font-bold" />
                Групповой диспетчер тегов
              </h2>
              <p className="text-stone-400 text-[10px] uppercase font-mono mt-0.5">Управление тегами товарного ряда в одно касание.</p>
            </div>

            {/* 1. Диапазон действия */}
            <div className="space-y-1.5">
              <span className="block text-[10px] font-mono tracking-wider font-bold text-stone-400 uppercase">1. Область воздействия</span>
              <div className="grid grid-cols-3 gap-2 select-none font-sans">
                <button
                  type="button"
                  onClick={() => setTargetScope('selected')}
                  className={`flex flex-col items-center gap-1.5 px-3 py-2 border rounded-xl text-center transition-all cursor-pointer ${
                    targetScope === 'selected'
                      ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md'
                      : 'bg-stone-800/40 border-stone-800 text-stone-400 hover:bg-stone-800'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold">Выделенные ({products.filter((p) => p.selected).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetScope('filtered')}
                  className={`flex flex-col items-center gap-1.5 px-3 py-2 border rounded-xl text-center transition-all cursor-pointer ${
                    targetScope === 'filtered'
                      ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md'
                      : 'bg-stone-800/40 border-stone-800 text-stone-400 hover:bg-stone-800'
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold">Отфильтровано ({filteredProducts.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetScope('all')}
                  className={`flex flex-col items-center gap-1.5 px-3 py-2 border rounded-xl text-center transition-all cursor-pointer ${
                    targetScope === 'all'
                      ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md'
                      : 'bg-stone-800/40 border-stone-800 text-stone-400 hover:bg-stone-800'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold">Всего в базе ({products.length})</span>
                </button>
              </div>
            </div>

            {/* 2. Тип пакетной операции */}
            <div className="space-y-1.5">
              <span className="block text-[10px] font-mono tracking-wider font-bold text-stone-400 uppercase">2. Тип пакетной операции</span>
              <div className="grid grid-cols-3 gap-2 select-none font-sans">
                <button
                  type="button"
                  onClick={() => setTagOperation('add')}
                  className={`py-2 px-2 border rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    tagOperation === 'add'
                      ? 'bg-emerald-600/15 border-emerald-500 text-emerald-450 text-white'
                      : 'bg-stone-800/40 border-stone-800 text-stone-400 hover:bg-stone-800'
                  }`}
                >
                  ➕ Добавить теги
                </button>
                <button
                  type="button"
                  onClick={() => setTagOperation('remove')}
                  className={`py-2 px-2 border rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    tagOperation === 'remove'
                      ? 'bg-rose-600/15 border-rose-500 text-rose-300'
                      : 'bg-stone-800/40 border-stone-800 text-stone-400 hover:bg-stone-800'
                  }`}
                >
                  ➖ Удалить теги
                </button>
                <button
                  type="button"
                  onClick={() => setTagOperation('replace')}
                  className={`py-2 px-2 border rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    tagOperation === 'replace'
                      ? 'bg-amber-600/15 border-amber-500 text-amber-300'
                      : 'bg-stone-800/40 border-stone-800 text-stone-400 hover:bg-stone-800'
                  }`}
                >
                  🔄 Заменить все
                </button>
              </div>
            </div>

            {/* 3. Поле ввода тегов */}
            <div>
              <label className="text-[10px] font-mono tracking-wider text-stone-400 uppercase font-bold flex items-center gap-1">
                3. Список тегов для применения (Через запятую)
              </label>
              <input
                type="text"
                placeholder="кроссовки, весна, оригинал, adidas..."
                className="w-full text-xs font-mono bg-stone-950 border border-stone-850 rounded-xl p-3 text-white placeholder-stone-700 mt-1 focus:outline-none focus:ring-1 focus:ring-stone-600"
                value={rawTagsInput}
                onChange={(e) => setRawTagsInput(e.target.value)}
              />
              <span className="text-[9.5px] font-mono text-stone-500 mt-1 block">
                Будет обработано тегов: <strong className="text-stone-300">{parsedTagsList.length}</strong> (Дубликаты отсекаются автоматически).
              </span>
            </div>

            {tagOperation === 'replace' && (
              <div className="bg-amber-950/40 border border-amber-900/50 text-amber-300 text-[11px] p-3 rounded-xl flex items-start gap-2 select-none leading-normal">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-550 mr-1" />
                <div>
                  <span className="font-bold text-amber-200">Перезапись тегов!</span>
                  <p className="text-[9.5px] text-amber-400 font-mono mt-0.5 leading-normal">Действие полностью сотрет прежний список тегов у {affectedProducts.length} товаров и сохранит новые.</p>
                </div>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-950/40 border border-emerald-850 text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2 select-none h-10 shrink-0">
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={parsedTagsList.length === 0 || affectedProducts.length === 0}
            onClick={handleApplyBulkTags}
            className="w-full h-11 bg-stone-100 hover:bg-stone-200 disabled:opacity-30 text-stone-900 font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer font-sans border-0"
          >
            <RefreshCw className="w-4 h-4 text-stone-900 animate-spin-hover" />
            <span>Выполнить изменения у {affectedProducts.length} карточек</span>
          </button>
        </div>

        {/* Правая split-колонка Живого Diff превью */}
        <div className="lg:col-span-7 bg-stone-950 border border-stone-900 p-4 rounded-xl flex flex-col overflow-hidden min-h-[250px]">
          <div className="flex items-center justify-between border-b border-stone-900 pb-2 mb-2 shrink-0 select-none">
            <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest font-bold flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-indigo-400" />
              Живой Diff-аудит тегов (Первые 15 позиций)
            </span>
            <span className="text-[9.5px] font-mono bg-stone-900 border border-stone-850 px-2 py-0.5 rounded text-stone-300">
              Выборка: {affectedProducts.length} поз.
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            {parsedTagsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-stone-600 h-full py-12 select-none text-center">
                <Tag className="w-8 h-8 mb-2 opacity-30 animate-pulse" />
                <span className="text-[10px] font-mono">Введите список тегов слева, чтобы включить просмотр Diff-изменений...</span>
              </div>
            ) : affectedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-amber-500/40 text-xs h-full text-center py-12 select-none">
                <AlertTriangle className="w-6 h-6 mr-1 opacity-40 mb-1" />
                <span className="text-[10.5px] font-mono">Не выбрано ни одной карточки под заданную область в пункте "1"!</span>
              </div>
            ) : (
              <div className="space-y-3.5 text-left animate-fade-in pr-0.5">
                {previewDiffs.map((diff, idx) => (
                  <div key={idx} className="text-[10.5px] font-mono border-b border-stone-900 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-stone-500 mb-1.5 font-bold">
                      <div className="flex items-center gap-2 truncate max-w-[70%]">
                        <img src={diff.image} alt="" className="w-5 h-5 object-cover rounded bg-stone-800" referrerPolicy="no-referrer" />
                        <span className="truncate text-stone-300">ID: {diff.id} ({diff.description})</span>
                      </div>
                      <span className="text-emerald-500 uppercase font-bold text-[9.5px] shrink-0">модификация</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 font-mono text-[10px]">
                      {/* До */}
                      <div className="bg-stone-900/50 p-2 rounded text-stone-500 text-left">
                        <span className="text-[8px] uppercase text-stone-600 font-bold block mb-1">Ранее:</span>
                        {diff.oldTags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {diff.oldTags.map(t => <span key={t} className="bg-stone-950 px-1 py-0.2 rounded">#{t}</span>)}
                          </div>
                        ) : (
                          <span className="italic text-stone-700">нет тегов</span>
                        )}
                      </div>

                      {/* После */}
                      <div className="bg-emerald-950/15 p-2 rounded border border-emerald-950/20 text-emerald-400 text-left">
                        <span className="text-[8px] uppercase text-emerald-600 font-bold block mb-1">Станет:</span>
                        {diff.newTags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {diff.newTags.map(t => <span key={t} className="bg-emerald-900/25 text-emerald-300 px-1 py-0.2 rounded">#{t}</span>)}
                          </div>
                        ) : (
                          <span className="italic text-emerald-700/50">теги удалены</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
export default BulkTagManager;
