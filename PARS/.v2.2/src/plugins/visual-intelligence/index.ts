/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Главный фасад VisualIntelligence — расчет перцептивных хэшей вложений и поиск дубликатов
import { computePHash, similarityPercentage } from './phash';
import { saveImageHash, getImageHash, getAllImageHashes, ImageHashRecord } from './db';

export interface VisualDuplicateResult {
  url: string;
  postId: string;
  similarity: number; // В процентах от 0 до 100
}

export const VisualIntelligence = {
  /**
   * Считает хэш для картинки (с автокешированием в IndexedDB)
   */
  async compute(url: string, postId: string): Promise<string> {
    if (!url) return '';
    
    // 1. Проверяем кеш
    const cached = await getImageHash(url);
    if (cached) {
      return cached;
    }

    // 2. Считаем реальный хэш
    const newPHash = await computePHash(url);
    
    // 3. Кешируем
    if (newPHash && newPHash !== '0000000000000000') {
      try {
        await saveImageHash(url, newPHash, postId);
      } catch (err) {
        console.warn('Не удалось сохранить хэш в IndexedDB:', err);
      }
    }

    return newPHash;
  },

  /**
   * Ищет визуальные дубликаты по всей базе данных IndexedDB
   * Возвращает список совпавших картинок с процентом сходства выше similarityThreshold
   */
  async findDuplicates(pHash: string, currentPostId: string, similarityThreshold = 80): Promise<VisualDuplicateResult[]> {
    if (!pHash || pHash === '0000000000000000') return [];

    try {
      const records = await getAllImageHashes();
      const results: VisualDuplicateResult[] = [];

      for (const rec of records) {
        // Пропускаем тот же самый пост
        if (rec.postId === currentPostId) continue;

        const sim = similarityPercentage(pHash, rec.pHash);
        if (sim >= similarityThreshold) {
          results.push({
            url: rec.url,
            postId: rec.postId,
            similarity: sim,
          });
        }
      }

      return results.sort((a, b) => b.similarity - a.similarity);
    } catch (err) {
      console.error('Ошибка во время поиска визуальных дубликатов:', err);
      return [];
    }
  },

  /**
   * Перестановка порядка изображений (переупорядочивание для экспорта)
   */
  reorderImages(images: { url: string; pHash: string }[], fromIndex: number, toIndex: number): { url: string; pHash: string }[] {
    const list = [...images];
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
      return list;
    }
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    return list;
  },

  /**
   * Исключение (удаление) картинки из поста товара
   */
  deleteImage(images: { url: string; pHash: string }[], index: number): { url: string; pHash: string }[] {
    const list = [...images];
    if (index >= 0 && index < list.length) {
      list.splice(index, 1);
    }
    return list;
  }
};
