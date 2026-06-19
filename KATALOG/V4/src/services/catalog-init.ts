/**
 * Сервис начальной инициализации каталога.
 * Выполняет миграцию из устаревшего localStorage и засев демо-данных при первом входе куратора.
 */

import { Product } from "../types";
import { DEMO_PRODUCTS } from "../data/demoProducts";
import { catalogAPI, migrateFromLocalStorage } from "./catalog-db";

/**
 * Инициализирует сервис каталога.
 * 1. Пробует мигрировать данные из localStorage.
 * 2. Получает текущий список товаров.
 * 3. Если список пуст, заполняет его демо-данными.
 * 4. Сортирует и возвращает список товаров.
 */
export async function initCatalogService(): Promise<Product[]> {
  // 1. Попробовать мигрировать из localStorage старой версии
  await migrateFromLocalStorage();
  
  // 2. Получить текущие товары
  let currentList = await catalogAPI.getAll();
  
  // 3. Если БД пуста - загружаем профессиональный промо-каталог демо-товаров
  if (currentList.length === 0) {
    console.info("⚡ [Инициализация] База пуста. Проводим засев профессионального каталога товаров...");
    await catalogAPI.bulkUpsert(DEMO_PRODUCTS);
    // Сбрасываем буфер сразу, чтобы при первом рендере товары успели гарантированно записаться
    await catalogAPI.forceSync();
    currentList = await catalogAPI.getAll();
  }
  
  // 4. Сортировка по ID товара (Рекомендация №1)
  return currentList.sort((a, b) => 
    String(a.product_id).localeCompare(String(b.product_id))
  );
}
