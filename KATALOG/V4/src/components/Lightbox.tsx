/**
 * Компонент полноэкранного просмотра изображений (Lightbox/Галерея).
 * Позволяет куратору в деталях рассмотреть фотографии товара с поддержкой карусели.
 */

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from 'motion/react';

interface LightboxProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  images,
  initialIndex,
  onClose,
}) => {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, images, onClose]);

  const handlePrev = () => {
    setIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  if (!images || images.length === 0) return null;

  return (
    <div
      id="lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотрщик изображений товара"
      className="fixed inset-0 z-[9000] bg-black/95 flex flex-col justify-between p-4 select-none"
      onClick={onClose}
    >
      {/* Top action bar */}
      <div className="flex items-center justify-between text-white p-2 w-full max-w-7xl mx-auto shrink-0">
        <div className="flex items-center gap-2 text-stone-300 font-mono text-xs">
          <ImageIcon className="w-4 h-4 text-emerald-400" />
          <span>
            Изображение <strong>{index + 1}</strong> из <strong>{images.length}</strong>
          </span>
        </div>

        <button
          id="close-lightbox-btn"
          onClick={onClose}
          className="text-stone-300 hover:text-white bg-stone-900/40 p-2.5 rounded-full hover:bg-stone-800/80 transition-all cursor-pointer border-0"
          title="Закрыть (Esc)"
        >
          <X className="w-5.5 h-5.5" />
        </button>
      </div>

      {/* Main viewport */}
      <div className="flex-1 flex items-center justify-center relative max-w-5xl mx-auto w-full">
        {images.length > 1 && (
          <button
            id="lightbox-prev-btn"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-2 md:left-4 z-10 text-white bg-stone-900/50 hover:bg-stone-800 p-3 rounded-full transition-all cursor-pointer border-0 hidden sm:flex"
            title="Назад (←)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <div
          className="relative max-h-[75vh] max-w-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              src={images[index]}
              alt={`Фото №${index + 1}`}
              className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl shrink-0"
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
        </div>

        {images.length > 1 && (
          <button
            id="lightbox-next-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-2 md:right-4 z-10 text-white bg-stone-900/50 hover:bg-stone-800 p-3 rounded-full transition-all cursor-pointer border-0 hidden sm:flex"
            title="Вперед (→)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Slide previews index tracker */}
      {images.length > 1 && (
        <div 
          className="flex flex-wrap items-center justify-center gap-1.5 shrink-0 max-w-2xl mx-auto overflow-x-auto pb-4"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setIndex(idx)}
              className={`w-11 h-11 rounded-md overflow-hidden bg-stone-950 border transition-all cursor-pointer ${
                index === idx 
                  ? "border-emerald-400 scale-110 shadow-lg"
                  : "border-transparent opacity-50 hover:opacity-90"
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
export default Lightbox;
