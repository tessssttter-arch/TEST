/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Панель фильтров и кастомизации колонок таблицы. Содержит поиск, управление датами, лимиты цен и переключатели колонок.
// Все комментарии написаны на русском языке.

import React, { useState } from 'react';
import { Search, SlidersHorizontal, RotateCcw, Columns, Star, CheckSquare, Square } from 'lucide-react';
import { usePostsStore } from '../../hooks/use-posts-store';
import { EXPORT_COLUMNS_MAP } from '../../lib/csv-exporter';

export const TableToolbar: React.FC = () => {
  const {
    filters,
    updateFilters,
    resetFilters,
    visibleColumns,
    updateVisibleColumns,
    filteredPosts,
    posts,
  } = usePostsStore();

  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState<boolean>(false);

  // Возможные для переключения колонки интерфейса
  const columnsList = [
    { key: 'favorite', label: 'Избранное ⭐' },
    { key: 'thumbnail', label: 'Превью фото 📸' },
    { key: 'author', label: 'Автор 👤' },
    { key: 'text', label: 'Текст поста 📝' },
    { key: 'price_original', label: 'Ориг. цена (₽)' },
    { key: 'price_edited', label: 'Итоговая цена (₽)' },
    { key: 'metrics', label: 'Метрики 📊' },
    { key: 'date', label: 'Дата публикации 📅' },
    { key: 'exported', label: 'Отметка выгрузки 📤' },
  ];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFilters({ searchQuery: e.target.value });
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFilters({ dateFrom: e.target.value });
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFilters({ dateTo: e.target.value });
  };

  const handleMinLikesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    updateFilters({ minLikes: isNaN(val) ? 0 : val });
  };

  const handlePriceMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFilters({ priceMin: e.target.value });
  };

  const handlePriceMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFilters({ priceMax: e.target.value });
  };

  const handleOnlyFavoritesToggle = () => {
    updateFilters({ onlyFavorites: !filters.onlyFavorites });
  };

  const handleOnlyNotExportedToggle = () => {
    updateFilters({ onlyNotExported: !filters.onlyNotExported });
  };

  const toggleColumn = (colKey: string) => {
    if (visibleColumns.includes(colKey)) {
      // Всегда оставляем хотя бы одну колонку
      if (visibleColumns.length > 1) {
        updateVisibleColumns(visibleColumns.filter((c) => c !== colKey));
      }
    } else {
      updateVisibleColumns([...visibleColumns, colKey]);
    }
  };

  // Проверяем, активен ли хотя бы один фильтр
  const isAnyFilterActive =
    filters.searchQuery !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.minLikes > 0 ||
    filters.priceMin !== '' ||
    filters.priceMax !== '' ||
    filters.onlyFavorites ||
    filters.onlyNotExported;

  return (
    <div id="table-toolbar" className="space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xs">
      {/* Главная строка: Поиск + Переключатель расширенного поиска + Выбор колонок */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Поле поиска */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="search-input"
            type="text"
            value={filters.searchQuery}
            onChange={handleSearchChange}
            placeholder="Поиск по описанию, хештегам, имени автора или ID..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 outline-hidden transition-all"
          />
        </div>

        {/* Кнопки управления */}
        <div className="flex items-center gap-2">
          {/* Расширенные фильтры */}
          <button
            id="toggle-advanced-filters"
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              showAdvanced || isAnyFilterActive
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-900 dark:text-indigo-400'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-850 dark:text-slate-300'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>Фильтры</span>
            {isAnyFilterActive && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>
            )}
          </button>

          {/* Настройка колонок */}
          <div className="relative">
            <button
              id="columns-menu-toggle"
              type="button"
              onClick={() => {
                setShowColumnDropdown(!showColumnDropdown);
                // Закрываем другой попап при открытии
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition-all cursor-pointer"
            >
              <Columns size={14} />
              Вид колонок
            </button>

            {showColumnDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColumnDropdown(false)}></div>
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl shadow-lg z-20 p-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                    Показывать колонки:
                  </p>
                  <div className="space-y-0.5 max-h-64 overflow-y-auto">
                    {columnsList.map((col) => {
                      const isVisible = visibleColumns.includes(col.key);
                      return (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() => toggleColumn(col.key)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900 transition-all text-left cursor-pointer"
                        >
                          <span>{col.label}</span>
                          {isVisible ? (
                            <CheckSquare size={14} className="text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square size={14} className="text-slate-300 dark:text-slate-700" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Сброс фильтров */}
          {isAnyFilterActive && (
            <button
              id="reset-filters"
              type="button"
              onClick={resetFilters}
              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg border border-rose-200 dark:border-rose-900/30 transition-all cursor-pointer"
              title="Сбросить все фильтры"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Панель расширенных фильтров */}
      {showAdvanced && (
        <div id="advanced-filters-panel" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-850 bg-slate-50/40 dark:bg-slate-900/10 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* По датам */}
          <div className="space-y-4 sm:col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Диапазон дат публикации
            </label>
            <div className="flex items-center gap-2">
              <input
                id="filter-date-from"
                type="date"
                value={filters.dateFrom}
                onChange={handleDateFromChange}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 outline-hidden"
              />
              <span className="text-xs text-slate-400">—</span>
              <input
                id="filter-date-to"
                type="date"
                value={filters.dateTo}
                onChange={handleDateToChange}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 outline-hidden"
              />
            </div>
          </div>

          {/* Диапазон цен */}
          <div className="space-y-4">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Стоимость товара (₽)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="filter-price-min"
                type="number"
                placeholder="от"
                value={filters.priceMin}
                onChange={handlePriceMinChange}
                className="w-1/2 px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 outline-hidden"
              />
              <span className="text-xs text-slate-400">—</span>
              <input
                id="filter-price-max"
                type="number"
                placeholder="до"
                value={filters.priceMax}
                onChange={handlePriceMaxChange}
                className="w-1/2 px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 outline-hidden"
              />
            </div>
          </div>

          {/* Быстрые переключатели / Минимальные интеракции */}
          <div className="space-y-4">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Порог вовлеченности
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Мин. лайков:</span>
              <input
                id="filter-min-likes"
                type="number"
                value={filters.minLikes || ''}
                onChange={handleMinLikesChange}
                placeholder="0"
                min="0"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 outline-hidden"
              />
            </div>
          </div>

          {/* Чекбоксы (Только избранное, только невыгруженное) */}
          <div className="sm:col-span-2 md:col-span-4 flex flex-wrap gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-1">
            <button
              type="button"
              onClick={handleOnlyFavoritesToggle}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                filters.onlyFavorites
                  ? 'bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-400'
                  : 'bg-slate-50 border border-slate-100 dark:bg-slate-900/40 dark:border-slate-850 hover:bg-slate-100/50 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Star size={13} fill={filters.onlyFavorites ? 'currentColor' : 'none'} className="text-amber-500" />
              Только избранные
            </button>

            <button
              type="button"
              onClick={handleOnlyNotExportedToggle}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                filters.onlyNotExported
                  ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900 dark:text-indigo-400'
                  : 'bg-slate-50 border border-slate-100 dark:bg-slate-900/40 dark:border-slate-850 hover:bg-slate-100/50 text-slate-600 dark:text-slate-400'
              }`}
            >
              📤
              Скрыть выгруженные
            </button>
            
            <div className="ml-auto text-[11px] text-slate-400 font-medium py-1">
              Найдено: <strong className="text-slate-700 dark:text-slate-300">{filteredPosts.length}</strong> из {posts.length} постов
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
