/**
 * Инлайновый редактор цен товара (ProductPriceEditor) с анализом дельт и трендов.
 * Предоставляет кнопки шаговой корректировки цен (+/- 50/100 ₽) и расчет разницы в процентах.
 */

import React, { useState, useEffect } from 'react';
import { Check, X, TrendingDown, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProductPriceEditorProps {
  price: number;
  originalPrice: number;
  onSavePrice: (newPrice: number) => void;
  viewMode?: 'grid' | 'list';
}

export const ProductPriceEditor: React.FC<ProductPriceEditorProps> = ({
  price,
  originalPrice,
  onSavePrice,
  viewMode = 'list',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrice, setEditedPrice] = useState(price);

  useEffect(() => {
    setEditedPrice(price);
  }, [price]);

  const adjustPrice = (amount: number) => {
    setEditedPrice((prev) => Math.max(0, prev + amount));
  };

  const handleSave = () => {
    setIsEditing(false);
    onSavePrice(editedPrice);
  };

  const handleCancel = () => {
    setEditedPrice(price);
    setIsEditing(false);
  };

  const differencePercentage = originalPrice !== 0
    ? Math.round(((price - originalPrice) / originalPrice) * 100)
    : 0;

  const showTrend = price !== originalPrice;

  if (viewMode === 'grid') {
    return (
      <div className="flex items-center justify-between pt-1 text-left">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span
            onClick={() => setIsEditing(true)}
            className="text-sm font-bold font-mono text-stone-900 cursor-pointer border-b border-dashed border-stone-300 hover:text-stone-700"
          >
            {price.toLocaleString()} ₽
          </span>
          {showTrend && (
            <span className="text-[11px] font-mono text-stone-400 line-through">
              {originalPrice.toLocaleString()} ₽
            </span>
          )}
        </div>

        {showTrend && (
          <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded font-mono ${
            differencePercentage < 0 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-800"
          }`}>
            {differencePercentage < 0 ? "-" : "+"}{Math.abs(differencePercentage)}%
          </span>
        )}

        <AnimatePresence>
          {isEditing && (
            <div className="fixed inset-0 z-[7000] bg-stone-900/30 backdrop-blur-[1px] flex items-center justify-center p-4" onClick={handleCancel}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xl w-full max-w-xs text-left" 
                onClick={e => e.stopPropagation()}
              >
                <span className="block text-[10px] font-mono text-stone-400 uppercase tracking-wider mb-2">Коррекция цены</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    className="w-full text-sm font-mono p-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800"
                    value={editedPrice}
                    onChange={(e) => setEditedPrice(Number(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave();
                      if (e.key === "Escape") handleCancel();
                    }}
                    autoFocus
                  />
                  <button onClick={handleSave} className="p-1.5 bg-stone-900 border border-stone-900 text-white hover:bg-stone-850 rounded cursor-pointer transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={handleCancel} className="p-1.5 bg-stone-100 text-stone-600 hover:bg-stone-200 rounded cursor-pointer border border-stone-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[10px] font-mono mt-3">
                  <button type="button" onClick={() => adjustPrice(-100)} className="bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 py-1 rounded cursor-pointer">-100</button>
                  <button type="button" onClick={() => adjustPrice(-50)} className="bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 py-1 rounded cursor-pointer">-50</button>
                  <button type="button" onClick={() => adjustPrice(50)} className="bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 py-1 rounded cursor-pointer">+50</button>
                  <button type="button" onClick={() => adjustPrice(100)} className="bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 py-1 rounded cursor-pointer">+100</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-left">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block">Стоимость решения</span>
          {showTrend && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full ${
              differencePercentage < 0 
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                : "bg-amber-50 text-amber-600 border border-amber-100"
            }`}>
              {differencePercentage < 0 ? (
                <>
                  <TrendingDown className="w-3 h-3 text-emerald-500" />
                  скидка {Math.abs(differencePercentage)}%
                </>
              ) : (
                <>
                  <TrendingUp className="w-3 h-3 text-amber-500" />
                  наценка +{differencePercentage}%
                </>
              )}
            </span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                className="w-full text-sm font-mono p-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800"
                value={editedPrice}
                onChange={(e) => setEditedPrice(Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
                autoFocus
              />
              <button onClick={handleSave} className="p-1.5 bg-stone-900 border border-stone-900 text-white hover:bg-stone-850 rounded cursor-pointer transition-colors">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={handleCancel} className="p-1.5 bg-stone-100 text-stone-600 hover:bg-stone-200 rounded cursor-pointer border border-stone-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Быстрые регуляторы цены */}
            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => adjustPrice(-100)}
                className="bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 py-1 rounded cursor-pointer transition-colors"
              >
                -100
              </button>
              <button
                type="button"
                onClick={() => adjustPrice(-50)}
                className="bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 py-1 rounded cursor-pointer transition-colors"
              >
                -50
              </button>
              <button
                type="button"
                onClick={() => adjustPrice(50)}
                className="bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 py-1 rounded cursor-pointer transition-colors"
              >
                +50
              </button>
              <button
                type="button"
                onClick={() => adjustPrice(100)}
                className="bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 py-1 rounded cursor-pointer transition-colors"
              >
                +100
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span 
              onClick={() => setIsEditing(true)}
              className="text-xl font-bold font-mono text-stone-900 cursor-pointer border-b border-dashed border-stone-400 hover:text-stone-700"
            >
              {price.toLocaleString()} ₽
            </span>
            {showTrend && (
              <span className="text-xs font-mono text-stone-400 line-through">
                {originalPrice.toLocaleString()} ₽
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
