/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ProductCardSkeletonProps {
  viewMode: 'grid' | 'list';
}

export const ProductCardSkeleton: React.FC<ProductCardSkeletonProps> = ({ viewMode }) => {
  if (viewMode === 'list') {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 select-none animate-pulse">
        {/* Картинка */}
        <div className="w-full sm:w-40 h-40 bg-stone-100 rounded-xl shrink-0" />

        {/* Инфо контент */}
        <div className="flex-1 flex flex-col justify-between py-1 space-y-4">
          <div className="space-y-2">
            {/* ID и Дата черновики */}
            <div className="flex items-center gap-2">
              <div className="h-4 bg-stone-100 rounded w-28" />
              <div className="h-4 bg-stone-100 rounded w-4" />
              <div className="h-4 bg-stone-100 rounded w-20" />
            </div>

            {/* Заголовок-описание */}
            <div className="space-y-1.5 pt-1">
              <div className="h-4 bg-stone-200 rounded w-full" />
              <div className="h-3.5 bg-stone-100 rounded w-5/6" />
            </div>
            
            {/* Теги */}
            <div className="flex flex-wrap gap-1 pt-1.5">
              <div className="h-5 bg-stone-100 rounded-full w-14" />
              <div className="h-5 bg-stone-100 rounded-full w-16" />
              <div className="h-5 bg-stone-100 rounded-full w-12" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-50">
            {/* Категория */}
            <div className="h-5 bg-stone-100 rounded-full w-32" />
            {/* Цена */}
            <div className="h-6 bg-stone-200 rounded w-24" />
          </div>
        </div>
      </div>
    );
  }

  // Сетка (Grid)
  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs flex flex-col select-none animate-pulse">
      {/* Плейсхолдер картинки */}
      <div className="aspect-square bg-stone-105 bg-stone-100 w-full" />

      {/* Контентная часть */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          {/* Полоска ID & Звезда */}
          <div className="flex justify-between items-center">
            <div className="h-3.5 bg-stone-100 rounded w-20" />
            <div className="w-6 h-6 bg-stone-100 rounded-full" />
          </div>

          {/* Тест-описание */}
          <div className="space-y-1.5">
            <div className="h-3.5 bg-stone-200 rounded w-full" />
            <div className="h-3.5 bg-stone-100 rounded w-4/5" />
          </div>

          {/* Теги */}
          <div className="flex flex-wrap gap-1">
            <div className="h-5 bg-stone-100 rounded-full w-12" />
            <div className="h-5 bg-stone-100 rounded-full w-16" />
          </div>
        </div>

        {/* Футер карточки */}
        <div className="pt-3 border-t border-stone-100 space-y-2">
          {/* Группировка */}
          <div className="h-3.5 bg-stone-100 rounded w-2/3" />
          {/* Цена */}
          <div className="flex justify-between items-center pt-1">
            <div className="h-5 bg-stone-100 rounded w-16" />
            <div className="h-6 bg-stone-200 rounded w-20" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCardSkeleton;
