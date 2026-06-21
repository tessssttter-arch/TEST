/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Компонент настройки экспорта в CSV. Позволяет выбирать колонки, сохранять конфигурационные пресеты (до 5 штук) и скачивать файл.
// Все комментарии написаны на русском языке.

import React, { useState, useEffect } from 'react';
import { Download, Bookmark, Trash2, X, PlusCircle, Check, HelpCircle } from 'lucide-react';
import { usePostsStore } from '../../hooks/use-posts-store';
import { EXPORT_COLUMNS_MAP, exportPostsToCSV, downloadCSVFile } from '../../lib/csv-exporter';
import { exportPostsToCatalogJsonV3 } from '../../lib/catalog-exporter';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose }) => {
  const {
    filteredPosts,
    exportProfiles,
    saveExportProfile,
    deleteExportProfile,
  } = usePostsStore();

  // [AI-EDIT] Переключатель форматов экспорта: CSV / JSON v3 | 2026-06-20 06:40
  const [exportFormat, setExportFormat] = useState<'csv' | 'json_v3'>('csv');

  // Доступные для экспорта колонки
  const exportableColumnsKeys = Object.keys(EXPORT_COLUMNS_MAP);

  // Список выбранных в данный момент колонок для экспорта
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    // По умолчанию экспортируем ключевые товарные свойства
    return ['post_id', 'source_url', 'date_formatted', 'text_edited', 'price_original', 'price_edited', 'photo_urls', 'likes', 'views', 'hashtags'];
  });

  const [profileName, setProfileName] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Закрытие при клике на Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  // Клик на чекбокс выбора колонок
  const handleToggleColumn = (colKey: string) => {
    if (selectedColumns.includes(colKey)) {
      setSelectedColumns(selectedColumns.filter((c) => c !== colKey));
    } else {
      setSelectedColumns([...selectedColumns, colKey]);
    }
  };

  // Выбрать все
  const handleSelectAll = () => {
    setSelectedColumns(exportableColumnsKeys);
  };

  // Снять выделение
  const handleDeselectAll = () => {
    setSelectedColumns([]);
  };

  // Сохранение текущей конфигурации в пресет
  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = profileName.trim();
    if (!trimmed) return;

    saveExportProfile(trimmed, selectedColumns);
    setProfileName('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // Загрузка колонок из сохраненного пресета
  const handleLoadPreset = (columns: string[]) => {
    setSelectedColumns(columns);
  };

  // Триггер непосредственного экспорта
  const handleTriggerExport = () => {
    if (filteredPosts.length === 0) {
      alert('Нет постов для экспорта! Проверьте настроенные фильтры.');
      return;
    }

    if (exportFormat === 'json_v3') {
      const dateStr = new Date().toISOString().slice(0, 10);
      const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '-');
      exportPostsToCatalogJsonV3(filteredPosts, `catalog_export_v3_${dateStr}_${timeStr}.json`);
      onClose();
      return;
    }

    if (selectedColumns.length === 0) {
      alert('Пожалуйста, выберите хотя бы одну колонку для сохранения.');
      return;
    }

    const csvData = exportPostsToCSV(filteredPosts, selectedColumns);
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '-');
    downloadCSVFile(csvData, `vk_insights_export_${dateStr}_${timeStr}.csv`);
    onClose();
  };

  return (
    <div id="export-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Фон-затемнение */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose}></div>

      {/* Контент модального окна */}
      <div id="export-modal-content" className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        
        {/* Хедер модалки */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 text-left">
          <div className="text-left">
            <h3 className="text-base font-bold text-slate-800 dark:text-white text-left">Экспорт товаров</h3>
            <p className="text-xs text-slate-500 text-left">Выберите формат и настройте параметры выгрузки ({filteredPosts.length} постов)</p>
          </div>
          <button
            id="close-modal"
            type="button"
            onClick={onClose}
            className="p-1 px-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer border-0 bg-transparent"
          >
            <X size={18} />
          </button>
        </div>

        {/* Тело модалки */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
          
          {/* Переключатель формата экспорта */}
          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest pl-2">Формат выгрузки:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border-0 ${
                  exportFormat === 'csv'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-750 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                CSV (Аналитика)
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('json_v3')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border-0 ${
                  exportFormat === 'json_v3'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-750 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                JSON v3 (Витрина)
              </button>
            </div>
          </div>

          {exportFormat === 'csv' ? (
            <>
              {/* Блок 1: Сохраненные конфигурационные пресеты по ТЗ (до 5шт) */}
          <div id="presets-section" className="space-y-3 text-left">
            <label className="block text-xs font-bold text-slate-605 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1 text-left">
              <Bookmark size={12} className="text-indigo-505" />
              История конфигураций пресетов (Макс. 5)
            </label>
            {exportProfiles.length > 0 ? (
              <div className="flex flex-wrap gap-2 text-left">
                {exportProfiles.map((prof) => (
                  <div
                    key={prof.id}
                    className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadPreset(prof.selectedColumns)}
                      className="font-semibold text-slate-700 hover:text-indigo-650 dark:text-slate-350 dark:hover:text-indigo-400 cursor-pointer border-0 bg-transparent"
                      title="Применить данный набор колонок"
                    >
                      {prof.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteExportProfile(prof.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded-md cursor-pointer border-0 bg-transparent"
                      title="Удалить пресет"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic text-left">У вас еще нет сохраненных конфигураций.</p>
            )}

            {/* Форма сохранения текущего набора в пресет */}
            <form onSubmit={handleSavePreset} className="flex gap-2 items-center mt-2 text-left">
              <input
                id="preset-name-input"
                type="text"
                placeholder="Имя для текущей конфигурации..."
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                maxLength={40}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-indigo-550 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 outline-none text-left"
              />
              <button
                id="save-preset-button"
                type="submit"
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-505 dark:hover:bg-indigo-650 rounded-lg shadow-sm transition-all cursor-pointer border-0"
              >
                {saveSuccess ? (
                  <>
                    <Check size={12} />
                    Сохранено!
                  </>
                ) : (
                  <>
                    <PlusCircle size={12} />
                    Сохранить
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Блок 2: Выбор экспортируемых полей */}
          <div id="columns-selection-section" className="space-y-3 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1 text-left">
                Выберите колонки для выгрузки в CSV
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold uppercase cursor-pointer border-0 bg-transparent"
                >
                  Выбрать все
                </button>
                <span className="text-slate-300 text-xs">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-[10px] text-slate-500 hover:text-slate-700 font-bold uppercase cursor-pointer border-0 bg-transparent"
                >
                  Сбросить выборы
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 max-h-56 overflow-y-auto pr-1 text-left">
              {exportableColumnsKeys.map((colKey) => {
                const isSelected = selectedColumns.includes(colKey);
                return (
                  <button
                    key={colKey}
                    type="button"
                    onClick={() => handleToggleColumn(colKey)}
                    className="flex items-center justify-between p-2 rounded-lg text-xs font-medium border border-slate-100 hover:border-indigo-100 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-900 transition-all text-left cursor-pointer bg-transparent"
                  >
                    <span className="text-slate-700 dark:text-slate-350">{EXPORT_COLUMNS_MAP[colKey]}</span>
                    <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-605 text-white dark:bg-indigo-505 dark:border-indigo-505'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}>
                      {isSelected && <Check size={10} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
            </>
          ) : (
            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800 text-sm">
              <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Экспорт в JSON v3 (Контракт Витрины)</p>
              <p className="text-xs text-slate-500">
                Выгрузка будет произведена в расширенном формате JSON согласно контракту <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-900 rounded text-indigo-600 dark:text-indigo-400">CatalogProductV3</code>. Этот файл готов для прямого импорта в приложение Витрины. Настройка колонок для этого формата не требуется.
              </p>
            </div>
          )}
        </div>

        {/* Футер модалки */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-left">
          <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium text-left">
            <HelpCircle size={12} className="text-slate-402 shrink-0" />
            {exportFormat === 'csv' 
              ? 'Выгруженный CSV содержит разметку UTF-8 BOM, читается в Excel напрямую.' 
              : 'Файл JSON v3 оптимизирован для импорта структуры каталога и медиа-ресурсов.'}
          </span>
          <div className="flex items-center gap-2">
            <button
              id="cancel-export"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-all border-0 bg-transparent"
            >
              Отмена
            </button>
            <button
              id="download-csv-action"
              type="button"
              onClick={handleTriggerExport}
              disabled={filteredPosts.length === 0 || (exportFormat === 'csv' && selectedColumns.length === 0)}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-750 dark:bg-indigo-500 dark:hover:bg-indigo-650 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all cursor-pointer border-0"
            >
              <Download size={14} />
              {exportFormat === 'csv' ? (
                <>Скачать CSV ({filteredPosts.length} постов)</>
              ) : (
                <>Скачать JSON v3 ({filteredPosts.length} постов)</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
