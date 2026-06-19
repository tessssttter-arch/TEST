/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Утилита экспорта постов в CSV-формат с поддержкой выбора колонок и экранирования спецсимволов.
// Все комментарии написаны на русском языке.

import { VKPost } from '../types/vk';

// Карта доступных колонок для экспорта с их человекочитаемым названием
export const EXPORT_COLUMNS_MAP: Record<string, string> = {
  post_id: 'ID Поста',
  source_url: 'Ссылка на оригинал',
  timestamp: 'Unix Дата',
  date_formatted: 'Дата публикации',
  text_original: 'Исходный текст',
  text_edited: 'Отредактированный текст',
  price_original: 'Оригинальная цена (₽)',
  price_edited: 'Итоговая цена (₽)',
  photo_urls: 'Ссылки на изображения (через точку с запятой)',
  likes: 'Лайки',
  comments: 'Комментарии',
  reposts: 'Репосты',
  views: 'Просмотры',
  signer_id: 'ID автора подписи (signer_id)',
  author_name: 'Имя автора поста',
  author_id: 'ID автора поста',
  hashtags: 'Хештеги',
  is_favorite: 'В избранном (Да/Нет)',
  is_exported: 'Выгружено (Да/Нет)',
};

/**
 * Экранирует значение ячейки для безопасной вставки в CSV.
 * Удваивает кавычки и оборачивает значение в кавычки.
 */
function escapeCSVCell(val: any): string {
  if (val === null || val === undefined) return '';
  
  let stringValue = '';
  if (Array.isArray(val)) {
    stringValue = val.join('; ');
  } else {
    stringValue = String(val);
  }

  // Заменяем кавычки " на ""
  const escaped = stringValue.replace(/"/g, '""');
  // Оборачиваем в кавычки
  return `"${escaped}"`;
}

/**
 * Генерирует строку CSV на основе выбранных постов и колонок.
 */
export function exportPostsToCSV(posts: VKPost[], selectedColumns: string[]): string {
  if (posts.length === 0 || selectedColumns.length === 0) return '';

  // 1. Создаем строку заголовков
  const headers = selectedColumns.map((col) => {
    return escapeCSVCell(EXPORT_COLUMNS_MAP[col] || col);
  });
  
  const csvLines: string[] = [headers.join(',')];

  // 2. Заполняем строками данных
  posts.forEach((post) => {
    const rowValues = selectedColumns.map((col) => {
      switch (col) {
        case 'post_id':
          return escapeCSVCell(post.post_id);
        case 'source_url':
          return escapeCSVCell(post.source_url);
        case 'timestamp':
          return escapeCSVCell(post.timestamp);
        case 'date_formatted':
          return escapeCSVCell(post.date_formatted);
        case 'text_original':
          return escapeCSVCell(post.text_original);
        case 'text_edited':
          return escapeCSVCell(post.text_edited);
        case 'price_original':
          return escapeCSVCell(post.price_original);
        case 'price_edited':
          return escapeCSVCell(post.price_edited);
        case 'photo_urls':
          const urls = post.images.map((img) => img.url);
          return escapeCSVCell(urls);
        case 'likes':
          return escapeCSVCell(post.likes);
        case 'comments':
          return escapeCSVCell(post.comments);
        case 'reposts':
          return escapeCSVCell(post.reposts);
        case 'views':
          return escapeCSVCell(post.views);
        case 'signer_id':
          return escapeCSVCell(post.signer_id || '');
        case 'author_name':
          return escapeCSVCell(post.author?.name || '');
        case 'author_id':
          return escapeCSVCell(post.author?.id || '');
        case 'hashtags':
          return escapeCSVCell(post.hashtags.join(', '));
        case 'is_favorite':
          return escapeCSVCell(post.is_favorite ? 'Да' : 'Нет');
        case 'is_exported':
          return escapeCSVCell(post.is_exported ? 'Да' : 'Нет');
        default:
          return escapeCSVCell('');
      }
    });

    csvLines.push(rowValues.join(','));
  });

  // UTF-8 BOM для корректного открытия в Excel (русские символы)
  const BOM = '\uFEFF';
  return BOM + csvLines.join('\r\n');
}

/**
 * Инициирует скачивание CSV-файла в браузере.
 */
export function downloadCSVFile(csvContent: string, fileName: string = 'vk_export.csv'): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
