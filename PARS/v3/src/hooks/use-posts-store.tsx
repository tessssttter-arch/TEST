/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Централизованное управление состоянием приложения (Store) с использованием React Context.
// Обеспечивает персистентное сохранение изменений пользователя в localStorage.
// Все комментарии написаны на русском языке.

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { VKPost, PriceConfig, ExportProfile, ParseStats, VKAuthor, VKImage } from '../types/vk';
import { parseVkJson } from '../lib/vk-utils';
import { calculateEditedPrice, DEFAULT_PRICE_CONFIG } from '../lib/price-utils';
import { VKAccount, VKGroup, VKExportLog, VK_API } from '../lib/vk-api-client';
import { TextIntelligence } from '../plugins/text-intelligence';
import { VKPluginManager } from '../plugins/vk-manager';
import { exportPostsToCatalogJsonV3 } from '../lib/catalog-exporter';

// Определение структуры фильтров
export interface FilterConfig {
  searchQuery: string; // Поиск по тексту поста и имени автора
  dateFrom: string; // Дата публикаций "От" (YYYY-MM-DD)
  dateTo: string; // Дата публикаций "До" (YYYY-MM-DD)
  minLikes: number; // Минимальное кол-во лайков
  priceMin: string; // Минимальная цена
  priceMax: string; // Максимальная цена
  onlyFavorites: boolean; // Показывать только избранные
  onlyNotExported: boolean; // Опционально: скрывать выгруженные
}

// Структура сортировки
export interface SortConfig {
  key: 'date' | 'likes' | 'comments' | 'reposts' | 'views' | 'price';
  direction: 'asc' | 'desc';
}

// Дефолтные настройки фильтров
const DEFAULT_FILTERS: FilterConfig = {
  searchQuery: '',
  dateFrom: '',
  dateTo: '',
  minLikes: 0,
  priceMin: '',
  priceMax: '',
  onlyFavorites: false,
  onlyNotExported: false,
};

// Дефолтная сортировка
const DEFAULT_SORT: SortConfig = {
  key: 'date',
  direction: 'desc',
};

// Контекст хранилища
interface PostsStoreContextType {
  posts: VKPost[]; // Все загруженные посты
  isLoading: boolean;
  error: string | null;
  fileName: string | null;
  
  // Доступные для экспорта/фильтрации посты
  filteredPosts: VKPost[];
  
  // Статистика выборки
  stats: ParseStats;
  
  // Конфигурационные состояния
  priceConfig: PriceConfig;
  filters: FilterConfig;
  sortConfig: SortConfig;
  visibleColumns: string[];
  exportProfiles: ExportProfile[];

  // Состояния VK интеграции
  vkAccount: VKAccount | null;
  vkGroups: VKGroup[];
  selectedTargetGroupId: number | null;
  exportLogs: VKExportLog[];
  setVkGroups: (groups: VKGroup[]) => void;
  setVkAccount: (account: VKAccount | null) => void;
  
  // Методы работы с файлом
  importJson: (jsonContent: string, fileName: string) => void;
  clearAll: () => void;
  
  // Методы работы с постами
  toggleFavorite: (postId: string) => void;
  toggleExported: (postId: string) => void;
  updatePostDetails: (postId: string, text: string, price: number | null) => void;
  bulkUpdatePostDetails: (updates: Record<string, { text: string; price: number | null }>) => void;
  reparseSupplierPosts: (ownerId: number) => void;
  
  // Настройки
  updatePriceConfig: (newConfig: Partial<PriceConfig>) => void;
  updateFilters: (filters: Partial<FilterConfig>) => void;
  resetFilters: () => void;
  updateSort: (key: SortConfig['key']) => void;
  updateVisibleColumns: (columns: string[]) => void;
  
  // Управление профилями настроек экспорта
  saveExportProfile: (name: string, columns: string[]) => void;
  deleteExportProfile: (id: string) => void;
  
  // [AI-EDIT] Добавлен метод экспорта каталога | 2026-06-20 06:36
  exportToCatalog: (filename?: string) => void;

  // Методы VK авторизации и парсинга
  loginVk: (account: VKAccount) => void;
  logoutVk: () => void;
  setSelectedTargetGroupId: (id: number | null) => void;
  fetchOnlineWall: (ownerId: string, count: number) => Promise<void>;
  exportSelectedPostsToVk: (postIds: string[], onItemProgress?: (postId: string, logLine: string) => void) => Promise<{ successCount: number; failedCount: number; links: string[] }>;
}

const PostsStoreContext = createContext<PostsStoreContextType | undefined>(undefined);

export const PostsStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Инициализация состояний из localStorage
  const [posts, setPosts] = useState<VKPost[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // States для VK интеграции
  const [vkAccount, setVkAccount] = useState<VKAccount | null>(() => {
    const saved = localStorage.getItem('vk_insights_vk_account');
    return saved ? JSON.parse(saved) : null;
  });

  const [vkGroups, setVkGroups] = useState<VKGroup[]>(() => {
    const saved = localStorage.getItem('vk_insights_vk_groups');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState<number | null>(() => {
    const saved = localStorage.getItem('vk_insights_selected_target_group');
    return saved ? Number(JSON.parse(saved)) : null;
  });

  const [exportLogs, setExportLogs] = useState<VKExportLog[]>(() => {
    const saved = localStorage.getItem('vk_insights_export_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [priceConfig, setPriceConfig] = useState<PriceConfig>(() => {
    const saved = localStorage.getItem('vk_insights_price_config');
    return saved ? JSON.parse(saved) : DEFAULT_PRICE_CONFIG;
  });

  const [filters, setFilters] = useState<FilterConfig>(DEFAULT_FILTERS);
  const [sortConfig, setSortConfig] = useState<SortConfig>(DEFAULT_SORT);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('vk_insights_visible_columns');
    return saved ? JSON.parse(saved) : ['favorite', 'thumbnail', 'author', 'text', 'price_original', 'price_edited', 'metrics', 'date', 'exported'];
  });

  const [exportProfiles, setExportProfiles] = useState<ExportProfile[]>(() => {
    const saved = localStorage.getItem('vk_insights_export_profiles');
    return saved ? JSON.parse(saved) : [];
  });

  // Локальные справочники правок и избранного
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('vk_insights_favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [exportedList, setExportedList] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('vk_insights_exported');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [editsMap, setEditsMap] = useState<Record<string, { text: string; price: number | null; text_edited?: string; price_edited?: number | null; is_manually_edited?: boolean }>>(() => {
    const saved = localStorage.getItem('vk_insights_edits');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('vk_insights_price_config', JSON.stringify(priceConfig));
    // При изменении настроек цен пересчитываем все цены отредактированных или оригинальных постов
    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        // Если у поста нет сохраненной вручную правки цены, пересчитываем её по формуле
        const savedEdit = editsMap[post.post_id];
        const hasManualPriceEdit = savedEdit && savedEdit.price !== undefined;
        
        let newPriceEdited = post.price_edited;
        if (!hasManualPriceEdit && post.price_original !== null) {
          newPriceEdited = calculateEditedPrice(post.price_original, priceConfig);
        } else if (hasManualPriceEdit) {
          newPriceEdited = savedEdit.price;
        }

        return {
          ...post,
          price_edited: newPriceEdited,
        };
      })
    );
  }, [priceConfig]);

  // Сохраняем стейты VK в localStorage при изменениях
  useEffect(() => {
    localStorage.setItem('vk_insights_vk_account', JSON.stringify(vkAccount));
  }, [vkAccount]);

  useEffect(() => {
    localStorage.setItem('vk_insights_vk_groups', JSON.stringify(vkGroups));
  }, [vkGroups]);

  useEffect(() => {
    localStorage.setItem('vk_insights_selected_target_group', JSON.stringify(selectedTargetGroupId));
  }, [selectedTargetGroupId]);

  useEffect(() => {
    localStorage.setItem('vk_insights_export_logs', JSON.stringify(exportLogs));
  }, [exportLogs]);

  // Сохраняем списки в localStorage при изменениях
  useEffect(() => {
    localStorage.setItem('vk_insights_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('vk_insights_favorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('vk_insights_exported', JSON.stringify(Array.from(exportedList)));
  }, [exportedList]);

  useEffect(() => {
    localStorage.setItem('vk_insights_edits', JSON.stringify(editsMap));
  }, [editsMap]);

  useEffect(() => {
    localStorage.setItem('vk_insights_export_profiles', JSON.stringify(exportProfiles));
  }, [exportProfiles]);

  // 2. Метод импорта JSON-файла
  const importJson = (jsonContent: string, name: string) => {
    setIsLoading(true);
    setError(null);
    
    // Сделаем небольшую паузу, чтобы UI успел показать лоадер
    setTimeout(() => {
      const { posts: parsedPosts, error: parseError } = parseVkJson(jsonContent, priceConfig);
      
      if (parseError) {
        setError(parseError);
        setIsLoading(false);
        return;
      }

      // Обогащаем посты локальными правками пользователя, избранным и статусами экспорта
      const enriched: VKPost[] = [];

      parsedPosts.forEach((post) => {
        // Подключаем парсер умного разбора (TextIntelligence)
        const smart = TextIntelligence.parse({
          id: post.id,
          owner_id: post.owner_id,
          text: post.text_original,
          attachments: post.images.map(img => ({ 
            type: 'photo', 
            photo: { 
              owner_id: post.owner_id,
              id: img.vk_photo_id?.split('_')[1] || '0',
              sizes: [{ url: img.url, width: img.width, height: img.height }] 
            } 
          })),
          date: post.timestamp
        });

        // Сплиттинг групповых постов по позициям
        const splits = TextIntelligence.splitMultiPosts(smart);
        
        splits.forEach((split) => {
          const splitId = split.id;
          const isFavorite = favorites.has(splitId);
          const isExported = exportedList.has(splitId);
          const savedEdit = editsMap[splitId];

          let textEdited = split.description;
          let priceEdited = split.prices.retail || post.price_edited;
          let isManuallyEdited = false;

          if (savedEdit) {
            if (savedEdit.text !== undefined) {
              textEdited = savedEdit.text;
              isManuallyEdited = true;
            }
            if (savedEdit.price !== undefined) {
              priceEdited = savedEdit.price;
              isManuallyEdited = true;
            }
          }

          // Генерируем нормализованную запись
          enriched.push({
            ...post,
            post_id: splitId,
            text_original: split.originalText,
            text_edited: textEdited,
            price_original: split.prices.retail || post.price_original,
            price_edited: priceEdited,
            is_manually_edited: isManuallyEdited,
            sizes: split.sizes,
            vendor_location: split.vendorLocation || 'Садовод',
            is_split_copy: split.isSplitCopy,
            images: split.images.map(img => ({ url: img.url, width: 800, height: 800, vk_photo_id: `${post.owner_id}_${splitId}` })),
            is_favorite: isFavorite,
            is_exported: isExported,
            originalText: split.originalText,
            processedText: split.description,
          });
        });
      });

      setPosts(enriched);
      setFileName(name);
      setIsLoading(false);
    }, 100);
  };

  const clearAll = () => {
    setPosts([]);
    setFileName(null);
    setError(null);
  };

  // 3. Функции изменения статусов элементов
  const toggleFavorite = (postId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });

    setPosts((prev) =>
      prev.map((post) =>
        post.post_id === postId ? { ...post, is_favorite: !post.is_favorite } : post
      )
    );
  };

  const toggleExported = (postId: string) => {
    setExportedList((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });

    setPosts((prev) =>
      prev.map((post) =>
        post.post_id === postId ? { ...post, is_exported: !post.is_exported } : post
      )
    );
  };

  const updatePostDetails = (postId: string, text: string, price: number | null) => {
    setEditsMap((prev) => ({
      ...prev,
      [postId]: { text, price, is_manually_edited: true },
    }));

    setPosts((prev) =>
      prev.map((post) =>
        post.post_id === postId ? { ...post, text_edited: text, price_edited: price, is_manually_edited: true } : post
      )
    );
  };

  const reparseSupplierPosts = (ownerId: number) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.owner_id !== ownerId) return post;

        // Перезапускаем умный парсер для этого поста
        const smart = TextIntelligence.parse({
          id: post.id,
          owner_id: post.owner_id,
          text: post.originalText || post.text_original,
          attachments: post.images.map(img => ({ 
            type: 'photo', 
            photo: { 
              owner_id: post.owner_id,
              id: img.vk_photo_id?.split('_')[1] || '0',
              sizes: [{ url: img.url, width: img.width, height: img.height }] 
            } 
          })),
          date: post.timestamp
        });

        const splits = TextIntelligence.splitMultiPosts(smart);
        const matchedSplit = splits.find(s => s.id === post.post_id) || splits[0];

        if (matchedSplit) {
          const savedEdit = editsMap[post.post_id];
          const hasManualPriceEdit = savedEdit && savedEdit.price !== undefined;
          let newPriceOriginal = matchedSplit.prices.retail || post.price_original;
          let newPriceEdited = post.price_edited;

          if (!hasManualPriceEdit) {
            newPriceEdited = newPriceOriginal !== null ? calculateEditedPrice(newPriceOriginal, priceConfig) : null;
          }

          return {
            ...post,
            price_original: newPriceOriginal,
            price_edited: newPriceEdited,
            sizes: matchedSplit.sizes,
          };
        }

        return post;
      })
    );
  };

  const bulkUpdatePostDetails = (updates: Record<string, { text: string; price: number | null }>) => {
    setEditsMap((prev) => {
      const updatedEdits = { ...prev };
      Object.keys(updates).forEach((id) => {
        updatedEdits[id] = {
          ...updates[id],
          is_manually_edited: true,
        };
      });
      return updatedEdits;
    });

    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        const update = updates[post.post_id];
        if (!update) return post;
        return {
          ...post,
          text_edited: update.text,
          price_edited: update.price,
          is_manually_edited: true,
        };
      })
    );
  };

  // 4. Методы конфигурационных стейтов
  const updatePriceConfig = (newConfig: Partial<PriceConfig>) => {
    setPriceConfig((prev) => ({
      ...prev,
      ...newConfig,
    }));
  };

  const updateFilters = (newFilters: Partial<FilterConfig>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const updateSort = (key: SortConfig['key']) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        // Переключаем направление
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      } else {
        // Новая сортировка по умолчанию desc
        return {
          key,
          direction: 'desc',
        };
      }
    });
  };

  const updateVisibleColumns = (columns: string[]) => {
    setVisibleColumns(columns);
  };

  // 5. Управление профилями экспорта (Ограничение: Храним 5 последних наборов)
  const saveExportProfile = (name: string, columns: string[]) => {
    const newProfile: ExportProfile = {
      id: Date.now().toString(),
      name,
      selectedColumns: columns,
      created_at: new Date().toLocaleDateString('ru'),
    };

    setExportProfiles((prev) => {
      // Исключаем совпадение по имени (если перезаписывают)
      const filtered = prev.filter((p) => p.name.toLowerCase() !== name.toLowerCase());
      // Добавляем в начало списка
      const updated = [newProfile, ...filtered];
      // Храним максимум 5 последних в соответствии с требованиями ТЗ
      return updated.slice(0, 5);
    });
  };

  const deleteExportProfile = (id: string) => {
    setExportProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  // [AI-EDIT] Метод экспорта каталога | 2026-06-20 06:38
  const exportToCatalog = (filename?: string) => {
    exportPostsToCatalogJsonV3(filteredPosts, filename);
  };

  // Методы VK авторизации
  const loginVk = (account: VKAccount) => {
    setVkAccount(account);
    VKPluginManager.addSession({
      token: account.access_token,
      firstName: account.first_name,
      lastName: account.last_name,
      avatar: account.avatar || '',
      userId: account.vk_user_id
    });
    setError(null);
  };

  const logoutVk = () => {
    if (vkAccount) {
      VKPluginManager.removeSession(vkAccount.access_token);
    }
    setVkAccount(null);
    setVkGroups([]);
    setSelectedTargetGroupId(null);
  };

  // Загрузка стены в реальном времени напрямую из VK (или симуляция)
  const fetchOnlineWall = async (ownerId: string, count: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const activeToken = VKPluginManager.getActiveToken() || vkAccount?.access_token || '';
      const isSandbox = vkAccount?.isSandbox ?? true;

      // Получаем плоский список ID по запятой
      const groupIds = ownerId.split(',').map((g) => g.trim()).filter(Boolean);
      const totalEnriched: VKPost[] = [];

      for (const gid of groupIds) {
        // Оборачиваем запрос к VK API в очередь для защиты от RPS-блокировок
        const fetched = await VKPluginManager.enqueue(() => 
          VK_API.fetchWallPosts(gid, count, activeToken, isSandbox, priceConfig)
        );
        
        fetched.forEach(post => {
          const smart = TextIntelligence.parse({
            id: post.id,
            owner_id: post.owner_id,
            text: post.text_original,
            attachments: post.images.map(img => ({ 
              type: 'photo', 
              photo: { 
                owner_id: post.owner_id,
                id: img.vk_photo_id?.split('_')[1] || '0',
                sizes: [{ url: img.url, width: img.width, height: img.height }] 
              } 
            })),
            date: post.timestamp
          });

          const splits = TextIntelligence.splitMultiPosts(smart);

          splits.forEach((split) => {
            const splitId = split.id;
            const isFavorite = favorites.has(splitId);
            const isExported = exportedList.has(splitId);
            const savedEdit = editsMap[splitId];

            let textEdited = split.description;
            let priceEdited = split.prices.retail || post.price_edited;
            let isManuallyEdited = false;

            if (savedEdit) {
              if (savedEdit.text !== undefined) {
                textEdited = savedEdit.text;
                isManuallyEdited = true;
              }
              if (savedEdit.price !== undefined) {
                priceEdited = savedEdit.price;
                isManuallyEdited = true;
              }
            }

            totalEnriched.push({
              ...post,
              post_id: splitId,
              text_original: split.description,
              text_edited: textEdited,
              price_original: split.prices.retail || post.price_original,
              price_edited: priceEdited,
              is_manually_edited: isManuallyEdited,
              sizes: split.sizes,
              vendor_location: split.vendorLocation || gid, // Показываем домен поставщика в качестве локации
              is_split_copy: split.isSplitCopy,
              images: split.images.map(img => ({ url: img.url, width: 800, height: 800, vk_photo_id: `${post.owner_id}_${splitId}` })),
              is_favorite: isFavorite,
              is_exported: isExported,
              originalText: split.originalText,
              processedText: split.description,
            });
          });
        });
      }

      setPosts(totalEnriched);
      setFileName(`Пул стен VK [${groupIds.join(', ')}]`);
    } catch (err: any) {
      setError(err.message || 'Ошибка парсинга стен VK');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Выгрузка выбранных товаров обратно в сообщество ВКонтакте
  const exportSelectedPostsToVk = async (
    postIds: string[],
    onItemProgress?: (postId: string, logLine: string) => void
  ) => {
    if (!vkAccount) throw new Error('Необходимо подключить аккаунт ВКонтакте для выгрузки.');
    if (!selectedTargetGroupId) throw new Error('Пожалуйста, выберите сообщество (целевую группу) в панели ВКонтакте.');

    const targetGroup = vkGroups.find(g => g.id === selectedTargetGroupId);
    const targetGroupName = targetGroup ? targetGroup.name : `Группа ${selectedTargetGroupId}`;

    let successCount = 0;
    let failedCount = 0;
    const links: string[] = [];

    // Обрабатывем по очереди
    for (const pid of postIds) {
      const post = posts.find(p => p.post_id === pid);
      if (!post) continue;

      const progressLogger = (line: string) => {
        if (onItemProgress) onItemProgress(pid, line);
      };

      const session = VKPluginManager.getSessionByToken(vkAccount.access_token);
      let textToPublish = post.text_edited || post.text_original;
      
      if (session?.settings) {
        const s = session.settings;
        // Накладываем водяной знак бота
        if (s.autoWatermark) {
          textToPublish = textToPublish + '\n\n#vk_insights #садовод_бот';
        }
        // Накладываем подпись аккаунта
        if (s.textSignature) {
          textToPublish = textToPublish + '\n\n' + s.textSignature;
        }
      }

      const enrichedPayload = {
        ...post,
        text_edited: textToPublish
      };

      try {
        const publishedUrl = await VK_API.exportPostToGroup(
          enrichedPayload,
          selectedTargetGroupId,
          vkAccount.access_token,
          vkAccount.isSandbox,
          progressLogger,
          session?.settings?.privacy
        );

        // Отмечаем товар как выгруженный в локальном хранилище и стейте
        setExportedList((prev) => {
          const next = new Set(prev);
          next.add(pid);
          return next;
        });

        setPosts((prev) =>
          prev.map((p) =>
            p.post_id === pid ? { ...p, is_exported: true } : p
          )
        );

        successCount++;
        links.push(publishedUrl);

        // Добавляем лог в глобальную историю
        const newLog: VKExportLog = {
          id: `${pid}_${Date.now()}`,
          postId: pid,
          postText: post.text_edited || post.text_original,
          targetGroupName,
          timestamp: Date.now(),
          status: 'success',
          message: `Успех! Ссылка: ${publishedUrl}`
        };

        setExportLogs(prev => [newLog, ...prev].slice(0, 50));

      } catch (err: any) {
        progressLogger(`❌ Ошибка: ${err.message || err}`);
        failedCount++;

        const newLog: VKExportLog = {
          id: `${pid}_${Date.now()}`,
          postId: pid,
          postText: post.text_edited || post.text_original,
          targetGroupName,
          timestamp: Date.now(),
          status: 'failed',
          message: err.message || 'Ошибка публикации'
        };

        setExportLogs(prev => [newLog, ...prev].slice(0, 50));
      }
    }

    return { successCount, failedCount, links };
  };

  // 6. Фильтрация и сортировка постов в реальном времени (Мемоизированная выборка)
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // Полнотекстовый поиск (по тексту поста, ИД поста, имени автора)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase().trim();
      result = result.filter(
        (post) =>
          post.text_original.toLowerCase().includes(query) ||
          post.text_edited.toLowerCase().includes(query) ||
          post.author.name.toLowerCase().includes(query) ||
          post.post_id.includes(query) ||
          post.hashtags.some((tag) => tag.includes(query))
      );
    }

    // Фильтр по диапазону дат
    if (filters.dateFrom) {
      const fromTime = new Date(filters.dateFrom).getTime() / 1000;
      result = result.filter((post) => post.timestamp >= fromTime);
    }
    if (filters.dateTo) {
      // Чтобы захватить весь день, ставим дату на конец дня (23:59:59)
      const toTime = new Date(`${filters.dateTo}T23:59:59`).getTime() / 1000;
      result = result.filter((post) => post.timestamp <= toTime);
    }

    // Фильтр по минимальному числу лайков
    if (filters.minLikes > 0) {
      result = result.filter((post) => post.likes >= filters.minLikes);
    }

    // Фильтр по диапазону итоговых цен (price_edited)
    if (filters.priceMin !== '') {
      const minPrice = parseFloat(filters.priceMin);
      if (!isNaN(minPrice)) {
        result = result.filter((post) => post.price_edited !== null && post.price_edited >= minPrice);
      }
    }
    if (filters.priceMax !== '') {
      const maxPrice = parseFloat(filters.priceMax);
      if (!isNaN(maxPrice)) {
        result = result.filter((post) => post.price_edited !== null && post.price_edited <= maxPrice);
      }
    }

    // Только избранные
    if (filters.onlyFavorites) {
      result = result.filter((post) => post.is_favorite);
    }

    // Скрывать уже экспортированные
    if (filters.onlyNotExported) {
      result = result.filter((post) => !post.is_exported);
    }

    // Применение выбранной сортировки
    result.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch (sortConfig.key) {
        case 'date':
          valA = a.timestamp;
          valB = b.timestamp;
          break;
        case 'likes':
          valA = a.likes;
          valB = b.likes;
          break;
        case 'comments':
          valA = a.comments;
          valB = b.comments;
          break;
        case 'reposts':
          valA = a.reposts;
          valB = b.reposts;
          break;
        case 'views':
          valA = a.views;
          valB = b.views;
          break;
        case 'price':
          valA = a.price_edited !== null ? a.price_edited : (sortConfig.direction === 'asc' ? 99999999 : -1);
          valB = b.price_edited !== null ? b.price_edited : (sortConfig.direction === 'asc' ? 99999999 : -1);
          break;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [posts, filters, sortConfig]);

  // 7. Расчет статистики по всей загруженной выборке (не фильтрованной)
  const stats = useMemo(() => {
    const total = posts.length;
    let postsWithPrice = 0;
    let postsWithImages = 0;
    let totalLikes = 0;
    let totalViews = 0;

    posts.forEach((p) => {
      if (p.price_edited !== null) postsWithPrice++;
      if (p.images.length > 0) postsWithImages++;
      totalLikes += p.likes;
      totalViews += p.views;
    });

    return {
      total_posts_requested: total,
      total_posts_received: total,
      posts_with_price: postsWithPrice,
      posts_without_price: total - postsWithPrice,
      posts_with_images: postsWithImages,
      posts_text_only: total - postsWithImages,
      total_likes: totalLikes,
      total_views: totalViews,
    };
  }, [posts]);

  return (
    <PostsStoreContext.Provider
      value={{
        posts,
        isLoading,
        error,
        fileName,
        filteredPosts,
        stats,
        priceConfig,
        filters,
        sortConfig,
        visibleColumns,
        exportProfiles,
        vkAccount,
        vkGroups,
        selectedTargetGroupId,
        exportLogs,
        setVkGroups,
        setVkAccount,
        importJson,
        clearAll,
        toggleFavorite,
        toggleExported,
        updatePostDetails,
        bulkUpdatePostDetails,
        reparseSupplierPosts,
        updatePriceConfig,
        updateFilters,
        resetFilters,
        updateSort,
        updateVisibleColumns,
        saveExportProfile,
        deleteExportProfile,
        exportToCatalog,
        loginVk,
        logoutVk,
        setSelectedTargetGroupId,
        fetchOnlineWall,
        exportSelectedPostsToVk,
      }}
    >
      {children}
    </PostsStoreContext.Provider>
  );
};

export const usePostsStore = () => {
  const context = useContext(PostsStoreContext);
  if (context === undefined) {
    throw new Error('usePostsStore must be used within a PostsStoreProvider');
  }
  return context;
};
