/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Компонент загрузки файлов JSON (wall.get) с поддержкой Drag & Drop, валидации и индикации прогресса.
// Все комментарии написаны на русском языке.

import React, { useRef, useState } from 'react';
import { Upload, FileCode, AlertCircle, RefreshCw } from 'lucide-react';
import { usePostsStore } from '../../hooks/use-posts-store';

export const FileUploader: React.FC = () => {
  const { importJson, isLoading, error: storeError, clearAll, posts, fileName } = usePostsStore();
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Валидация файла по ТЗ: Максимальный размер 10 МБ.
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 МБ в байтах

  const processFile = (file: File) => {
    setLocalError(null);

    // Проверка расширения
    if (!file.name.endsWith('.json')) {
      setLocalError('Пожалуйста, выберите файл в формате .json');
      return;
    }

    // Проверка размера файла
    if (file.size > MAX_FILE_SIZE) {
      setLocalError(`Размер файла превышает лимит 10 МБ. Ваш файл: ${(file.size / (1024 * 1024)).toFixed(2)} МБ.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        importJson(result, file.name);
      }
    };
    reader.onerror = () => {
      setLocalError('Ошибка при чтении файла с диска.');
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const activeError = localError || storeError;

  return (
    <div id="file-uploader-section" className="w-full">
      {posts.length > 0 && fileName ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 dark:border-emerald-950/30 dark:bg-emerald-950/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 rounded-lg">
              <FileCode size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{fileName}</p>
              <p className="text-xs text-slate-500">Успешно загружено и структурировано {posts.length} постов.</p>
            </div>
          </div>
          <button
            id="reupload-button"
            onClick={clearAll}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 dark:text-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw size={14} />
            Загрузить другой файл
          </button>
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
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className={`p-4 rounded-full transition-all duration-300 ${
              isDragActive 
                ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400 scale-110' 
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 group-hover:bg-indigo-50 group-hover:text-indigo-500 dark:group-hover:bg-indigo-950/60 dark:group-hover:text-indigo-400'
            }`}>
              {isLoading ? (
                <RefreshCw size={28} className="animate-spin" />
              ) : (
                <Upload size={28} />
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {isLoading ? 'Импорт и обработка данных...' : 'Перетащите файл со стеной VK сюда'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Поддерживается импорт ответов методов <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 font-mono text-[10px] rounded text-indigo-600 dark:text-indigo-400">wall.get</code> в формате <code className="font-mono text-[10px] text-slate-600 dark:text-slate-300">.json</code>
              </p>
            </div>

            {!isLoading && (
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg group-hover:bg-indigo-100/80 transition-all">
                Выбрать файл на устройстве
              </span>
            )}
          </div>

          {/* Валидационные лимиты в футере виджета */}
          <div className="mt-6 flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 w-full pt-4">
            <span>Максимум: 10 МБ</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            <span>Пачка до 10 000 записей</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            <span>Автогруппировка медиа</span>
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
