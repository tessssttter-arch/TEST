/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Компонент расширенной настройки ценообразования. Позволяет задавать параметры наценки, округления и валютных курсов.
// Все комментарии написаны на русском языке.

import React from 'react';
import { Settings, Percent, DollarSign, Wallet, HelpCircle } from 'lucide-react';
import { usePostsStore } from '../../hooks/use-posts-store';

export const PriceSettings: React.FC = () => {
  const { priceConfig, updatePriceConfig, posts } = usePostsStore();

  const handleMarkupTypeChange = (type: 'percent' | 'fixed') => {
    updatePriceConfig({ markupType: type });
  };

  const handleMarkupValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    updatePriceConfig({ markupValue: value });
  };

  const handleRoundingTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updatePriceConfig({ roundingType: e.target.value as any });
  };

  const handleRoundingValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 1;
    updatePriceConfig({ roundingValue: value >= 1 ? value : 1 });
  };

  const handleRateChange = (currency: 'USD' | 'EUR' | 'KZT' | 'UE', value: number) => {
    updatePriceConfig({
      exchangeRates: {
        ...priceConfig.exchangeRates,
        [currency]: value >= 0 ? value : 0,
      },
    });
  };

  // Показываем, сколько постов содержат распознанную оригинальную цену
  const pricedPostsCount = posts.filter(p => p.price_original !== null).length;

  return (
    <div id="price-settings-card" className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400 rounded-lg">
            <Settings size={18} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white text-base">Калькулятор цен и наценки</h3>
            <p className="text-xs text-slate-500">Автоматический расчёт конечной цены товара в рублях</p>
          </div>
        </div>
        {posts.length > 0 && (
          <span className="text-[11px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-1 rounded-md">
            Цены распознаны в {pricedPostsCount} из {posts.length} постов
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Блок 1: Наценка */}
        <div id="markup-config-block" className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Наценка на товары</label>
            <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => handleMarkupTypeChange('percent')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  priceConfig.markupType === 'percent'
                    ? 'bg-white text-slate-800 dark:bg-slate-700 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Percent size={13} />
                Процент (%)
              </button>
              <button
                type="button"
                onClick={() => handleMarkupTypeChange('fixed')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  priceConfig.markupType === 'fixed'
                    ? 'bg-white text-slate-800 dark:bg-slate-700 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <span>₽</span>
                Фиксир. (руб)
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="markup-value-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Размер наценки
            </label>
            <div className="relative rounded-lg shadow-2xs">
              <input
                id="markup-value-input"
                type="number"
                value={priceConfig.markupValue}
                onChange={handleMarkupValueChange}
                placeholder="0"
                min="0"
                className="w-full pl-3 pr-10 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all outline-hidden"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs">
                {priceConfig.markupType === 'percent' ? '%' : '₽'}
              </div>
            </div>
          </div>
        </div>

        {/* Блок 2: Округление */}
        <div id="rounding-config-block" className="space-y-4">
          <div>
            <label htmlFor="rounding-type-select" className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Округление цен</label>
            <select
              id="rounding-type-select"
              value={priceConfig.roundingType}
              onChange={handleRoundingTypeChange}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 cursor-pointer outline-hidden"
            >
              <option value="none">Без округления (центы/рубли как есть)</option>
              <option value="round">Математическое (к ближайшему)</option>
              <option value="floor">В меньшую сторону (Floor)</option>
              <option value="ceil">В большую сторону (Ceil)</option>
              <option value="to_9">Красивые цены (-1 рубль, пример: 999)</option>
            </select>
          </div>

          <div>
            <label htmlFor="rounding-value-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              Кратность округления
              <span className="tooltip group relative cursor-pointer text-slate-400 hover:text-slate-600">
                <HelpCircle size={12} />
                <span className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-[10px] font-normal rounded-lg shadow-md z-10 text-center leading-normal">
                  Округление до сотен (100), десятков (10), половины сотен (50).
                </span>
              </span>
            </label>
            <input
              id="rounding-value-input"
              type="number"
              value={priceConfig.roundingValue}
              onChange={handleRoundingValueChange}
              disabled={priceConfig.roundingType === 'none'}
              min="1"
              placeholder="10"
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 disabled:opacity-50 disabled:bg-slate-50 transition-all outline-hidden"
            />
          </div>
        </div>

        {/* Блок 3: Валютные курсы */}
        <div id="currency-rates-block" className="space-y-3">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Курсы конвертации валют в ₽</label>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <label htmlFor="rate-usd-input" className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                <DollarSign size={10} /> USD ($)
              </label>
              <input
                id="rate-usd-input"
                type="number"
                step="0.1"
                value={priceConfig.exchangeRates.USD}
                onChange={(e) => handleRateChange('USD', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 outline-hidden"
              />
            </div>
            <div>
              <label htmlFor="rate-eur-input" className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                <span>€</span> EUR (€)
              </label>
              <input
                id="rate-eur-input"
                type="number"
                step="0.1"
                value={priceConfig.exchangeRates.EUR}
                onChange={(e) => handleRateChange('EUR', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 outline-hidden"
              />
            </div>
            <div>
              <label htmlFor="rate-kzt-input" className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                <span>₸</span> KZT (тенге)
              </label>
              <input
                id="rate-kzt-input"
                type="number"
                step="0.01"
                value={priceConfig.exchangeRates.KZT}
                onChange={(e) => handleRateChange('KZT', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 outline-hidden"
              />
            </div>
            <div>
              <label htmlFor="rate-ue-input" className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Wallet size={10} /> У.Е. (уе)
              </label>
              <input
                id="rate-ue-input"
                type="number"
                step="0.1"
                value={priceConfig.exchangeRates.UE}
                onChange={(e) => handleRateChange('UE', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
