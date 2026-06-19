/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Главный фасад TextIntelligence — конвейер NLP-разбора постов и сплиттинга мультипостов
import { cleanText } from './cleaner';
import { extractSizes, extractAndClassifyPrices } from './rules';
import { VENDOR_LOCATION_PATTERNS } from './lexicon';

export interface ParsingStepLog {
  step: string;
  timestamp: number;
  details: string;
}

export interface SmartParsedPost {
  id: string;                    // Детерминированный ID вида: vk_{owner_id}_{post_id}
  isSplitCopy: boolean;          // Флаг, является ли пост результатом сплиттинга мульти-поста
  originalText: string;          // Исходный текст для бэкапа и логов
  title: string;                 // Первая строка (название товара)
  description: string;           // Очищенный текст (без ссылок, телефонов, адресов)
  prices: {
    retail: number | null;       // Распознанная розничная/штучная цена
    wholesale: number | null;    // Распознанная оптовая цена
    isAmbiguous: boolean;        // Флаг конфликта (найдено много цен, движок сомневается)
  };
  sizes: string[];               // Массив распознанных размеров (например, ["42", "44", "46"])
  images: {
    url: string;
    pHash: string;               // Перцептивный хэш для поиска визуальных дубликатов
  }[];
  vendorLocation: string | null; // Вырезанный адрес (например, "Садовод, 22-45")
  parsingTrace: ParsingStepLog[];// Пошаговый лог для подсистемы отладки
}

export const TextIntelligence = {
  /**
   * Разбор и нормализация одиночного поста
   */
  parse(rawPost: { id: number; owner_id: number; text: string; attachments?: any[]; date: number }): SmartParsedPost {
    const traceLog: ParsingStepLog[] = [];
    const addTrace = (step: string, details: string) => {
      traceLog.push({ step, timestamp: Date.now(), details });
    };

    addTrace('Начало разбора', `Пост ID: ${rawPost.id}, Владелец: ${rawPost.owner_id}`);

    const originalText = rawPost.text || '';
    
    // 1. Очистка от мусора
    const cleanResult = cleanText(originalText);
    const cleanedText = cleanResult.cleanedText;
    cleanResult.steps.forEach(step => {
      addTrace(step.name, `Удалено: ${step.removed.join(', ')}`);
    });

    // 2. Определение Title (первая содержательная строка)
    const lines = cleanedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const title = lines[0] || 'Товар без названия';
    addTrace('Определение заголовка', `Установлен заголовок: "${title}"`);

    // 3. Вырезание адреса павильона (места)
    let vendorLocation: string | null = null;
    for (const pattern of VENDOR_LOCATION_PATTERNS) {
      const match = originalText.match(pattern);
      if (match) {
        vendorLocation = match[0].trim();
        addTrace('Поиск локации', `Найдено расположение поставщика: ${vendorLocation}`);
        break;
      }
    }

    // 4. Извлечение цен
    const priceAnalysis = extractAndClassifyPrices(originalText);
    addTrace(
      'Извлечение цен',
      `Распознано цен: ${priceAnalysis.rawList.length}. Розница: ${priceAnalysis.retail ?? 'не определено'}, Опт: ${priceAnalysis.wholesale ?? 'не определено'}`
    );

    // 5. Размеры
    const sizes = extractSizes(originalText);
    if (sizes.length > 0) {
      addTrace('Распознавание размеров', `Выявлены размеры: ${sizes.join(', ')}`);
    }

    // 6. Формирование картинок
    const images: { url: string; pHash: string }[] = [];
    if (rawPost.attachments) {
      for (const att of rawPost.attachments) {
        if (att.type === 'photo') {
          const photo = att.photo;
          if (photo && photo.sizes) {
            // Выбираем наибольший элемент по ширине
            const sortedSizes = [...photo.sizes].sort((a, b) => b.width - a.width);
            const bestUrl = sortedSizes[0]?.url || photo.photo_604 || '';
            if (bestUrl) {
              images.push({ url: bestUrl, pHash: '' });
            }
          }
        }
      }
    }
    addTrace('Загрузка вложений', `Отыскано ${images.length} изображений`);

    return {
      id: `vk_${rawPost.owner_id}_${rawPost.id}`,
      isSplitCopy: false,
      originalText,
      title,
      description: cleanedText,
      prices: {
        retail: priceAnalysis.retail,
        wholesale: priceAnalysis.wholesale,
        isAmbiguous: priceAnalysis.isAmbiguous,
      },
      sizes,
      images,
      vendorLocation,
      parsingTrace: traceLog,
    };
  },

  /**
   * Сплиттинг мульти-постов (Разделение одного поста на N независимых товаров)
   */
  splitMultiPosts(parsed: SmartParsedPost): SmartParsedPost[] {
    const text = parsed.originalText;
    
    // Ищем признаки мульти-товара, например, "1.", "2.", "3." или "Арт:" / разбиение по позициям
    const numberedItemRegex = /(?:^|\n)(?:[1-9]\.|👉|📍|\-)\s*([^\n]+)/g;
    const matches: string[] = [];
    let match;

    while ((match = numberedItemRegex.exec(text)) !== null) {
      matches.push(match[1].trim());
    }

    // Если найдено по крайней мере два четких раздела с нумерацией и в тексте есть разные цены
    if (matches.length >= 2 && parsed.images.length >= 2) {
      const splits: SmartParsedPost[] = [];
      const imageCountPerItem = Math.max(1, Math.floor(parsed.images.length / matches.length));

      matches.forEach((itemText, idx) => {
        // Вычисляем заголовок и описание под-поста
        const subTitle = itemText.split(/[,\-–]/)[0]?.trim() || `Товар №${idx + 1}`;
        const subPriceAnalysis = extractAndClassifyPrices(itemText);
        
        // Назначаем подмассив картинок
        const startImg = idx * imageCountPerItem;
        const subImages = parsed.images.slice(startImg, startImg + imageCountPerItem);

        const subTraceLog: ParsingStepLog[] = [
          { step: 'Мульти-сплиттинг', timestamp: Date.now(), details: `Выделен товар №${idx + 1} из группового поста Садовода` },
        ];

        splits.push({
          id: `${parsed.id}_split_${idx + 1}`,
          isSplitCopy: true,
          originalText: text,
          title: subTitle,
          description: itemText,
          prices: {
            retail: subPriceAnalysis.retail || parsed.prices.retail,
            wholesale: subPriceAnalysis.wholesale || parsed.prices.wholesale,
            isAmbiguous: subPriceAnalysis.isAmbiguous,
          },
          sizes: extractSizes(itemText).length > 0 ? extractSizes(itemText) : parsed.sizes,
          images: subImages.length > 0 ? subImages : parsed.images,
          vendorLocation: parsed.vendorLocation,
          parsingTrace: [...parsed.parsingTrace, ...subTraceLog],
        });
      });

      return splits;
    }

    return [parsed];
  }
};
