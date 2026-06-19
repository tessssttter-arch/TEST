/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Центр Управления модератора (ControlCenterModal).
 * Состоит из двух частей для максимальной оптимизации производительности:
 * 1. Легковесный FAB (плавающая кнопка драг-н-дроп), который рендерит только количество выбранных товаров.
 *    При перетаскивании или переключении чекбоксов тяжелые вычисления замен регулярных выражений НЕ запускаются.
 * 2. Тяжелая модальная панель ControlCenterPanel, которая монтируется в AnimatePresence только при открытии.
 *    Она содержит аудит правок, экспорт JSON/CSV, групповой текстовый редактор RegEx и песочницу.
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { ExportMode, DiffReport } from '../types';
import { BulkTagManager } from './BulkTagManager';
import { analyzeReplacements, ReplacementMatch, PRESETS, TextPreset } from "../utils/textReplace";
import {
  Download, Copy, Check, FileCheck, HelpCircle, Archive, ScrollText, Star, Trash2,
  RefreshCcw, CheckCircle2, AlertCircle, FileText, Layers, Wand2, AlertTriangle, Combine, Globe
} from "lucide-react";
import { motion, AnimatePresence } from 'motion/react';

// ============================================================================
// ТЯЖЕЛАЯ ПАНЕЛЬ С ВЫЧИСЛЕНИЯМИ (Рендерится только когда модальное окно открыто)
// ============================================================================
interface ControlCenterPanelProps {
  onClose: () => void;
}

const ControlCenterPanel: React.FC<ControlCenterPanelProps> = ({ onClose }) => {
  const {
    products,
    bulkUpdateProducts,
    deleteSelected,
    showConfirm,
    addToast,
  } = useCatalog();

  const [activeTab, setActiveTab] = useState('export');

  // Export Panel State
  const [exportMode, setExportMode] = useState<ExportMode>("selected");
  const [copied, setCopied] = useState(false);

  // Text Replace Panel State
  const [searchStr, setSearchStr] = useState("");
  const [replaceStr, setReplaceStr] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [sandboxText, setSandboxText] = useState(
    "Привет! Наш телефон +7(999)123-45-67, заходите в паблик vk.com/my-awesome-shop или подписывайтесь в TG @awesome_shop_official. Ждем вас!"
  );

  // Запуск анализа замен регулярного выражения
  const previewMatches = useMemo((): ReplacementMatch[] => {
    if (!searchStr) return [];
    return products.reduce((acc, p) => {
      const { replacedText, matchCount } = analyzeReplacements(p.description || "", searchStr, replaceStr, isRegex, matchCase);
      if (matchCount > 0) acc.push({ productId: p.product_id, originalText: p.description || "", replacedText, matchCount });
      return acc;
    }, [] as ReplacementMatch[]);
  }, [products, searchStr, replaceStr, isRegex, matchCase]);

  const totalMatchesCount = useMemo(() => previewMatches.reduce((acc, m) => acc + m.matchCount, 0), [previewMatches]);
  const emptyDescriptionsCount = useMemo(() => previewMatches.filter(m => !m.replacedText.trim()).length, [previewMatches]);
  const sandboxResult = useMemo(() => analyzeReplacements(sandboxText, searchStr, replaceStr, isRegex, matchCase), [sandboxText, searchStr, replaceStr, isRegex, matchCase]);

  // Выполнение групповой замены текста во всех кураторских описаниях
  const handleApplyTextReplace = useCallback(() => {
    if (!searchStr || previewMatches.length === 0) {
      addToast("Не нашлось совпадений по вашему регулярному выражению!", "info");
      return;
    }
    
    let warning = emptyDescriptionsCount > 0 ? `\n\n⚠️ ВНИМАНИЕ: Для ${emptyDescriptionsCount} товаров описание будет полностью стёрто!` : '';
    
    showConfirm({
      title: `Заменить текст в описаниях товаров?`,
      message: `Вы действительно хотите запустить авто-замену в ${previewMatches.length} карточках (всего ${totalMatchesCount} совпадений)?${warning}`,
      confirmBtnText: 'Заменить текст',
      cancelBtnText: 'Отмена',
      onConfirm: async () => {
        const updated = products.map(p => {
          const match = previewMatches.find(m => m.productId === p.product_id);
          return match ? { ...p, description: match.replacedText, is_modified: true } : p;
        });
        await bulkUpdateProducts(updated);
        setSuccessMsg(`Успешно заменено в ${previewMatches.length} карточках!`);
        addToast(`Regex-замена завершена! Изменено ${totalMatchesCount} строк.`, "success");
        setSearchStr("");
        setReplaceStr("");
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    });
  }, [searchStr, previewMatches, products, bulkUpdateProducts, emptyDescriptionsCount, totalMatchesCount, showConfirm, addToast]);

  // Выгрузка экспорта
  const filteredItems = useMemo(() => {
    switch (exportMode) {
      case "selected": return products.filter((p) => p.selected);
      case "favorites": return products.filter((p) => p.starred);
      case "diff": return products.filter((p) => p.is_modified);
      default: return [];
    }
  }, [products, exportMode]);

  const duplicates = useMemo(() => Array.from(new Set(products.map((p) => String(p.product_id)).filter((id, index, self) => self.indexOf(id) !== index))), [products]);

  const handleApplyPreset = (preset: TextPreset) => { 
    setSearchStr(preset.search); 
    setReplaceStr(preset.replace); 
    setIsRegex(preset.isRegex); 
    setMatchCase(preset.matchCase); 
    addToast(`Применен пресет: "${preset.name}"`, 'info');
  };

  const generateExportJSON = (): string => {
    if (exportMode === "diff") {
      const report: DiffReport = { 
        meta: { 
          exported_at: new Date().toISOString(), 
          type: "diff_audit_report", 
          total_items: products.length, 
          modified_count: filteredItems.length 
        }, 
        items: filteredItems.map(p => ({ 
          product_id: p.product_id, 
          status: p.is_modified ? "modified" : "unmodified", 
          original_price: p.original_price, 
          current_price: p.price, 
          price_difference: p.price - p.original_price, 
          original_sizes: p.sizes_original, 
          current_sizes: p.sizes, 
          sizes_changed: !p.sizes.every((v, i) => v === p.sizes_original[i]), 
          source_url: p.source_url 
        })) 
      };
      return JSON.stringify(report, null, 2);
    }
    const payload = { meta: { exported_at: new Date().toISOString(), type: `${exportMode}_products_export`, total_items: filteredItems.length }, items: filteredItems };
    return JSON.stringify(payload, null, 2);
  };

  const generateExportCSV = (): string => {
    const csvRows = [["Product ID", "Category", "Original Price", "Current Price", "Diff Rubles", "Current Sizes", "Original Sizes", "Main Image", "Images Count", "Source Link", "Description", "Tags"].join(";")];
    const escape = (v: any) => `"${String(v || '').replace(/"/g, '""')}"`;
    filteredItems.forEach(p => { 
      const cleanCategory = p.group_products 
        ? p.group_products.split(',').map(c => c.trim()).filter(Boolean).join(', ') 
        : 'Разное';
      const cleanTags = (p.tags || [])
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);

      csvRows.push([
        p.product_id, 
        escape(cleanCategory), 
        p.original_price, 
        p.price, 
        p.price - p.original_price, 
        escape(p.sizes.join(", ")), 
        escape(p.sizes_original.join(", ")), 
        escape(p.main_image), 
        p.images?.length || p.photos_count || 0, 
        escape(p.source_url), 
        escape(p.description), 
        escape(cleanTags.join(", "))
      ].join(";")); 
    });
    return csvRows.join("\r\n");
  };

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; 
    link.download = fileName;
    document.body.appendChild(link); 
    link.click();
    document.body.removeChild(link); 
    URL.revokeObjectURL(url);
    addToast(`Файл выгрузки ${fileName} сохранен!`, 'success');
  };

  const downloadJSON = () => downloadFile(generateExportJSON(), `export_${exportMode}_${new Date().toISOString().split('T')[0]}.json`, "application/json;charset=utf-8;");
  const downloadCSV = () => downloadFile('\uFEFF' + generateExportCSV(), `export_${exportMode}_${new Date().toISOString().split('T')[0]}.csv`, "text/csv;charset=utf-8;");

  const copyToClipboard = () => {
    const header = `📦 ЭКСПОРТ (${exportMode.toUpperCase()}) — ${filteredItems.length} поз. от ${new Date().toLocaleDateString("ru-RU")}\n`;
    const body = filteredItems.map((p, idx) => `${idx + 1}. [ID: ${p.product_id}] ${p.group_products} - ${p.price} ₽${p.is_modified ? ` (изм! ${p.original_price} ₽)` : ''}\n📏 Размеры: ${p.sizes.join(", ") || "-"}\n🔗 ${p.source_url}\n`).join("\n");
    navigator.clipboard.writeText(header + "\n" + body).then(() => { 
      setCopied(true); 
      addToast('Выгрузка успешно скопирована в буфер обмена!', 'success');
      setTimeout(() => setCopied(false), 2000); 
    });
  };

  const downloadSanitizedJson = () => {
    const sanitized = filteredItems.map(({
      product_id,
      price,
      description,
      sizes,
      main_image,
      images,
      group_products
    }) => ({
      product_id,
      price,
      description,
      sizes,
      main_image,
      images,
      group_products
    }));

    const content = JSON.stringify({
      meta: {
        exported_at: new Date().toISOString(),
        type: "sanitized_catalog_export",
        total_items: sanitized.length
      },
      products: sanitized,
    }, null, 2);

    downloadFile(
      content,
      'catalog.json',
      'application/json;charset=utf-8;'
    );
  };

  const handleBulkDeleteSelected = () => {
    showConfirm({
      title: 'Удалить выделенные элементы?',
      message: `Вы собираетесь безвозвратно убрать ${products.filter(p => p.selected).length} отмеченных карточек из IndexedDB базы.`,
      confirmBtnText: 'Удалить отмеченные',
      cancelBtnText: 'Отмена',
      onConfirm: async () => {
        await deleteSelected();
      }
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-stone-950/45 z-50 flex justify-center items-center backdrop-blur-sm p-4" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", duration: 0.3, bounce: 0.1 }}
        className="bg-stone-50 rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden text-left" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка модалки */}
        <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-100 rounded-t-lg shrink-0">
          <h2 className="text-sm font-bold text-stone-800 flex items-center gap-2 font-mono">
            <Combine className="text-stone-900 w-5 h-5 animate-pulse" />
            Центр управления куратора (Batch Suite)
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-800 text-2xl font-light border-0 bg-transparent cursor-pointer">&times;</button>
        </div>

        {/* Навигация по табам */}
        <div className="flex border-b border-stone-250 bg-stone-100/55 shrink-0 select-none font-sans">
          <button 
            type="button"
            className={`py-3 px-6 font-bold text-xs border-0 cursor-pointer transition-all ${activeTab === 'export' ? 'border-b-2 border-stone-900 text-stone-950 bg-white' : 'text-stone-500 hover:text-stone-800 bg-transparent'}`} 
            onClick={() => setActiveTab('export')}
          >
            Пакетный экспорт и аудит
          </button>
          <button 
            type="button"
            className={`py-3 px-6 font-bold text-xs border-0 cursor-pointer transition-all ${activeTab === 'bulk-tags' ? 'border-b-2 border-stone-900 text-stone-950 bg-white' : 'text-stone-500 hover:text-stone-800 bg-transparent'}`} 
            onClick={() => setActiveTab('bulk-tags')}
          >
            Массовый редактор тегов
          </button>
          <button 
            type="button"
            className={`py-3 px-6 font-bold text-xs border-0 cursor-pointer transition-all ${activeTab === 'batch-edit' ? 'border-b-2 border-stone-900 text-stone-950 bg-white' : 'text-stone-500 hover:text-stone-800 bg-transparent'}`} 
            onClick={() => setActiveTab('batch-edit')}
          >
            Групповой очиститель Regex
          </button>
        </div>

        {/* Область контента */}
        <div className="flex-grow p-4 overflow-auto bg-stone-100 rounded-b-lg">
          {activeTab === 'export' ? (
            /* ВКЛАДКА ЭКСПОРТА */
            <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden h-full flex flex-col justify-between">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0 text-left">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Archive className="w-5 h-5 text-emerald-400 font-bold" />
                    Центр пакетного сопоставления и экспорта
                  </h2>
                  <p className="text-stone-450 text-[10px] uppercase font-mono mt-0.5 text-stone-400">Направления подготовки документов для выгрузки.</p>
                </div>
                
                <div className="flex gap-2.5 select-none font-mono">
                  <div className="bg-stone-800 px-3 py-1.5 rounded-lg border border-stone-700 text-center"><span className="block text-[9px] uppercase font-mono text-stone-400 font-bold">Выбрано</span><span className="text-sm font-bold font-mono text-emerald-400">{products.filter(p => p.selected).length}</span></div>
                  <div className="bg-stone-800 px-3 py-1.5 rounded-lg border border-stone-700 text-center"><span className="block text-[9px] uppercase font-mono text-stone-400 font-bold">Избранные</span><span className="text-sm font-bold font-mono text-amber-400">{products.filter(p => p.starred).length}</span></div>
                  <div className="bg-stone-800 px-3 py-1.5 rounded-lg border border-stone-700 text-center"><span className="block text-[9px] uppercase font-mono text-stone-400 font-bold">С правками</span><span className="text-sm font-bold font-mono text-cyan-400">{products.filter(p => p.is_modified).length}</span></div>
                </div>
              </div>

              {duplicates.length > 0 && (
                <div className="mb-4 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs flex items-start gap-2.5 text-rose-300 font-mono text-left max-h-16 shrink-0 leading-normal">
                  <HelpCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
                  <div>
                    <span className="font-bold block text-rose-200">Внимание: обнаружены дубли ID!</span>
                    ID: {duplicates.join(", ")}. Отредактируйте ID товаров.
                  </div>
                </div>
              )}

              {/* Выбор режима выгрузки */}
              <div className="grid grid-cols-3 gap-2.5 mb-5 shrink-0 select-none">
                <button 
                  onClick={() => setExportMode("selected")} 
                  className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl border text-center transition-all cursor-pointer ${exportMode === "selected" ? "bg-emerald-500/10 border-emerald-500 text-white shadow-md scale-[1.02]" : "bg-stone-800/40 border-stone-800 text-stone-400 hover:bg-stone-800"}`}
                >
                  <FileCheck className="w-4 h-4 text-emerald-400" /> 
                  <span className="text-xs font-semibold font-sans">Выбранные ({products.filter(p => p.selected).length} шт.)</span>
                </button>
                <button 
                  onClick={() => setExportMode("favorites")} 
                  className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl border text-center transition-all cursor-pointer ${exportMode === "favorites" ? "bg-amber-500/10 border-amber-400 text-white shadow-md scale-[1.02]" : "bg-stone-800/40 border-stone-800 text-stone-400 hover:bg-stone-800"}`}
                >
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> 
                  <span className="text-xs font-semibold font-sans">Избранные ({products.filter(p => p.starred).length} шт.)</span>
                </button>
                <button 
                  onClick={() => setExportMode("diff")} 
                  className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl border text-center transition-all cursor-pointer ${exportMode === "diff" ? "bg-cyan-500/10 border-cyan-400 text-white shadow-md scale-[1.02]" : "bg-stone-800/40 border-stone-800 text-stone-400 hover:bg-stone-800"}`}
                >
                  <ScrollText className="w-4 h-4 text-cyan-400" /> 
                  <span className="text-xs font-semibold font-sans">С правками ({products.filter(p => p.is_modified).length} шт.)</span>
                </button>
              </div>

              {/* Двухколоночный просмотр и JSON превью */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 overflow-hidden min-h-[220px]">
                
                {/* Список подходящих товаров */}
                <div className="lg:col-span-2 space-y-2 overflow-y-auto pr-1 custom-scrollbar bg-stone-950/80 p-3 rounded-xl border border-stone-850">
                  {filteredItems.length > 0 ? (
                    filteredItems.map(item => (
                      <div key={item.product_id} className="flex items-center justify-between p-2 rounded-lg bg-stone-900 border border-stone-850 text-xs text-left">
                        <div className="flex items-center gap-2.5 truncate max-w-[200px]">
                          <img src={item.main_image} alt="" className="w-7 h-7 object-cover rounded bg-stone-800 shrink-0 select-none" referrerPolicy="no-referrer"/>
                          <div className="truncate">
                            <span className="font-semibold block text-stone-200 truncate">{item.description}</span>
                            <span className="text-[10px] font-mono text-stone-500">ID: {item.product_id}</span>
                          </div>
                        </div>
                        <div className="text-right font-mono font-medium pl-2 shrink-0">
                          <span className="block text-emerald-400">{item.price} ₽</span>
                          {item.price !== item.original_price && (
                            <span className="text-[9px] text-stone-500 line-through block">{item.original_price} ₽</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10">
                      <span className="text-2xl mb-1 select-none">📭</span>
                      <p className="text-stone-500 text-xs font-mono">Товаров по данному фильтру экспорта не нашлось.</p>
                    </div>
                  )}
                </div>

                {/* Поле кода JSON */}
                <div className="lg:col-span-3 flex flex-col overflow-hidden justify-between">
                  <div className="flex-1 bg-stone-950 text-[10px] font-mono text-stone-300 p-3.5 rounded-xl border border-stone-850 overflow-y-auto custom-scrollbar select-all text-left whitespace-pre">
                    {filteredItems.length > 0 ? generateExportJSON() : "// Выберите режим экспорта на верхних баджах."}
                  </div>
                  
                  {/* Кнопки скачивания */}
                  <div className="mt-3 flex flex-wrap gap-2 shrink-0 font-sans select-none">
                    <button 
                      onClick={downloadJSON} 
                      disabled={!filteredItems.length} 
                      className={`flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl font-bold text-xs border border-transparent cursor-pointer transition-all ${!filteredItems.length ? "bg-stone-805 bg-stone-800 text-stone-600 border-transparent cursor-not-allowed" : "bg-sky-600 hover:bg-sky-500 text-white"}`}
                    >
                      <Download className="w-4 h-4" />
                      <span>Скачать JSON</span>
                    </button>
                    
                    <button 
                      onClick={downloadCSV} 
                      disabled={!filteredItems.length} 
                      className={`flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl font-bold text-xs border border-transparent cursor-pointer transition-all ${!filteredItems.length ? "bg-stone-800 text-stone-600 border-transparent cursor-not-allowed" : "bg-teal-600 hover:bg-teal-500 text-white"}`}
                    >
                      <Download className="w-4 h-4" />
                      <span>Скачать CSV</span>
                    </button>
                    
                    <button
                      onClick={downloadSanitizedJson}
                      disabled={!filteredItems.length}
                      className={`flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl font-bold text-xs border transition-all ${!filteredItems.length ? "border-stone-800 bg-stone-800 text-stone-600 cursor-not-allowed" : "border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 cursor-pointer"}`}
                    >
                      <Globe className="w-4 h-4" />
                      <span>Скачать витрину</span>
                    </button>

                    <button 
                      onClick={copyToClipboard} 
                      disabled={!filteredItems.length} 
                      className={`h-10 flex items-center justify-center gap-1.5 px-4 rounded-xl font-bold text-xs border cursor-pointer transition-all ${!filteredItems.length ? "bg-stone-800 text-stone-600 cursor-not-allowed border-stone-800" : copied ? "bg-stone-800 border-emerald-500 text-emerald-400" : "bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-200"}`}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? "Скопировано!" : "Скопировать"}</span>
                    </button>
                  </div>

                  {products.some(p => p.selected) && (
                    <button 
                      onClick={handleBulkDeleteSelected} 
                      className="mt-2.5 flex items-center justify-center gap-2 w-full h-10 bg-red-950/35 hover:bg-rose-900/40 border border-red-900/40 text-rose-300 hover:text-white rounded-xl font-bold text-xs transition-colors shrink-0 cursor-pointer font-sans"
                    >
                      <Trash2 className="w-4 h-4 text-rose-450 text-rose-400 animate-spin-hover" />
                      <span>Удалить выбранные ({products.filter(p => p.selected).length} шт.)</span>
                    </button>
                  )}
                </div>

              </div>

            </div>
          ) : activeTab === 'bulk-tags' ? (
            /* ВКЛАДКА МАССОВЫХ ТЕГОВ */
            <BulkTagManager />
          ) : (
            /* ВКЛАДКА ГРУППОВОГО РЕДАКТОРА С РЕГУЛЯРКАМИ */
            <div className="p-1 sm:p-2 space-y-6 bg-stone-905 bg-stone-900 border border-stone-800 rounded-2xl shadow-xl h-full flex flex-col justify-between overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-left flex-1">
                
                {/* Левые параметры настройки */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                  {/* Секция пресетов */}
                  <div className="space-y-1.5 select-none">
                    <span className="block text-[10px] font-mono tracking-wider font-bold text-stone-400 uppercase flex items-center gap-1.5 mb-2"><Layers className="w-3.5 h-3.5 text-amber-500" />Библиотека пресетов (RegEx)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PRESETS.map(pst => (
                        <button 
                          key={pst.id} 
                          onClick={() => handleApplyPreset(pst)} 
                          type="button" 
                          className="bg-stone-950 hover:bg-stone-850 border border-stone-800 rounded-xl p-2.5 text-left transition-all hover:border-stone-700 flex flex-col justify-between cursor-pointer h-16 shrink-0" 
                          title={pst.description}
                        >
                          <span className="text-xs font-bold text-stone-200 flex items-center gap-1 truncate"><Wand2 className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />{pst.name}</span>
                          <p className="text-[9.5px] text-stone-500 font-mono truncate mt-0.5 leading-normal">{pst.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Секция инпутов строки */}
                  <div className="space-y-3.5 leading-tight select-text">
                    <div>
                      <label className="text-[10px] font-mono tracking-wider text-stone-400 uppercase font-bold">Строка поиска (Regex или Текст)</label>
                      <input 
                        type="text" 
                        placeholder="Паттерн для поиска..." 
                        className="w-full text-xs font-mono bg-stone-950 border border-stone-850 rounded-xl p-3 text-white placeholder-stone-700 mt-1 focus:outline-none focus:ring-1 focus:ring-stone-600" 
                        value={searchStr} 
                        onChange={e => setSearchStr(e.target.value)} 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono tracking-wider text-stone-400 uppercase font-bold">Заменить на</label>
                      <input 
                        type="text" 
                        placeholder="На что заменить (зачистка по умолчанию)..." 
                        className="w-full text-xs font-mono bg-stone-950 border border-stone-850 rounded-xl p-3 text-white placeholder-stone-700 mt-1 focus:outline-none focus:ring-1 focus:ring-stone-600" 
                        value={replaceStr} 
                        onChange={e => setReplaceStr(e.target.value)} 
                      />
                    </div>
                    
                    {/* Чекбоксы Regex / Case */}
                    <div className="flex items-center gap-4 py-0.5 select-none font-mono text-[11px]">
                      <label className="flex items-center gap-2 text-stone-300 cursor-pointer">
                        <input type="checkbox" checked={matchCase} onChange={e => setMatchCase(e.target.checked)} className="rounded accent-stone-750 w-4 h-4 bg-stone-950 border-stone-800" />
                        Регистр (Match Case)
                      </label>
                      <label className="flex items-center gap-2 text-stone-300 cursor-pointer">
                        <input type="checkbox" checked={isRegex} onChange={e => setIsRegex(e.target.checked)} className="rounded accent-stone-750 w-4 h-4 bg-stone-950 border-stone-800" />
                        Регулярное выражение (Regex)
                      </label>
                    </div>
                  </div>

                  {emptyDescriptionsCount > 0 && (
                    <div className="bg-red-950/40 border border-red-900/50 text-red-300 text-[11px] p-3 rounded-xl flex items-start gap-2 select-none h-14 shrink-0 max-h-16 overflow-hidden leading-normal text-left">
                      <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-red-500 mt-0.5" />
                      <div>
                        <span className="font-bold">Деструктивный пустой сброс!</span>
                        <p className="text-[9.5px] text-red-400 font-mono">Плейсхолдер очистит описания в <strong>{emptyDescriptionsCount}</strong> товарах полностью!</p>
                      </div>
                    </div>
                  )}

                  {successMsg && (
                    <div className="bg-emerald-950/40 border border-emerald-850 text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2 select-none h-10 shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <button 
                    type="button" 
                    disabled={!searchStr || previewMatches.length === 0} 
                    onClick={handleApplyTextReplace} 
                    className="w-full h-11 bg-stone-100 hover:bg-stone-200 disabled:opacity-30 text-stone-900 font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer font-sans border-0"
                  >
                    <RefreshCcw className="w-4 h-4 text-stone-900 animate-spin-hover" />
                    <span>Применить Regex для {previewMatches.length} товаров</span>
                  </button>
                </div>

                {/* Правые компоненты Diff и Песочницы */}
                <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4 h-full min-h-[300px]">
                  
                  {/* Блок песочницы */}
                  <div className="bg-stone-950 border border-stone-900 p-4 rounded-xl flex flex-col justify-between space-y-3">
                    <span className="block text-[10px] font-mono text-stone-400 uppercase tracking-widest font-bold flex items-center gap-1 shrink-0 select-none">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                      Модераторская песочница
                    </span>
                    <textarea 
                      value={sandboxText} 
                      onChange={e => setSandboxText(e.target.value)} 
                      rows={5} 
                      className="w-full text-[11px] font-mono bg-stone-900 border border-stone-850 rounded-lg p-2.5 text-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-700 flex-1 min-h-[100px] leading-relaxed resize-none text-left" 
                    />
                    <div className="space-y-1.5 pt-2 border-t border-stone-900 shrink-0">
                      <span className="text-[9px] font-mono text-emerald-500 uppercase font-bold block select-none">Результат замены:</span>
                      <div className="bg-emerald-950/10 text-emerald-400 border border-emerald-950/20 rounded-lg p-2.5 font-mono text-[11px] min-h-[46px] leading-relaxed break-all select-text text-left">
                        {sandboxResult.replacedText || <span className="text-stone-700 italic">Ожидание совпадений...</span>}
                      </div>
                      <span className="text-[9.5px] font-mono text-stone-500 text-right block select-none">
                        Совпадений: <strong className="text-emerald-400 font-bold">{sandboxResult.matchCount}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Блок Живого Diff */}
                  <div className="bg-stone-950 border border-stone-900 p-4 rounded-xl flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-stone-900 pb-2 mb-2 shrink-0 select-none">
                      <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest font-bold flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-amber-500 font-bold" />
                        Живой лог Diff
                      </span>
                      <span className="text-[9.5px] font-mono bg-stone-900 border border-stone-850 px-2 py-0.5 rounded text-stone-300">
                        Затронет: {previewMatches.length} поз.
                      </span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                      {!searchStr ? (
                        <div className="flex flex-col items-center justify-center text-stone-600 h-full py-10 select-none">
                          <FileText className="w-8 h-8 mb-2 opacity-30 animate-pulse" />
                          <span className="text-[10px] font-mono text-center">Ожидание ввода регулярок в поисковое поле...</span>
                        </div>
                      ) : !previewMatches.length ? (
                        <div className="flex flex-col items-center justify-center text-amber-500/40 text-xs h-full text-center py-10 select-none">
                          <AlertCircle className="w-6 h-6 text-amber-550 mr-1 opacity-40" />
                          <span className="text-[10.5px] font-mono text-stone-605">Совпадений в каталоге не обнаружено.</span>
                        </div>
                      ) : (
                        <div className="space-y-3.5 text-left animate-fade-in">
                          {previewMatches.map((match, idx) => (
                            <div key={idx} className="text-[10.5px] font-mono border-b border-stone-900 pb-3 last:border-0 last:pb-0 select-text">
                              <div className="flex items-center justify-between text-stone-500 mb-1.5 font-bold">
                                <span>ID: <strong className="text-stone-300">{match.productId}</strong></span>
                                <span className="text-amber-550">{match.matchCount} совп.</span>
                              </div>
                              <div className="grid grid-cols-1 gap-1.5">
                                <div className="bg-stone-900/60 p-2 rounded text-[10px] text-stone-500 max-h-[50px] overflow-y-auto break-all scrollbar-none whitespace-pre-wrap select-text">{match.originalText}</div>
                                <div className="bg-emerald-950/20 p-2 rounded text-[10px] text-emerald-400 border border-emerald-950/30 max-h-[50px] overflow-y-auto break-all scrollbar-none whitespace-pre-wrap select-text">{match.replacedText}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>

      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// ЛЕГКОВЕСНЫЙ FAB (Основной экспортируемый компонент)
// ============================================================================
export const ControlCenterModal: React.FC = () => {
  const { products } = useCatalog();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const handleCloseEvent = () => setIsExpanded(false);
    window.addEventListener('close-control-center', handleCloseEvent);
    return () => window.removeEventListener('close-control-center', handleCloseEvent);
  }, []);

  const [position, setPosition] = useState({ 
    x: typeof window !== 'undefined' ? window.innerWidth - 82 : 1000, 
    y: typeof window !== 'undefined' ? window.innerHeight - 150 : 600 
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const fabRef = useRef<HTMLDivElement>(null);
  const wasDragged = useRef(false);

  const selectedCount = useMemo(() => products.filter(p => p.selected).length, [products]);

  // Специфичные обработчики перетаскивания FAB
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (fabRef.current) {
      const rect = fabRef.current.getBoundingClientRect();
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setIsDragging(true);
      wasDragged.current = false;
      e.preventDefault();
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setTimeout(() => {
        if (!wasDragged.current) {
          setIsExpanded(true);
        }
      }, 0);
    }
    setIsDragging(false);
  }, [isDragging]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        if (!wasDragged.current) {
          if (Math.abs(e.clientX - (position.x + dragOffset.current.x)) > 5 || Math.abs(e.clientY - (position.y + dragOffset.current.y)) > 5) {
            wasDragged.current = true;
          }
        }
        setPosition({ 
          x: Math.min(window.innerWidth - 70, Math.max(10, e.clientX - dragOffset.current.x)), 
          y: Math.min(window.innerHeight - 70, Math.max(10, e.clientY - dragOffset.current.y)) 
        });
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isDragging, position.x, position.y]);

  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(window.innerWidth - 82, Math.max(10, prev.x)),
        y: Math.min(window.innerHeight - 82, Math.max(10, prev.y))
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* Легковесная плавающая кнопка (FAB) */}
      {!isExpanded && (
        <div
          ref={fabRef}
          id="control-center-fab"
          className="fixed z-50 w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center text-white shadow-2xl cursor-pointer hover:bg-stone-850 hover:shadow-stone-900/10 transition-all duration-150 transform hover:scale-105 select-none animate-fade-in touch-none border border-stone-850"
          style={{ left: position.x, top: position.y }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        >
          <Combine size={24} />
          {selectedCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-mono font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white animate-bounce shadow-md">
              {selectedCount}
            </span>
          )}
        </div>
      )}

      {/* Анимированный лениво-монтируемый интерфейс Центра Управления */}
      <AnimatePresence>
        {isExpanded && (
          <ControlCenterPanel onClose={() => setIsExpanded(false)} />
        )}
      </AnimatePresence>
    </>
  );
};

export default ControlCenterModal;
