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
import { 
  Eye, 
  Sparkles, 
  Star, 
  Send, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Layers, 
  Tag, 
  CheckCircle,
  Keyboard,
  Info
} from 'lucide-react';

export const GalleryViewer: React.FC = () => {
  const { 
    filteredPosts, 
    posts,
    toggleFavorite, 
    toggleExported, 
    updatePostDetails, 
    exportSelectedPostsToVk 
  } = usePostsStore();

  // Состояния отображения
  const [isXRayMode, setIsXRayMode] = useState<boolean>(true); // "Рентген" режим активен по умолчанию для наглядности
  const [activeIndex, setActiveIndex] = useState<number>(0);  // Индекс для Tinder-режима клавиатуры
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  
  // Карусель картинок внутри карточек: храним текущий индекс слайда по postId
  const [cardSlideIndex, setCardSlideIndex] = useState<Record<string, number>>({});

  // Локальный кеш дубликатов для постов, чтобы подсвечивать связи (pHash)
  const [duplicatesMap, setDuplicatesMap] = useState<Record<string, VisualDuplicateResult[]>>({});
  const [isComputingHashes, setIsComputingHashes] = useState<boolean>(false);

  // Специфические фильтры Галереи
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'fresh' | 'sizes' | 'no-price'>('all');

  // 1. Асинхронный расчет перцептивных хэшей для картинок при монтировании
  useEffect(() => {
    let active = true;
    const calculateAllHashes = async () => {
      if (filteredPosts.length === 0) return;
      setIsComputingHashes(true);

      for (const post of filteredPosts) {
        if (!active) break;
        if (post.images && post.images.length > 0) {
          const firstImg = post.images[0].url;
          
          // Рассчитываем и кешируем хэш первого изображения
          const pHash = await VisualIntelligence.compute(firstImg, post.post_id);
          
          // Сразу сканируем на наличие дубликатов в БД IndexedDB
          if (pHash) {
            const dups = await VisualIntelligence.findDuplicates(pHash, post.post_id, 80);
            if (dups.length > 0 && active) {
              setDuplicatesMap(prev => ({
                ...prev,
                [post.post_id]: dups,
              }));
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
  }, [filteredPosts]);

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
  }, [filteredPosts, activeIndex]);

  // 3. Выборка постов с применением дополнительных фильтров галереи
  const galleryItems = useMemo(() => {
    let items = [...filteredPosts];

    if (galleryFilter === 'fresh') {
      // Сортировка по свежести (новые вверху)
      items.sort((a, b) => b.timestamp - a.timestamp);
    } else if (galleryFilter === 'sizes') {
      // Только посты, у которых извлечен список размеров
      items = items.filter(p => {
        const sizes = (p as any).sizes || TextIntelligence.extractSizes(p.text_original);
        return sizes && sizes.length > 0;
      });
    } else if (galleryFilter === 'no-price') {
      // Посты без установленной цены
      items = items.filter(p => p.price_edited === null);
    }

    return items;
  }, [filteredPosts, galleryFilter]);

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
          <div>
            <h4 className="text-xs font-extrabold text-slate-805 dark:text-white uppercase tracking-wider">
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
            {isXRayMode ? 'Рентген: ВКЛ 👁️‍🗨️' : 'Рентген: ВЫКЛ'}
          </button>
        </div>
      </div>

      {/* Клавиатурный Tinder хелпер */}
      {galleryItems.length > 0 && (
        <div className="hidden sm:flex items-center gap-2 p-3 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/20 rounded-xl text-xs text-indigo-700 dark:text-indigo-400">
          <Keyboard size={14} className="shrink-0" />
          <p className="leading-relaxed text-[11px]">
            <strong>Tinder свипы кнопками:</strong> Нажимайте <kbd className="bg-white px-1.5 py-0.5 border rounded shadow-2xs font-mono font-bold dark:bg-slate-800">← Стрелка Влево</kbd> и <kbd className="bg-white px-1.5 py-0.5 border rounded shadow-2xs font-mono font-bold dark:bg-slate-800">Стрелка Вправо →</kbd> для мотания, <kbd className="bg-white px-1.5 py-0.5 border rounded shadow-2xs font-mono font-bold dark:bg-slate-800">F</kbd> — Избранное. Активный товар выделен синей рамкой.
          </p>
        </div>
      )}

      {/* Оповещение об индексации хэшей */}
      {isComputingHashes && (
        <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse bg-slate-50 dark:bg-slate-900/30 p-2.5 rounded-lg border">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4C75A3]"></span>
          <span>Оркестратор VisualIntelligence рассчитывает пиксельные pHash-слепки изображений для разметки дубликатов поставщиков...</span>
        </div>
      )}

      {/* 2. Bento Grid отображения товаров */}
      {galleryItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {galleryItems.map((post, idx) => {
            const isSelectedTinder = idx === activeIndex;
            const currentSlide = cardSlideIndex[post.post_id] || 0;
            const imagesCount = post.images?.length || 0;
            const hasImages = imagesCount > 0;
            
            // Получаем размеры поста
            const postSizes = (post as any).sizes || TextIntelligence.extractSizes(post.text_original);
            
            // Проверяем дубликаты
            const postDups = duplicatesMap[post.post_id] || [];
            const hasDups = postDups.length > 0;

            return (
              <div
                key={post.post_id}
                id={`gallery-card-${post.post_id}`}
                onMouseEnter={() => setHoveredCardId(post.post_id)}
                onMouseLeave={() => setHoveredCardId(null)}
                className={`group relative flex flex-col bg-white dark:bg-slate-900 border overflow-hidden rounded-2xl shadow-2xs transition-all duration-300 ${
                  isSelectedTinder 
                    ? 'ring-4 ring-indigo-500/80 scale-[1.01] border-transparent' 
                    : 'border-slate-205 dark:border-slate-800 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {/* Visual pHash duplicate Badge */}
                {hasDups && (
                  <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2 py-1 text-[8px] font-extrabold bg-amber-500 text-white rounded-full shadow-md animate-bounce">
                    <Layers size={9} />
                    <span>ЕСТЬ ДУБЛИ ({postDups.length})</span>
                  </div>
                )}

                {/* Vendor Location Location Badge */}
                {post.signer_id && (
                  <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-0.5 px-2 py-0.5 text-[8px] font-bold bg-slate-900/85 text-white rounded-md">
                    <MapPin size={8} />
                    <span>Садовод</span>
                  </div>
                )}

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
                        onClick={(e) => prevSlide(post.post_id, imagesCount, e)}
                        className="p-1 rounded-full bg-white/85 text-slate-800 hover:bg-white cursor-pointer shadow-xs"
                      >
                        <ChevronLeft size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => nextSlide(post.post_id, imagesCount, e)}
                        className="p-1 rounded-full bg-white/85 text-slate-800 hover:bg-white cursor-pointer shadow-xs"
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
                          <div className="flex flex-wrap gap-1 max-h-[36px] overflow-y-auto">
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
                        <div>
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
                            onClick={() => toggleFavorite(post.post_id)}
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
                      <span className="truncate">
                        {(post as any).vendor_location || 'Линия Садовод'}
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
                        <span className="text-xs font-black text-indigo-650 dark:text-indigo-400">
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
                      onClick={() => handlePublishedToVk(post.post_id)}
                      className={`p-1.5 rounded-xl cursor-pointer transition-all ${
                        post.is_exported
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400'
                          : 'bg-indigo-55 text-indigo-650 hover:bg-indigo-100 hover:text-indigo-700'
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
    </div>
  );
};
