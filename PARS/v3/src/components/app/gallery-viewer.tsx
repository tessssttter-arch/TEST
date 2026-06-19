/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Компонент "Умная Галерея" (GalleryViewer / Витрина товаров).
// Обеспечивает премиальное плиточное отображение постов с поддержкой режима "Рентген",
// визуального поиска дубликатов по pHash, клавиатурного Tinder-режима и карусели картинок.

import React, { useState, useEffect, useMemo } from 'react';
import { usePostsStore } from '../../hooks/use-posts-store';
import { VisualIntelligence, VisualDuplicateResult } from '../../plugins/visual-intelligence';
import { TextIntelligence } from '../../plugins/text-intelligence';
import { VKPluginManager } from '../../plugins/vk-manager';
import { 
  Eye, 
  Sparkles, 
  Star, 
  Send, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Layers, 
  CheckCircle,
  Keyboard,
  Info,
  X,
  Trash2,
  Check,
  Edit2,
  FileText,
  RotateCcw
} from 'lucide-react';

// Построение регулярного выражения по выделенному фрагменту (Few-Shot Pattern Builder)
const generateRegexFromSelection = (originalText: string, selectedText: string): { regexStr: string; error?: string } => {
  const cleanedSelection = selectedText.trim();
  if (!cleanedSelection) {
    return { regexStr: '', error: 'Выделенный фрагмент пуст.' };
  }

  // Поиск последовательности цифр внутри выделенного фрагмента (значение цены)
  const digitMatch = /(\d+)/.exec(cleanedSelection);
  if (!digitMatch) {
    return { regexStr: '', error: 'Выделенный фрагмент должен содержать цифры цены.' };
  }

  const priceValue = digitMatch[1];
  const index = originalText.indexOf(cleanedSelection);
  if (index === -1) {
    return { regexStr: '', error: 'Выделенный текст не обнаружен в оригинальном посте.' };
  }

  // Извлечение левого и правого контекста
  const beforeText = originalText.substring(Math.max(0, index - 15), index);
  const afterText = originalText.substring(index + cleanedSelection.length, Math.min(originalText.length, index + cleanedSelection.length + 15));

  // Берем последние 1-2 слова до цены и первые 1-2 слова после цены
  const beforeWords = beforeText.match(/(\S+\s+)?\S+$/);
  const afterWords = afterText.match(/^\S+(\s+\S+)?/);

  const prefix = beforeWords ? beforeWords[0].trim() : '';
  const suffix = afterWords ? afterWords[0].trim() : '';

  // Экранирование спецсимволов для безопасного регулярного выражения
  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let prefixPattern = '';
  if (prefix) {
    const escapedPrefix = escapeRegExp(prefix).replace(/\s+/g, '\\s*');
    prefixPattern = `(?:${escapedPrefix}\\s*)`;
  } else {
    prefixPattern = `(?:\\s*)`;
  }

  let suffixPattern = '';
  if (suffix) {
    const escapedSuffix = escapeRegExp(suffix).replace(/\s+/g, '\\s*');
    suffixPattern = `(?:\\s*${escapedSuffix})`;
  } else {
    suffixPattern = `(?:\\s*)`;
  }

  // Результирующая регулярка
  const regexStr = `${prefixPattern}(\\d+)${suffixPattern}`;
  return { regexStr };
};

export const GalleryViewer: React.FC = () => {
  const { 
    posts,
    filteredPosts, 
    toggleFavorite, 
    exportSelectedPostsToVk,
    updatePostDetails,
    reparseSupplierPosts
  } = usePostsStore();

  // Состояния отображения
  const [isXRayMode, setIsXRayMode] = useState<boolean>(true); // "Рентген" режим активен по умолчанию для наглядности
  const [activeIndex, setActiveIndex] = useState<number>(0);  // Индекс для Tinder-режима клавиатуры
  const [cardSlideIndex, setCardSlideIndex] = useState<Record<string, number>>({});

  // Лимитирование видимых карточек для оптимизации отрисовки DOM (Lazy Load / Пагинация)
  const [visibleLimit, setVisibleLimit] = useState<number>(30);

  // Детальный просмотр и обучение паттерну цены донора
  const [selectedPostForDetail, setSelectedPostForDetail] = useState<any | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const [generatedPattern, setGeneratedPattern] = useState<string>('');
  const [patternErrorMessage, setPatternErrorMessage] = useState<string>('');
  const [patternSaveSuccess, setPatternSaveSuccess] = useState<boolean>(false);
  const [isEditingProcessedText, setIsEditingProcessedText] = useState<boolean>(false);
  const [editedTextValue, setEditedTextValue] = useState<string>('');

  // Локальный кеш дубликатов для постов, чтобы подсвечивать связи (pHash)
  const [duplicatesMap, setDuplicatesMap] = useState<Record<string, VisualDuplicateResult[]>>({});
  const [isComputingHashes, setIsComputingHashes] = useState<boolean>(false);

  // Специфические фильтры Галереи
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'fresh' | 'sizes' | 'no-price'>('all');

  // Очистка и запуск состояний при переключении карточки в модалке
  useEffect(() => {
    if (selectedPostForDetail) {
      setEditedTextValue(selectedPostForDetail.text_edited || selectedPostForDetail.processedText || selectedPostForDetail.text_original || '');
      setIsEditingProcessedText(false);
      setSelectedText('');
      setGeneratedPattern('');
      setPatternErrorMessage('');
      setPatternSaveSuccess(false);
    }
  }, [selectedPostForDetail]);

  // Сброс лимита видимости при переключении фильтров умной витрины
  useEffect(() => {
    setVisibleLimit(30);
  }, [galleryFilter, filteredPosts]);

  const handleSelection = () => {
    const selection = window.getSelection();
    if (selection) {
      const text = selection.toString().trim();
      if (text && selectedPostForDetail) {
        setSelectedText(text);
        const sourceText = selectedPostForDetail.originalText || selectedPostForDetail.text_original || '';
        const res = generateRegexFromSelection(sourceText, text);
        if (res.regexStr) {
          setGeneratedPattern(res.regexStr);
          setPatternErrorMessage('');
        } else {
          setGeneratedPattern('');
          setPatternErrorMessage(res.error || 'Ошибка построения регулярного выражения');
        }
      }
    }
  };

  const handleSaveTextEdit = () => {
    if (selectedPostForDetail) {
      updatePostDetails(selectedPostForDetail.post_id, editedTextValue, selectedPostForDetail.price_edited);
      setSelectedPostForDetail(prev => prev ? { ...prev, text_edited: editedTextValue, is_manually_edited: true } : null);
      setIsEditingProcessedText(false);
    }
  };

  const handleResetToClean = () => {
    if (selectedPostForDetail) {
      const cleanDesc = selectedPostForDetail.processedText || selectedPostForDetail.text_original || '';
      setEditedTextValue(cleanDesc);
      updatePostDetails(selectedPostForDetail.post_id, cleanDesc, selectedPostForDetail.price_edited);
      setSelectedPostForDetail(prev => prev ? { ...prev, text_edited: cleanDesc, is_manually_edited: false } : null);
      setIsEditingProcessedText(false);
    }
  };

  const handleSavePattern = () => {
    if (selectedPostForDetail && generatedPattern) {
      const ownerId = String(selectedPostForDetail.owner_id);
      VKPluginManager.saveSupplierPattern({
        ownerId,
        pricePattern: generatedPattern
      });
      setPatternSaveSuccess(true);
      // Мгновенный пересчет всех цен поставщика
      reparseSupplierPosts(selectedPostForDetail.owner_id);
      
      setTimeout(() => {
        const updatedPost = filteredPosts.find(p => p.post_id === selectedPostForDetail.post_id);
        if (updatedPost) {
          setSelectedPostForDetail(updatedPost);
        }
        setPatternSaveSuccess(false);
      }, 300);
    }
  };

  const handleRemovePattern = () => {
    if (selectedPostForDetail) {
      const ownerId = String(selectedPostForDetail.owner_id);
      VKPluginManager.deleteSupplierPattern(ownerId);
      reparseSupplierPosts(selectedPostForDetail.owner_id);
      
      setTimeout(() => {
        const updatedPost = filteredPosts.find(p => p.post_id === selectedPostForDetail.post_id);
        if (updatedPost) {
          setSelectedPostForDetail(updatedPost);
        }
      }, 300);
    }
  };

  // 1. Асинхронный расчет перцептивных хэшей для картинок при загрузке новых постов (сохраняем кэш и не перезапускаем на фильтрах)
  useEffect(() => {
    let active = true;
    const calculateAllHashes = async () => {
      if (posts.length === 0) return;
      setIsComputingHashes(true);

      for (const post of posts) {
        if (!active) break;
        // Если для данного поста дубликаты уже были рассчитаны, пропускаем
        if (duplicatesMap[post.post_id]) continue;

        if (post.images && post.images.length > 0) {
          const firstImg = post.images[0].url;
          
          // Рассчитываем и кешируем хэш первого изображения
          const pHash = await VisualIntelligence.compute(firstImg, post.post_id);
          
          // Сразу сканируем на наличие дубликатов в базе данных IndexedDB
          if (pHash) {
            const dups = await VisualIntelligence.findDuplicates(pHash, post.post_id, 80);
            if (dups.length > 0 && active) {
              setDuplicatesMap(prev => {
                if (prev[post.post_id]) return prev;
                return {
                  ...prev,
                  [post.post_id]: dups,
                };
              });
            }
          }
        }
      }
      if (active) setIsComputingHashes(false);
    };

    calculateAllHashes();
    return () => {
      active = false;
    };
  }, [posts]);

  // 2. Клавиатурное Tinder-управление (стрелки Влево/Вправо)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredPosts.length === 0) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filteredPosts.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filteredPosts.length) % filteredPosts.length);
      } else if (e.key === 'f' || e.key === 'а') {
        // 'F' - добавить текущий в избранное
        e.preventDefault();
        const currentPost = filteredPosts[activeIndex];
        if (currentPost) toggleFavorite(currentPost.post_id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredPosts, activeIndex, toggleFavorite, activeIndex]);

  // 3. Выборка постов с применением дополнительных фильтров галереи
  const galleryItems = useMemo(() => {
    let items = [...filteredPosts];

    if (galleryFilter === 'fresh') {
      // Сортировка по свежести (новые вверху)
      items.sort((a, b) => b.timestamp - a.timestamp);
    } else if (galleryFilter === 'sizes') {
      // Только посты, у которых извлечен список размеров
      items = items.filter(p => {
        const sizes = p.sizes || TextIntelligence.extractSizes(p.text_original, p.owner_id);
        return sizes && sizes.length > 0;
      });
    } else if (galleryFilter === 'no-price') {
      // Посты без установленной цены
      items = items.filter(p => p.price_edited === null);
    }

    return items;
  }, [filteredPosts, galleryFilter]);

  // Использовать срез видимых постов для отрисовки DOM
  const visibleItems = useMemo(() => {
    return galleryItems.slice(0, visibleLimit);
  }, [galleryItems, visibleLimit]);

  // Управление каруселью внутри конкретной карточки
  const nextSlide = (postId: string, max: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCardSlideIndex(prev => {
      const current = prev[postId] || 0;
      return {
        ...prev,
        [postId]: (current + 1) % max
      };
    });
  };

  const prevSlide = (postId: string, max: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCardSlideIndex(prev => {
      const current = prev[postId] || 0;
      return {
        ...prev,
        [postId]: (current - 1 + max) % max
      };
    });
  };

  // Метод автоматической публикации выбранного в VK
  const handlePublishedToVk = async (postId: string) => {
    try {
      await exportSelectedPostsToVk([postId]);
    } catch (e: any) {
      alert(`Ошибка экспорта: ${e.message}`);
    }
  };

  return (
    <div id="smart-gallery-container" className="space-y-6">
      
      {/* 1. Настройка тулбара Умной Галереи */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
            <Sparkles size={16} />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
              Умная Фото-Витрина (Smart Gallery)
            </h4>
            <p className="text-[10px] text-slate-500">
              Быстрый визуальный отбор товаров, подсветка похожих дубликатов Садовода по пиксельной свертке.
            </p>
          </div>
        </div>

        {/* Фильтры и Интерактивные Переключатели */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Режимы Галереи */}
          <div className="flex bg-slate-200/60 dark:bg-slate-950 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setGalleryFilter('all')}
              className={`py-1 px-2.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                galleryFilter === 'all' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              Все товары
            </button>
            <button
              type="button"
              onClick={() => setGalleryFilter('sizes')}
              className={`py-1 px-2.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                galleryFilter === 'sizes' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              С размерами
            </button>
            <button
              type="button"
              onClick={() => setGalleryFilter('no-price')}
              className={`py-1 px-2.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                galleryFilter === 'no-price' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              Без цен
            </button>
          </div>

          {/* Кнопка режима Рентген */}
          <button
            type="button"
            onClick={() => setIsXRayMode(!isXRayMode)}
            className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer ${
              isXRayMode 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900'
            }`}
          >
            <Eye size={12} />
            {isXRayMode ? 'Рентген: ВКЛ 👁️‍عون' : 'Рентген: ВЫКЛ'}
          </button>
        </div>
      </div>

      {/* Клавиатурный Tinder хелпер */}
      {galleryItems.length > 0 && (
        <div className="hidden sm:flex items-center gap-2 p-3 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/20 rounded-xl text-xs text-indigo-700 dark:text-indigo-400">
          <Keyboard size={14} className="shrink-0" />
          <p className="leading-relaxed text-[11px] text-left">
            <strong>Tinder свипы кнопками:</strong> Нажимайте <kbd className="bg-white px-1.5 py-0.5 border rounded shadow-2xs font-mono font-bold dark:bg-slate-800">← Стрелка Влево</kbd> и <kbd className="bg-white px-1.5 py-0.5 border rounded shadow-2xs font-mono font-bold dark:bg-slate-800">Стрелка Вправо →</kbd> для мотания, <kbd className="bg-white px-1.5 py-0.5 border rounded shadow-2xs font-mono font-bold dark:bg-slate-800">F</kbd> — Избранное. Активный товар выделен синей рамкой.
          </p>
        </div>
      )}

      {/* Оповещение об индексации хэшей */}
      {isComputingHashes && (
        <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse bg-slate-50 dark:bg-slate-900/30 p-2.5 rounded-lg border text-left">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4C75A3]"></span>
          <span>Оркестратор VisualIntelligence рассчитывает пиксельные pHash-слепки изображений для разметки дубликатов поставщиков...</span>
        </div>
      )}

      {/* Bento Grid отображения товаров */}
      {galleryItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {visibleItems.map((post, idx) => {
            const isSelectedTinder = idx === activeIndex;
            const currentSlide = cardSlideIndex[post.post_id] || 0;
            const imagesCount = post.images?.length || 0;
            const hasImages = imagesCount > 0;
            
            // Получаем размеры поста
            const postSizes = post.sizes || TextIntelligence.extractSizes(post.text_original, post.owner_id);
            
            // Проверяем дубликаты
            const postDups = duplicatesMap[post.post_id] || [];
            const hasDups = postDups.length > 0;

            return (
              <div
                key={post.post_id}
                id={`gallery-card-${post.post_id}`}
                onClick={() => setSelectedPostForDetail(post)}
                className={`group relative flex flex-col bg-white dark:bg-slate-900 border overflow-hidden rounded-2xl shadow-2xs transition-all duration-300 cursor-pointer ${
                  isSelectedTinder 
                    ? 'ring-4 ring-indigo-550 scale-[1.01] border-transparent' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {/* Visual pHash duplicate Badge */}
                {hasDups && (
                  <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2 py-1 text-[8px] font-extrabold bg-amber-500 text-white rounded-full shadow-md">
                    <Layers size={9} />
                    <span>ЕСТЬ ДУБЛИ ({postDups.length})</span>
                  </div>
                )}

                {/* Vendor Location Location Badge */}
                <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-0.5 px-2 py-0.5 text-[8px] font-bold bg-slate-900/85 text-white rounded-md">
                  <MapPin size={8} />
                  <span>Садовод</span>
                </div>

                {/* Основная картинка / Карусель */}
                <div className="relative aspect-square w-full bg-slate-50 dark:bg-slate-950 overflow-hidden shrink-0">
                  {hasImages ? (
                    <img
                      src={post.images[currentSlide].url}
                      alt={post.title || 'Картинка товара'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                      <Layers size={24} className="opacity-40 mb-1" />
                      <span className="text-[10px]">Фото отсутствует</span>
                    </div>
                  )}

                  {/* Слайдер навигации */}
                  {imagesCount > 1 && (
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); prevSlide(post.post_id, imagesCount, e); }}
                        className="p-1 rounded-full bg-white/85 text-slate-800 hover:bg-white cursor-pointer shadow-xs border-0"
                      >
                        <ChevronLeft size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); nextSlide(post.post_id, imagesCount, e); }}
                        className="p-1 rounded-full bg-white/85 text-slate-800 hover:bg-white cursor-pointer shadow-xs border-0"
                      >
                        <ChevronRight size={10} />
                      </button>
                    </div>
                  )}

                  {/* Нижняя строчка с индексами карусели */}
                  {imagesCount > 1 && (
                    <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 z-10">
                      {post.images.map((_, dotIdx) => (
                        <span
                          key={dotIdx}
                          className={`w-1.5 h-1.5 rounded-full ${
                            dotIdx === currentSlide ? 'bg-indigo-600' : 'bg-white/60'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Рентген Оверлей (X-Ray Mode) с полной информацией поверх фото */}
                  {isXRayMode && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col justify-between p-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                      {/* Верх оверлея */}
                      <div className="space-y-1.5 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] uppercase font-bold tracking-wider opacity-60">
                            Анализ размера:
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${postSizes.length > 0 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                            {postSizes.length > 0 ? `${postSizes.length} шт` : 'нет'}
                          </span>
                        </div>
                        
                        {postSizes.length > 0 ? (
                           <div className="flex flex-wrap gap-1 max-h-[36px] overflow-y-auto animate-fadeIn">
                            {postSizes.slice(0, 8).map((sz: string) => (
                              <span key={sz} className="px-1 py-0.5 text-[8px] font-semibold bg-white/10 rounded-sm">
                                {sz}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[9px] italic opacity-50">Размеры не распознаны</p>
                        )}
                      </div>

                      {/* Текст поста превью */}
                      <p className="text-[9px] line-clamp-3 text-slate-300 leading-normal italic text-left">
                        "{post.text_edited || post.text_original}"
                      </p>

                      {/* Низ оверлея */}
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-1 text-[9px] font-bold">
                        <div className="text-left">
                          <p className="text-[8px] font-normal opacity-60">Расчетная маржа:</p>
                          <p className="text-emerald-400">
                            {post.price_edited && post.price_original 
                              ? `+${post.price_edited - post.price_original} ₽` 
                              : '0 ₽'}
                          </p>
                        </div>
                        
                        {/* Кнопки Быстрого Действия */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(post.post_id); }}
                            className={`p-1.5 rounded-lg border ${
                              post.is_favorite 
                                ? 'bg-amber-500 border-transparent text-white' 
                                : 'bg-white/10 border-white/20 hover:bg-white/20'
                            }`}
                            title="Избранное"
                          >
                            <Star size={10} fill={post.is_favorite ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Информация под карточкой */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    {/* Локация поставщика (место Садовода) */}
                    <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-[9px]">
                      <MapPin size={10} />
                      <span className="truncate block text-left">
                        {post.vendor_location || 'Линия Садовод'}
                      </span>
                    </div>

                    {/* Название */}
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 line-clamp-1 text-left">
                      {post.title || 'Пост без заголовка'}
                    </h5>
                  </div>

                  {/* Прайс зона */}
                  <div className="flex items-end justify-between pt-1 border-t border-slate-50 dark:border-slate-800/50">
                    <div className="text-left">
                      <p className="text-[8px] text-slate-400 uppercase tracking-widest font-semibold">Цена</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-black text-indigo-700 dark:text-indigo-400">
                          {post.price_edited !== null ? `${post.price_edited} ₽` : 'нет'}
                        </span>
                        {post.price_original && post.price_original !== post.price_edited && (
                          <span className="text-[9px] line-through text-slate-400">
                            {post.price_original}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Кнопка запуска выгрузки обратно в сообщество */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlePublishedToVk(post.post_id); }}
                      className={`p-1.5 rounded-xl cursor-pointer border-0 transition-all ${
                        post.is_exported
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800'
                      }`}
                      title={post.is_exported ? "Успешно выгружен!" : "Выгрузить карточку в ВК сообщество"}
                    >
                      {post.is_exported ? <CheckCircle size={12} /> : <Send size={11} />}
                    </button>
                  </div>
                </div>

                {/* Линия связи дубликатов на карточке */}
                {hasDups && (
                  <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500 w-full shrink-0" title="Визуальный дубликат найден в других постах" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-dashed text-slate-400 bg-slate-50/50 dark:bg-slate-900/10">
          <Info size={24} className="mx-auto text-slate-300 dark:text-slate-700 mb-1.5" />
          <h5 className="font-bold text-xs text-slate-650">Нет элементов для отображения</h5>
          <p className="text-[10px] mt-0.5">Попробуйте скорректировать фильтры или загрузить исходный JSON.</p>
        </div>
      )}

      {/* Кнопка дозагрузки (пагинация) в Умной Галерее */}
      {galleryItems.length > visibleLimit && (
        <div className="flex justify-center pt-6 pb-2">
          <button
            type="button"
            onClick={() => setVisibleLimit(prev => prev + 30)}
            className="flex items-center gap-2 px-6 py-3 text-xs font-bold text-slate-705 bg-slate-100 hover:bg-slate-200 border-0 rounded-xl shadow-xs transition-all cursor-pointer btn animate-pulse"
          >
            <Sparkles size={13} className="text-indigo-600 dark:text-indigo-400" />
            <span>Показать еще 30 товаров (осталось {galleryItems.length - visibleLimit})</span>
          </button>
        </div>
      )}

      {/* 2. Высокотехнологичная модалка детального просмотра и обучения парсингу */}
      {selectedPostForDetail && (() => {
        // Локальное получение активного паттерна из Стора/localStorage
        const currentPatternsMap = VKPluginManager.getSupplierPatterns();
        const activePatternObj = currentPatternsMap[String(selectedPostForDetail.owner_id)];
        const hasActivePattern = !!activePatternObj;
        
        const detailSizes = selectedPostForDetail.sizes || TextIntelligence.extractSizes(selectedPostForDetail.text_original, selectedPostForDetail.owner_id);
        const imagesList = selectedPostForDetail.images || [];
        const hasImages = imagesList.length > 0;
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
            <div 
              className="relative max-w-5xl w-full max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-scaleIn"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Заголовок модалки */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="text-left">
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-md">
                    ОБУЧАЮЩИЙ РЕЖИМ (FEW-SHOT LEARNER)
                  </span>
                  <h4 className="text-base font-extrabold text-slate-800 dark:text-white mt-1">
                    {selectedPostForDetail.title || 'Пост без названия'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ID поста: <span className="font-mono">{selectedPostForDetail.post_id}</span> | Поставщик (owner_id): <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{selectedPostForDetail.owner_id}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPostForDetail(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Тело модалки */}
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Левая колонка - Визуал и Параметры (5 колонок) */}
                <div className="md:col-span-5 space-y-5">
                  
                  {/* Слайдер картинок в модалке */}
                  <div className="relative aspect-square w-full rounded-2xl bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center">
                    {hasImages ? (
                      <>
                        <img
                          src={imagesList[activeIndex % imagesList.length]?.url || imagesList[0].url}
                          alt="Изображение товара детально"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                        />
                        {imagesList.length > 1 && (
                          <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex justify-between z-10">
                            <button
                              type="button"
                              onClick={() => {
                                const nextIdx = activeIndex === 0 ? imagesList.length - 1 : activeIndex - 1;
                                setActiveIndex(nextIdx);
                              }}
                              className="p-1.5 rounded-full bg-white/90 text-slate-800 hover:bg-white cursor-pointer shadow-md"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const nextIdx = (activeIndex + 1) % imagesList.length;
                                setActiveIndex(nextIdx);
                              }}
                              className="p-1.5 rounded-full bg-white/90 text-slate-800 hover:bg-white cursor-pointer shadow-md"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        )}
                        <div className="absolute bottom-2.5 right-3 bg-black/75 px-2 py-0.5 rounded-md text-[9px] font-bold text-white tracking-wider">
                          {(activeIndex % imagesList.length) + 1} / {imagesList.length}
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-slate-500">
                        <Layers size={36} className="mx-auto opacity-40 mb-2" />
                        <span className="text-xs">Фотографии отсутствуют</span>
                      </div>
                    )}
                  </div>

                  {/* Сводка цен и характеристик */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 space-y-3.5 text-left">
                    <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-650 dark:text-indigo-400">
                      Распознанные параметры карточки:
                    </h5>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/50">
                        <p className="text-[9px] opacity-60 font-semibold uppercase">Базовая опт-цена</p>
                        <p className="text-sm font-black text-slate-800 dark:text-white mt-0.5">
                          {selectedPostForDetail.price_original ? `${selectedPostForDetail.price_original} ₽` : 'не найдена'}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/50">
                        <p className="text-[9px] opacity-60 font-semibold uppercase">Продажная цена</p>
                        <p className="text-sm font-black text-indigo-700 dark:text-indigo-400 mt-0.5">
                          {selectedPostForDetail.price_edited ? `${selectedPostForDetail.price_edited} ₽` : 'не найдена'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] opacity-60 font-semibold uppercase">Распознанные размеры:</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {detailSizes.length > 0 ? (
                          detailSizes.map((sz: string) => (
                            <span key={sz} className="px-2 py-0.5 text-[9px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 rounded text-indigo-700 dark:text-indigo-400">
                              {sz}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] italic text-slate-500">Размеры не обнаружены в тексте</span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Правая колонка - Разметка и Обучение (7 колонок) */}
                <div className="md:col-span-7 space-y-5 text-left flex flex-col">
                  
                  {/* Блок 1: Исходник с функцией выделения */}
                  <div className="space-y-1.5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider">
                        Оригинальный текст-донор (Источник)
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <FileText size={10} />
                        Интерактивное выделение
                      </span>
                    </div>
                    
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex-1 flex flex-col min-h-[120px] max-h-[180px] overflow-y-auto">
                      <p className="text-[10px] text-indigo-550 dark:text-indigo-400 italic mb-1 text-[9px]">
                        💡 Выделите мышкой цену (например: «750» или «цена 1000 руб») в тексте ниже для автоматического создания паттерна:
                      </p>
                      <div
                        onMouseUp={handleSelection}
                        onKeyUp={handleSelection}
                        className="text-xs font-mono whitespace-pre-wrap leading-relaxed select-text cursor-text text-slate-800 dark:text-slate-200 bg-indigo-50/20 dark:bg-indigo-950/10 p-2.5 rounded-xl border border-indigo-100/50 dark:border-indigo-950/50 flex-1 overflow-contain text-left"
                      >
                        {selectedPostForDetail.originalText || selectedPostForDetail.text_original || 'Текст пуст'}
                      </div>
                    </div>
                  </div>

                  {/* Блок 2: Обучающая панель Few-Shot Learner */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-950/40 space-y-3 shrink-0">
                    <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-indigo-650" />
                      Помощник обучения алгоритма цены поставщика:
                    </h5>

                    {/* Показ активного сохраненного фильтра */}
                    {hasActivePattern && (
                      <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl text-[10px] text-emerald-800 dark:text-emerald-400 animate-fadeIn">
                        <span className="font-medium truncate mr-2">
                          🎯 Активен паттерн цены: <code className="font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded font-black border border-emerald-200">{activePatternObj.pricePattern}</code>
                        </span>
                        <button
                          type="button"
                          onClick={handleRemovePattern}
                          className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg cursor-pointer border-0 transition-all shadow-2xs"
                          title="Вернуться к базовому парсеру"
                        >
                          <Trash2 size={10} />
                          СБРОСИТЬ
                        </button>
                      </div>
                    )}

                    {selectedText ? (
                      <div className="space-y-2.5 bg-white dark:bg-slate-900 p-3 rounded-xl border animate-slideDown">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase font-bold">Выделенный фрагмент:</span>
                            <div className="font-mono text-[10px] font-extrabold bg-indigo-50 dark:bg-indigo-950/50 px-2 py-1 rounded mt-0.5 text-indigo-700 dark:text-indigo-400 truncate">
                              "{selectedText}"
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase font-bold">Генерируемое выражение:</span>
                            <div className="font-mono text-[10px] font-extrabold bg-teal-50 dark:bg-slate-950 px-2 py-1 rounded mt-0.5 text-teal-800 dark:text-teal-400 truncate">
                              /{generatedPattern}/gi
                            </div>
                          </div>
                        </div>

                        {patternErrorMessage && (
                          <div className="p-1 px-2.5 rounded bg-rose-50 text-rose-750 text-[10px] border border-rose-100 font-semibold">
                            ⚠️ {patternErrorMessage}
                          </div>
                        )}

                        {!patternErrorMessage && generatedPattern && (
                          <button
                            type="button"
                            onClick={handleSavePattern}
                            disabled={patternSaveSuccess}
                            className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-bold border-0 transition-all cursor-pointer shadow-xs ${
                              patternSaveSuccess
                                ? 'bg-emerald-600 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-750 text-white'
                            }`}
                          >
                            {patternSaveSuccess ? (
                              <>
                                <Check size={12} />
                                Алгоритм цены сохранен и применен!
                              </>
                            ) : (
                              <>
                                <Sparkles size={11} />
                                Запомнить паттерн для поставщика {selectedPostForDetail.owner_id}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic py-2 bg-white/50 dark:bg-slate-900/50 rounded-xl px-3 border border-dashed border-slate-200">
                        Выделите мышкой цифру цены внутри правого текстового источника, после чего алгоритм автоматически сгенерирует RegExp конкретно для прайс-шаблонов этого донора Садовода.
                      </p>
                    )}
                  </div>

                  {/* Блок 3: Обработанный текст для витрин */}
                  <div className="space-y-1.5 shrink-0 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-indigo-650 dark:text-indigo-400 tracking-wider">
                        Обработанный текст для витрины (Публикация)
                      </span>
                      {selectedPostForDetail.is_manually_edited && (
                        <span className="px-2 py-0.5 text-[8px] font-bold bg-amber-500 text-white rounded-full">
                          Изменен вручную
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={editedTextValue}
                        onChange={(e) => {
                          setEditedTextValue(e.target.value);
                          setIsEditingProcessedText(true);
                        }}
                        className="w-full font-sans text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 resize-none leading-relaxed text-left"
                        placeholder="Очищенный от метаданных текст товара..."
                      />

                      <div className="flex items-center justify-between gap-2">
                        {isEditingProcessedText ? (
                          <div className="flex gap-2 w-full">
                            <button
                              type="button"
                              onClick={handleSaveTextEdit}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer border-0 shadow-xs"
                            >
                              <Check size={11} />
                              Сохранить текст
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditedTextValue(selectedPostForDetail.text_edited || selectedPostForDetail.text_original || '');
                                setIsEditingProcessedText(false);
                              }}
                              className="px-3 py-1.5 text-[10px] font-extrabold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer border border-slate-200"
                            >
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResetToClean}
                            className="flex items-center gap-1 px-3 py-1.5 text-[9px] font-extrabold uppercase text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-all w-full justify-center"
                          >
                            <RotateCcw size={10} />
                            Сбросить изменения текста к оригиналу умного разбора
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* Хвостовик модалки */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedPostForDetail(null)}
                  className="px-5 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white rounded-xl cursor-pointer border-0"
                >
                  Закрыть карточку
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
};
