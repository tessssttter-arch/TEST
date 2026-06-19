/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Движок для распознавания, извлечения и конвертации цен из текста постов на русском языке.
// Адаптирован специально под особенности объявлений рынка Садовод.

import { PriceDetails, PriceConfig } from '../types/vk';

// Дефолтные настройки цен
export const DEFAULT_PRICE_CONFIG: PriceConfig = {
  markupType: 'percent',
  markupValue: 0,
  roundingType: 'none',
  roundingValue: 10,
  exchangeRates: {
    USD: 85.0,
    EUR: 92.0,
    KZT: 0.19,
    UE: 85.0,
  },
};

interface PriceCandidate {
  value: number;
  originalValue: number;
  currency: string;
  isRange: boolean;
  rangeMin: number | null;
  rangeMax: number | null;
  rawMatch: string;
  index: number;
  score: number; // Вес доверия к кандидату
}

/**
 * Конвертирует числовое значение валюты в рубли по заданному курсу.
 */
export function convertToRub(value: number, currencyStr: string, config: PriceConfig): { rubValue: number; currency: string } {
  const cur = currencyStr.toLowerCase().trim();
  let rate = 1.0;
  let detectedCurrency = 'RUB';

  if (cur === 'usd' || cur === '$') {
    rate = config.exchangeRates.USD;
    detectedCurrency = 'USD';
  } else if (cur === 'eur' || cur === '€') {
    rate = config.exchangeRates.EUR;
    detectedCurrency = 'EUR';
  } else if (cur === 'у.е.' || cur === 'уе') {
    rate = config.exchangeRates.UE;
    detectedCurrency = 'UE';
  } else if (cur === 'тенге' || cur === '₸' || cur === 'kzt') {
    rate = config.exchangeRates.KZT;
    detectedCurrency = 'KZT';
  } else {
    // По умолчанию рубли
    rate = 1.0;
    detectedCurrency = 'RUB';
  }

  return {
    rubValue: value * rate,
    currency: detectedCurrency
  };
}

/**
 * Парсит строковое число (учитывает пробелы-разделители и точки: "1 500" -> 1500)
 */
function cleanNumber(str: string): number {
  // Убираем пробелы и точки-разделители тысяч
  const clean = str.replace(/\s+/g, '').replace(/\.(?=\d{3})/g, '');
  return parseFloat(clean);
}

/**
 * Интеллектуальный фильтр для ложноположительных срабатываний цен (размеры, линии павильонов, телефоны, даты, вес)
 */
function isFalsePositive(
  text: string,
  valueStr: string,
  matchIndex: number,
  originalMatchStr: string,
  isRange: boolean
): boolean {
  const contextLeft = text.slice(Math.max(0, matchIndex - 40), matchIndex).toLowerCase();
  const contextRight = text.slice(matchIndex + originalMatchStr.length, matchIndex + originalMatchStr.length + 40).toLowerCase();

  const cleanLeft = contextLeft.trim();
  const cleanRight = contextRight.trim();

  // 1. Исключение слишком длинных чисел (номера карт, телефоны и подобные)
  const numericOnly = originalMatchStr.replace(/\D/g, '');
  if (numericOnly.length >= 9) {
    return true; 
  }

  // 2. Исключение дат и времени
  // Например "24.05", "в 18.00" или внутри диапазона дат
  if (/^\s*[\.,]\s*\d{2}/.test(contextRight) && /^\d{2}\s*[\.,]/.test(originalMatchStr)) {
    return true; 
  }
  if (/^\d{1,2}\.\d{2}(?:\.\d{2,4})?$/.test(originalMatchStr.trim())) {
    return true; 
  }
  if (/^(?:\d{1,2}:\d{2}|\d{1,2}\s*ч\b)/.test(cleanRight)) {
    return true; // Это время публикации или встреч
  }

  // 3. Исключение размеров одежды/обуви
  // Ищем ключевые маркеры размеров слева в пределах 15 символов
  const isSizeLeft = /(?:размер|разме|разм|р-р|р-ры|рост|ростовк|size|sz|маркировк|р\.р|ряды|макировк|роста|разм\.)\s*[:.-]?\s*$/i.test(cleanLeft) ||
                     /(?:размер|разме|разм|р-р|р-ры|рост|ростовк|size|sz|маркировк|ряды|роста|разм\.)\s+$/i.test(cleanLeft);
  
  // Ключевые маркеры размеров справа
  const isSizeRight = /^(?:размер|разме|рост|см|разм|size|sz|ростовк)/.test(cleanRight);

  if (isSizeLeft || isSizeRight) {
    return true;
  }

  // Если это типичные размеры вроде "42-48", "42,44,46,48", и рядом нет валюты
  if (isRange && !/(?:руб|р\.|₽|usd|eur|у\.е\.)/i.test(originalMatchStr)) {
    const val = cleanNumber(valueStr);
    // На Садоводе одежда чаще всего в размерах от 36 до 64. 
    // Если диапазон находится в этих пределах, а валюты нет, то с высокой вероятностью это размеры!
    if (val >= 36 && val <= 64) {
      return true;
    }
  }

  // 4. Исключение линий и павильонов Садовода (адреса)
  const isAddressLeft = /(?:линия|лин|павильон|пав|место|корпус|корп|сектор|ряд|тц|контейнер|садовод|вход|линии|павильоны|месте|корп\.)\s*[:.-]?\s*$/i.test(cleanLeft) ||
                        /(?:линия|лин|павильон|пав|место|корпус|корп|сектор|ряд|тц|контейнер|садовод|вход|линии|павильоны|месте)\s+$/i.test(cleanLeft);
  
  if (isAddressLeft) {
    return true;
  }

  // Если адрес Садовода "22-15" (линия 22 павильон 15) пойман как цена
  // Обычно линии от 1 до 33, павильоны от 1 до 200.
  // Если у нас диапазон без валюты типа "24-15" или "14-88", то это адрес.
  if (isRange && !/(?:руб|р\.|₽|usd|eur|у\.е\.)/i.test(originalMatchStr)) {
    const parts = originalMatchStr.replace(/\s+/g, '').split(/[-–—до]/);
    if (parts.length >= 2) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      if (p1 >= 1 && p1 <= 35 && p2 >= 1 && p2 <= 200) {
        return true; 
      }
    }
  }

  // 5. Исключение количества штук / объемов / процентов / дней без валюты
  const isQuantityRight = /^(?:шт|штук|уп|упак|короб|пач|дн|дне|лет|год|кг|гр|грамм|мл|литр|л\b|мм|см|м\b|%|процент)/i.test(cleanRight);
  const hasCurrencyInMatch = /(?:руб|р\.|р\b|₽|usd|eur|у\.е\.)/i.test(originalMatchStr);
  const hasCurrencyRightAfter = /^(?:руб|р\.|₽|usd|eur|у\.е\.)/i.test(cleanRight);

  if (isQuantityRight && !hasCurrencyInMatch && !hasCurrencyRightAfter) {
    return true;
  }

  return false;
}

/**
 * Сканирует текст и собирает всех возможных кандидатов на извлечение цен.
 */
function getCandidates(text: string, config: PriceConfig): PriceCandidate[] {
  const candidates: PriceCandidate[] = [];

  // Временная очистка текста от телефонных номеров для точности парсирования чисел
  let cleanText = text.replace(/(?:\+7|8)[\s\(-]?\d{3}[\s\)-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g, ' [PHONE] ');

  // 1. Поиск диапазонов (например, "500-700 руб" или "от 1200 до 1500 рублей")
  const rangeReg = /(?:от\s+)?(\d{1,3}(?:[\s\.]?\d{3})*(?:\.\d{1,2})?)\s*(?:-|–|—|до)\s*(\d{1,3}(?:[\s\.]?\d{3})*(?:\.\d{1,2})?)\s*(руб\.?|рублей|р\.?|₽|rub|RUB|USD|\$|EUR|€|у\.?е\.?|тенге|₸|kzt|KZT)?/gi;
  let match;
  rangeReg.lastIndex = 0;
  while ((match = rangeReg.exec(cleanText)) !== null) {
    const minValStr = match[1];
    const maxValStr = match[2];
    const rawCurrency = match[3] || '₽';
    
    if (isFalsePositive(cleanText, minValStr, match.index, match[0], true)) {
      continue;
    }

    const minRaw = cleanNumber(minValStr);
    const maxRaw = cleanNumber(maxValStr);

    if (!isNaN(minRaw) && !isNaN(maxRaw)) {
      const { rubValue: minRub, currency } = convertToRub(minRaw, rawCurrency, config);
      const { rubValue: maxRub } = convertToRub(maxRaw, rawCurrency, config);

      const hasCur = !!match[3];
      const score = hasCur ? 3.0 : 1.5;

      candidates.push({
        value: Math.round(minRub * 100) / 100,
        originalValue: Math.round(minRub * 100) / 100,
        currency,
        isRange: true,
        rangeMin: Math.round(minRub * 100) / 100,
        rangeMax: Math.round(maxRub * 100) / 100,
        rawMatch: match[0],
        index: match.index,
        score
      });
    }
  }

  // 2. Поиск оптовых цен (например, "1500/опт" или "900 оптом")
  const wholesaleReg = /(\d{1,3}(?:[\s\.]?\d{3})*(?:\.\d{1,2})?)\s*(?:\/|\s+)(?:опт|оптовая|оптом|wholesale|опт\.)/gi;
  wholesaleReg.lastIndex = 0;
  while ((match = wholesaleReg.exec(cleanText)) !== null) {
    const valStr = match[1];
    
    if (isFalsePositive(cleanText, valStr, match.index, match[0], false)) {
      continue;
    }

    const valRaw = cleanNumber(valStr);
    if (!isNaN(valRaw)) {
      candidates.push({
        value: valRaw,
        originalValue: valRaw,
        currency: 'RUB',
        isRange: false,
        rangeMin: null,
        rangeMax: null,
        rawMatch: match[0],
        index: match.index,
        score: 3.5
      });
    }
  }

  // 3. Поиск цен с валютой справа (например, "Цена 1500 р.", "350₽", "1000 рублей")
  const rightCurrencyReg = /(\d{1,3}(?:[\s\.]?\d{3})*(?:\.\d{1,2})?)\s*(руб\.?|рублей|р\.|р\b|₽|rub|RUB|USD|\$|EUR|€|у\.?е\.?|тенге|₸|kzt|KZT)/gi;
  rightCurrencyReg.lastIndex = 0;
  while ((match = rightCurrencyReg.exec(cleanText)) !== null) {
    const valStr = match[1];
    const curStr = match[2];

    if (isFalsePositive(cleanText, valStr, match.index, match[0], false)) {
      continue;
    }

    const valRaw = cleanNumber(valStr);
    if (!isNaN(valRaw)) {
      const { rubValue, currency } = convertToRub(valRaw, curStr, config);
      
      const contextLeft = cleanText.slice(Math.max(0, match.index - 15), match.index).toLowerCase();
      const hasKeywordLeft = /(?:цена|стоит|стоимость|по)\s*[:.-]?\s*$/i.test(contextLeft);
      const score = hasKeywordLeft ? 4.5 : 4.0;

      candidates.push({
        value: Math.round(rubValue * 100) / 100,
        originalValue: Math.round(rubValue * 100) / 100,
        currency,
        isRange: false,
        rangeMin: null,
        rangeMax: null,
        rawMatch: match[0],
        index: match.index,
        score
      });
    }
  }

  // 4. Поиск цен с валютой слева (например, "$15", "€200")
  const leftCurrencyReg = /(\$|€|£|₽|у\.е\.)\s*(\d{1,3}(?:[\s\.]?\d{3})*(?:\.\d{1,2})?)/gi;
  leftCurrencyReg.lastIndex = 0;
  while ((match = leftCurrencyReg.exec(cleanText)) !== null) {
    const curStr = match[1];
    const valStr = match[2];

    if (isFalsePositive(cleanText, valStr, match.index, match[0], false)) {
      continue;
    }

    const valRaw = cleanNumber(valStr);
    if (!isNaN(valRaw)) {
      const { rubValue, currency } = convertToRub(valRaw, curStr, config);
      candidates.push({
        value: Math.round(rubValue * 100) / 100,
        originalValue: Math.round(rubValue * 100) / 100,
        currency,
        isRange: false,
        rangeMin: null,
        rangeMax: null,
        rawMatch: match[0],
        index: match.index,
        score: 3.8
      });
    }
  }

  // 5. Поиск цен со словом "цена" слева, без явного указания валюты на конце (например, "цена 1500")
  const keywordPriceReg = /(?:цена|стоимость|стоит|цена:|ст-ть|ст-ть:|ц:)\s*(?:всего|по)?\s*(\d{3,5})\b/gi;
  keywordPriceReg.lastIndex = 0;
  while ((match = keywordPriceReg.exec(cleanText)) !== null) {
    const valStr = match[1];

    if (isFalsePositive(cleanText, valStr, match.index, match[0], false)) {
      continue;
    }

    const valRaw = cleanNumber(valStr);
    if (!isNaN(valRaw)) {
      const isDuplicate = candidates.some(c => Math.abs(c.index - match.index) < 15);
      if (!isDuplicate) {
        candidates.push({
          value: valRaw,
          originalValue: valRaw,
          currency: 'RUB',
          isRange: false,
          rangeMin: null,
          rangeMax: null,
          rawMatch: match[0],
          index: match.index,
          score: 3.5
        });
      }
    }
  }

  return candidates;
}

/**
 * Извлекает цену из текста поста с применением приоритетов весов доверия.
 * Возвращает заполненную структуру PriceDetails или null.
 */
export function extractPriceFromText(text: string, config: PriceConfig = DEFAULT_PRICE_CONFIG): PriceDetails | null {
  if (!text) return null;

  const candidates = getCandidates(text, config);
  if (candidates.length === 0) return null;

  // Сортировка кандидатов по весу score (по убыванию),
  // а при равных score - по позиции в тексте по возрастанию (первое совпадение приоритетнее)
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.index - b.index;
  });

  const best = candidates[0];

  return {
    value: best.value,
    originalValue: best.originalValue,
    currency: best.currency,
    isRange: best.isRange,
    rangeMin: best.rangeMin,
    rangeMax: best.rangeMax,
    rawMatch: best.rawMatch
  };
}

/**
 * Применяет наценку и правила округления к исходной цене.
 */
export function calculateEditedPrice(originalPrice: number, config: PriceConfig): number {
  if (originalPrice === null || isNaN(originalPrice)) return 0;

  // 1. Применяем наценку
  let priced = originalPrice;
  if (config.markupType === 'percent') {
    priced = originalPrice * (1 + config.markupValue / 100);
  } else {
    priced = originalPrice + config.markupValue;
  }

  // 2. Округление
  const roundVal = config.roundingValue > 0 ? config.roundingValue : 1;
  let rounded = priced;

  switch (config.roundingType) {
    case 'floor':
      rounded = Math.floor(priced / roundVal) * roundVal;
      break;
    case 'ceil':
      rounded = Math.ceil(priced / roundVal) * roundVal;
      break;
    case 'round':
      rounded = Math.round(priced / roundVal) * roundVal;
      break;
    case 'to_9': {
      // Округление до 9 на конце (например, к ближайшей сотне минус 1 рубль)
      const base = Math.round(priced / roundVal) * roundVal;
      rounded = base - 1;
      if (rounded <= 0) rounded = priced;
      break;
    }
    case 'none':
    default:
      rounded = Math.round(priced * 100) / 100;
      break;
  }

  return Math.round(rounded * 100) / 100;
}
