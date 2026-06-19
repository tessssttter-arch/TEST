/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Компонент виртуализированной таблицы постов ВКонтакте на базе react-virtuoso.
// Поддерживает превью картинок в модальном слайдере, инлайн-редактирование текста и цены, метрики и отметки.
// Все комментарии написаны на русском языке.

import React, { useState, useEffect } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import {
  Star,
  ExternalLink,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Edit2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { usePostsStore } from '../../hooks/use-posts-store';
import { VKPost } from '../../types/vk';

export const PostsTable: React.FC = () => {
  const {
    filteredPosts,
    posts,
    visibleColumns,
    toggleFavorite,
    toggleExported,
    updatePostDetails,
    sortConfig,
    updateSort,
    vkAccount,
    selectedTargetGroupId,
    exportSelectedPostsToVk,
  } = usePostsStore();

  // Отрисовка индикатора направления сортировки
  const renderSortIndicator = (key: 'date' | 'likes' | 'comments' | 'reposts' | 'views' | 'price') => {
    if (sortConfig.key !== key) {
      return <span className="text-slate-300 dark:text-slate-700 ml-1 select-none font-normal">⇅</span>;
    }
    return sortConfig.direction === 'asc' ? (
      <span className="text-indigo-600 dark:text-indigo-400 ml-1 font-semibold select-none">▲</span>
    ) : (
      <span className="text-indigo-600 dark:text-indigo-400 ml-1 font-semibold select-none">▼</span>
    );
  };

  // Состояния для карусели изображений (модальное окно)
  const [activeMediaPost, setActiveMediaPost] = useState<VKPost | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number>(0);

  // Состояния для инлайн-редактирования текста поста
  const [editingTextPostId, setEditingTextPostId] = useState<string | null>(null);
  const [tempEditText, setTempEditText] = useState<string>('');

  // Состояния для инлайн-редактирования цены
  const [editingPricePostId, setEditingPricePostId] = useState<string | null>(null);
  const [tempEditPrice, setTempEditPrice] = useState<string>('');

  // Состояния для разворачивания длинных постов
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(new Set());

  // Локальные состояния для множественного выбора и выгрузки постов в ВК
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  
  // Состояния фоновой публикации выбранных постов
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishingProgress, setPublishingProgress] = useState<{ total: number; current: number }>({ total: 0, current: 0 });
  const [publishLogs, setPublishLogs] = useState<string[]>([]);
  const [publishSummary, setPublishSummary] = useState<{ success: number; failed: number; links: string[] } | null>(null);
  const [activePublishPost, setActivePublishPost] = useState<VKPost | null>(null);

  // Очистка выделения при изменении общего набора постов
  useEffect(() => {
    setSelectedPostIds(new Set());
  }, [posts]);

  // Массовое добавление в избранное
  const handleBulkFavorite = () => {
    const ids = Array.from(selectedPostIds);
    ids.forEach((pid) => {
      const p = filteredPosts.find((item) => item.post_id === pid);
      if (p && !p.is_favorite) {
        toggleFavorite(pid);
      }
    });
    setSelectedPostIds(new Set());
  };

  // Массовая выгрузка в ВК
  const handleBulkExportToVk = async () => {
    if (!vkAccount) {
      alert('Пожалуйста, подключите Ваш аккаунт ВКонтакте в панели интеграции выше.');
      return;
    }
    if (!selectedTargetGroupId) {
      alert('Пожалуйста, выберите целевую группу ВКонтакте в панели интеграции выше.');
      return;
    }

    const idsToExport = Array.from(selectedPostIds);
    setPublishingProgress({ total: idsToExport.length, current: 0 });
    setPublishLogs([]);
    setPublishSummary(null);
    setIsPublishing(true);

    const logAccumulator: string[] = [];
    const addLog = (line: string) => {
      logAccumulator.push(line);
      setPublishLogs([...logAccumulator]);
    };

    addLog(`🎬 Запуск выгрузки товара (всего: ${idsToExport.length} шт.) в группу ID ${selectedTargetGroupId}...`);

    try {
      const result = await exportSelectedPostsToVk(idsToExport, (pid, line) => {
        const post = filteredPosts.find(p => p.post_id === pid);
        const nameText = post ? (post.text_edited.slice(0, 30) + '...') : pid;
        const idx = idsToExport.indexOf(pid);
        
        setPublishingProgress({ total: idsToExport.length, current: idx + 1 });
        if (post) {
          setActivePublishPost(post);
        }
        addLog(`[Товар ${idx + 1}/${idsToExport.length}] "${nameText}": ${line}`);
      });

      addLog(`✨ Выгрузка успешно завершена! Создано товаров: ${result.successCount}, Ошибок: ${result.failedCount}`);
      setPublishSummary({
        success: result.successCount,
        failed: result.failedCount,
        links: result.links
      });
      setSelectedPostIds(new Set());
    } catch (err: any) {
      addLog(`❌ Критический сбой при групповой выгрузке: ${err.message || err}`);
    }
  };

  if (filteredPosts.length === 0) {
    return (
      <div id="posts-empty-state" className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 dark:bg-slate-900/10 border border-dashed border-slate-205 dark:border-slate-800 rounded-2xl">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Посты отсутствуют или не соответствуют текущим фильтрам поиска.
        </p>
        <p className="text-xs text-slate-400 mt-1">Очистите фильтры или загрузите новый файл JSON.</p>
      </div>
    );
  }

  // Включение/Отключение отображения колонок через store
  const isColVisible = (colKey: string) => visibleColumns.includes(colKey);

  // Форматирование компактных чисел (e.g. 1500 -> 1.5K)
  const formatCompact = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  };

  // Развернуть / Свернуть длинный текст поста
  const toggleTextExpand = (postId: string) => {
    setExpandedTextIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  // Триггер начала инлайн-редактирования текста
  const startEditingText = (post: VKPost) => {
    setEditingTextPostId(post.post_id);
    setTempEditText(post.text_edited);
  };

  const saveEditedText = (postId: string) => {
    const post = filteredPosts.find((p) => p.post_id === postId);
    if (post) {
      updatePostDetails(postId, tempEditText, post.price_edited);
    }
    setEditingTextPostId(null);
  };

  // Триггер начала инлайн-редактирования цены
  const startEditingPrice = (post: VKPost) => {
    setEditingPricePostId(post.post_id);
    setTempEditPrice(post.price_edited !== null ? String(post.price_edited) : '');
  };

  const saveEditedPrice = (postId: string) => {
    const post = filteredPosts.find((p) => p.post_id === postId);
    if (post) {
      const newPriceNum = tempEditPrice.trim() === '' ? null : parseFloat(tempEditPrice);
      updatePostDetails(postId, post.text_edited, isNaN(newPriceNum as any) ? null : newPriceNum);
    }
    setEditingPricePostId(null);
  };

  // Метод открыть модалку карусели фоток
  const openMediaModal = (post: VKPost, index: number = 0) => {
    setActiveMediaPost(post);
    setActiveMediaIndex(index);
  };

  const nextMedia = () => {
    if (!activeMediaPost) return;
    setActiveMediaIndex((prev) => (prev + 1) % activeMediaPost.images.length);
  };

  const prevMedia = () => {
    if (!activeMediaPost) return;
    setActiveMediaIndex((prev) => (prev - 1 + activeMediaPost.images.length) % activeMediaPost.images.length);
  };

  return (
    <div id="posts-table-wrapper" className="w-full border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
      {/* Виртуализированная таблица Virtuoso */}
      <TableVirtuoso
        data={filteredPosts}
        useWindowScroll
        style={{ height: '700px' }}
        fixedHeaderContent={() => {
          const allSelected = filteredPosts.length > 0 && filteredPosts.every(p => selectedPostIds.has(p.post_id));
          return (
            <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold tracking-wider uppercase text-slate-500 text-left select-none">
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPostIds(new Set(filteredPosts.map(p => p.post_id)));
                    } else {
                      setSelectedPostIds(new Set());
                    }
                  }}
                  className="w-4 h-4 text-indigo-650 bg-white dark:bg-slate-905 border-slate-300 dark:border-slate-700 rounded-xs cursor-pointer accent-indigo-600"
                />
              </th>
              {isColVisible('favorite') && <th className="p-3 w-10 text-center">⭐</th>}
              {isColVisible('thumbnail') && <th className="p-3 w-16">Фото</th>}
              {isColVisible('author') && <th className="p-3 w-44">Автор</th>}
              {isColVisible('text') && <th className="p-3 min-w-[200px]">Описание & Текст</th>}
              {isColVisible('price_original') && (
                <th 
                  className="p-3 w-28 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                  onClick={() => updateSort('price')}
                  title="Сортировать по оригинальной цене"
                >
                  <div className="flex items-center">
                    <span>Ориг. цена</span>
                    {renderSortIndicator('price')}
                  </div>
                </th>
              )}
              {isColVisible('price_edited') && (
                <th 
                  className="p-3 w-32 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                  onClick={() => updateSort('price')}
                  title="Сортировать по итоговой цене"
                >
                  <div className="flex items-center">
                    <span>Итоговая цена</span>
                    {renderSortIndicator('price')}
                  </div>
                </th>
              )}
              {isColVisible('metrics') && (
                <th className="p-3 w-44 text-left select-none">
                  <div className="text-slate-400 text-[9px] font-semibold mb-1 uppercase tracking-wider">
                    Сортировка по метрике:
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateSort('likes')}
                      className={`p-1 px-1.5 rounded-md text-[10px] flex items-center gap-0.5 font-bold border transition-all cursor-pointer ${
                        sortConfig.key === 'likes'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/60 dark:text-indigo-400'
                          : 'bg-white border-slate-200 text-slate-400 hover:text-slate-650 dark:bg-slate-900 dark:border-slate-800'
                      }`}
                      title="Сортировать по лайкам"
                    >
                      ❤️{sortConfig.key === 'likes' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSort('views')}
                      className={`p-1 px-1.5 rounded-md text-[10px] flex items-center gap-0.5 font-bold border transition-all cursor-pointer ${
                        sortConfig.key === 'views'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/60 dark:text-indigo-400'
                          : 'bg-white border-slate-200 text-slate-400 hover:text-slate-650 dark:bg-slate-900 dark:border-slate-800'
                      }`}
                      title="Сортировать по просмотрам"
                    >
                      👁️{sortConfig.key === 'views' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSort('comments')}
                      className={`p-1 px-1.5 rounded-md text-[10px] flex items-center gap-0.5 font-bold border transition-all cursor-pointer ${
                        sortConfig.key === 'comments'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/60 dark:text-indigo-400'
                          : 'bg-white border-slate-200 text-slate-400 hover:text-slate-650 dark:bg-slate-900 dark:border-slate-800'
                      }`}
                      title="Сортировать по комментариям"
                    >
                      💬{sortConfig.key === 'comments' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSort('reposts')}
                      className={`p-1 px-1.5 rounded-md text-[10px] flex items-center gap-0.5 font-bold border transition-all cursor-pointer ${
                        sortConfig.key === 'reposts'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/60 dark:text-indigo-400'
                          : 'bg-white border-slate-200 text-slate-400 hover:text-slate-650 dark:bg-slate-900 dark:border-slate-800'
                      }`}
                      title="Сортировать по репостам"
                    >
                      🔄{sortConfig.key === 'reposts' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                    </button>
                  </div>
                </th>
              )}
              {isColVisible('date') && (
                <th 
                  className="p-3 w-36 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                  onClick={() => updateSort('date')}
                  title="Сортировать по дате публикации"
                >
                  <div className="flex items-center">
                    <span>Дата</span>
                    {renderSortIndicator('date')}
                  </div>
                </th>
              )}
              {isColVisible('exported') && <th className="p-3 w-20 text-center">Выгружен</th>}
            </tr>
          );
        }}
        itemContent={(index, post) => {
          const isSelected = selectedPostIds.has(post.post_id);
          return (
            <>
              {/* Специфический Чекбокс Выбора */}
              <td className="p-3 text-center align-middle border-b border-slate-105 dark:border-slate-800/65">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {
                    setSelectedPostIds(prev => {
                      const next = new Set(prev);
                      if (next.has(post.post_id)) {
                        next.delete(post.post_id);
                      } else {
                        next.add(post.post_id);
                      }
                      return next;
                    });
                  }}
                  className="w-4 h-4 text-indigo-650 rounded-xs border-slate-300 dark:border-slate-700 cursor-pointer accent-indigo-600"
                />
              </td>

              {/* Колонка 1: Избранное */}
              {isColVisible('favorite') && (
                <td className="p-3 text-center align-middle border-b border-slate-105 dark:border-slate-800/65">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(post.post_id)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all cursor-pointer border-0"
                  >
                    <Star
                      size={16}
                      className={post.is_favorite ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-slate-700'}
                    />
                  </button>
                </td>
              )}

              {/* Колонка 2: Превью фото */}
              {isColVisible('thumbnail') && (
                <td className="p-3 align-middle border-b border-slate-105 dark:border-slate-800/65">
                  {post.images.length > 0 ? (
                    <div className="relative group w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-950 overflow-hidden cursor-pointer shadow-2xs border border-slate-200" onClick={() => openMediaModal(post, 0)}>
                      <img
                        loading="lazy"
                        src={post.images[0].url}
                        alt="Превью"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      {post.images.length > 1 && (
                        <span className="absolute bottom-0 right-0 px-1 py-0.5 text-[8px] font-black bg-slate-900/80 text-white rounded-tl-md">
                          +{post.images.length - 1}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-medium z-0 select-none">
                      нет фото
                    </div>
                  )}
                </td>
              )}

              {/* Колонка 3: Автор */}
              {isColVisible('author') && (
                <td className="p-3 align-middle border-b border-slate-105 dark:border-slate-800/65 text-left">
                  <div className="flex items-center gap-2 max-w-[170px]">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-xs font-bold text-indigo-700 overflow-hidden border border-indigo-100/50 shrink-0">
                      {post.author.avatar ? (
                        <img src={post.author.avatar} alt={post.author.name} className="w-full h-full object-cover" />
                      ) : (
                        post.author.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1">
                        {post.author.name}
                        {post.author.type === 'user' && (
                          <span
                            className="text-[10px] select-none"
                            title={post.author.gender === 'male' ? 'Мужчина ♂️' : post.author.gender === 'female' ? 'Женщина ♀️' : 'Пол неизвестен'}
                          >
                            {post.author.gender === 'male' ? '♂️' : post.author.gender === 'female' ? '♀️' : ''}
                          </span>
                        )}
                        {post.author.type === 'group' && (
                          <span className="text-[10px] bg-slate-100 px-1 rounded dark:bg-slate-800 text-slate-400 font-bold uppercase tracking-wider scale-90">
                            сообщ.
                          </span>
                        )}
                      </p>
                      <a
                        href={post.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[10px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:underline"
                      >
                        wall_{post.id}
                      </a>
                    </div>
                  </div>
                </td>
              )}

              {/* Колонка 4: Описание и Текст */}
              {isColVisible('text') && (
                <td className="p-3 align-middle border-b border-slate-105 dark:border-slate-800/65 text-left">
                  {editingTextPostId === post.post_id ? (
                    <div className="space-y-2">
                      <textarea
                        value={tempEditText}
                        onChange={(e) => setTempEditText(e.target.value)}
                        rows={4}
                        className="w-full text-xs p-2 rounded-lg border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-150 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 outline-hidden resize-y font-normal"
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingTextPostId(null)}
                          className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-105 rounded-md cursor-pointer border-0"
                        >
                          <X size={10} className="inline mr-1" />
                          Отмена
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEditedText(post.post_id)}
                          className="px-2.5 py-1 text-[10px] font-bold text-white bg-indigo-650 hover:bg-indigo-700 rounded-md cursor-pointer border-0"
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-750 dark:text-slate-300">
                      <div className="whitespace-pre-line leading-relaxed font-normal">
                        {expandedTextIds.has(post.post_id) || post.text_edited.length <= 180 ? (
                          post.text_edited
                        ) : (
                          <>
                            {post.text_edited.slice(0, 180)}...{' '}
                            <button
                              type="button"
                              onClick={() => toggleTextExpand(post.post_id)}
                              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline py-0 inline cursor-pointer border-0 bg-transparent"
                            >
                              читать далее
                            </button>
                          </>
                        )}
                        {expandedTextIds.has(post.post_id) && post.text_edited.length > 180 && (
                          <button
                            type="button"
                            onClick={() => toggleTextExpand(post.post_id)}
                            className="text-slate-400 font-bold hover:underline py-0 inline ml-1.5 cursor-pointer border-0 bg-transparent"
                          >
                            свернуть
                          </button>
                        )}
                      </div>

                      {/* Тэги и хэштеги */}
                      {post.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5 text-left">
                          {post.hashtags.map((tag) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 font-medium select-all">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Кнопка вызвать инлайн редактор */}
                      <button
                        type="button"
                        onClick={() => startEditingText(post)}
                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 px-1.5 py-0.5 rounded cursor-pointer border-0 bg-transparent"
                      >
                        <Edit2 size={8} />
                        Править описание
                      </button>
                    </div>
                  )}
                </td>
              )}

              {/* Колонка 5: Оригинальная цена */}
              {isColVisible('price_original') && (
                <td className="p-3 align-middle border-b border-slate-105 dark:border-slate-800/65 text-left">
                  {post.price_original !== null ? (
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {post.price_original.toLocaleString('ru')} ₽
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium italic flex items-center gap-0.5" title="Цена не найдена автоматически">
                      ⚠️ не найдена
                    </span>
                  )}
                </td>
              )}

              {/* Колонка 6: Итоговая цена (сверхнаценка и инлайн правка) */}
              {isColVisible('price_edited') && (
                <td className="p-3 align-middle border-b border-slate-105 dark:border-slate-800/65 text-left">
                  {editingPricePostId === post.post_id ? (
                    <div className="space-y-2">
                      <input
                        type="number"
                        value={tempEditPrice}
                        onChange={(e) => setTempEditPrice(e.target.value)}
                        placeholder="Цена..."
                        className="w-24 px-2 py-1 text-xs rounded-lg border border-indigo-200 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 outline-hidden"
                      />
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingPricePostId(null)}
                          className="p-1 px-1.5 text-[8px] font-extrabold text-slate-500 hover:bg-slate-100 rounded cursor-pointer border-0"
                        >
                          <X size={8} />
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEditedPrice(post.post_id)}
                          className="p-1 px-1.5 text-[8px] font-extrabold text-white bg-indigo-600 rounded cursor-pointer border-0"
                        >
                          <Check size={8} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group/price text-xs">
                      {post.price_edited !== null ? (
                        <div className="px-2 py-1 rounded bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 font-black border border-indigo-100/30">
                          {post.price_edited.toLocaleString('ru')} ₽
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium italic">нет значения</span>
                      )}
                      <button
                        type="button"
                        onClick={() => startEditingPrice(post)}
                        className="p-1 text-slate-400 hover:text-indigo-650 hover:bg-slate-50 rounded hidden group-hover/price:block cursor-pointer transition-all border-0 bg-transparent"
                        title="Указать цену вручную"
                      >
                        <Edit2 size={10} />
                      </button>
                    </div>
                  )}
                </td>
              )}

              {/* Колонка 7: Метрики */}
              {isColVisible('metrics') && (
                <td className="p-3 align-middle border-b border-slate-105 dark:border-slate-800/65 text-left">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-400 font-semibold select-none">
                    <span className="flex items-center gap-0.5 text-rose-500/90" title="Лайки">
                      ❤️
                      {formatCompact(post.likes)}
                    </span>
                    <span className="flex items-center gap-0.5 text-slate-400" title="Просмотры">
                      👁️
                      {formatCompact(post.views)}
                    </span>
                    <span className="flex items-center gap-0.5 text-indigo-500/90" title="Комментарии">
                      💬
                      {formatCompact(post.comments)}
                    </span>
                    <span className="flex items-center gap-0.5 text-cyan-500" title="Репосты">
                      🔄
                      {formatCompact(post.reposts)}
                    </span>
                  </div>
                </td>
              )}

              {/* Колонка 8: Дата */}
              {isColVisible('date') && (
                <td className="p-3 align-middle text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-105 dark:border-slate-800/65 text-left font-mono">
                  {post.date_formatted}
                </td>
              )}

              {/* Колонка 9: Статус выгрузки */}
              {isColVisible('exported') && (
                <td className="p-3 text-center align-middle border-b border-slate-105 dark:border-slate-800/65">
                  <button
                    type="button"
                    onClick={() => toggleExported(post.post_id)}
                    className={`inline-flex items-center justify-center p-1 px-2.5 text-[10px] font-extrabold rounded-md border transition-all cursor-pointer ${
                      post.is_exported
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-705 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400'
                        : 'bg-white border-slate-200 text-slate-400 hover:text-slate-650 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700'
                    }`}
                  >
                    {post.is_exported ? 'Выгружен' : 'Не выгруж.'}
                  </button>
                </td>
              )}
            </>
          );
        }}
      />

      {/* Плавающая панель массовых действий */}
      {selectedPostIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl flex items-center justify-between gap-6 p-4 px-6 shadow-xl border border-slate-800 animate-in slide-in-from-bottom-5 duration-200 max-w-[90vw] md:max-w-xl">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-[#4C75A3] font-bold text-xs">
              Выбрано: {selectedPostIds.size}
            </span>
            <p className="text-xs text-slate-300 font-semibold hidden md:block">
              выгрузите выбранное ВКонтакте
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkFavorite}
              className="py-1.5 px-3 bg-slate-800 hover:bg-slate-755 text-white font-bold text-xs rounded-lg border border-slate-700 transition-all cursor-pointer flex items-center gap-1 active:scale-[0.98]"
            >
              ⭐ В избранное
            </button>
            <button
              onClick={handleBulkExportToVk}
              className="py-1.5 px-4 bg-[#4C75A3] hover:bg-[#3d618a] text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-[0.98] border-0"
            >
              🚀 Выгрузить в VK
            </button>
            <button
              onClick={() => setSelectedPostIds(new Set())}
              className="p-1.5 hover:bg-slate-800/80 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer border-0 bg-transparent"
              title="Сбросить выделение"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Модальное окно прогресса публикации в группу ВК */}
      {isPublishing && (
        <div id="publish-progress-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1 px-2 text-[10px] font-bold bg-[#4C75A3] text-white rounded">VK API PUBLISH ENGINE</span>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Выгрузка товаров ВКонтакте</h3>
              </div>
              {!publishSummary && (
                <div className="flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin text-indigo-500" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Работаем...</span>
                </div>
              )}
            </div>

            {!publishSummary && activePublishPost && (
              <div className="mb-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-205 dark:border-slate-800 p-3 rounded-xl flex gap-3 text-left">
                {activePublishPost.images.length > 0 && (
                  <img src={activePublishPost.images[0].url} alt="pic" className="w-11 h-11 object-cover rounded-md shadow-xs border border-slate-200" />
                )}
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-[#4C75A3]">Публикуется товар #{publishingProgress.current}:</span>
                  <p className="text-xs text-slate-800 dark:text-slate-200 truncate leading-relaxed">
                    "{activePublishPost.text_edited || activePublishPost.text_original}"
                  </p>
                  <p className="text-[10px] text-slate-450 font-bold mt-1">Цена: {activePublishPost.price_edited} руб.</p>
                </div>
              </div>
            )}

            <div className="space-y-1.5 mb-4 text-left">
              <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                <span>Прогресс копирования стен:</span>
                <span>{publishingProgress.current} из {publishingProgress.total} постов</span>
              </div>
              <div className="w-full bg-slate-105 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className="bg-gradient-to-r from-[#4C75A3] to-[#5B88BD] h-full transition-all duration-300"
                  style={{ width: `${(publishingProgress.current / publishingProgress.total) * 105}%` }}
                />
              </div>
            </div>

            <div className="flex-1 bg-slate-950 text-slate-200 p-3.5 rounded-xl border border-slate-800 font-mono text-[10px] overflow-y-auto max-h-[160px] flex flex-col space-y-1.5 text-left">
              {publishLogs.map((log, idx) => (
                <div key={idx} className="leading-normal break-words py-0.5 border-b border-white/5 last:border-0">
                  <span className="text-slate-500 mr-1.5">[{idx+1}]</span>
                  {log}
                </div>
              ))}
            </div>

            {publishSummary && (
              <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-100 dark:border-emerald-900 rounded-xl space-y-1.5 text-left">
                <h4 className="text-xs font-extrabold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                  🎉 Выгрузка завершена успешно!
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-350 font-normal leading-relaxed">
                  Успешно зарегистрировано товаров: <strong>{publishSummary.success}</strong>. С ошибкой: <strong>{publishSummary.failed}</strong>.
                </p>
                {publishSummary.links.length > 0 && (
                  <div className="pt-1.5 border-t border-dashed border-emerald-200 dark:border-emerald-800 space-y-1">
                    <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-500">Прямые ссылки для проверки в VK:</span>
                    <div className="max-h-[60px] overflow-y-auto space-y-0.5">
                      {publishSummary.links.map((link, idx) => (
                        <a key={idx} href={link} target="_blank" rel="noreferrer" className="block text-[10px] text-[#4C75A3] hover:underline font-mono truncate">
                          Пост #{idx+1}: {link} ↗
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {publishSummary && (
              <button
                onClick={() => {
                  setIsPublishing(false);
                  setPublishSummary(null);
                  setActivePublishPost(null);
                }}
                className="mt-4 w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer border-0"
              >
                Вернуться к таблице
              </button>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно карусели фотографий для поста */}
      {activeMediaPost && (
        <div id="media-carousel-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setActiveMediaPost(null)}></div>

          <div className="relative w-full max-w-3xl bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] z-10">
            {/* Шапка модалки */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950 text-white border-b border-slate-800 text-left">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold bg-slate-800 px-2.5 py-1 rounded-md text-slate-300">
                  Пост {activeMediaPost.id}
                </p>
                <p className="text-[11px] text-slate-400 font-semibold">{activeMediaPost.date_formatted}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveMediaPost(null)}
                className="p-1 px-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer border-0 bg-transparent"
              >
                <X size={18} />
              </button>
            </div>

            {/* Активная фотография с боковыми стрелками */}
            <div className="flex-1 relative flex items-center justify-center bg-slate-950 p-6 min-h-[300px] max-h-[60vh]">
              {activeMediaPost.images.length > 0 ? (
                <img
                  src={activeMediaPost.images[activeMediaIndex].url}
                  alt={`Медиа ${activeMediaIndex + 1}`}
                  className="max-w-full max-h-[50vh] object-contain rounded-lg"
                />
              ) : (
                <p className="text-sm text-slate-500">Нет изображений к данному посту.</p>
              )}

              {/* Стрелки перелистывания если более 1 фото */}
              {activeMediaPost.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevMedia}
                    className="absolute left-4 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white shadow-md cursor-pointer border-0"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={nextMedia}
                    className="absolute right-4 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white shadow-md cursor-pointer border-0"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
            </div>

            {/* Футер-карусель с эскизами картинок */}
            {activeMediaPost.images.length > 1 && (
              <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-center gap-2 overflow-x-auto">
                {activeMediaPost.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveMediaIndex(idx)}
                    className={`w-10 h-10 rounded-md overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      idx === activeMediaIndex ? 'border-indigo-500 scale-102' : 'border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img.url} alt="Эскиз" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
