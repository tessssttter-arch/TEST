/**
 * Сервис работы с базой данных IndexedDB.
 * Содержит оптимизированную пакетную очередь записи (Batch queue) с дебаунсом 300мс
 * для исключения микротранзакций и разгрузки процессора (Рекомендация №3).
 */

import { Product } from '../types';
import { normalizeProduct } from './product-normalizer';

const DB_NAME = 'appDataDB';
const DB_VERSION = 1;
const STORE_NAME = 'products';
const LS_MIGRATION_FLAG = 'idb_migration_completed';
const LS_CATALOG_KEY = 'curated_catalog_products';

// Буфер отложенной записи (Batch Queue)
const writeBuffer = new Map<string, Product>();
let flushTimeout: any = null;
let activeFlushPromise: Promise<void> | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'product_id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Не удалось открыть базу IndexedDB'));
  });
}

/**
 * Выполнить незамедлительную запись всех накопленных в буфере изменений в БД.
 */
export async function flushWrites(): Promise<void> {
  if (writeBuffer.size === 0) return;
  
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  // Если уже идет запись, ждем её завершения
  if (activeFlushPromise) {
    await activeFlushPromise;
  }

  const itemsToSave = Array.from(writeBuffer.values());
  writeBuffer.clear();

  activeFlushPromise = (async () => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const item of itemsToSave) {
        store.put(item);
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error('Транзакция отменена'));
      });

      console.info(`[IndexedDB Batch] Успешная пакетная запись: ${itemsToSave.length} товаров было синхронизировано.`);
    } catch (err) {
      console.error('[IndexedDB Batch] Ошибка сохранения пакета изменений:', err);
      // При ошибке возвращаем элементы в буфер для последующей попытки синхронизации
      for (const item of itemsToSave) {
        if (!writeBuffer.has(item.product_id)) {
          writeBuffer.set(item.product_id, item);
        }
      }
      throw err;
    } finally {
      activeFlushPromise = null;
    }
  })();

  await activeFlushPromise;
}

/**
 * Поставить товар в очередь на запись (с задержкой 300мс)
 */
function queueProductWrite(product: Product) {
  const normalized = normalizeProduct(product);
  writeBuffer.set(normalized.product_id, normalized);
  
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(() => {
    flushWrites().catch(() => {});
  }, 300);
}

/**
 * Миграция данных из localStorage старой V3 версии
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
  if (localStorage.getItem(LS_MIGRATION_FLAG) === 'true') return true;

  const raw = localStorage.getItem(LS_CATALOG_KEY);
  if (!raw) {
    localStorage.setItem(LS_MIGRATION_FLAG, 'true');
    return true;
  }

  try {
    const parsed = JSON.parse(raw);
    const products: Product[] = Array.isArray(parsed) 
      ? parsed.map(normalizeProduct) 
      : [normalizeProduct(parsed)];

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const p of products) {
      store.put(p);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    localStorage.setItem(LS_MIGRATION_FLAG, 'true');
    localStorage.removeItem(LS_CATALOG_KEY);
    console.info(`✅ [Миграция] Успешно перенесено ${products.length} позиций в IndexedDB.`);
    return true;
  } catch (error) {
    console.error('❌ Ошибка миграции из localStorage:', error);
    return false;
  }
}

// Слушатель закрытия страницы для мгновенного сохранения буфера
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (writeBuffer.size > 0) {
      // Пытаемся сохранить данные перед уходом пользователя
      flushWrites().catch(() => {});
    }
  });
}

// Экспортируемый API
export const catalogAPI = {
  /**
   * Получить все товары из БД. Если есть несинхронизированные элементы в буфере, 
   * они накладываются сверху для консистентности.
   */
  async getAll(): Promise<Product[]> {
    const db = await openDB();
    const dbProducts = await new Promise<Product[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // Накладываем "грязные" (измененные, но еще не сохраненные v IDB) товары сверху
    const merged = dbProducts.map((p) => {
      const buffered = writeBuffer.get(p.product_id);
      return buffered ? { ...p, ...buffered } : p;
    });

    // Также добавляем полностью новые товары, которые есть только в буфере
    const dbProductIds = new Set(merged.map(p => p.product_id));
    for (const p of writeBuffer.values()) {
      if (!dbProductIds.has(p.product_id)) {
        merged.push(p);
      }
    }

    return merged;
  },

  async getById(id: string): Promise<Product | null> {
    // Сначала ищем в буфере отложенной записи
    if (writeBuffer.has(String(id))) {
      return writeBuffer.get(String(id)) || null;
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(String(id));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Обновить/добавить товар (проходит через буферизацию)
   */
  async upsert(product: Product): Promise<void> {
    queueProductWrite(product);
  },

  /**
   * Групповое обновление (проходит через буферизацию)
   */
  async bulkUpsert(products: Product[]): Promise<void> {
    for (const p of products) {
      const normalized = normalizeProduct(p);
      writeBuffer.set(normalized.product_id, normalized);
    }
    
    if (flushTimeout) clearTimeout(flushTimeout);
    flushTimeout = setTimeout(() => {
      flushWrites().catch(() => {});
    }, 300);
  },

  /**
   * Удаление товара (удаляет из буфера и стирает из БД сразу, гарантируя актуальный вид UI)
   */
  async deleteById(id: string): Promise<void> {
    const stringId = String(id);
    writeBuffer.delete(stringId);
    
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(stringId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Полная очистка всей БД и сброс очередей
   */
  async clear(): Promise<void> {
    if (flushTimeout) clearTimeout(flushTimeout);
    writeBuffer.clear();
    
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Метод принудительной синхронизации для ручных триггеров
   */
  async forceSync(): Promise<void> {
    await flushWrites();
  }
};
