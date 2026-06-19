/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Типы данных для VK Insights Analyzer

// Интерфейс для изображения
export interface VKImage {
  url: string;
  width: number;
  height: number;
  vk_photo_id?: string;
}

// Автор поста (может быть пользователем или сообществом)
export interface VKAuthor {
  id: number;
  name: string;
  avatar: string;
  type: 'user' | 'group';
  screen_name?: string;
  gender?: 'male' | 'female' | 'unknown'; // Для пользователей: 1 - женский, 2 - мужской
}

// Извлеченная и нормализованная цена
export interface PriceDetails {
  value: number; // Итоговая цена в рублях (скорректированная или оригинальная)
  originalValue: number | null; // Исходная найденная цена в рублях
  currency: string; // Исходная валюта (RUB, USD, EUR, KZT, UE)
  isRange: boolean; // Является ли диапазоном
  rangeMin: number | null;
  rangeMax: number | null;
  rawMatch: string; // Исходная строка, совпавшая с паттерном
}

// Основная модель скомпонованного поста
export interface VKPost {
  post_id: string; // Уникальный идентификатор: "{owner_id}_{id}"
  id: number; // Числовой ID поста в VK
  owner_id: number; // ID владельца стены
  source_url: string; // Ссылка на оригинальный пост в VK
  timestamp: number; // Unix timestamp даты публикации
  date_formatted: string; // Красивая отформатированная дата
  
  text_original: string; // Оригинальный текст поста
  text_edited: string; // Отредактированный текст поста
  
  images: VKImage[]; // Список картинок поста
  is_grouped: boolean; // Объединены ли картинки из одного поста
  
  // Цены
  price_original: number | null; // Первоначальная извлеченная цена
  price_edited: number | null; // Измененная вручную или нацененная цена
  price_details: PriceDetails | null; // Подробная информация о цене
  
  // Метрики
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  
  // Метаданные
  signer_id?: number; // ID подписи (кто выложил пост в группе)
  hashtags: string[]; // Найденные хештеги
  author: VKAuthor; // Связанный объект автора
  
  // Статусы
  is_exported: boolean; // Отмечен ли как экспортированный
  is_favorite: boolean; // Добавлен ли в избранное

  // Поля Умного Парсинга (Text/Visual Intelligence)
  sizes?: string[];
  vendor_location?: string | null;
  is_split_copy?: boolean;
}

// Настройки парсинга цен и пересчета
export interface PriceConfig {
  markupType: 'percent' | 'fixed'; // Тип наценки: проценты или фиксированная сумма
  markupValue: number; // Величина наценки (например, 10 для 10% или 200 для +200 руб)
  roundingType: 'none' | 'floor' | 'ceil' | 'round' | 'to_9'; // Округление (to_9 - до 9 на конце, например 999)
  roundingValue: number; // Кратность округления (например, до 10, до 50, до 100)
  exchangeRates: {
    USD: number;
    EUR: number;
    KZT: number;
    UE: number;
  };
}

// Статистика загруженной выборки
export interface ParseStats {
  total_posts_requested: number;
  total_posts_received: number;
  posts_with_price: number;
  posts_without_price: number;
  posts_with_images: number;
  posts_text_only: number;
  total_likes: number;
  total_views: number;
}

// Конфигурационный профиль для экспорта в CSV
export interface ExportProfile {
  id: string;
  name: string;
  selectedColumns: string[];
  created_at: string;
}
