/**
 * Панель групповых операций по каталогу (BulkActionsPanel).
 * Реализует групповую наценку или фиксированную убавку цен, сброс правок,
 * выделение диапазона товаров и мгновенные безопасные удаления с подтверждением.
 * Интегрирована со стором и модальными Confirm-диалогами (Рекомендации №1 и №7).
 */

import React, { useState } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { CheckSquare, Square, Star, RefreshCcw, Trash2, ArrowUpRight, Percent, DollarSign } from 'lucide-react';

export const BulkActionsPanel: React.FC = () => {
  const {
    products,
    filteredProducts,
    toggleSelectAll,
    toggleStarAll,
    bulkApplyPriceAdjustment,
    resetAllEdits,
    deleteSelected,
    showConfirm,
  } = useCatalog();

  const [priceInput, setPriceInput] = useState<string>('500');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'percent'>('add');

  const selectedProducts = products.filter((p) => p.selected);
  const selectedCount = selectedProducts.length;
  const isAllSelected = filteredProducts.length > 0 && filteredProducts.every((p) => p.selected);
  const totalModifiedCount = products.filter(p => p.is_modified).length;

  // Безопасный сброс всех кураторских изменений
  const handleResetClick = () => {
    showConfirm({
      title: 'Сбросить все кураторские правки?',
      message: `Вы действительно хотите отменить все ручные изменения цен, описаний и размерных рядов для ${totalModifiedCount} измененных товаров? Исходные значения будут полностью восстановлены.`,
      confirmBtnText: 'Сбросить правки',
      cancelBtnText: 'Отмена',
      onConfirm: async () => {
        await resetAllEdits();
      }
    });
  };

  // Безопасное удаление выделенной куратором пачки
  const handleDeleteClick = () => {
    showConfirm({
      title: 'Удалить выделенные товары?',
      message: `Вы действительно хотите безвозвратно стереть ${selectedCount} товаров из локальной базы данных IndexedDB? Исходники не сохранятся!`,
      confirmBtnText: 'Да, удалить товары',
      cancelBtnText: 'Отмена',
      onConfirm: async () => {
        await deleteSelected();
      }
    });
  };

  // Метод запуска групповой наценки
  const handleApplyPrice = () => {
    const amount = Number(priceInput);
    if (isNaN(amount) || amount === 0) return;
    
    const modifierText = adjustmentType === 'add' ? `+${amount} ₽` : `+${amount}%`;
    showConfirm({
      title: 'Наценить выбранные товары?',
      message: `Будет применена пакетная переоценка в размере ${modifierText} для всех ${selectedCount} выделенных товаров.`,
      confirmBtnText: 'Переоценить',
      cancelBtnText: 'Отмена',
      onConfirm: async () => {
        await bulkApplyPriceAdjustment(amount, adjustmentType);
      }
    });
  };

  if (filteredProducts.length === 0 && selectedCount === 0) {
    return null; // Нет подходящих товаров - панель скрывается
  }

  return (
    <div id="bulk-actions-panel" className="bg-stone-50 border border-stone-200 rounded-2xl p-4 md:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5 select-none font-sans">
      
      {/* Левые кнопки выделения */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          id="select-all-btn"
          onClick={() => toggleSelectAll(!isAllSelected)}
          className={`h-9 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            isAllSelected
              ? "bg-stone-900 border-stone-950 text-white"
              : "bg-white border-stone-250 text-stone-700 hover:bg-stone-100"
          }`}
        >
          {isAllSelected ? (
            <CheckSquare className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4 text-stone-400" />
          )}
          <span>{isAllSelected ? 'Снять выделение со всех' : `Выделить видимые (${filteredProducts.length} шт.)`}</span>
        </button>

        {isAllSelected && (
          <button
            id="bulk-star-all-btn"
            onClick={() => toggleStarAll(true)}
            className="h-9 px-3.5 bg-white border border-stone-250 text-stone-700 hover:bg-stone-100 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all animate-fade-in"
            title="Добавить выделенные товары в избранное"
          >
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            Избранное (все)
          </button>
        )}

        {totalModifiedCount > 0 && (
          <button
            id="bulk-reset-edits-btn"
            onClick={handleResetClick}
            className="h-9 px-3.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-605 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
            title="Откатить все правки к исходникам"
          >
            <RefreshCcw className="w-3.5 h-3.5 text-rose-500 animate-spin-hover" />
            Откатить {totalModifiedCount} правок
          </button>
        )}
      </div>

      {/* Правая часть — Коррекция цен выделенной пачки */}
      {selectedCount > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 bg-white p-3 border border-stone-200 shadow-xs rounded-xl flex-1 max-w-2xl">
          
          <div className="flex items-center gap-2 text-xs font-bold text-stone-600 shrink-0 select-none">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Выбрано: <strong className="text-stone-950 font-mono text-sm pl-0.5">{selectedCount}</strong> поз.</span>
          </div>

          {/* input-регулятор величины наценки */}
          <div className="flex items-center gap-1 flex-1">
            <div className="relative flex-1">
              <input
                id="bulk-price-input"
                type="number"
                className="w-full h-8 pl-8 pr-2 bg-stone-50 border border-stone-250 rounded-lg text-xs font-mono font-bold text-stone-800 focus:bg-white focus:outline-none focus:border-stone-400 transition-all text-center"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="Задать шаг"
              />
              <ArrowUpRight className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            </div>

            {/* Выбор типа (Проценты или Рубли) */}
            <div className="flex bg-stone-100 p-0.5 rounded-lg border border-stone-200 select-none">
              <button
                id="price-type-add"
                type="button"
                onClick={() => setAdjustmentType('add')}
                className={`p-1 rounded-md cursor-pointer transition-colors ${
                  adjustmentType === 'add' 
                    ? "bg-white text-stone-800 shadow-xs" 
                    : "text-stone-400 hover:text-stone-600"
                }`}
                title="В рублях (₽)"
              >
                <DollarSign className="w-3.5 h-3.5" />
              </button>
              <button
                id="price-type-percent"
                type="button"
                onClick={() => setAdjustmentType('percent')}
                className={`p-1 rounded-md cursor-pointer transition-colors ${
                  adjustmentType === 'percent' 
                    ? "bg-white text-stone-800 shadow-xs" 
                    : "text-stone-400 hover:text-stone-600"
                }`}
                title="В процентах (%)"
              >
                <Percent className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="apply-bulk-price-btn"
              onClick={handleApplyPrice}
              className="h-8 px-3 bg-emerald-600 border border-emerald-700 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1 shadow-xs"
            >
              Наценить
            </button>

            <button
              id="bulk-delete-btn"
              onClick={handleDeleteClick}
              className="h-8 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1 shadow-xs"
              title="Безвозвратно стереть выделенные"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Стереть
            </button>
          </div>

        </div>
      ) : (
        <div className="text-stone-400 text-xs font-medium italic select-none text-left lg:text-right">
          💡 Выберите товары чекбоксами для пакетной переоценки или удаления.
        </div>
      )}

    </div>
  );
};
