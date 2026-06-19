/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Главный компонент-контейнер "VK Insights Analyzer". Связывает все визуальные модули и управляет открытием диалога экспорта.
// Все комментарии написаны на русском языке.

import React, { useState } from 'react';
import { usePostsStore } from '../../hooks/use-posts-store';
import { FileUploader } from './file-uploader';
import { PriceSettings } from './price-settings';
import { StatsPanel } from './stats-panel';
import { TableToolbar } from './table-toolbar';
import { PostsTable } from './posts-table';
import { GalleryViewer } from './gallery-viewer';
import { ExportDialog } from './export-dialog';
import { VkIntegration } from './vk-integration';
import { Download, Info, Trash2, ArrowRightLeft, Sparkles, LayoutGrid, List } from 'lucide-react';

export const VkAnalyzer: React.FC = () => {
  const { posts, filteredPosts, clearAll, fileName } = usePostsStore();
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'gallery' | 'table'>('gallery'); // Галерея по умолчанию для максимального визуального эффекта

  return (
    <div id="vk-analyzer-inner" className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Шапка проекта с названием */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-semibold text-white bg-indigo-650 dark:bg-indigo-505 rounded-lg shadow-sm">
              VK Insights v1.1
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            VK Insights Analyzer
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-normal">
            Импортируйте, анализируйте и экспортируйте выгрузки постов из ВКонтакте. Автоматизированное распознавание цен, разметка наценок и гибкий фильтр товарных карточек.
          </p>
        </div>
        
        {/* Кнопка сброса текущей сессии */}
        {posts.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              id="clear-workspace-btn"
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-lg transition-all cursor-pointer"
            >
              <Trash2 size={13} />
              Очистить рабочую область
            </button>
          </div>
        )}
      </header>

      {/* Интеграция с ВКонтакте */}
      <section id="vk-integration-portal" className="w-full">
        <VkIntegration />
      </section>

      {/* Зона загрузки файлов */}
      <section id="file-import-section" className="w-full">
        <FileUploader />
      </section>

      {/* Если данные загружены — показываем дашборд аналитика */}
      {posts.length > 0 ? (
        <div id="analyzer-dashboard-grid" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* 1. Блок визуальной статистики и аналитики Recharts */}
          <section id="stats-dashboard-card" className="w-full">
            <StatsPanel />
          </section>

          {/* 2. Блок калькулятора цен и наценок */}
          <section id="price-calculator-section" className="w-full">
            <PriceSettings />
          </section>

          {/* 3. Основная таблица постов, фильтры и кнопка экспорта */}
          <section id="table-explorer-section" className="space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Менеджер постов и товаров</h3>
                <p className="text-xs text-slate-500">
                  Показано <strong className="text-slate-700 dark:text-slate-350">{filteredPosts.length}</strong> из {posts.length} постов
                </p>
              </div>

              {/* Кнопка переключения режимов отображения и экспорта */}
              <div className="flex items-center gap-3">
                
                {/* Туггл вида */}
                <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setViewMode('gallery')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      viewMode === 'gallery'
                        ? 'bg-white dark:bg-slate-900 text-indigo-650 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <LayoutGrid size={13} />
                    Умная Витрина
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      viewMode === 'table'
                        ? 'bg-white dark:bg-slate-900 text-indigo-650 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <List size={13} />
                    Таблица
                  </button>
                </div>

                {/* Кнопка открытия экспорта */}
                <button
                  id="open-export-dialog-btn"
                  type="button"
                  onClick={() => setIsExportOpen(true)}
                  disabled={filteredPosts.length === 0}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-650 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs hover:shadow-sm cursor-pointer transition-all"
                >
                  <Download size={15} />
                  Настроить & Экспортировать в CSV
                </button>
              </div>
            </div>

            {/* Фильтры и тулбар поиска */}
            <TableToolbar />

            {/* Отображаем выбранный вид (Таблицу или Смарт Галерею) */}
            {viewMode === 'gallery' ? (
              <GalleryViewer />
            ) : (
              <PostsTable />
            )}

            {/* Информационный баннер об оффлайн режиме */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-blue-50 dark:border-blue-950 bg-blue-50/30 dark:bg-blue-950/10 text-[11px] text-blue-600 dark:text-blue-400">
              <Info size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold leading-normal">Локальное слияние правок</p>
                <p className="leading-relaxed opacity-90 mt-0.5">
                  Все изменения текста, цен, а также выбранные закладки избранного сохраняются автоматически в хранилище вашего интернет-браузера (localStorage). Вы можете безопасно закрывать или обновлять вкладку: прогресс не сотрется при перезагрузке исходного файла.
                </p>
              </div>
            </div>
          </section>

          {/* Оверлей Диалога Экспорта */}
          <ExportDialog isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
        </div>
      ) : (
        /* Инструкция при пустой рабочей области */
        <div id="instructions-card" className="p-6 bg-slate-50 dark:bg-slate-900/10 border border-slate-205 dark:border-slate-800 rounded-2xl max-w-3xl mx-auto space-y-4">
          <div className="flex items-center gap-2 text-indigo-650 dark:text-indigo-400">
            <Sparkles size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Как это работает?</span>
          </div>
          <div className="space-y-2 text-slate-600 dark:text-slate-400 text-xs leading-relaxed font-normal">
            <p>
              Данное приложение позволяет загружать оффлайн-выгрузки постов из ВКонтакте в формате JSON (стандартный ответ API от вызова <code className="px-1 py-0.5 bg-slate-100 font-mono text-[10px] rounded dark:bg-slate-800">wall.get</code>).
            </p>
            <div className="space-y-1 pl-4 my-2 list-decimal list-inside">
              <div>1. Загрузите файл JSON со стеной группы.</div>
              <div>2. Метрики вовлеченности (лайки, комменты, репосты) и прикрепленные изображения подгрузятся мгновенно.</div>
              <div>3. Цены извлекутся из текстов автоматически по умным алгоритмам (regex рублей, долларов, евро, оптовых цен и диапазонов).</div>
              <div>4. Настройте наценку и правила округления для автоматического перерасчета стоимости товаров.</div>
              <div>5. Сами отберите нужные столбцы, пресеты экспорта и скачайте сформированную таблицу в Excel-совместимый <code className="font-mono text-slate-500">.csv</code> файл.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
