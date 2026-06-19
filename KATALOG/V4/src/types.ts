/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  product_id: string;
  price: number;
  original_price: number; // Для сравнения и выявления наценки/скидки
  main_image: string;
  images: string[];
  original_text: string;
  description: string;
  source_url: string;
  group_products: string; // Категория (Обувь, Одежда и т.д.)
  sizes: string[];        // Редактируемые куратором размеры
  sizes_original: string[]; // Оригинальные размеры от парсера
  date?: string;
  photos_count?: number;
  comments_count?: number;
  likes_count?: number;
  
  // Состояния куратора
  starred?: boolean;     // В избранном
  selected?: boolean;    // Выбран для группового экспорта/удаления
  is_modified?: boolean;  // Был ли изменен вручную
  tags?: string[];       // Тэги от куратора
  original_description?: string;
  original_text_original?: string;
  
  // Допускаем хранение дополнительных свойств спарсенных товаров
  [key: string]: unknown;
}

export type DBMode = 'readonly' | 'readwrite';
export type DBRequestResult<T> = { success: true; data: T } | { success: false; error: string };

export type ExportMode = "selected" | "favorites" | "diff";

export function getTagColor(tag: string) {
  const clean = tag.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    { bg: "bg-red-50 text-red-700 border-red-200/60", active: "bg-red-600 text-white border-transparent" },
    { bg: "bg-amber-50 text-amber-700 border-amber-200/60", active: "bg-amber-600 text-white border-transparent" },
    { bg: "bg-emerald-50 text-emerald-700 border-emerald-200/60", active: "bg-emerald-600 text-white border-transparent" },
    { bg: "bg-blue-50 text-blue-700 border-blue-200/60", active: "bg-blue-600 text-white border-transparent" },
    { bg: "bg-indigo-50 text-indigo-700 border-indigo-200/60", active: "bg-indigo-600 text-white border-transparent" },
    { bg: "bg-violet-50 text-violet-700 border-violet-200/60", active: "bg-violet-600 text-white border-transparent" },
    { bg: "bg-rose-50 text-rose-700 border-rose-200/60", active: "bg-rose-600 text-white border-transparent" },
    { bg: "bg-cyan-50 text-cyan-700 border-cyan-200/60", active: "bg-cyan-600 text-white border-transparent" },
    { bg: "bg-teal-50 text-teal-700 border-teal-200/60", active: "bg-teal-600 text-white border-transparent" },
    { bg: "bg-orange-50 text-orange-700 border-orange-200/60", active: "bg-orange-600 text-white border-transparent" },
  ];
  const idx = Math.abs(hash) % colors.length;
  return colors[idx];
}

export interface DiffReport {
  meta: {
    exported_at: string;
    type: string;
    total_items: number;
    modified_count: number;
  };
  items: Array<{
    product_id: string;
    status: "modified" | "unmodified";
    original_price: number;
    current_price: number;
    price_difference: number;
    original_sizes: string[];
    current_sizes: string[];
    sizes_changed: boolean;
    source_url: string;
  }>;
}
