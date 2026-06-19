/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from "react";
import { CatalogProvider, useCatalog } from "./context/CatalogContext";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { ToastProvider } from "./components/ToastProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ConfirmModal } from "./components/ConfirmModal";
import { CatalogFilters } from "./components/CatalogFilters";
import { BulkActionsPanel } from "./components/BulkActionsPanel";
import { StatsSummaryPanel } from "./components/StatsSummaryPanel";
import ParserImportPanel from "./components/ParserImportPanel";
import { ProductCard } from "./components/ProductCard";
import { ProductCardSkeleton } from "./components/ProductCardSkeleton";
import { ControlCenterModal } from "./components/ControlCenterModal";
import { Lightbox } from "./components/Lightbox";
import { TagCategoryCloud } from "./components/TagCategoryCloud";
import { PaginationControls } from "./components/PaginationControls";
import { ScrollToTop } from "./components/ScrollToTop";
import { DEMO_PRODUCTS } from "./data/demoProducts";
import { FileJson, Database, Sparkles, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from 'motion/react';

// Основной субкомпонент дашборда каталога, потребляющий CatalogContext
function CatalogDashboard() {
  const {
    products,
    filteredProducts,
    paginatedProducts,
    isLoading,
    updateProduct,
    deleteProduct,
    importProducts,
    viewMode,
    addToast,
    closeConfirm,
    toggleSelectAll
  } = useCatalog();

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  const handleOpenLightbox = useCallback((images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
  }, []);

  const handleCloseAllModals = useCallback(() => {
    setIsImportOpen(false);
    setLightboxImages(null);
    closeConfirm();
    window.dispatchEvent(new CustomEvent('close-control-center'));
  }, [closeConfirm]);

  useKeyboardShortcuts({
    onCloseModals: handleCloseAllModals,
    onSelectAll: () => toggleSelectAll(true),
    onClearSelection: () => toggleSelectAll(false),
  });

  // Вычисление обобщенной статистики для StatsSummaryPanel
  const totalItems = products.length;
  const totalValue = products.reduce((acc, p) => acc + p.price, 0);
  const selectedCount = products.filter(p => p.selected).length;
  const favoritesCount = products.filter(p => p.starred).length;
  const modifiedCount = products.filter(p => p.is_modified).length;
  const avgPrice = totalItems > 0 ? (totalValue / totalItems) : 0;

  // Инжектор демо-данных на случай пустой базы данных
  const handleSeedDemoData = async () => {
    try {
      await importProducts(DEMO_PRODUCTS, 'replace');
      addToast("Демо-товары успешно восстановлены в IndexedDB базу!", "success");
    } catch (err: any) {
      addToast("Не удалось импортировать демо-данные: " + err.message, "error");
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/50 pb-20 select-text selection:bg-stone-900 selection:text-white">
      {/* Главный заголовок и навигационная шапка */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-stone-200 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-stone-950 flex items-center justify-center text-white font-mono font-bold text-sm tracking-tighter">
              CC
            </div>
            <div className="text-left">
              <h1 className="text-sm font-bold text-stone-900 tracking-tight font-sans">
                Curator Catalog Dashboard <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-100 ml-1">V4.0</span>
              </h1>
              <span className="text-[10px] font-mono text-stone-400 block tracking-wider uppercase font-semibold">
                Модерация · Чистка Регулярками · Синхронизация БД
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="top-toggle-import-btn"
              onClick={() => setIsImportOpen(!isImportOpen)}
              className={`h-9 px-3.5 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer transition-all border ${
                isImportOpen 
                  ? "bg-stone-950 border-stone-950 text-white shadow-sm" 
                  : "bg-white border-stone-250 text-stone-700 hover:bg-stone-50"
              }`}
            >
              <FileJson className="w-4 h-4 shrink-0" />
              <span>{isImportOpen ? "Скрыть импорт" : "Импорт парсера"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Основной контейнер контента */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        
        {/* Интерактивная модальная панель импорта парсера */}
        <AnimatePresence>
          {isImportOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <ParserImportPanel onClose={() => setIsImportOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Сводная панель аналитики и параметров сессии */}
        <StatsSummaryPanel
          totalItems={totalItems}
          totalValue={totalValue}
          selectedCount={selectedCount}
          favoritesCount={favoritesCount}
          modifiedCount={modifiedCount}
          avgPrice={avgPrice}
        />

        {/* Панель фильтров: Категории, поиска, теги */}
        <CatalogFilters />

        {/* Облако категорий и тегов */}
        <TagCategoryCloud />

        {/* Панель массовых операций над выбранными товарами */}
        <BulkActionsPanel />

        {/* Главная товарная полка */}
        {isLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1 text-stone-500 font-mono text-[10px] uppercase tracking-wider animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-stone-400" />
              <span>Чтение локальной таблицы IndexedDB, восстановление транзакций...</span>
            </div>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
                  : "space-y-5"
              }
            >
              {Array.from({ length: 8 }).map((_, idx) => (
                <ProductCardSkeleton key={`skeleton-${idx}`} viewMode={viewMode} />
              ))}
            </div>
          </div>
        ) : products.length === 0 ? (
          /* ДЕФОЛТНОЕ ПУСТОЕ СОСТОЯНИЕ (База пуста) */
          <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-xs select-none space-y-6">
            <div className="w-20 h-20 rounded-full bg-stone-50 border border-stone-150 flex items-center justify-center mx-auto text-3xl">
              📦
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-stone-900 font-sans">Локальная база данных пуста</h3>
              <p className="text-xs text-stone-500 leading-relaxed font-sans px-4">
                В IndexedDB на данный момент нет товаров. Импортируйте свой файл выгрузки или сгенерируйте демонстрационный набор карточек, чтобы исследовать весь функционал V3.5.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-4">
              <button
                id="empty-state-seed-btn"
                onClick={handleSeedDemoData}
                className="w-full sm:w-auto h-11 px-5 bg-stone-900 hover:bg-stone-850 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm border-0"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Восстановить Демо-товары</span>
              </button>
              
              <button
                id="empty-state-open-import"
                onClick={() => setIsImportOpen(true)}
                className={`w-full sm:w-auto h-11 px-5 bg-white border rounded-xl text-xs text-stone-700 hover:bg-stone-50 font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isImportOpen ? "border-stone-900 bg-stone-50" : "border-stone-250 bg-white"
                }`}
              >
                <FileJson className="w-4 h-4 text-stone-400" />
                <span>Загрузить свой JSON</span>
              </button>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* ПУСТОЕ СОСТОЯНИЕ ДЛЯ АКТИВНЫХ ФИЛЬТРОВ */
          <div className="bg-white border border-stone-200 rounded-2xl p-16 text-center shadow-xs select-none">
            <Database className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-stone-850">Совпадений не найдено</h3>
            <p className="text-xs text-stone-500 leading-normal mt-1.5 text-stone-450">
              Попробуйте смягчить поисковую строку, сбросить фильтрацию тегов или отключить кнопки быстрой сортировки.
            </p>
          </div>
        ) : (
          /* ОТРИСОВКА ВЫБРАННОГО LIST ИЛИ GRID РЕЖИМА */
          <div className="space-y-6">
            <motion.div
              id="product-shelves-container"
              layout
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
                  : "space-y-5"
              }
            >
              <AnimatePresence mode="popLayout animate-fade-in">
                {paginatedProducts.map((prod) => (
                  <motion.div
                    layout
                    key={prod.product_id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ProductCard
                      product={prod}
                      onUpdate={updateProduct}
                      onDelete={deleteProduct}
                      onOpenLightbox={handleOpenLightbox}
                      viewMode={viewMode}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Компактный PaginationControls под списком товаров */}
            <PaginationControls />
          </div>
        )}

      </main>

      {/* Мобильная всплывающая FAB-панель "Центра Управления" */}
      <ControlCenterModal />

      {/* Полноэкранный просмотрщик Lightbox (при клике на медиакарточку) */}
      <Lightbox
        images={lightboxImages || []}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxImages(null)}
      />

      {/* Компактная плавающая кнопка быстрого возврата наверх */}
      <ScrollToTop />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CatalogProvider>
        <ToastProvider>
          <CatalogDashboard />
          <ConfirmModal />
        </ToastProvider>
      </CatalogProvider>
    </ErrorBoundary>
  );
}
