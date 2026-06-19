/**
 * Компонент галереи медиафайлов товара (ProductMediaGallery).
 * Отвечает за показ миниатюр, слайдов интерактивной карусели, оверлей-кнопок выбора и звезд.
 */

import React, { useState } from 'react';
import { Star, CheckSquare, Square, Image as ImageIcon } from 'lucide-react';

interface ProductMediaGalleryProps {
  productId: string;
  images: string[];
  mainImage: string;
  selected?: boolean;
  starred?: boolean;
  isModified?: boolean;
  onToggleSelect: () => void;
  onToggleStar: () => void;
  onOpenLightbox: (images: string[], index: number) => void;
  viewMode: 'grid' | 'list';
}

export const ProductMediaGallery: React.FC<ProductMediaGalleryProps> = ({
  productId,
  images,
  mainImage,
  selected = false,
  starred = false,
  isModified = false,
  onToggleSelect,
  onToggleStar,
  onOpenLightbox,
  viewMode,
}) => {
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const resolvedImages = images && images.length > 0 
    ? images 
    : [mainImage].filter(Boolean) as string[];

  if (viewMode === 'grid') {
    return (
      <div className="relative aspect-square w-full overflow-hidden bg-stone-100 flex items-center justify-center group/card select-none">
        {/* Чекбокс выбора */}
        <button
          id={`toggle-select-grid-${productId}`}
          onClick={onToggleSelect}
          className="absolute top-2.5 left-2.5 bg-white/95 text-stone-850 rounded-lg p-2 shadow-xs hover:bg-stone-50 transition-colors z-10 border border-stone-200 cursor-pointer"
        >
          {selected ? (
            <CheckSquare className="w-4 h-4 text-stone-905" />
          ) : (
            <Square className="w-4 h-4 text-stone-400" />
          )}
        </button>

        {/* Звездный маркер (звезда) */}
        <button
          id={`toggle-star-grid-${productId}`}
          onClick={onToggleStar}
          className="absolute top-2.5 right-2.5 bg-white/95 text-yellow-500 rounded-lg p-2 shadow-xs hover:bg-stone-50 transition-colors z-10 border border-stone-200 cursor-pointer"
        >
          <Star className={`w-4 h-4 ${starred ? "fill-yellow-500 text-yellow-500" : "text-stone-405 text-stone-400"}`} />
        </button>

        {/* Индикатор правок */}
        {isModified && (
          <span className="absolute bottom-2.5 left-2.5 bg-amber-500 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded shadow-xs z-10 uppercase tracking-wide">
            Правка
          </span>
        )}

        {/* Количество изображений */}
        {resolvedImages.length > 1 && (
          <span className="absolute bottom-2.5 right-2.5 bg-stone-900/60 text-stone-100 text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 backdrop-blur-[2px] pointer-events-none z-10">
            <ImageIcon className="w-3 h-3" />
            {resolvedImages.length}
          </span>
        )}

        {/* Интерактивное открытие Lightbox */}
        {resolvedImages.length > 0 ? (
          <img
            onClick={() => onOpenLightbox(resolvedImages, activeImageIdx)}
            src={resolvedImages[activeImageIdx] || mainImage}
            alt="Превью товара"
            className="w-full h-full object-cover cursor-zoom-in transition-all hover:scale-[1.03] duration-300"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : (
          <div className="text-stone-400 font-mono text-[10px] p-4 text-center">Нет фото</div>
        )}
      </div>
    );
  }

  return (
    <div className="md:col-span-1 relative bg-stone-100 flex items-center justify-center min-h-[250px] md:min-h-auto overflow-hidden group/gallery select-none">
      {/* Чекбокс выбора */}
      <button
        id={`toggle-select-${productId}`}
        onClick={onToggleSelect}
        className="absolute top-3 left-3 bg-white/95 text-stone-850 rounded-lg p-2.5 shadow-sm hover:bg-stone-50 transition-colors z-10 border border-stone-200 cursor-pointer"
      >
        {selected ? (
          <CheckSquare className="w-5 h-5 text-stone-905" />
        ) : (
          <Square className="w-5 h-5 text-stone-404 text-stone-400" />
        )}
      </button>

      {/* Кнопка добавления в избранное */}
      <button
        id={`toggle-star-${productId}`}
        onClick={onToggleStar}
        className="absolute top-3 right-3 bg-white/95 text-yellow-500 rounded-lg p-2.5 shadow-sm hover:bg-stone-50 transition-colors z-10 border border-stone-200 cursor-pointer"
      >
        <Star className={`w-5 h-5 ${starred ? "fill-yellow-500 text-yellow-500" : "text-stone-404 text-stone-400"}`} />
      </button>

      {/* Плашка правок */}
      {isModified && (
        <span className="absolute bottom-3 left-3 bg-amber-500 text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-10 uppercase tracking-wide">
          Правка
        </span>
      )}

      {/* Точки переключения карусели в списочном режиме */}
      {resolvedImages.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/35 px-2.5 py-1 rounded-full backdrop-blur-[2px] opacity-80 group-hover/gallery:opacity-100 transition-opacity z-10">
          {resolvedImages.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setActiveImageIdx(idx);
              }}
              className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer border-0 ${
                activeImageIdx === idx ? "bg-white scale-125" : "bg-white/50 hover:bg-white"
              }`}
              aria-label={`Фото №${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Счетчик фотографий */}
      {resolvedImages.length > 1 && (
        <span className="absolute bottom-3 right-3 bg-stone-900/60 text-stone-100 text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-[2px] pointer-events-none z-10">
          <ImageIcon className="w-3.5 h-3.5" />
          {resolvedImages.length}
        </span>
      )}

      {/* Изображение */}
      {resolvedImages.length > 0 ? (
        <img
          onClick={() => onOpenLightbox(resolvedImages, activeImageIdx)}
          src={resolvedImages[activeImageIdx] || mainImage}
          alt="Фото товара"
          className="w-full h-full object-cover cursor-zoom-in transition-all hover:scale-[1.02] duration-300 max-h-[300px] md:max-h-full"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      ) : (
        <div className="text-stone-400 font-mono text-[11px] p-6 text-center">Нет фото</div>
      )}
    </div>
  );
};
