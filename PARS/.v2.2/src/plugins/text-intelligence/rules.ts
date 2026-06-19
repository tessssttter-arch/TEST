/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Правила разметки цен, извлечения размеров и нечеткого соответствия (алгоритм Джаро-Винклера)
import { RETAIL_KEYWORDS, WHOLESALE_KEYWORDS, CLOTH_SIZES, SHOE_SIZES } from './lexicon';

export interface ExtractedPrices {
  retail: number | null;
  wholesale: number | null;
  isAmbiguous: boolean;
  rawList: { value: number; label: string; index: number }[];
}

/**
 * Вычисление расстояния Джаро-Винклера для нечеткого поиска ключевых слов
 */
export function jaroWinkler(s1: string, s2: string): number {
  s1 = s1.toLowerCase().trim();
  s2 = s2.toLowerCase().trim();
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(len2 - 1, i + matchWindow);
    for (let j = start; j <= end; j++) {
      if (!matches2[j] && s1[i] === s2[j]) {
        matches1[i] = true;
        matches2[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0.0;

  // Поиск транспозиций
  let trans = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (matches1[i]) {
      while (!matches2[k]) k++;
      if (s1[i] !== s2[k]) trans++;
      k++;
    }
  }

  const jaro = (matches / len1 + matches / len2 + (matches - trans / 2) / matches) / 3;

  // Коэффициент Винклера
  const prefixScalingFactor = 0.1;
  let commonPrefix = 0;
  const maxPrefix = Math.min(4, Math.min(len1, len2));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      commonPrefix++;
    } else {
      break;
    }
  }

  return jaro + commonPrefix * prefixScalingFactor * (1 - jaro);
}

/**
 * Проверка, похож ли токен на слово из списка по Джаро-Винклеру (порог 0.82)
 */
export function matchesFuzzyWord(token: string, keywordList: string[]): boolean {
  for (const kw of keywordList) {
    if (token.includes(kw) || kw.includes(token)) return true;
    if (jaroWinkler(token, kw) >= 0.82) return true;
  }
  return false;
}

/**
 * Извлекает все размеры (включая диапазоны типа "42-46" или "ряд 4шт")
 */
export function extractSizes(text: string): string[] {
  const normalized = text.toLowerCase();
  const sizesFound: Set<string> = new Set();

  // Ищем одиночные размеры в тексте
  const words = normalized.split(/[\s,./()\-+]+/);
  for (const word of words) {
    if (CLOTH_SIZES.includes(word) || SHOE_SIZES.includes(word)) {
      sizesFound.add(word.toUpperCase());
    }
  }

  // Также поищем популярный формат диапазонов, например, "42-48" или "42,44,46,48"
  const rangeRegex = /\b(4[0-8]|5[0-8]|3[5-9])[\s]*\-[\s]*(4[0-8]|5[0-8]|3[5-9])\b/g;
  let match;
  while ((match = rangeRegex.exec(normalized)) !== null) {
    const min = parseInt(match[1], 10);
    const max = parseInt(match[2], 10);
    if (!isNaN(min) && !isNaN(max) && min < max && max - min <= 12) {
      for (let s = min; s <= max; s += 2) {
        sizesFound.add(String(s));
      }
    }
  }

  return Array.from(sizesFound).sort();
}

/**
 * Извлекает цены и классифицирует их на розничные и оптовые на основе тегов/слов вокруг
 */
export function extractAndClassifyPrices(text: string): ExtractedPrices {
  const result: ExtractedPrices = {
    retail: null,
    wholesale: null,
    isAmbiguous: false,
    rawList: [],
  };

  if (!text) return result;

  // Ищем все числа, за которыми идут валютные символы или ключевые слова рубля
  // Например: "1500₽", "1500 руб", "1 500 р.", "1200", но исключаем телефоны, номера павильонов (типа 22-45)
  // Для начала отыщем все упоминания цен
  const priceRegex = /\b(\d{3,5})\s*(?:руб|р|₽|rub|usd|\$|eur|€)?\b/gi;
  let match;
  const numbers: { value: number; index: number; textAround: string }[] = [];

  const normalized = text.toLowerCase();

  while ((match = priceRegex.exec(normalized)) !== null) {
    const val = parseInt(match[1], 10);
    if (isNaN(val) || val < 100 || val > 150000) continue; // Исключаем нерелевантные числа

    // Проверяем, не является ли это частью павильона, например "22-45" или "павильон 18"
    const startIdx = Math.max(0, match.index - 15);
    const endIdx = Math.min(normalized.length, match.index + match[0].length + 15);
    const context = normalized.substring(startIdx, endIdx);

    if (/павильон|линия|пав|бокс|место|номер/i.test(context)) {
      // Это локация, игнорируем
      continue;
    }

    numbers.push({
      value: val,
      index: match.index,
      textAround: context,
    });
  }

  if (numbers.length === 0) return result;

  // Классифицируем каждое число
  for (const num of numbers) {
    let label = 'unknown';

    // Ищем признаки опта или розницы в контексте вокруг числа
    const tokens = num.textAround.split(/[\s,./()\-]+/);
    for (const token of tokens) {
      if (matchesFuzzyWord(token, WHOLESALE_KEYWORDS)) {
        label = 'wholesale';
        break;
      }
      if (matchesFuzzyWord(token, RETAIL_KEYWORDS)) {
        label = 'retail';
        break;
      }
    }

    result.rawList.push({
      value: num.value,
      label,
      index: num.index,
    });
  }

  // Обрабатываем распределение цен
  const wholesales = result.rawList.filter((x) => x.label === 'wholesale');
  const retails = result.rawList.filter((x) => x.label === 'retail');
  const unknowns = result.rawList.filter((x) => x.label === 'unknown');

  if (wholesales.length > 0) {
    result.wholesale = Math.min(...wholesales.map((x) => x.value));
  }
  if (retails.length > 0) {
    result.retail = Math.min(...retails.map((x) => x.value));
  }

  // Если у нас только одна цена и она "неизвестна", по умолчанию трактуем её как розничную
  if (result.wholesale === null && result.retail === null && unknowns.length === 1) {
    result.retail = unknowns[0].value;
  }
  // Если две цены неизвестны, одна поменьше, одна побольше - часто меньшая является оптом, большая - розницей
  else if (result.wholesale === null && result.retail === null && unknowns.length >= 2) {
    const sortedVals = Array.from(new Set(unknowns.map((x) => x.value))).sort((a, b) => a - b);
    result.wholesale = sortedVals[0];
    result.retail = sortedVals[1];
    result.isAmbiguous = true;
  }

  // Проверка конфликтов / двусмысленности
  if (result.rawList.length > 2 || (result.wholesale && result.retail && Math.abs(result.retail - result.wholesale) < 50)) {
    result.isAmbiguous = true;
  }

  return result;
}
