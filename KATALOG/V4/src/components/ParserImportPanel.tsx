/**
 * Панель импорта данных парсера (ParserImportPanel).
 * Поддерживает вставку JSON, перетаскивание файлов (Drag & Drop), 
 * валидацию схем полей и выбор режима слияния (Merge vs Replace).
 * Полностью переведена на CatalogContext (Рекомендации №1 и №2).
 */

import React, { useState, useRef } from "react";
import { useCatalog } from "../context/CatalogContext";
import { Upload, AlertTriangle, CheckCircle, HelpCircle, FileJson, ArrowRightLeft } from "lucide-react";

interface ParserImportPanelProps {
  onClose?: () => void;
}

export default function ParserImportPanel({ onClose }: ParserImportPanelProps) {
  const { importProducts, addToast } = useCatalog();
  const [jsonText, setJsonText] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessImport = async () => {
    setErrorMsg(null);
    setSuccessCount(null);

    const txt = jsonText.trim();
    if (!txt) {
      setErrorMsg("Буфер обмена пуст. Пожалуйста, вставьте JSON данные.");
      return;
    }

    try {
      let parsed = JSON.parse(txt);
      if (!Array.isArray(parsed)) {
        parsed = [parsed];
      }

      await importProducts(parsed, importMode);
      setSuccessCount(parsed.length);
      setJsonText("");
      setTimeout(() => {
        onClose?.();
      }, 1500);
    } catch (e: any) {
      setErrorMsg(`Ошибка импорта: ${e?.message || e}`);
    }
  };

  // Drag and drop handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMsg(null);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const readFile = (file: File) => {
    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
      setErrorMsg("Разрешена загрузка только файлов .json");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        // Verify parsing immediately to avoid putting invalid text
        JSON.parse(text);
        setJsonText(text);
        addToast("Файл импорта успешно прочитан!", "success");
      } catch (e: any) {
        setErrorMsg(`Ошибка чтения JSON файла: ${e?.message || e}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div 
      id="parser-import-panel" 
      className="bg-white border border-stone-200 rounded-2xl shadow-md p-6 max-w-4xl mx-auto mb-8 transition-all font-sans text-left animate-zoom-in"
    >
      <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-stone-100 rounded-lg text-stone-700">
            <FileJson className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900">Импорт парсинг-данных VK / Telegram</h2>
            <p className="text-xs text-stone-550 font-sans">Загрузите или вставьте спарсенные товарные карточки в проект.</p>
          </div>
        </div>
        {onClose && (
          <button 
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors text-sm px-3 py-1.5 rounded-lg hover:bg-stone-50 border-0 bg-transparent cursor-pointer font-semibold"
          >
            Скрыть панель
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Input Section */}
        <div className="md:col-span-2 space-y-4">
          <label className="block text-xs font-bold font-mono text-stone-400 uppercase tracking-wider">Вставить спарсенные JSON-данные</label>
          <textarea
            id="import-raw-json-textarea"
            rows={10}
            className="w-full text-xs font-mono p-4 border border-stone-200 rounded-lg bg-stone-50 focus:bg-white focus:ring-1 focus:ring-stone-450 focus:outline-none transition-colors text-stone-850"
            placeholder={`[\n  {\n    "product_id": "vk_1049281",\n    "price": 2500,\n    "group_products": "Свитшоты",\n    "sizes_original": ["S", "M"],\n    "original_text": "Купить свитшот...",\n    "images": ["https://images.unsplash.com/photo-..."]\n  }\n]`}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />

          {/* Drag & Drop Hotspot */}
          <div
            id="import-drag-drop-zone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-all h-36 ${
              isDragging 
                ? "border-stone-850 bg-stone-100" 
                : "border-stone-200 bg-stone-50 hover:bg-stone-100"
            }`}
          >
            <Upload className="w-8 h-8 text-stone-400 mb-2" />
            <span className="text-xs font-medium text-stone-600 text-center select-none font-sans">
              Перетащите сюда .json-файл или <span className="text-stone-900 underline font-semibold">выберите с диска</span>
            </span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json,application/json"
              className="hidden"
            />
          </div>
        </div>

        {/* Right Configuration Section */}
        <div className="space-y-5 bg-stone-50 p-5 rounded-lg border border-stone-100 flex flex-col justify-between">
          <div className="space-y-4 text-left">
            <h3 className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-stone-500" />
              Параметры Импорта
            </h3>

            {/* Mode selection block */}
            <div className="space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  checked={importMode === "merge"}
                  onChange={() => setImportMode("merge")}
                  className="mt-1 accent-stone-900"
                />
                <div className="text-left select-none">
                  <span className="text-xs font-bold text-stone-850">Объединить (Merge)</span>
                  <p className="text-[10px] text-stone-500 leading-normal">Добавит новые вещи, обновит цены старых, сохранив ваши отметки, теги и избранное.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  checked={importMode === "replace"}
                  onChange={() => setImportMode("replace")}
                  className="mt-1 accent-stone-900"
                />
                <div className="text-left select-none">
                  <span className="text-xs font-bold text-stone-850">Заменить всю базу</span>
                  <p className="text-[10px] text-stone-500 leading-normal">Полная очистка текущей IndexedDB базы перед импортом новых товаров.</p>
                </div>
              </label>
            </div>

            {/* Help guidelines */}
            <div className="pt-3 border-t border-stone-205 space-y-2">
              <span className="text-[10px] font-mono text-stone-400 flex items-center gap-1 font-bold">
                <HelpCircle className="w-3.5 h-3.5" /> Схема Валидации
              </span>
              <p className="text-[10px] text-stone-500 font-mono leading-relaxed bg-stone-100 p-2.5 rounded-md border border-stone-150 text-left">
                • <strong>price</strong>: преобразует в number<br />
                • <strong>images</strong>: преобразует массивы<br />
                • <strong>sizes</strong>: автозаполнение<br />
                • <strong>original_text</strong>: резервная копия оригинала
              </p>
            </div>
          </div>

          <div className="space-y-3 shrink-0">
            {/* Notifications */}
            {errorMsg && (
              <div id="import-error-banner" className="bg-rose-50 text-rose-700 text-xs p-3 rounded-md flex items-start gap-2 border border-rose-200">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-rose-505" />
                <span className="leading-tight text-left">{errorMsg}</span>
              </div>
            )}

            {successCount !== null && (
              <div id="import-success-banner" className="bg-emerald-50 text-emerald-700 text-xs p-3 rounded-md flex items-center gap-2 border border-emerald-250">
                <CheckCircle className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                <span className="text-left">Успешно! Импортировано товаров: {successCount}</span>
              </div>
            )}

            <button
              id="import-apply-btn"
              type="button"
              onClick={handleProcessImport}
              className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer border-0"
            >
              Выполнить Импорт
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
