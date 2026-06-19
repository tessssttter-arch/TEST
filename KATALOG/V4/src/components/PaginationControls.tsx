/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export const PaginationControls: React.FC = () => {
  const {
    filteredProducts,
    page,
    setPage,
    pageSize
  } = useCatalog();

  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Смещение расчета элементов для показа надписей
  const startItemIdx = (page - 1) * pageSize + 1;
  const endItemIdx = Math.min(page * pageSize, totalItems);

  // Генерация логичного ряда видимых номеров страниц: First, Dots, Active, Dots, Last
  const pageRange = useMemo(() => {
    const range: (number | string)[] = [];
    const maxVisibleNeighbors = 1; // Количеств соседей вокруг активной страницы

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) range.push(i);
    } else {
      range.push(1);
      
      const leftBoundary = Math.max(2, page - maxVisibleNeighbors);
      const rightBoundary = Math.min(totalPages - 1, page + maxVisibleNeighbors);

      if (leftBoundary > 2) {
        range.push('...');
      }

      for (let i = leftBoundary; i <= rightBoundary; i++) {
        range.push(i);
      }

      if (rightBoundary < totalPages - 1) {
        range.push('...');
      }

      range.push(totalPages);
    }
    return range;
  }, [page, totalPages]);

  if (totalPages <= 1) {
    return (
      <div id="pagination-status-bar" className="flex items-center justify-between text-stone-400 font-mono text-[10px] uppercase tracking-wider py-4 border-t border-stone-100 select-none">
        <span>Показаны все позиции ({totalItems} шт.)</span>
        <span>Страница 1 из 1</span>
      </div>
    );
  }

  return (
    <div
      id="pagination-controls-wrapper"
      className="flex flex-col sm:flex-row items-center justify-between gap-4 py-5 border-t border-stone-200 select-none text-left"
    >
      {/* Текстовая порция информации */}
      <div className="text-[11px] font-mono text-stone-500 font-medium">
        Показаны товары <strong className="text-stone-800">{startItemIdx}–{endItemIdx}</strong> из <strong className="text-stone-800">{totalItems}</strong> шт.
      </div>

      {/* Ряд интерактивных кнопок пагинации */}
      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
        {/* В самое начало */}
        <button
          onClick={() => setPage(1)}
          disabled={page === 1}
          className="p-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-stone-600 hover:text-stone-900 disabled:opacity-35 disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="В самое начало"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Назад */}
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-stone-600 hover:text-stone-900 disabled:opacity-35 disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="Предыдущая страница"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Цифры */}
        {pageRange.map((p, idx) => {
          if (p === '...') {
            return (
              <span
                key={`dots-${idx}`}
                className="w-9 h-9 flex items-center justify-center text-stone-400 select-none"
              >
                ...
              </span>
            );
          }

          const pageNum = p as number;
          const isCurrent = pageNum === page;

          return (
            <button
              key={`page-${pageNum}`}
              onClick={() => setPage(pageNum)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer transition-all ${
                isCurrent
                  ? "bg-stone-900 border-stone-900 text-white font-bold scale-[1.03]"
                  : "bg-white hover:bg-stone-50 border-stone-200 text-stone-600 hover:text-stone-900"
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        {/* Вперед */}
        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-stone-600 hover:text-stone-900 disabled:opacity-35 disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="Следующая страница"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* В самый конец */}
        <button
          onClick={() => setPage(totalPages)}
          disabled={page === totalPages}
          className="p-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-stone-600 hover:text-stone-900 disabled:opacity-35 disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="В самый конец"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PaginationControls;
