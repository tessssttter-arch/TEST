/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// [AI-EDIT] Разделение сценариев загрузки: JSON — полный сброс, CSV — только обновление правок | 2026-06-14
// [AI-CONTEXT] В режиме CSV кнопка "Загрузить другой файл" больше не вызывает clearAll, чтобы не затирать посты при повторной загрузке редактуры.
// Компонент загрузки JSON и CSV, переиспользуемый в разных режимах.
// Все комментарии написаны на русском языке.

import React, { useRef, useState } from 'react';
import { Upload, FileCode, AlertCircle, RefreshCw } from 'lucide-react';
import { usePostsStore } from '../../hooks/use-posts-store';
import { parseCsv, validateCsvHeaders, sanitizePostId, sanitizeText, sanitizePrice } from '../../lib/csv-importer';

export type FileUploaderMode = 'json' | 'csv';

export interface FileUploaderProps {
  mode?: FileUploaderMode;
}

const REQUIRED_CSV_HEADERS = ['ID Поста', 'Отредактированный текст', 'Итоговая цена (₽)'];

export const FileUploader: React.FC<FileUploaderProps> = ({ mode = 'json' }) => {
  const { importJson, bulkUpdatePostDetails, isLoading, error: storeError, clearAll, posts, fileName } = usePostsStore();
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const resetLocalState = () => {
    setLocalError(null);
    fileInputRef.current && (fileInputRef.current.value = '');
  };

  const processFile = (file: File) => {
    setLocalError(null);

    if (mode === 'json' && !file.name.endsWith('.json')) {
      setLocalError('Пожалуйста, выберите файл в формате .json');
      return;
    }

    if (mode === 'csv' && !file.name.endsWith('.csv')) {
      setLocalError('Пожалуйста, выберите файл в формате .csv');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setLocalError(`Размер файла превышает лимит 10 МБ. Ваш файл: ${(file.size / (1024 * 1024)).toFixed(2)} МБ.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result !== 'string') {
        setLocalError('Не удалось прочитать содержимое файла.');
        return;
      }

      if (mode === 'json') {
        importJson(result, file.name);
        return;
      }

      const parsed = parseCsv(result);
      const validation = validateCsvHeaders(parsed.headers, REQUIRED_CSV_HEADERS);
      if (!validation.valid) {
        setLocalError(
          `${validation.error ?? 'Некорректный заголовок'}. Найдены: ${parsed.headers.join(', ')}`
        );
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
        setLocalError('CSV не содержит строк для импорта.');
        return;
      }

      bulkUpdatePostDetails(updates);

      if (skippedRows.length > 0) {
        setLocalError(`Импортировано ${Object.keys(updates).length} постов. Пропущено строк: ${skippedRows.length}.`);
      } else {
        setLocalError(`Импортировано ${Object.keys(updates).length} постов.`);
        setTimeout(() => setLocalError(null), 4000);
      }

      resetLocalState();
    };
    reader.onerror = () => setLocalError('Ошибка при чтении файла с диска.');
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
    else if (e.type === 'dragleave') setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
    resetLocalState();
  };

  const onButtonClick = () => fileInputRef.current?.click();

  const activeError = localError || storeError;

  return (
    <div id="file-uploader-section" className="w-full">
      {posts.length > 0 && fileName ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 dark:border-emerald-950/30 dark:bg-emerald-950/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 rounded-lg">
              <FileCode size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{fileName}</p>
              <p className="text-xs text-slate-500">
                {mode === 'csv'
                  ? 'Обратный импорт правок из CSV.'
                  : `Успешно загружено и структурировано ${posts.length} постов.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'json' ? (
              <button
                id="reupload-button"
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 dark:text-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs transition-all cursor-pointer"
              >
                <RefreshCw size={14} />
                Загрузить другой файл
              </button>
            ) : (
              <button
                id="reupload-csv-button"
                type="button"
                onClick={() => {
                  resetLocalState();
                  onButtonClick();
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <RefreshCw size={14} />
                Загрузить другой CSV с правками
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          id="drop-zone"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          className={`relative group w-full flex flex-col items-center justify-center p-8 md:p-12 border-2 border-dashed rounded-2xl transition-all duration-300 cursor-pointer ${
            isDragActive
              ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/10 scale-[0.99]'
              : 'border-slate-200 hover:border-indigo-400 dark:border-slate-800 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-900/10'
          }`}
        >
          <input
            id="file-input"
            ref={fileInputRef}
            type="file"
            accept={mode === 'csv' ? '.csv' : '.json'}
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div
              className={`p-4 rounded-full transition-all duration-300 ${
                isDragActive
                  ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400 scale-110'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 group-hover:bg-indigo-50 group-hover:text-indigo-500 dark:group-hover:bg-indigo-950/60 dark:group-hover:text-indigo-400'
              }`}
            >
              {isLoading ? <RefreshCw size={28} className="animate-spin" /> : <Upload size={28} />}
            </div>

            <div className="space-y-1.5">
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {isLoading
                  ? 'Импорт и обработка данных...'
                  : mode === 'csv'
                  ? 'Перетащите CSV с отредактированными товарами'
                  : 'Перетащите файл со стеной VK сюда'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                {mode === 'csv'
                  ? 'Режим обратного импорта правок из Excel (CSV). Файл должен содержать колонки: ID Поста, Отредактированный текст, Итоговая цена (₽).'
                  : 'Поддерживается импорт ответов методов wall.get в формате .json'}
              </p>
            </div>

            {!isLoading && (
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg group-hover:bg-indigo-100/80 transition-all">
                Выбрать файл на устройстве
              </span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 w-full pt-4">
            <span>Максимум: 10 МБ</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full" />
            <span>Пачка до 10 000 записей</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full" />
            <span>Жёсткая валидация заголовков</span>
          </div>

          {activeError && (
            <div
              id="upload-error"
              onClick={(e) => e.stopPropagation()}
              className="absolute -bottom-14 left-0 right-0 p-3 flex items-center gap-2 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 rounded-xl max-w-lg mx-auto shadow-xs text-xs animate-in fade-in slide-in-from-top-2 duration-300"
            >
              <AlertCircle size={16} className="shrink-0" />
              <span>{activeError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
