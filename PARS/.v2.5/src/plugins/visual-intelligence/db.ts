/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Интеграция с базой данных IndexedDB для кеширования хэшей и быстрого поиска дубликатов постов

export interface ImageHashRecord {
  url: string;
  pHash: string;
  postId: string;
  timestamp: number;
}

const DB_NAME = 'vk_insights_vintelligence_db';
const DB_VERSION = 1;
const STORE_NAME = 'image_hashes';

let dbInstance: IDBDatabase | null = null;

export function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('pHash', 'pHash', { unique: false });
        store.createIndex('postId', 'postId', { unique: false });
      }
    };

    request.onsuccess = (e) => {
      dbInstance = (e.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (e) => {
      reject(new Error(`IndexedDB failed to open: ${request.error?.message}`));
    };
  });
}

/**
 * Сохранить перцептивный хэш картинки в базу данных
 */
export async function saveImageHash(url: string, pHash: string, postId: string): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(transaction.objectStoreNames[0]);

    const record: ImageHashRecord = {
      url,
      pHash,
      postId,
      timestamp: Date.now(),
    };

    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Получить хэш конкретной картинки
 */
export async function getImageHash(url: string): Promise<string | null> {
  const db = await initIndexedDB();
  return new Promise((resolve) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(transaction.objectStoreNames[0]);
    const request = store.get(url);

    request.onsuccess = () => {
      const record = request.result as ImageHashRecord | undefined;
      resolve(record ? record.pHash : null);
    };
    request.onerror = () => {
      resolve(null);
    };
  });
}

/**
 * Выбрать все записи из БД
 */
export async function getAllImageHashes(): Promise<ImageHashRecord[]> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(transaction.objectStoreNames[0]);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve((request.result as ImageHashRecord[]) || []);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Полностью сбросить IndexedDB кеш картинок
 */
export async function clearImageHashesDB(): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(transaction.objectStoreNames[0]);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
