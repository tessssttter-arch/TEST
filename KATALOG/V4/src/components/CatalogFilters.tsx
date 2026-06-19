/**
 * Панель фильтров каталога (CatalogFilters).
 * Осуществляет полнотекстовый поиск, селекторы категорий/тегов и переключатели «Избранное», «Правка», «Выделено».
 * Полноценно извлекает стейт из CatalogContext и заменяет тонны кода в App.tsx (Рекомендация №1).
 */

import React from 'react';
import { useCatalog } from '../context/CatalogContext';
import { Search, LayoutGrid, List, SlidersHorizontal, Star, Edit3, CheckSquare, X } from 'lucide-react';

export const CatalogFilters: React.FC = () => {
  const {
    products,
    categories,
    tags,
    
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedTag,
    setSelectedTag,
    viewMode,
    setViewMode,
    
    sortBy,
    setSortBy,
    pageSize,
    setPageSize,
    
    showStarredOnly,
    setShowStarredOnly,
    showModifiedOnly,
    setShowModifiedOnly,
    showSelectedOnly,
    setShowSelectedOnly,
  } = useCatalog();

  // Специфичный флаг активных фильтров для показа кнопки быстрого сброса
  const hasActiveFilters = searchQuery.trim() !== '' || 
                           selectedCategory !== '' || 
                           selectedTag !== '' || 
                           showStarredOnly || 
                           showModifiedOnly || 
                           showSelectedOnly;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedTag('');
    setShowStarredOnly(false);
    setShowModifiedOnly(false);
    setShowSelectedOnly(false);
  };

  const starredCount = products.filter(p => p.starred).length;
  const modifiedCount = products.filter(p => p.is_modified).length;
  const selectedCount = products.filter(p => p.selected).length;

  return (
    <div id="catalog-filters-panel" className="bg-white border border-stone-200 rounded-2xl p-4 md:p-5 shadow-xs space-y-4">
      {/* Главный блок поиска и селекторы */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        
        {/* Полнотекстовый поиск */}
        <div className="md:col-span-6 relative">
          <input
            id="search-input"
            type="text"
            placeholder="Поиск по описанию, оригинальным тегам, ID..."
            className="w-full h-11 pl-10 pr-10 bg-stone-50 border border-stone-250 rounded-xl focus:border-stone-400 focus:bg-white text-xs text-stone-800 placeholder-stone-450 focus:outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          {searchQuery && (
            <button
              id="clear-search-btn"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 bg-transparent border-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Категория (Выбор группы) */}
        <div className="md:col-span-3">
          <select
            id="category-filter"
            className="w-full h-11 px-3 bg-stone-50 border border-stone-250 rounded-xl focus:border-stone-400 focus:bg-white text-xs text-stone-700 focus:outline-none transition-all cursor-pointer"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Все категории</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Фильтр по Тегам */}
        <div className="md:col-span-3">
          <select
            id="tag-filter"
            className="w-full h-11 px-3 bg-stone-50 border border-stone-250 rounded-xl focus:border-stone-400 focus:bg-white text-xs text-stone-700 focus:outline-none transition-all cursor-pointer"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
          >
            <option value="">Все теги</option>
            {tags.map((tg) => (
              <option key={tg} value={tg}>
                #{tg}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Нижняя полоса быстрых фильтров и раскладок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-stone-100">
        
        {/* Горизонтальный список баджей-фильтров */}
        <div className="flex flex-wrap items-center gap-2 select-none">
          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-stone-400 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Фильтры:
          </span>

          {/* Быстрый фильтр только «В избранном» */}
          <button
            id="filter-star-btn"
            onClick={() => setShowStarredOnly(!showStarredOnly)}
            className={`h-8 px-3 rounded-lg border text-xs font-semibold font-sans flex items-center gap-1.5 transition-all cursor-pointer ${
              showStarredOnly
                ? "bg-amber-500/10 border-amber-400 text-amber-700 shadow-xs"
                : "bg-stone-50/50 border-stone-200 text-stone-600 hover:bg-stone-100/60"
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${showStarredOnly ? 'fill-amber-500 text-amber-500' : 'text-stone-400'}`} />
            <span>Избранные</span>
            {starredCount > 0 && (
              <span className="font-mono text-[10px] bg-stone-200/60 text-stone-600 px-1.5 rounded font-bold">{starredCount}</span>
            )}
          </button>

          {/* Быстрый фильтр только «С правками» */}
          <button
            id="filter-modified-btn"
            onClick={() => setShowModifiedOnly(!showModifiedOnly)}
            className={`h-8 px-3 rounded-lg border text-xs font-semibold font-sans flex items-center gap-1.5 transition-all cursor-pointer ${
              showModifiedOnly
                ? "bg-cyan-500/10 border-cyan-400 text-cyan-700 shadow-xs"
                : "bg-stone-50/50 border-stone-200 text-stone-600 hover:bg-stone-100/60"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-500" />
            <span>С правками</span>
            {modifiedCount > 0 && (
              <span className="font-mono text-[10px] bg-stone-200/60 text-stone-600 px-1.5 rounded font-bold">{modifiedCount}</span>
            )}
          </button>

          {/* Быстрый фильтр только «Выделенные» */}
          <button
            id="filter-selected-btn"
            onClick={() => setShowSelectedOnly(!showSelectedOnly)}
            className={`h-8 px-3 rounded-lg border text-xs font-semibold font-sans flex items-center gap-1.5 transition-all cursor-pointer ${
              showSelectedOnly
                ? "bg-stone-905 bg-stone-900 border-stone-900 text-white shadow-xs"
                : "bg-stone-50/50 border-stone-200 text-stone-600 hover:bg-stone-100/60"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Выделенные</span>
            {selectedCount > 0 && (
              <span className={`font-mono text-[10px] px-1.5 rounded font-bold ${showSelectedOnly ? 'bg-white/20 text-white' : 'bg-stone-200/60 text-stone-600'}`}>{selectedCount}</span>
            )}
          </button>

          {/* Сброс активного набора */}
          {hasActiveFilters && (
            <button
              id="reset-filters-btn"
              onClick={handleResetFilters}
              className="h-8 px-2.5 rounded-lg border border-red-200/50 hover:bg-red-50 text-red-600 text-xs font-bold font-sans flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Сбросить
            </button>
          )}
        </div>

        {/* Сортировка, Лимит и Раскладки */}
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto shrink-0 select-none">
          {/* Сортировка */}
          <select
            id="sort-select"
            className="h-8 px-2 bg-stone-100 border-0 rounded-xl text-[11px] font-semibold text-stone-605 text-stone-700 font-sans focus:outline-none cursor-pointer transition-all"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            title="Сортировать по"
          >
            <option value="id-desc">Сначала новые ID</option>
            <option value="price-asc">Сначала дешевые</option>
            <option value="price-desc">Сначала дорогие</option>
          </select>

          {/* Размер страницы */}
          <select
            id="page-size-select"
            className="h-8 px-2 bg-stone-100 border-0 rounded-xl text-[11px] font-semibold text-stone-605 text-stone-700 font-sans focus:outline-none cursor-pointer transition-all"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            title="Показывать товаров на странице"
          >
            <option value="24">по 24 шт.</option>
            <option value="50">по 50 шт.</option>
            <option value="100">по 100 шт.</option>
          </select>

          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl shadow-xs">
            <button
              id="view-list-btn"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                viewMode === 'list' 
                  ? "bg-white text-stone-850 shadow-xs" 
                  : "text-stone-400 hover:text-stone-705 text-stone-500"
              }`}
              title="Списком"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              id="view-grid-btn"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                viewMode === 'grid' 
                  ? "bg-white text-stone-850 shadow-xs" 
                  : "text-stone-400 hover:text-stone-705 text-stone-500"
              }`}
              title="Сеткой (Галерея)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
