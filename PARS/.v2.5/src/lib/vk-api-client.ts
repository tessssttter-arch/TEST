/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Клиент для интеграции с VK API (реальный через JSONP и симулированный режим Песочницы для тестирования).
// Все комментарии написаны на русском языке.

import { VKPost, VKAuthor, VKImage, PriceConfig } from '../types/vk';
import { formatUnixTimestamp, extractHashtags } from './vk-utils';
import { extractPriceFromText, calculateEditedPrice } from './price-utils';

// Описание типа для подключенной группы
export interface VKGroup {
  id: number;
  name: string;
  avatar: string;
  screen_name: string;
  members_count?: number;
}

// Описание типа аккаунта VK
export interface VKAccount {
  vk_user_id: string;
  first_name: string;
  last_name: string;
  avatar: string;
  access_token: string;
  isSandbox: boolean;
}

// Описание лога экспорта в VK
export interface VKExportLog {
  id: string;
  postId: string;
  postText: string;
  targetGroupName: string;
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
  message: string;
}

/**
 * Простая реализация JSONP для запросов к VK API напрямую из браузера в обход CORS.
 */
export function fetchVkJsonp<T = any>(methodName: string, params: Record<string, any>): Promise<T> {
  return new Promise((resolve, reject) => {
    const callbackName = `vk_jsonp_callback_${Math.round(1000000 * Math.random())}`;
    
    // Таймаут для отлова ошибок соединения
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Превышено время ожидания ответа от VK API (CORS/Таймаут)'));
    }, 10000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      if ((window as any)[callbackName]) {
        delete (window as any)[callbackName];
      }
      const existingScript = document.getElementById(callbackName);
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };

    // Регистрируем глобальный коллбек
    (window as any)[callbackName] = (result: any) => {
      cleanup();
      if (result && result.error) {
        reject(new Error(result.error.error_msg || `Ошибка VK API #${result.error.error_code}`));
      } else {
        resolve(result);
      }
    };

    // Строим строку параметров запроса
    const queryParams = {
      ...params,
      callback: callbackName
    };
    
    const queryString = Object.keys(queryParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const url = `https://api.vk.com/method/${methodName}?${queryString}`;

    // Создаем элемент script
    const script = document.createElement('script');
    script.id = callbackName;
    script.src = url;
    script.onerror = () => {
      cleanup();
      reject(new Error('Не удалось выполнить JSONP-запрос. Проверьте соединение с интернетом или блокировки.'));
    };

    document.body.appendChild(script);
  });
}

// Коллекция встроенных высококачественных картинок товаров для песочницы
const SANDBOX_PRODUCT_IMAGES = [
  'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80', // Вечернее платье
  'https://images.unsplash.com/photo-1543087903-1ac2ec7aa8c5?w=600&auto=format&fit=crop&q=80', // Модный костюм
  'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&auto=format&fit=crop&q=80', // Куртка демисезон
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80', // Желтый наряд
  'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=600&auto=format&fit=crop&q=80', // Одежда
  'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&auto=format&fit=crop&q=80', // Юбка и блуза
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&auto=format&fit=crop&q=80', // Сумка и стиль
  'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&auto=format&fit=crop&q=80', // Джинсы и кардиган
  'https://images.unsplash.com/photo-1554412933-514a83d2f3c8?w=600&auto=format&fit=crop&q=80', // Пальто серое
  'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&auto=format&fit=crop&q=80', // Свитшот
];

/**
 * Генератор симулированных постов для режима Песочницы.
 */
export function generateSandboxWall(ownerId: number, count: number = 30, priceConfig: PriceConfig): VKPost[] {
  const result: VKPost[] = [];
  const currentUnix = Math.floor(Date.now() / 1000);
  
  // Создаем фейковых авторов
  const groupNames = {
    [-1001]: { name: 'Садовод Одежда Оптом 24', avatar: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=100&h=100&fit=crop' },
    [-1002]: { name: 'Павильон 2Б-45 Shoes Classic', avatar: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=100&h=100&fit=crop' },
    [-1003]: { name: 'Luxury Мода Платья & Костюмы', avatar: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=100&h=100&fit=crop' },
    [-1004]: { name: 'Куртки оптом VIP Садовод', avatar: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=100&h=100&fit=crop' },
  };

  const groupInfo = (groupNames as any)[ownerId] || { name: `Садовод Поставщик #${Math.abs(ownerId)}`, avatar: '' };
  
  const author: VKAuthor = {
    id: ownerId,
    name: groupInfo.name,
    avatar: groupInfo.avatar,
    type: 'group',
    screen_name: `public${Math.abs(ownerId)}`
  };

  const textTemplates = [
    '👗 Шикарное платье в наличии!\nТкань: дорогая лапша в рубчик, очень приятное к телу супер качество!\nРазмеры: 42, 44, 46, 48 (идут в размер)\nЦена: 1650₽\nРаботаем без выходных, отправка во все регионы РФ! #мода #платье #садовод',
    '👟 Кроссовки Adidas Neo облегченные на весну-лето.\nСупер качество по супер цене!\nРазмерный ряд: 41 - 46 (маломерят на размер)\nЦена за штуку: 2100₽.\nПри покупке от коробки скидка! Опт 1500 рублей/опт.\nАдрес: корп Б, этаж 2, пав 34. #обувь #садовод #акция',
    '🧥 Куртка демисезонная мужская со съемным капюшоном.\nВетрозащитная непромокаемая ткань, плотный утеплитель холлофайбер.\nЦвета: черный, темно-синий, хаки.\nЦена поставщика всего 3500₽! Успейте купить!\nРазмеры: 48, 50, 52, 54, 56. #upperwear #куртки #оптом',
    '👜 Сумка женская кросс-боди из мягкой экокожи люкс класса.\nФормат очень удобный, внутри три отделения под молнию.\nРемешок регулируется по длине.\nЦена: 1200р\nРозница 1400 рублей (самовывоз).\nЖивые фото прикреплены. #сумки #мода #аксессуары',
    '👚 Кофта легкая оверсайз нежная вязка.\nРазмер единый (42-48).\nПалитра цветов: пудра, беж, олива, белый, голубой.\nЦена оптом: 900₽\nВ розницу цена 1100₽/шт. #кофта #оверсайз #новое',
    '👖 Джинсы женские завышенная талия бананы.\nОтличное качество, стрейч тянется шикарно!\nРазмеры: 26 - 31\nОригинальная цена: 1500₽\nДоставка ТК Садовод или Почтой. #джинсы #садовод #распродажа',
    '👔 Рубашка мужская вельветовая классика.\nСостав: 100% плотный хлопок.\nРазмеры от С до ХХЛ (44-52)\nЦена: 1300₽\nПомерить можно в пав. 12-42. #рубашка #мужскойстиль',
    '🩳 Спортивный легкий костюм двойка (футболка + шорты).\nТкань: турецкий двухниточный трикотаж люкс.\nЦена на сегодня снижена: было 1800р, стало всего 1350₽! Спешите приобрести.\nОптом от 5 шт по 1100 руб. #спорт #костюм #распродажа',
    '👢 Сапоги осенние женские натуральная замша.\nСупер удобная колодка со средним устойчивым каблуком.\nРазмеры: 36, 37, 38, 39, 40.\nЦена: 4500₽\nПолный пакет документов в наличии. #обувь #сапоги #замша',
    '🌟 Футболка базовая белая плотный хлопок 220гр.\nИдеальная посадка, унисекс.\nРазмеры: XS - XXL\nЦена в розницу: 800 рублей\nЦена ОПТ от 10шт: 500 рублей/опт. #база #футболка #унисекс'
  ];

  for (let i = 0; i < count; i++) {
    const id = 1204000 + i;
    const postId = `${ownerId}_${id}`;
    const timestamp = currentUnix - (i * 3600 * 2) - Math.floor(Math.random() * 1800); // С шагом ~2 часа назад
    
    // Берем шаблон текста циклически
    const textOriginal = textTemplates[i % textTemplates.length];
    
    // Формируем картинки (1 до 3 штук)
    const imagesCount = Math.floor(Math.random() * 3) + 1; // 1 to 3
    const images: VKImage[] = [];
    
    for (let imgIndex = 0; imgIndex < imagesCount; imgIndex++) {
      const idx = (i * 3 + imgIndex) % SANDBOX_PRODUCT_IMAGES.length;
      images.push({
        url: SANDBOX_PRODUCT_IMAGES[idx],
        width: 800,
        height: 600,
        vk_photo_id: `${ownerId}_photo_${id}_${imgIndex}`
      });
    }

    // Парсим цену
    const priceDetails = extractPriceFromText(textOriginal, priceConfig);
    const priceOriginal = priceDetails ? priceDetails.value : null;
    const priceEdited = priceOriginal !== null ? calculateEditedPrice(priceOriginal, priceConfig) : null;

    // Engagement
    const likesCount = Math.floor(Math.random() * 150) + 5;
    const commentsCount = Math.floor(Math.random() * 30);
    const repostsCount = Math.floor(Math.random() * 15);
    const viewsCount = Math.floor(likesCount * (Math.random() * 15 + 8)) + 120;

    result.push({
      post_id: postId,
      id,
      owner_id: ownerId,
      source_url: `https://vk.com/wall${ownerId < 0 ? '-' : ''}${Math.abs(ownerId)}_${id}`,
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
      hashtags: extractHashtags(textOriginal),
      author,
      is_exported: false,
      is_favorite: false
    });
  }

  return result;
}

/**
 * Основной обработчик интеграции VK API с поддержкой реальных запросов и песочницы.
 */
export const VK_API = {
  /**
   * Возвращает список групп, доступных пользователю
   */
  async getAdminGroups(token: string, isSandbox: boolean = false): Promise<VKGroup[]> {
    if (isSandbox) {
      // Имитируем задержку сети
      await new Promise(resolve => setTimeout(resolve, 800));
      return [
        { id: 1001, name: 'Садовод Одежда Оптом 24', avatar: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=100&h=100&fit=crop', screen_name: 'sadovod_opt_24', members_count: 45700 },
        { id: 1002, name: 'Павильон 2Б-45 Shoes Classic', avatar: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=100&h=100&fit=crop', screen_name: 'shoes_classic_sadovod', members_count: 12400 },
        { id: 1003, name: 'Luxury Мода Платья & Костюмы', avatar: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=100&h=100&fit=crop', screen_name: 'luxury_elegance_p', members_count: 98000 },
        { id: 1004, name: 'Куртки оптом VIP Садовод', avatar: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=100&h=100&fit=crop', screen_name: 'vip_jackets_opt', members_count: 32000 }
      ];
    }

    try {
      // Реальный запрос к ВК API через JSONP
      const data = await fetchVkJsonp('groups.get', {
        access_token: token,
        v: '5.131',
        extended: 1,
        filter: 'admin,moder' // Администратор либо модератор
      });

      if (data && data.response && Array.isArray(data.response.items)) {
        return data.response.items.map((g: any) => ({
          id: Math.abs(Number(g.id)),
          name: g.name || `Сообщество #${g.id}`,
          avatar: g.photo_100 || g.photo_50 || '',
          screen_name: g.screen_name || `club${g.id}`,
          members_count: g.members_count || 0
        }));
      }
      return [];
    } catch (err: any) {
      let msg = err.message || err;
      if (typeof msg === 'string' && msg.includes('user_id is undefined')) {
        msg = 'Указан Токен Сообщества вместо Токена Пользователя (user_id is undefined). Пожалуйста, вставьте личный User Access Token, полученный через VK OAuth Flow.';
      }
      console.warn('Real VK getGroups warning:', msg);
      throw new Error(`Не удалось загрузить сообщества из VK: ${msg}`);
    }
  },

  /**
   * Парсинг стены сообщества
   */
  async fetchWallPosts(
    ownerIdOrDomain: string,
    count: number = 50,
    token: string,
    isSandbox: boolean = false,
    priceConfig: PriceConfig,
    isRetry: boolean = false
  ): Promise<VKPost[]> {
    if (isSandbox) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Разрешаем домен/ID к одному из наших симулированных ID
      let numericOwner = -1001;
      const lower = ownerIdOrDomain.toLowerCase().trim();
      if (lower.includes('shoes') || lower.includes('1002')) numericOwner = -1002;
      else if (lower.includes('lux') || lower.includes('elegance') || lower.includes('1003')) numericOwner = -1003;
      else if (lower.includes('jacket') || lower.includes('vip') || lower.includes('1004')) numericOwner = -1004;
      
      return generateSandboxWall(numericOwner, count, priceConfig);
    }

    try {
      // Приводим ID к числовому формату либо определяем если передан домен
      let resolvedIdParams: Record<string, any> = {};
      
      const cleanOwner = ownerIdOrDomain.trim();
      if (/^-?\d+$/.test(cleanOwner)) {
        resolvedIdParams.owner_id = Number(cleanOwner);
      } else {
        resolvedIdParams.domain = cleanOwner;
      }

      // Реальный вызов wall.get с вложенными профилями и группами
      const data = await fetchVkJsonp('wall.get', {
        ...resolvedIdParams,
        count: Math.min(count, 100), // VK API ограничивает до 100 за один вызов
        v: '5.131',
        extended: 1,
        access_token: token
      });

      if (!data || !data.response) {
        throw new Error('VK API вернул пустой ответ');
      }

      // Передаем сырой ответ в наш отлаженный parseVkJson
      const parsedWrapper = {
        response: {
          items: data.response.items || [],
          profiles: data.response.profiles || [],
          groups: data.response.groups || []
        }
      };

      const result = parsedWrapper.response.items.map((item: any) => {
        // Обогащаем посты аналогично parseVkJson, но прямо здесь
        const id = Number(item.id);
        const ownerId = Number(item.owner_id || item.to_id || 0);
        const postId = `${ownerId}_${id}`;
        const timestamp = Number(item.date || 0);

        // Поиск автора в profiles/groups
        let author: VKAuthor = {
          id: ownerId,
          name: ownerId < 0 ? `Группа #${Math.abs(ownerId)}` : `Пользователь #${ownerId}`,
          avatar: '',
          type: ownerId < 0 ? 'group' : 'user',
          screen_name: ownerId < 0 ? `club${Math.abs(ownerId)}` : `id${ownerId}`
        };

        const fromId = Number(item.from_id || ownerId);
        if (fromId < 0) {
          const matchg = data.response.groups?.find((g: any) => Math.abs(Number(g.id)) === Math.abs(fromId));
          if (matchg) {
            author = {
              id: fromId,
              name: matchg.name || '',
              avatar: matchg.photo_100 || matchg.photo_50 || '',
              type: 'group',
              screen_name: matchg.screen_name
            };
          }
        } else {
          const matchp = data.response.profiles?.find((p: any) => Number(p.id) === fromId);
          if (matchp) {
            author = {
              id: fromId,
              name: `${matchp.first_name || ''} ${matchp.last_name || ''}`.trim(),
              avatar: matchp.photo_100 || matchp.photo_50 || '',
              type: 'user',
              screen_name: matchp.screen_name,
              gender: matchp.sex === 1 ? 'female' : matchp.sex === 2 ? 'male' : 'unknown'
            };
          }
        }

        // Картинки
        const images: VKImage[] = [];
        const attachments = item.attachments || [];
        attachments.forEach((attach: any) => {
          if (attach.type === 'photo' && attach.photo) {
            const sizes = attach.photo.sizes || [];
            if (sizes.length > 0) {
              const sorted = [...sizes].sort((a,b) => (b.width * b.height || b.width || 0) - (a.width * a.height || a.width || 0));
              images.push({
                url: sorted[0].url || sorted[0].src || '',
                width: sorted[0].width || 0,
                height: sorted[0].height || 0,
                vk_photo_id: `${attach.photo.owner_id}_${attach.photo.id}`
              });
            }
          }
        });

        const textOriginal = item.text || '';
        const priceDetails = extractPriceFromText(textOriginal, priceConfig);
        const priceOriginal = priceDetails ? priceDetails.value : null;
        const priceEdited = priceOriginal !== null ? calculateEditedPrice(priceOriginal, priceConfig) : null;

        return {
          post_id: postId,
          id,
          owner_id: ownerId,
          source_url: `https://vk.com/wall${ownerId < 0 ? '-' : ''}${Math.abs(ownerId)}_${id}`,
          timestamp,
          date_formatted: formatUnixTimestamp(timestamp),
          text_original: textOriginal,
          text_edited: textOriginal,
          images,
          is_grouped: images.length > 1,
          price_original: priceOriginal,
          price_edited: priceEdited,
          price_details: priceDetails,
          likes: Number(item.likes?.count || 0),
          comments: Number(item.comments?.count || 0),
          reposts: Number(item.reposts?.count || 0),
          views: Number(item.views?.count || 0),
          hashtags: extractHashtags(textOriginal),
          author,
          is_exported: false,
          is_favorite: false
        };
      });

      return result;
    } catch (err: any) {
      console.error('Real VK FetchWall Error:', err);
      const errMsg = String(err.message || err || '');
      const isCommunityMemberError = 
        errMsg.toLowerCase().includes('community member') || 
        errMsg.toLowerCase().includes('доступен только участникам') ||
        errMsg.toLowerCase().includes('access denied');

      if (isCommunityMemberError && !isRetry) {
        console.log('🤖 Робот: Обнаружена стена только для участников сообщества. Пробуем автоматически подписаться на группу:', ownerIdOrDomain);
        try {
          const cleanOwner = ownerIdOrDomain.trim();
          let targetGroupId: string | number = cleanOwner;
          if (/^-?\d+$/.test(cleanOwner)) {
            targetGroupId = Math.abs(Number(cleanOwner));
          }

          // Попытка автоматического вступления в группу через groups.join
          await fetchVkJsonp('groups.join', {
            group_id: targetGroupId,
            access_token: token,
            v: '5.131'
          });

          console.log('🤖 Робот: Успешно вступили в сообщество! Повторный запуск парсинга...');
          // Дадим VK 1.2 секунды на обновление статуса подписки в сессии перед повтором
          await new Promise(r => setTimeout(r, 1200));
          return this.fetchWallPosts(ownerIdOrDomain, count, token, isSandbox, priceConfig, true);
        } catch (joinErr: any) {
          console.error('🤖 Робот: Не удалось автоматически подписаться:', joinErr);
          throw new Error(`Стена доступна только участникам сообщества. Мы попытались автоматически вступить в группу с вашего аккаунта, но произошла ошибка: ${joinErr.message || joinErr}. Пожалуйста, вступите в группу vk.com/${ownerIdOrDomain} вручную.`);
        }
      }

      if (isCommunityMemberError) {
        throw new Error(`Доступ ограничен: стена этого сообщества доступна только его участникам. Пожалуйста, перейдите по адресу vk.com/public${ownerIdOrDomain.replace(/^-/, '')} или vk.com/${ownerIdOrDomain} и вступите в группу вручную!`);
      }

      throw new Error(`Ошибка загрузки постов. Либо у сообщества закрытая стена, либо токен недействителен. Ошибка: ${err.message || err}`);
    }
  },

  /**
   * Имитация/Реальная публикация товара в сообщество
   */
  async exportPostToGroup(
    post: VKPost,
    targetGroupId: number,
    token: string,
    isSandbox: boolean,
    onProgress: (logLine: string) => void,
    privacySettings?: {
      friendsOnly: boolean;
      closeComments: boolean;
      muteNotifications: boolean;
      markAsAds: boolean;
    }
  ): Promise<string> {
    if (isSandbox) {
      onProgress(`🔗 Соединение с сервером публикации VK API...`);
      await new Promise(r => setTimeout(r, 600));
      onProgress(`⚙️ Проверка прав доступа в сообщество -${targetGroupId}...`);
      await new Promise(r => setTimeout(r, 500));
      
      if (privacySettings) {
        onProgress(`🛡️ Применение приватных фильтров: Друзьям: ${privacySettings.friendsOnly ? 'Да' : 'Нет'}, Отключить комментарии: ${privacySettings.closeComments ? 'Да' : 'Нет'}, Без пушей: ${privacySettings.muteNotifications ? 'Да' : 'Нет'}`);
        await new Promise(r => setTimeout(r, 450));
      }

      if (post.images.length > 0) {
        onProgress(`📸 Буферизация картинок (${post.images.length} шт) и загрузка на сервера VK...`);
        await new Promise(r => setTimeout(r, 800));
        onProgress(`💾 Фото успешно прикреплены к временному пулу постов.`);
      }
      
      onProgress(`✍️ Сборка метаданных товара. Конечная цена: ${post.price_edited} руб.`);
      await new Promise(r => setTimeout(r, 650));
      
      const mockPostId = Math.floor(100000 + Math.random() * 900000);
      onProgress(`✅ Запись успешно создана! Новый ID поста: wall-${targetGroupId}_${mockPostId}`);
      return `https://vk.com/wall-${targetGroupId}_${mockPostId}`;
    }

    try {
      onProgress(`🔗 Инициализация запроса публикации...`);
      // Для реального API VK опубликуем пост на стену сообщества
      const params: Record<string, any> = {
        owner_id: -Math.abs(targetGroupId),
        message: post.text_edited || post.text_original,
        access_token: token,
        v: '5.131'
      };

      if (privacySettings) {
        if (privacySettings.friendsOnly) params.friends_only = 1;
        if (privacySettings.closeComments) params.close_comments = 1;
        if (privacySettings.muteNotifications) params.mute_notifications = 1;
        if (privacySettings.markAsAds) params.mark_as_ads = 1;
        onProgress(`🛡️ Активируем настройки приватности: Друзьям: ${privacySettings.friendsOnly ? 'Да' : 'Нет'}, Нотификации отключены: ${privacySettings.muteNotifications ? 'Да' : 'Нет'}...`);
      }

      // Добавим вложения (картинки), если они есть у оригинального поста
      if (post.images && post.images.length > 0) {
        const photoIds = post.images
          .filter(img => img.vk_photo_id)
          .map(img => `photo${img.vk_photo_id}`)
          .slice(0, 10) // Лимит VK API на 10 вложений
          .join(',');
        
        if (photoIds) {
          params.attachments = photoIds;
          onProgress(`📸 Привязка оригинальных вложений: ${photoIds.split(',').length} фото...`);
        }
      }

      await new Promise(r => setTimeout(r, 500));
      onProgress(`🚀 Направляем запрос wall.post в ВКонтакте...`);
      
      const response = await fetchVkJsonp('wall.post', params);
      
      if (response && response.response && response.response.post_id) {
        const publishedId = response.response.post_id;
        onProgress(`✅ Товар успешно опубликован на живой стене ВКонтакте!`);
        return `https://vk.com/wall-${Math.abs(targetGroupId)}_${publishedId}`;
      } else {
        throw new Error('Некорректный ответ wall.post от VK API');
      }
    } catch (err: any) {
      console.error('Real Post Publish to VK Error:', err);
      throw new Error(`Ошибка публикации: ${err.message || err}. Проверьте права вашего токена (требуется scope "wall" и права администратора сообщества).`);
    }
  }
};
