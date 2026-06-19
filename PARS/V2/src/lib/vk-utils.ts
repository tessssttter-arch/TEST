/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Утилиты для импорта, парсинга и нормализации “сырых” данных из ВКонтакте (wall.get).
// Все комментарии написаны на русском языке.

import { VKPost, VKAuthor, VKImage, PriceConfig } from '../types/vk';
import { extractPriceFromText, calculateEditedPrice } from './price-utils';

/**
 * Извлекает максимальное качество фото из сырого объекта VK photo.
 */
export function getVkMaxResPhoto(photo: any): VKImage | null {
  if (!photo) return null;
  const sizes = photo.sizes || [];

  if (sizes.length > 0) {
    // Сортируем по разрешению (ширина * высота) по убыванию и выбираем наибольшее
    const sorted = [...sizes].sort((a, b) => {
      const areaA = (a.width || 0) * (a.height || 0) || a.width || 0;
      const areaB = (b.width || 0) * (b.height || 0) || b.width || 0;
      return areaB - areaA;
    });
    
    const best = sorted[0];
    return {
      url: best.url || best.src || '',
      width: best.width || 0,
      height: best.height || 0,
      vk_photo_id: `${photo.owner_id}_${photo.id}`,
    };
  }

  // Если массива sizes нет, ищем классические поля прямого URL
  const url =
    photo.photo_2560 ||
    photo.photo_1280 ||
    photo.photo_807 ||
    photo.photo_604 ||
    photo.photo_130 ||
    photo.photo_75 ||
    '';

  return {
    url,
    width: photo.width || 0,
    height: photo.height || 0,
    vk_photo_id: `${photo.owner_id || 0}_${photo.id || 0}`,
  };
}

/**
 * Получает форматированное представление даты на русском языке.
 * Пример: "8 июня 2026 г., 19:25"
 */
export function formatUnixTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Извлекает все хештеги из текста поста.
 * Ищет символы # за которыми следуют буквы, цифры и подчеркивания.
 */
export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/#[a-zA-Z0-9а-яА-ЯёЁ_]+/g);
  if (!matches) return [];
  // Очищаем и убираем дубликаты
  return Array.from(new Set(matches.map((tag) => tag.toLowerCase())));
}

/**
 * Генерирует дефолтного автора в зависимости от ID владельца.
 */
function createFallbackAuthor(ownerId: number): VKAuthor {
  const isGroup = ownerId < 0;
  const absId = Math.abs(ownerId);
  return {
    id: ownerId,
    name: isGroup ? `Сообщество #${absId}` : `Пользователь #${absId}`,
    avatar: '', // Будет сгенерирован плейсхолдер в UI
    type: isGroup ? 'group' : 'user',
    screen_name: isGroup ? `club${absId}` : `id${absId}`,
    gender: 'unknown',
  };
}

/**
 * Маппит единичный сырой элемент API VK в типизированный объект VKPost.
 */
export function mapVkItemToPost(item: any, profilesMap: Map<number, any>, groupsMap: Map<number, any>, priceConfig: PriceConfig): VKPost {
  const id = Number(item.id);
  const ownerId = Number(item.owner_id || item.to_id || 0);
  const postId = `${ownerId}_${id}`;
  const timestamp = Number(item.date || 0);

  // 1. Определение автора
  let author = createFallbackAuthor(ownerId);
  const fromId = Number(item.from_id || ownerId);

  if (fromId < 0) {
    const groupInfo = groupsMap.get(Math.abs(fromId));
    if (groupInfo) {
      author = {
        id: fromId,
        name: groupInfo.name || `Группа ${groupInfo.id}`,
        avatar: groupInfo.photo_100 || groupInfo.photo_50 || '',
        type: 'group',
        screen_name: groupInfo.screen_name || `club${Math.abs(fromId)}`,
      };
    }
  } else {
    const userInfo = profilesMap.get(fromId);
    if (userInfo) {
      let gender: 'male' | 'female' | 'unknown' = 'unknown';
      if (userInfo.sex === 1) gender = 'female';
      if (userInfo.sex === 2) gender = 'male';

      author = {
        id: fromId,
        name: `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim() || `Пользователь ${userInfo.id}`,
        avatar: userInfo.photo_100 || userInfo.photo_50 || '',
        type: 'user',
        screen_name: userInfo.screen_name || `id${fromId}`,
        gender,
      };
    }
  }

  // 2. Сбор вложений-изображений
  const images: VKImage[] = [];
  const attachments = item.attachments || [];
  
  attachments.forEach((attach: any) => {
    if (attach.type === 'photo' && attach.photo) {
      const imgObj = getVkMaxResPhoto(attach.photo);
      if (imgObj) {
        images.push(imgObj);
      }
    }
  });

  const textOriginal = item.text || '';
  const likesCount = Number(item.likes?.count || 0);
  const commentsCount = Number(item.comments?.count || 0);
  const repostsCount = Number(item.reposts?.count || 0);
  const viewsCount = Number(item.views?.count || 0);
  const priceDetails = extractPriceFromText(textOriginal, priceConfig);
  const priceOriginal = priceDetails ? priceDetails.value : null;
  const priceEdited = priceOriginal !== null ? calculateEditedPrice(priceOriginal, priceConfig) : null;
  const hashtags = extractHashtags(textOriginal);
  const absOwnerId = Math.abs(ownerId);
  const sourceUrl = `https://vk.com/wall${ownerId < 0 ? '-' : ''}${absOwnerId}_${id}`;

  return {
    post_id: postId,
    id,
    owner_id: ownerId,
    source_url: sourceUrl,
    timestamp,
    date_formatted: formatUnixTimestamp(timestamp),
    text_original: textOriginal,
    text_edited: textOriginal,
    images,
    is_grouped: images.length > 1,
    price_original: priceOriginal,
    price_edited: priceEdited,
    price_details: priceDetails,
    likes: likesCount,
    comments: commentsCount,
    reposts: repostsCount,
    views: viewsCount,
    signer_id: item.signer_id ? Number(item.signer_id) : undefined,
    hashtags,
    author,
    is_exported: false,
    is_favorite: false,
  };
}

/**
 * Главная функция парсинга сырого JSON-файла.
 */
export function parseVkJson(
  jsonContent: string,
  priceConfig: PriceConfig
): { posts: VKPost[]; error: string | null } {
  try {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      return { posts: [], error: 'Неверный формат JSON-файла.' };
    }

    let rawItems: any[] = [];
    let rawProfiles: any[] = [];
    let rawGroups: any[] = [];

    if (parsed.response && typeof parsed.response === 'object') {
      const response = parsed.response;
      rawItems = Array.isArray(response.items) ? response.items : [];
      rawProfiles = Array.isArray(response.profiles) ? response.profiles : [];
      rawGroups = Array.isArray(response.groups) ? response.groups : [];
    } else if (Array.isArray(parsed.items)) {
      rawItems = parsed.items;
      rawProfiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
      rawGroups = Array.isArray(parsed.groups) ? parsed.groups : [];
    } else if (Array.isArray(parsed)) {
      rawItems = parsed;
    } else if (parsed.items && Array.isArray(parsed.items)) {
      rawItems = parsed.items;
    } else {
      return {
        posts: [],
        error: 'Не удалось обнаружить список постов во входном файле. Убедитесь, что это выгрузка ответа wall.get.',
      };
    }

    if (rawItems.length === 0) {
      return { posts: [], error: 'Файл успешно загружен, но в нем отсутствует информация о постах.' };
    }

    const MAX_POSTS_LIMIT = 10000;
    const itemsToProcess = rawItems.slice(0, MAX_POSTS_LIMIT);

    const profilesMap = new Map<number, any>();
    rawProfiles.forEach((p) => profilesMap.set(Number(p.id), p));

    const groupsMap = new Map<number, any>();
    rawGroups.forEach((g) => groupsMap.set(Number(g.id), g));

    const processedPosts: VKPost[] = [];

    for (const item of itemsToProcess) {
      if (!item.id) continue;
      processedPosts.push(mapVkItemToPost(item, profilesMap, groupsMap, priceConfig));
    }

    return { posts: processedPosts, error: null };
  } catch (err: any) {
    return { posts: [], error: `Критическая ошибка при чтении JSON-файла: ${err.message || err}` };
  }
}

