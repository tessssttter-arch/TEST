/**
 * Сервис для валидации и нормализации товаров (совмещает логику БД и парсера)
 */

import { Product } from '../types';
import { normalizeTagsArray } from '../utils/tag-normalizer';

export function normalizeProduct(raw: any): Product {
  const images: string[] = Array.isArray(raw.images) 
    ? raw.images 
    : (raw.main_image ? [raw.main_image] : []);
  
  const mainImage = raw.main_image || images[0] || '';
  
  // [AI-EDIT] Исправление логики генерации product_id | 2026-06-14 | Контрольная проверка DoC
  // [AI-CONTEXT] Теперь идентификатор генерируется только при полном отсутствии и product_id, и id, 
  // что критически важно для корректного слияния товаров при импорте из VK (использующих детерминированные ID).
  const rawId = raw.product_id !== undefined ? raw.product_id : raw.id;
  const product_id = String(rawId !== undefined && rawId !== null && String(rawId).trim() !== "" ? rawId : crypto.randomUUID());
  // [AI-END]
  
  const price = Number(raw.price) || 0;
  const original_price = raw.original_price !== undefined && !isNaN(Number(raw.original_price))
    ? Number(raw.original_price)
    : price;

  const original_text = raw.original_text || raw.original_description || raw.description || '';
  const description = raw.description || raw.original_description || original_text || '';
  
  const sizes: string[] = Array.isArray(raw.sizes) 
    ? raw.sizes.map(String) 
    : (Array.isArray(raw.sizes_original) ? raw.sizes_original.map(String) : []);
    
  const sizes_original: string[] = Array.isArray(raw.sizes_original) 
    ? raw.sizes_original.map(String) 
    : [...sizes];

  const group_products = Array.isArray(raw.group_products) 
    ? raw.group_products.join(", ") 
    : String(raw.group_products || "Разное");

  return {
    ...raw, // Сохраняем дополнительные специфичные кастомные метаданные
    product_id,
    price,
    original_price,
    main_image: mainImage,
    images: images.length > 0 ? images : (mainImage ? [mainImage] : []),
    original_text,
    description,
    source_url: raw.source_url || '',
    group_products,
    sizes,
    sizes_original,
    date: raw.date || new Date().toLocaleString("ru-RU"),
    photos_count: Number(raw.photos_count) || (images.length > 0 ? images.length : (mainImage ? 1 : 0)),
    comments_count: Number(raw.comments_count) || 0,
    likes_count: Number(raw.likes_count) || 0,
    starred: Boolean(raw.starred),
    selected: Boolean(raw.selected),
    is_modified: raw.is_modified !== undefined ? Boolean(raw.is_modified) : false,
    tags: normalizeTagsArray(raw.tags)
  };
}

export function validateAndNormalize(rawList: any[]): Product[] {
  return rawList.map((item, idx) => {
    const rawId = item.product_id !== undefined ? item.product_id : item.id;
    if (rawId === undefined || rawId === null || String(rawId).trim() === "") {
      throw new Error(`Ошибка схемы: товар под индексом ${idx} не имеет обязательного уникального идентификатора ('product_id' или 'id')!`);
    }
    
    if (item.price === undefined || item.price === null || isNaN(Number(item.price))) {
      throw new Error(`Ошибка схемы: товар ID ${rawId} имеет неверный формат цены ('price' должен быть числом)!`);
    }

    return normalizeProduct(item);
  });
}
