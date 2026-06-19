/**
 * Сводная панель аналитики каталога (StatsSummaryPanel).
 * Осуществляет визуализирование ключевых кураторских метрик, общей цены,
 * средних чеков, количества ручных правок и рекомендаций.
 */

import React, { useState } from "react";
import { ChevronDown, ChevronUp, BarChart3, TrendingUp, RefreshCw, Layers } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface StatsSummaryPanelProps {
  totalItems: number;
  totalValue: number;
  selectedCount: number;
  favoritesCount: number;
  modifiedCount: number;
  avgPrice?: number;
}

export default function StatsSummaryPanel({
  totalItems,
  totalValue,
  selectedCount,
  favoritesCount,
  modifiedCount,
  avgPrice
}: StatsSummaryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const stats = {
    totalCount: totalItems,
    starredCount: favoritesCount,
    selectedCount,
    modifiedCount,
    totalCost: totalValue,
    averagePrice: avgPrice !== undefined ? Math.round(avgPrice) : (totalItems > 0 ? Math.round(totalValue / totalItems) : 0)
  };

  return (
    <div 
      id="stats-summary-panel" 
      className="bg-white border border-stone-200 rounded-2xl shadow-sm transition-all overflow-hidden mb-6"
    >
      {/* Шапка аккордеона */}
      <button
        id="stats-summary-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-stone-50/70 hover:bg-stone-50 transition-colors text-left cursor-pointer border-0"
      >
        <div className="flex items-center gap-2.5 text-stone-800 font-medium">
          <BarChart3 className="w-5 h-5 text-stone-600" />
          <span>Аналитика и Сводка Каталога</span>
          <span className="ml-2 font-mono text-xs bg-stone-200/80 text-stone-700 px-2.5 py-0.5 rounded-full">
            {stats.totalCount} шт.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-stone-500">
            <span>Сумма: {stats.totalCost.toLocaleString()} ₽</span>
            <span>Параметры: {stats.modifiedCount} изм.</span>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-stone-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-stone-500" />
          )}
        </div>
      </button>

      {/* Внутренний контейнер */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            id="stats-summary-content" 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-stone-100 bg-white grid grid-cols-1 md:grid-cols-4 gap-4 overflow-hidden"
          >
            <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 col-span-4">
              {/* Главные метрики количеств */}
              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                <div className="bg-stone-50 p-4 rounded-lg border border-stone-100 flex flex-col justify-center text-left">
                  <div className="text-stone-500 text-xs font-mono uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-stone-400" />
                    Всего товаров
                  </div>
                  <div className="text-2xl font-bold text-stone-900 font-mono">{stats.totalCount}</div>
                  <div className="text-stone-500 text-[11px] mt-1">
                    {stats.selectedCount} отмечено · {stats.starredCount} в избранном
                  </div>
                </div>

                <div className="bg-emerald-50/30 p-4 rounded-lg border border-emerald-100 flex flex-col justify-center text-left">
                  <div className="text-emerald-800 text-xs font-mono uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    Общая ценность
                  </div>
                  <div className="text-2xl font-bold text-stone-900 font-mono">
                    {stats.totalCost.toLocaleString()} <span className="text-lg font-normal text-stone-500">₽</span>
                  </div>
                  <div className="text-stone-500 text-[11px] mt-1">
                    Средний чек договора: {stats.averagePrice.toLocaleString()} ₽
                  </div>
                </div>

                <div className="bg-amber-50/20 p-4 rounded-lg border border-amber-100 flex flex-col justify-center col-span-2 text-left">
                  <div className="text-amber-800 text-xs font-mono uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                    Правок в сессии
                  </div>
                  <div className="text-2xl font-bold text-stone-900 font-mono">{stats.modifiedCount}</div>
                  <div className="text-stone-500 text-[11px] mt-1">
                    Товары, отредактированные вручную или скриптами с отличиями от оригиналов.
                  </div>
                </div>
              </div>

              {/* Совета куратору */}
              <div className="md:col-span-2 bg-stone-50 p-4 rounded-lg border border-stone-100 flex flex-col justify-between text-left">
                <div>
                  <div className="text-stone-500 text-xs font-mono uppercase tracking-wider mb-2">Советы курирования</div>
                  <ul className="text-stone-605 text-stone-600 text-xs space-y-2 list-disc pl-4 font-sans leading-relaxed">
                    <li>Переключайте вкладку <strong>«Импорт парсера»</strong> для добавления сырых данных.</li>
                    <li>Используйте <strong>«Центр Управления»</strong> на FAB кнопке для регулярных замен Regex.</li>
                    <li>Все ваши правки цен и размеров сохраняются в изолированной базе <strong>IndexedDB</strong>.</li>
                  </ul>
                </div>
                <div className="text-[10px] text-stone-400 font-mono mt-3">
                  * Изменения не сотрутся при обновлении страницы.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export { StatsSummaryPanel };
