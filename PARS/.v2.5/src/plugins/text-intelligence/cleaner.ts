/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Слой очистки текста от мусорных данных (TrashCutter)
// Находит и вырезает рекламные призывы, ссылки, телефоны, возвращая очищенный текст и лог шагов.

export interface CleanerStep {
  name: string;
  removed: string[];
}

export interface CleanerResult {
  cleanedText: string;
  steps: CleanerStep[];
}

const SPAM_PATTERNS = [
  /заказывать\s+сюда\s*[:\-]?\s*\S+/gi,
  /пишите\s+в\s+личку\s*[:\-]?\s*\S+/gi,
  /по\s+всем\s+вопросам\s+обращаться\s*\S+/gi,
  /жми\s+сюда\s*\S*/gi,
  /подписывайтесь\s+на\s+наш\s+\S+/gi,
  /активная\s+ссылка\s+в\s+шапке/gi,
  /доставка\s+по\s+всей\s+рф/gi,
  /успейте\s+купить/gi,
];

export function cleanText(text: string): CleanerResult {
  const steps: CleanerStep[] = [];
  let currentString = text;

  // 1. Вырезаем ссылки (t.me, vk.com, http...)
  const urlRegex = /(https?:\/\/[^\s]+|(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}(?:\/[^\s]*)?)/g;
  const urls: string[] = [];
  currentString = currentString.replace(urlRegex, (match) => {
    // Не вырезаем простые локации типа "22-45"
    if (/^\d+-\d+$/.test(match)) return match;
    urls.push(match);
    return '';
  });
  if (urls.length > 0) {
    steps.push({ name: 'Вырезание внешних ссылок', removed: urls });
  }

  // 2. Вырезаем Telegram упоминания (@username)
  const tgRegex = /@[a-zA-Z0-9_]+/g;
  const tgMentions: string[] = [];
  currentString = currentString.replace(tgRegex, (match) => {
    tgMentions.push(match);
    return '';
  });
  if (tgMentions.length > 0) {
    steps.push({ name: 'Вырезание Telegram упоминаний', removed: tgMentions });
  }

  // 3. Вырезаем номера телефонов
  const phoneRegex = /(?:\+?7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g;
  const phones: string[] = [];
  currentString = currentString.replace(phoneRegex, (match) => {
    phones.push(match);
    return '';
  });
  if (phones.length > 0) {
    steps.push({ name: 'Вырезание телефонов', removed: phones });
  }

  // 4. Вырезаем рекламные спам-призывы
  const removedSpam: string[] = [];
  for (const pattern of SPAM_PATTERNS) {
    currentString = currentString.replace(pattern, (match) => {
      removedSpam.push(match);
      return '';
    });
  }
  if (removedSpam.length > 0) {
    steps.push({ name: 'Удаление рекламного спама', removed: removedSpam });
  }

  // Очистка лишних пробелов и переносов строк
  currentString = currentString
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();

  return {
    cleanedText: currentString,
    steps,
  };
}
