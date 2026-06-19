/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Диалог импорта правок из CSV/Excel. Используется после загрузки постов, чтобы обновить правок без потери данных.

import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { usePostsStore } from '../../hooks/use-posts-store';
import { parseCsv, validateCsvHeaders, sanitizePostId, sanitizeText, sanitizePrice } from '../../lib/csv-importer';

const REQUIRED_CSV_HEADERS = ['ID Поста', 'Отредактированный текст', 'Итоговая цена (₽)'];

export const CsvImportDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { bulkUpdatePostDetails } = usePostsStore();
  const [status, setStatus] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setStatus('❌ Пожалуйста, выберите файл с расширением .csv');
      return;
    }

    setIsProcessing(true);
    setStatus('⏳ Обработка файла...');

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result !== 'string') {
        setStatus('❌ Не удалось прочитать содержимое файла.');
        setIsProcessing(false);
        return;
      }

      try {
        const parsed = parseCsv(result);
        const validation = validateCsvHeaders(parsed.headers, REQUIRED_CSV_HEADERS);
        if (!validation.valid) {
          setStatus(`${validation.error ?? 'Некорректный заголовок'}. Найдены: ${parsed.headers.join(', ')}`);
          setIsProcessing(false);
          return;
        }

        const updates: Record<string, { text: string; price: number | null }> = {};
        const skippedRows: string[] = [];

        for (let i = 0; i < parsed.rows.length; i++) {
          const row = parsed.rows[i];
          const postId = sanitizePostId((row['ID Поста'] ?? '').toString());
          if (postId === '') {
            skippedRows.push(`Строка ${i + 2}: пустой ID Поста`);
            continue;
          }

          const text = sanitizeText((row['Отредактированный текст'] ?? '').toString());
          const price = sanitizePrice((row['Итоговая цена (₽)'] ?? '').toString());
          updates[postId] = { text, price };
        }

        if (Object.keys(updates).length === 0) {
          setStatus('⚠️ CSV не содержит строк для импорта.');
          setIsProcessing(false);
          return;
        }

        bulkUpdatePostDetails(updates);

        const imported = Object.keys(updates).length;
        if (skippedRows.length > 0) {
          setStatus(`✅ Импортировано ${imported} постов. Пропущено строк: ${skippedRows.length}.`);
        } else {
          setStatus(`✅ Импортировано ${imported} постов.`);
        }

        setTimeout(() => {
          onClose();
          setStatus('');
        }, 2000);
      } catch (error) {
        console.error('CSV Import Error:', error);
        setStatus(`❌ Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setStatus('❌ Ошибка при чтении файла с диска.');
      setIsProcessing(false);
    };

    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Импорт правок из CSV</h3>
          <button
            type="button"
            onClick={() => {
              onClose();
              setStatus('');
            }}
            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            disabled={isProcessing}
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center transition-colors hover:border-indigo-500 dark:hover:border-indigo-400"
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-import-input"
            disabled={isProcessing}
          />
          <label htmlFor="csv-import-input" className="cursor-pointer flex flex-col items-center gap-2">
            <Upload size={32} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Перетащите CSV файл сюда или кликните
            </span>
            <span className="text-xs text-slate-500">
              Файл должен содержать колонки: "ID Поста", "Отредактированный текст", "Итоговая цена (₽)"
            </span>
          </label>
        </div>

        {status && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              status.startsWith('✅')
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                : status.startsWith('❌')
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
                : status.startsWith('⚠️')
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
            }`}
          >
            {status}
          </div>
        )}
      </div>
    </div>
  );
};
