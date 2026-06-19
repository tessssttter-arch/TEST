/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Панель аналитики и визуализации данных постов. Строит распределение цен и динамику постов с помощью Recharts.
// Все комментарии написаны на русском языке.

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Heart, Eye, ShoppingCart, Image, FileText, ChevronRight } from 'lucide-react';
import { usePostsStore } from '../../hooks/use-posts-store';

export const StatsPanel: React.FC = () => {
  const { posts, stats } = usePostsStore();

  // Если постов нет, возвращаем пустую заглушку
  if (posts.length === 0) return null;

  // 1. Форматирование чисел для красивого вывода (например, 15400 -> 15.4K)
  const formatMetric = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return String(num);
  };

  // 2. Расчет аналитики по ценовым диапазонам для гистограммы
  const priceBandsData = useMemo(() => {
    const bands = {
      'До 500₽': 0,
      '500₽–1.5K₽': 0,
      '1.5K₽–3K₽': 0,
      '3K₽–5K₽': 0,
      'От 5К₽': 0,
    };

    posts.forEach((post) => {
      const price = post.price_edited;
      if (price === null) return;

      if (price < 500) {
        bands['До 500₽']++;
      } else if (price >= 500 && price < 1500) {
        bands['500₽–1.5K₽']++;
      } else if (price >= 1500 && price < 3000) {
        bands['1.5K₽–3K₽']++;
      } else if (price >= 3000 && price < 5000) {
        bands['3K₽–5K₽']++;
      } else {
        bands['От 5К₽']++;
      }
    });

    return Object.entries(bands).map(([name, count]) => ({
      name,
      'Количество товаров': count,
    }));
  }, [posts]);

  // 3. Аналитика типов постов (с изображениями vs только текст)
  const mediaDistributionData = useMemo(() => {
    return [
      { name: 'Товары с фото', value: stats.posts_with_images, color: '#6366f1' },
      { name: 'Только текст', value: stats.posts_text_only, color: '#94a3b8' },
    ];
  }, [stats]);

  // 4. Поиск среднего чека
  const averagePrice = useMemo(() => {
    let sum = 0;
    let count = 0;
    posts.forEach((post) => {
      if (post.price_edited !== null) {
        sum += post.price_edited;
        count++;
      }
    });
    return count > 0 ? Math.round(sum / count) : 0;
  }, [posts]);

  return (
    <div id="stats-dashboard-container" className="space-y-6 text-left">
      <div className="flex items-center gap-1 text-slate-800 dark:text-slate-205 text-left">
        <h3 className="font-bold text-lg text-left">Сводная статистика выборки</h3>
        <ChevronRight size={16} className="text-slate-400" />
        <span className="text-xs text-slate-500 font-medium">{posts.length} постов загружено</span>
      </div>

      {/* Grid: Карточки с ключевыми метриками */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Карточка 1: Всего постов */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 text-left">
          <div className="p-3 bg-indigo-55 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400 rounded-xl">
            <ShoppingCart size={20} />
          </div>
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Всего постов</p>
            <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{posts.length}</p>
          </div>
        </div>

        {/* Карточка 2: Товары с ценой */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 text-left">
          <div className="p-3 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400 rounded-xl font-black text-center w-11 h-11 flex items-center justify-center">
            <span>₽</span>
          </div>
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Найдено цен</p>
            <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
              {stats.posts_with_price}{' '}
              <span className="text-xs font-normal text-slate-400">
                ({posts.length > 0 ? Math.round((stats.posts_with_price / posts.length) * 100) : 0}%)
              </span>
            </p>
          </div>
        </div>

        {/* Карточка 3: Средняя цена */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 text-left">
          <div className="p-3 bg-amber-50 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400 rounded-xl">
            <ShoppingCart size={20} />
          </div>
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Средний чек</p>
            <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{formatMetric(averagePrice)} ₽</p>
          </div>
        </div>

        {/* Карточка 4: Всего лайков */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 text-left">
          <div className="p-3 bg-rose-50 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400 rounded-xl">
            <Heart size={18} />
          </div>
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Всего лайков</p>
            <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{formatMetric(stats.total_likes)}</p>
          </div>
        </div>

        {/* Карточка 5: Всего просмотров */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-3 text-left">
          <div className="p-3 bg-cyan-50 text-cyan-600 dark:bg-cyan-950/80 dark:text-cyan-400 rounded-xl">
            <Eye size={18} />
          </div>
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Просмотры</p>
            <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{formatMetric(stats.total_views)}</p>
          </div>
        </div>
      </div>

      {/* Grid: Диаграммы и визуализации Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
        {/* Левая колонка: Гистограмма цен */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-left">
          <h4 className="font-bold text-sm text-slate-700 dark:text-slate-350 mb-4 uppercase tracking-wider text-left">Распределение товаров по диапазонам цен</h4>
          <div className="h-64 w-full text-left">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priceBandsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Bar dataKey="Количество товаров" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Правая колонка: Круговая диаграмма типов постов + Список типов контента */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between text-left">
          <div className="text-left">
            <h4 className="font-bold text-sm text-slate-700 dark:text-slate-350 mb-4 px-2 uppercase tracking-wider text-left">Структура постов по типу контента</h4>
            <div className="h-44 w-full relative flex items-center justify-center text-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mediaDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {mediaDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center">
                <span className="text-xl font-extrabold text-slate-800 dark:text-white">{posts.length}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Постов</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4 px-2 text-left">
            <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/10">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0"></span>
                <Image size={13} className="text-indigo-500 shrink-0" />
                С картинками
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-205">{stats.posts_with_images}</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-850">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0"></span>
                <FileText size={13} className="text-slate-450 shrink-0" />
                Только текст
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-205">{stats.posts_text_only}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
