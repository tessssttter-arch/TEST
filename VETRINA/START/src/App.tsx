import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  Sparkles, 
  Trash2, 
  Check, 
  ArrowLeft, 
  Send, 
  User, 
  Phone, 
  MapPin, 
  ShoppingCart, 
  X, 
  Plus, 
  Minus, 
  Search, 
  ChevronRight, 
  ArrowRight, 
  CheckCircle2, 
  SlidersHorizontal,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import catalogData from '../storefront/public/data/catalog.json';
import { ProductItem, CartItem, UserProfile } from './types';

/**
 * Высокопроизводительный вспомогательный компонент для плавной ленивой загрузки изображений.
 * Показывает изящный анимированный скелетон-заполнитель, пока оригинальная картинка скачивается,
 * а затем мягко проявляет её (fade-in), избавляя пользователя от эффекта скачкообразного рендеринга.
 */
function ImageWithSkeleton({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="relative w-full h-full bg-stone-200 overflow-hidden">
      {/* Скелетон-заполнитель в духе минималистичного дизайна */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-200">
          <div className="w-full h-full animate-pulse bg-gradient-to-r from-stone-200 via-stone-150 to-stone-200" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoaded(true)}
        className={`${className} w-full h-full object-cover transition-opacity duration-300 ease-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}

export default function App() {
  // === КЛАСТЕРИЗАЦИЯ И ИНИЦИАЛИЗАЦИЯ ДАННЫХ ===
  // Загружаем товары из статического JSON-каталога.
  const loadedProducts = useMemo<ProductItem[]>(() => {
    if (catalogData && Array.isArray(catalogData.products)) {
      return catalogData.products as ProductItem[];
    }
    return [];
  }, []);

  // === ХРАНЕНИЕ СОСТОЯНИЯ (PERSISTENCE) ===
  // Локальная корзина с автоматическим восстановлением из кэша localStorage
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('vintage_store_cart');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Не удалось восстановить корзину из кэша:", e);
      }
    }
    return [];
  });

  // Профиль покупателя (автозаполнение реквизитов доставки для экономии времени повторных покупок)
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('vintage_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Не удалось восстановить профиль из кэша:", e);
      }
    }
    return {
      name: '',
      telegram: '',
      phone: '',
      address: ''
    };
  });

  // Никнейм управляющего менеджера для переадресации заказов в Telegram
  const [managerTelegram, setManagerTelegram] = useState(() => {
    return localStorage.getItem('vintage_manager_telegram') || 'mery_jane_vintage';
  });

  // === UI & НАВИГАЦИОННЫЕ ФУНКЦИИ ===
  const [sfCategory, setSfCategory] = useState<string>('Все');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [notification, setNotification] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'details' | 'success'>('cart');
  const [sortBy, setSortBy] = useState<'default' | 'asc' | 'desc'>('default');

  // Активная превью-картинка в детальном модальном окне товара
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  // === СИНХРОНИЗАЦИЯ С LOCALSTORAGE ===
  // Автоматическая фоновая перезапись кэша при любых изменениях состояния корзины и профиля.
  useEffect(() => {
    localStorage.setItem('vintage_store_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('vintage_user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('vintage_manager_telegram', managerTelegram);
  }, [managerTelegram]);

  // === УВЕДОМЛЕНИЯ ПОЛЬЗОВАТЕЛЯ ===
  const triggerNotification = (msg: string) => {
    setNotification(msg);
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // === ВЫЧИСЛЯЕМЫЕ И ОПТИМИЗИРОВАННЫЕ ЗНАЧЕНИЯ ===
  // Сбор всех уникальных категорий товаров из каталога
  const categories = useMemo(() => {
    const groups = loadedProducts.map(p => p.group_products);
    return ['Все', ...new Set(groups)].filter(Boolean);
  }, [loadedProducts]);

  // Расчёт общего количества позиций в корзине
  const totalCartItems = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Расчёт итоговой стоимости товаров в корзине
  const totalCartCost = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  }, [cart]);

  // Самая критически важная оптимизированная фильтрация и сортировка.
  // Все фильтры вычисляются реактивно в useMemo, предотвращая повторный рендеринг при вводе текста.
  const filteredProducts = useMemo(() => {
    let result = [...loadedProducts];

    // Фильтрация по категориям
    if (sfCategory !== 'Все') {
      result = result.filter(p => p.group_products === sfCategory);
    }

    // Полнотекстовый поиск по ID товара, его группе или описанию
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.product_id.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query) || 
        p.group_products.toLowerCase().includes(query)
      );
    }

    // Высокопроизводительная сортировка без мутации оригинального массива
    if (sortBy === 'asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'desc') {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [loadedProducts, sfCategory, searchQuery, sortBy]);

  // === БИЗНЕС-ЛОГИКА: РАБОТА С КОРЗИНОЙ ===
  const handleAddToCart = (product: ProductItem, size?: string) => {
    const finalSize = size || (product.sizes && product.sizes.length > 0 ? product.sizes[0] : undefined);
    
    // Ищем, есть ли уже этот товар с таким же размером в нашей корзине
    const existingIndex = cart.findIndex(
      item => item.product.product_id === product.product_id && item.selectedSize === finalSize
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product, quantity: 1, selectedSize: finalSize }]);
    }
    
    triggerNotification(`«${product.description.slice(0, 20)}...» добавлено в корзину`);
  };

  const updateCartQuantity = (index: number, delta: number) => {
    const updated = [...cart];
    updated[index].quantity += delta;
    
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
      triggerNotification('Товар удален из корзины');
    }
    setCart(updated);
  };

  const removeFromCart = (index: number) => {
    const updated = [...cart];
    const removedItem = updated[index];
    updated.splice(index, 1);
    setCart(updated);
    triggerNotification(`«${removedItem.product.description.slice(0, 15)}...» удалено`);
  };

  // === БИЗНЕС-ЛОГИКА: ФОРМИРОВАНИЕ ЧЕКА ДЛЯ TELEGRAM ===
  const generateTelegramCheckoutUrl = () => {
    if (!userProfile.name || !userProfile.telegram) {
      triggerNotification('Пожалуйста, укажите имя и контакты в корзине!');
      return '#';
    }

    const titleStr = `📦 *ЗАКАЗ В VINTAGE.ARCHIVE* 📦\n`;
    const contactStr = `👤 *Покупатель:* ${userProfile.name}\n✈️ *Telegram:* @${userProfile.telegram.replace('@', '')}\n📞 *Телефон:* ${userProfile.phone || 'Не указан'}\n📍 *Адрес доставки:* ${userProfile.address || 'Самовывоз / Точка выдачи'}\n\n`;
    
    let itemsStr = `🛒 *Выбранные товары:*\n`;
    cart.forEach((item, idx) => {
      itemsStr += `${idx + 1}. *[ID ${item.product.product_id}]* — ${item.quantity} шт.\n   _Цена:_ ${item.product.price} ₽ ${item.selectedSize ? `(Размер: ${item.selectedSize})` : ''}\n\n`;
    });

    const totalStr = `💰 *Итого к оплате:* ${totalCartCost.toLocaleString()} ₽\n\n_Менеджер свяжется с вами для подтверждения доставки._`;
    const fullMessage = encodeURIComponent(titleStr + contactStr + itemsStr + totalStr);
    
    return `https://t.me/${managerTelegram.replace('@', '')}?text=${fullMessage}`;
  };

  const handleCheckoutComplete = () => {
    localStorage.setItem('vintage_user_profile', JSON.stringify(userProfile));
    setCheckoutStep('success');
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-950 font-sans selection:bg-stone-900 selection:text-white relative">
      
      {/* Сплывающие всплывающие уведомления */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-6 right-6 z-50 bg-stone-900 text-stone-100 px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-stone-800"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse-subtle" />
            <span className="text-xs font-mono font-medium">{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Верхнее навигационное меню (Sticky Header) */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-40 shadow-xs backdrop-blur-md bg-white/95">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-stone-900 flex items-center justify-center text-white font-mono font-black text-lg select-none">
              V
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black tracking-tight text-lg uppercase">
                  VINTAGE<span className="text-emerald-600">.STORE</span>
                </span>
                <span className="bg-stone-105 text-stone-600 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                  Магазин
                </span>
              </div>
              {userProfile.name ? (
                <p className="text-[10px] font-mono text-emerald-600 font-bold">
                  Рады видеть, {userProfile.name}
                </p>
              ) : (
                <p className="text-[10px] font-mono text-stone-400 tracking-wider uppercase">
                  Кураторская селекция одежды
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Кнопка настроек / Личного кабинета */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all border outline-none active:scale-95 duration-150 ${
                userProfile.name && userProfile.telegram
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' 
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              <User className="w-4 h-4" />
              <span className="hidden md:inline">
                {userProfile.name ? `@${userProfile.telegram || 'профиль'}` : 'Войти / Профиль'}
              </span>
            </button>

            {/* Кнопка корзины с динамическим счетчиком товаров */}
            <button
              onClick={() => {
                setIsCartOpen(true);
                setCheckoutStep('cart');
              }}
              className="relative flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-850 active:scale-95 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
              <span>Корзина</span>
              <span className="bg-emerald-600 text-white text-[10px] h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center font-bold">
                {totalCartItems}
              </span>
            </button>
          </div>

        </div>
      </nav>

      {/* Шапка главной страницы (Hero Section) */}
      <header className="bg-white border-b border-stone-200 py-12 px-4 mb-8">
        <div className="max-w-[1400px] mx-auto text-center space-y-4">
          <span className="text-[10px] font-mono font-extrabold uppercase bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full tracking-widest">
            ✨ КАТАЛОГ ОБНОВЛЕН
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-stone-900 max-w-3xl mx-auto uppercase">
            Винтажная архивный гардероб
          </h1>
          <p className="text-stone-500 text-xs md:text-sm max-w-xl mx-auto leading-relaxed">
            Каждая вещь подобрана вручную в единственном экземпляре. Мгновенная сборка заказа и прямая переадресация менеджеру в Telegram для подтверждения бронирования.
          </p>

          {/* Высокоскоростные индикаторы технологичности */}
          <div className="flex flex-wrap items-center justify-center gap-5 pt-3 text-stone-500 font-mono text-[11px]">
            <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-150">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Доступно: <strong>{loadedProducts.length} позиций</strong></span>
            </div>
            
            <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-150">
              <span>Доставка: <strong>СДЭК / Почта РФ</strong></span>
            </div>

            <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-150">
              <span>Платформа: <strong>Astro + React UI Engine</strong></span>
            </div>
          </div>
        </div>
      </header>

      {/* Секция контента, фильтрации и каталога */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 pb-20">
        
        {/* Интерактивная панель управления фильтрами и поиском */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-8 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* Категории товаров (Horizontal Scrollable) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            <span className="text-[10px] font-mono text-stone-400 uppercase font-extrabold flex items-center gap-1 flex-shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Фильтр:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSfCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 duration-150 ${
                  sfCategory === cat
                    ? 'bg-stone-900 text-white hover:bg-stone-850'
                    : 'bg-stone-50 text-stone-600 border border-stone-250/70 hover:border-stone-400 hover:bg-stone-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Интегрированная поисковая строка и селектор сортировок */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            
            {/* Контейнер поиска */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Поиск по ID или описаниям..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-8 py-2 border border-stone-200 bg-stone-50 rounded-xl text-xs placeholder:text-stone-400 focus:outline-none focus:border-stone-400 focus:bg-white transition-all font-medium text-stone-900"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 bg-stone-200 hover:bg-stone-300 rounded-full flex items-center justify-center text-stone-600 hover:text-stone-950 transition-colors text-[10px]"
                >
                  ×
                </button>
              )}
            </div>

            {/* Выпадающий список высокопроизводительной сортировки */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-stone-700 outline-none hover:border-stone-400 hover:bg-stone-50 cursor-pointer"
            >
              <option value="default">По умолчанию</option>
              <option value="asc">Цена: Сначала дешевле</option>
              <option value="desc">Цена: Сначала дороже</option>
            </select>

          </div>

        </div>

        {/* Заголовок со сводкой подходящих товаров */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg md:text-xl font-bold font-mono uppercase tracking-tight text-stone-900 flex items-center gap-2 select-none">
            <span>⚡ НАЙДЕНО В КАТАЛОГЕ</span>
            <span className="bg-stone-200 text-stone-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold font-mono">
              {filteredProducts.length} позиций
            </span>
          </h2>

          {(sfCategory !== 'Все' || searchQuery) && (
            <button
              onClick={() => {
                setSfCategory('Все');
                setSearchQuery('');
              }}
              className="text-xs text-stone-500 hover:text-stone-900 font-mono underline hover:no-underline cursor-pointer"
            >
              Сбросить фильтры
            </button>
          )}
        </div>

        {/* Модульная сетка каталога товаров */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white border border-stone-200 rounded-2xl p-8 max-w-lg mx-auto shadow-xs">
            <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="font-mono font-bold text-sm text-stone-800 uppercase tracking-wider">Ничего не найдено</p>
            <p className="text-xs text-stone-400 mt-1 leading-relaxed">
              Попробуйте изменить поисковый запрос или переключить категорию фильтра на «Все».
            </p>
            <button
              onClick={() => {
                setSfCategory('Все');
                setSearchQuery('');
              }}
              className="mt-5 px-4 py-2.5 bg-stone-900 text-white rounded-xl text-xs font-mono font-bold hover:bg-stone-850 transition duration-150 active:scale-95"
            >
              Вернуться ко всему каталогу
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((p) => (
                <motion.div
                  layout="position"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.23, ease: [0.16, 1, 0.3, 1] }}
                  key={p.product_id}
                  onClick={() => {
                    setSelectedProduct(p);
                    setSelectedSize(p.sizes && p.sizes.length > 0 ? p.sizes[0] : '');
                    setSelectedPreviewImage(p.main_image);
                  }}
                  className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-xl hover:border-stone-400 transition-all duration-300 flex flex-col justify-between cursor-pointer"
                >
                  <div className="relative">
                    {/* Контейнер изображения с оптимизированной плавной загрузкой */}
                    <div className="aspect-square bg-stone-100 overflow-hidden relative">
                      <ImageWithSkeleton 
                        src={p.main_image || (p.images && p.images[0])} 
                        alt={p.description}
                        className="group-hover:scale-103 transition-transform duration-500"
                      />
                      
                      {/* Обозначение группы товара на плавающем ярлыке */}
                      <span className="absolute top-3 left-3 bg-stone-900/80 backdrop-blur-md px-2.5 py-1 text-white text-[9px] font-mono font-bold tracking-wider rounded-md uppercase">
                        {p.group_products}
                      </span>

                      {/* Индикаторы размеров товара внутри карточки */}
                      {p.sizes && p.sizes.length > 0 && (
                        <div className="absolute bottom-3 left-3 flex gap-1 flex-wrap">
                          {p.sizes.slice(0, 3).map((sz, idx) => (
                            <span key={idx} className="bg-white/90 backdrop-blur-xs px-1.5 py-0.5 rounded border border-stone-200 text-[9px] font-mono font-bold text-stone-850">
                              {sz.length > 12 ? sz.slice(0, 5) + '..' : sz}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Описание и цена */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center justify-between font-mono text-[10px] text-stone-400">
                        <span>ID: {p.product_id}</span>
                        <span className="text-emerald-600 font-bold">Уникат / 1 шт</span>
                      </div>

                      <p className="text-xs font-bold text-stone-900 leading-snug line-clamp-2">
                        {p.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-stone-100 mt-2">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-mono text-stone-450 uppercase font-bold">ЦЕНА</span>
                        <span className="text-sm font-extrabold font-mono text-stone-900">
                          {p.price.toLocaleString()} ₽
                        </span>
                      </div>
                      
                      {/* Кнопка быстрого добавления в корзину */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(p);
                        }}
                        className="p-2.5 bg-stone-100 hover:bg-stone-900 text-stone-900 hover:text-white rounded-xl transition-all duration-150 border border-stone-200 hover:border-transparent flex items-center justify-center cursor-pointer active:scale-90"
                        title="Добавить в корзину"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

      </section>

      {/* Футер приложения */}
      <footer className="bg-stone-900 text-stone-400 border-t border-stone-800 py-12 mt-12 px-4">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          
          <div className="space-y-4">
            <h3 className="font-mono text-white font-black uppercase text-sm tracking-widest">
              VINTAGE<span className="text-emerald-500">.ARCHIVE</span>
            </h3>
            <p className="text-xs leading-relaxed max-w-sm mx-auto md:mx-0">
              Кураторский маркетплейс редкой архивной одежды. Мы выстроили высокоскоростную модель без тяжелых медленных баз данных — на кэше и Astro.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-white text-xs font-bold uppercase tracking-wider">Поддержка</h4>
            <p className="text-xs leading-relaxed max-w-xs mx-auto md:mx-0">
              По всем вопросам бронирования, мерок и логистики пишите напрямую администратору.
            </p>
            <div className="pt-2">
              <a 
                href={`https://t.me/${managerTelegram}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline"
              >
                Telegram поддержка (@{managerTelegram})
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="space-y-3 font-mono text-[10px] text-stone-500 leading-snug">
            <span className="block text-white text-xs font-bold uppercase tracking-wider">Платформа</span>
            <div>
              <p>📍 Генератор: Astro 5.0 Core Template</p>
              <p>📍 Рендерер: React 19 Client UI</p>
              <p>📍 Кэш-слой: LocalStorage Mirror</p>
              <p>📍 Стили: Tailwind CSS v4 Accelerated</p>
            </div>
            <p className="text-[9px] pt-1.5 border-t border-stone-800">
              © {new Date().getFullYear()} Vintage Archive. Прозрачные мгновенные покупки.
            </p>
          </div>

        </div>
      </footer>

      {/* БОКОВАЯ ПАНЕЛЬ (DRAWER): КОРЗИНА И ОФОРМЛЕНИЕ ЗАКАЗА */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            {/* Затемнение фона */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black z-50 pointer-events-auto"
            />

            {/* Выплывающая панель корзины */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:max-w-md bg-white z-50 border-l border-stone-200 shadow-2xl flex flex-col justify-between"
            >
              {/* Шапка корзины */}
              <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4.5 h-4.5 text-emerald-600" />
                  <h3 className="font-mono font-black text-sm uppercase tracking-wider text-stone-900">
                    КОРЗИНА
                  </h3>
                  <span className="bg-stone-900 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                    {totalCartItems} шт
                  </span>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 hover:bg-stone-200 text-stone-400 hover:text-stone-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Индикаторы текущего шага оформления заказа */}
              <div className="border-b border-stone-100 px-5 py-2.5 flex items-center justify-between text-[10px] font-mono text-stone-400 bg-white">
                <span className={`${checkoutStep === 'cart' ? 'text-stone-900 font-bold border-b border-stone-900' : ''}`}>
                  1. Список покупок
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className={`${checkoutStep === 'details' ? 'text-stone-900 font-bold border-b border-stone-900' : ''}`}>
                  2. Доставка
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className={`${checkoutStep === 'success' ? 'text-emerald-600 font-bold border-b border-emerald-500' : ''}`}>
                  3. Резерв
                </span>
              </div>

              {/* Содержимое корзины в зависимости от шага заказа */}
              <div className="flex-1 overflow-y-auto p-5">
                
                {/* ШАГ ЗАКРЫТИЯ ЗАКАЗА (ИНФО РЕЗЕРВА И TELEGRAM) */}
                {checkoutStep === 'success' && (
                  <div className="text-center py-7 space-y-6">
                    <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-mono font-black text-base text-stone-900 uppercase">Данные подготовлены!</h4>
                      <p className="text-xs text-stone-500 leading-relaxed">
                        Контакты сохранены в вашем кэше для быстрого автозаполнения в следующий раз. Чтобы завершить бронь, отправьте сгенерированный чек в личные сообщения менеджеру.
                      </p>
                    </div>

                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-left font-mono space-y-1.5 text-stone-700 text-xs">
                      <p className="text-[10px] uppercase font-bold text-stone-400 pb-1 border-b border-stone-200">Резюме бронирования:</p>
                      <p>👤 Имя: <strong className="text-stone-900">{userProfile.name}</strong></p>
                      <p>✈️ Telegram: <strong className="text-stone-900">@{userProfile.telegram}</strong></p>
                      <p>💰 К оплате: <strong className="text-emerald-700">{totalCartCost.toLocaleString()} ₽</strong></p>
                    </div>

                    <a
                      href={generateTelegramCheckoutUrl()}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        // Очищаем корзину после перенаправления по ссылке для избежания повторных заказов
                        setCart([]);
                        setIsCartOpen(false);
                      }}
                      className="block w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-center rounded-xl font-mono text-xs font-bold transition duration-150 shadow-md flex items-center justify-center gap-2 active:scale-98"
                    >
                      <Send className="w-4 h-4" />
                      Отправить менеджеру в Telegram
                    </a>

                    <button
                      onClick={() => setCheckoutStep('cart')}
                      className="text-stone-500 hover:text-stone-900 text-[11px] font-mono font-bold transition-colors cursor-pointer"
                    >
                      Вернуться назад в корзину
                    </button>
                  </div>
                )}

                {/* ШАГ ОБЩЕГО СПИСКА ПОКУПОК */}
                {checkoutStep === 'cart' && (
                  cart.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                      <ShoppingCart className="w-10 h-10 text-stone-300 mx-auto" />
                      <p className="font-mono text-stone-400 text-xs uppercase font-bold">Корзина пуста</p>
                      <p className="text-[11px] text-stone-450 leading-relaxed">
                        Выберите любую интересующую редкую вещь из каталога и добавьте её в корзину.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cart.map((item, idx) => (
                        <div key={`${item.product.product_id}-${item.selectedSize || 'nosize'}`} className="flex gap-3 border-b border-stone-100 pb-3 items-center">
                          <img 
                            src={item.product.main_image} 
                            alt={item.product.description} 
                            className="w-14 h-14 object-cover rounded-lg border border-stone-200 flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-mono text-stone-400">ID: {item.product.product_id}</span>
                            <h4 className="text-xs font-bold text-stone-900 truncate">
                              {item.product.description}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {item.selectedSize && (
                                <span className="text-[9px] font-mono font-bold bg-stone-100 border border-stone-200 text-stone-700 rounded px-1.5">
                                  {item.selectedSize}
                                </span>
                              )}
                              <span className="text-[10px] font-mono font-bold text-stone-900">
                                {item.product.price.toLocaleString()} ₽
                              </span>
                            </div>
                          </div>

                          {/* Изменение количества товара в позиции и удаление */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex bg-stone-100 rounded-lg p-0.5 items-center">
                              <button 
                                onClick={() => updateCartQuantity(idx, -1)}
                                className="p-1 hover:bg-white rounded text-stone-605 transition cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-1.5 text-xs font-mono font-bold text-stone-800">
                                {item.quantity}
                              </span>
                              <button 
                                onClick={() => updateCartQuantity(idx, 1)}
                                className="p-1 hover:bg-white rounded text-stone-605 transition cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <button 
                              onClick={() => removeFromCart(idx)}
                              className="p-1.5 hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-colors rounded-lg"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* ШАГ ЗАПОЛНЕНИЯ ДЕТАЛЕЙ ДОСТАВКИ */}
                {checkoutStep === 'details' && (
                  <div className="space-y-4">
                    <h4 className="font-mono text-xs font-black uppercase text-stone-500">Реквизиты получателя</h4>
                    <p className="text-[11px] text-stone-400 leading-relaxed">
                      Эти сведения никогда не передаются сторонним серверам и сохраняются исключительно локально на вашем ПК / телефоне.
                    </p>

                    <div className="space-y-3.5">
                      {/* Строка ввода Имени */}
                      <div>
                        <label className="block text-[9px] font-mono uppercase text-stone-400 font-extrabold mb-1">ФИО Получателя *</label>
                        <div className="relative">
                          <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input 
                            type="text" 
                            required
                            placeholder="Например: Иван Ковалев"
                            value={userProfile.name}
                            onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                            className="w-full pl-9 pr-3 py-2.5 border border-stone-200 rounded-xl text-xs placeholder:text-stone-300 focus:outline-none focus:border-stone-400 font-medium text-stone-900"
                          />
                        </div>
                      </div>

                      {/* Твиттер-подобный Телеграм */}
                      <div>
                        <label className="block text-[9px] font-mono uppercase text-stone-400 font-extrabold mb-1">Никнейм Телеграм *</label>
                        <div className="relative">
                          <span className="text-xs font-mono font-bold text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2">@</span>
                          <input 
                            type="text" 
                            required
                            placeholder="username"
                            value={userProfile.telegram.replace('@', '')}
                            onChange={(e) => setUserProfile({...userProfile, telegram: e.target.value})}
                            className="w-full pl-8 pr-3 py-2.5 border border-stone-200 rounded-xl text-xs placeholder:text-stone-300 focus:outline-none focus:border-stone-400 font-mono text-stone-900 font-bold"
                          />
                        </div>
                      </div>

                      {/* Номер телефона */}
                      <div>
                        <label className="block text-[9px] font-mono uppercase text-stone-400 font-extrabold mb-1">Контактный телефон</label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input 
                            type="tel" 
                            placeholder="+7 (999) 888-77-66"
                            value={userProfile.phone || ''}
                            onChange={(e) => setUserProfile({...userProfile, phone: e.target.value})}
                            className="w-full pl-9 pr-3 py-2.5 border border-stone-200 rounded-xl text-xs placeholder:text-stone-300 focus:outline-none focus:border-stone-400 font-mono text-stone-900"
                          />
                        </div>
                      </div>

                      {/* Текстовое поле ввода Адреса */}
                      <div>
                        <label className="block text-[9px] font-mono uppercase text-stone-450 font-extrabold mb-1">Адрес / Пункт выдачи СДЭК</label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                          <textarea 
                            rows={3}
                            placeholder="Адрес СДЭК или домашний адрес для Почты..."
                            value={userProfile.address || ''}
                            onChange={(e) => setUserProfile({...userProfile, address: e.target.value})}
                            className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-xl text-xs placeholder:text-stone-300 focus:outline-none focus:border-stone-400 font-medium text-stone-900"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-stone-50 border border-stone-150 rounded-xl p-3.5 mt-2 flex gap-2.5 items-start">
                      <HelpCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-stone-500 leading-snug font-mono">
                        Бот-клиент конвертирует эту информацию в красивую чек-квитанцию. Доставка будет согласована за секунды.
                      </p>
                    </div>
                  </div>
                )}

              </div>

              {/* Панель итогов и управления оформлением внизу корзины */}
              {checkoutStep !== 'success' && (
                <div className="p-5 border-t border-stone-150 bg-stone-50 space-y-4">
                  {cart.length > 0 && (
                    <div className="space-y-1.5 font-mono text-xs">
                      <div className="flex justify-between text-stone-500">
                        <span>Всего позиций:</span>
                        <span className="font-bold text-stone-900">{totalCartItems}</span>
                      </div>
                      <div className="flex justify-between text-stone-900 font-extrabold text-sm border-t border-dashed border-stone-200 pt-2">
                        <span>Итоговая цена:</span>
                        <span className="text-stone-950 font-mono text-base">{totalCartCost.toLocaleString()} ₽</span>
                      </div>
                    </div>
                  )}

                  {cart.length > 0 && (
                    <div>
                      {checkoutStep === 'cart' ? (
                        <button
                          onClick={() => setCheckoutStep('details')}
                          className="w-full py-4 bg-stone-905 hover:bg-stone-850 text-stone-100 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 duration-100"
                        >
                          Перейти к доставке
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCheckoutStep('cart')}
                            className="py-3.5 px-4 bg-stone-200 hover:bg-stone-300 text-stone-750 font-mono text-xs font-bold rounded-xl transition cursor-pointer active:scale-95 duration-100"
                          >
                            Назад
                          </button>
                          
                          <button
                            onClick={handleCheckoutComplete}
                            disabled={!userProfile.name || !userProfile.telegram}
                            className={`flex-1 py-3.5 text-center rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm duration-150 active:scale-[0.98] ${
                              userProfile.name && userProfile.telegram
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                : 'bg-stone-300 text-stone-550 cursor-not-allowed'
                            }`}
                          >
                            Сформировать предзаказ
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ВСПЛЫВАЮЩЕЕ ОКНО (POPUP): ПОЛНОЕ УПРАВЛЕНИЕ ЛИЧНЫМ КАБИНЕТОМ */}
      <AnimatePresence>
        {isProfileOpen && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-55 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.98, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setIsProfileOpen(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-stone-105 text-stone-400 hover:text-stone-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="font-mono font-black text-sm uppercase tracking-wider text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-3 mb-4 select-none">
                <User className="w-4.5 h-4.5 text-emerald-600" />
                Личный кабинет
              </h3>

              <div className="space-y-4">
                <p className="text-[11px] text-stone-450 leading-relaxed font-mono">
                  Наш магазин работает на кэше без серверов. Один раз заполненные реквизиты полностью сохраняются во встроенном кэше вашего интернет-браузера.
                </p>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[9px] font-mono uppercase text-stone-400 font-extrabold mb-1">Ваше имя *</label>
                    <input 
                      type="text" 
                      placeholder="Имя Фамилия"
                      value={userProfile.name}
                      onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-xs outline-none focus:border-stone-400 font-medium text-stone-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono uppercase text-stone-400 font-extrabold mb-1">Никнейм в Telegram *</label>
                    <div className="relative">
                      <span className="text-xs font-mono font-bold text-stone-400 absolute left-3 top-1/2 -translate-y-1/2">@</span>
                      <input 
                        type="text" 
                        placeholder="john_doe"
                        value={userProfile.telegram.replace('@', '')}
                        onChange={(e) => setUserProfile({...userProfile, telegram: e.target.value})}
                        className="w-full pl-7 pr-3 py-2.5 border border-stone-200 rounded-xl text-xs outline-none focus:border-stone-400 font-mono text-stone-900 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono uppercase text-stone-400 font-extrabold mb-1">Ваш Телефон</label>
                    <input 
                      type="tel" 
                      placeholder="+7..."
                      value={userProfile.phone || ''}
                      onChange={(e) => setUserProfile({...userProfile, phone: e.target.value})}
                      className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-xs outline-none focus:border-stone-400 font-mono text-stone-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono uppercase text-stone-450 font-extrabold mb-1">Адрес доставки</label>
                    <textarea 
                      rows={2}
                      placeholder="Адрес, ПВЗ..."
                      value={userProfile.address || ''}
                      onChange={(e) => setUserProfile({...userProfile, address: e.target.value})}
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-stone-400 font-medium text-stone-900"
                    />
                  </div>

                  {/* Скрытая панель настройки менеджера-получателя */}
                  <div className="pt-3 border-t border-stone-100">
                    <label className="block text-[9px] font-mono uppercase text-emerald-800 font-black mb-1">
                      ⚙️ Адрес менеджера (Telegram)
                    </label>
                    <input 
                      type="text" 
                      placeholder="mery_jane_vintage"
                      value={managerTelegram}
                      onChange={(e) => setManagerTelegram(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 bg-stone-50 rounded-xl text-xs outline-none focus:border-stone-400 font-mono font-bold text-emerald-800"
                    />
                    <span className="text-[9px] text-stone-400 mt-1 block leading-snug font-mono">
                      Никнейм получателя заказов. Ссылка Telegram сгенерирует чат именно с ним.
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    localStorage.setItem('vintage_user_profile', JSON.stringify(userProfile));
                    triggerNotification('Профиль покупателя успешно обновлен!');
                    setIsProfileOpen(false);
                  }}
                  className="w-full py-3 bg-stone-900 hover:bg-stone-850 active:scale-98 duration-100 text-white font-mono font-bold text-xs rounded-xl cursor-pointer transition text-center"
                >
                  Запомнить данные
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* МАКСИМАЛЬНО ДЕТАЛЬНОЕ ОКНО ТОВАРА (MODAL PREVIEW) */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-55 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.98, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl border border-stone-200 max-w-3xl w-full p-6 md:p-8 shadow-2xl relative grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-800 rounded-xl hover:bg-stone-105 transition duration-150 h-10 w-10 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Медиа-галерея выбранного товара */}
              <div className="space-y-4">
                <div className="aspect-square rounded-2xl overflow-hidden bg-stone-50 border border-stone-150 relative">
                  <ImageWithSkeleton 
                    src={selectedPreviewImage || selectedProduct.main_image} 
                    alt={selectedProduct.description}
                  />
                  <span className="absolute bottom-3 right-3 bg-stone-900/80 backdrop-blur-md text-white text-[9px] font-mono px-2 py-0.5 rounded-md">
                    ID: {selectedProduct.product_id}
                  </span>
                </div>

                {/* Каталог дополнительных ракурсов в галерее */}
                {selectedProduct.images && selectedProduct.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
                    {selectedProduct.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedPreviewImage(img)}
                        className={`w-14 h-14 rounded-lg overflow-hidden border bg-stone-50 flex-shrink-0 cursor-pointer active:scale-95 transition-all ${
                          (selectedPreviewImage || selectedProduct.main_image) === img
                            ? 'border-emerald-600 ring-1 ring-emerald-500'
                            : 'border-stone-200 hover:border-stone-400'
                        }`}
                      >
                        <img 
                          src={img} 
                          alt={`thumbnail-${idx}`} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Правая панель информации товара */}
              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div>
                    <span className="bg-stone-100 text-stone-605 text-[9px] font-mono font-bold px-2.5 py-1 rounded-md uppercase">
                      {selectedProduct.group_products}
                    </span>
                    <h3 className="text-lg md:text-xl font-bold text-stone-900 mt-2.5 leading-snug">
                      {selectedProduct.description}
                    </h3>
                  </div>

                  {/* Окончательный блок цены */}
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-[10px] font-mono text-stone-400 uppercase font-bold">Стоимость:</span>
                    <span className="text-2xl font-mono font-black text-stone-900">
                      {selectedProduct.price.toLocaleString()} ₽
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold">
                      В наличии
                    </span>
                  </div>

                  {/* Переключатель размеров товара */}
                  {selectedProduct.sizes && selectedProduct.sizes.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono text-stone-400 uppercase font-bold block">Доступные размеры:</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.sizes.map((size) => (
                          <button
                            key={size}
                            onClick={() => setSelectedSize(size)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border cursor-pointer transition duration-150 active:scale-95 ${
                              selectedSize === size
                                ? 'bg-stone-900 text-white border-transparent'
                                : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-400'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Блок технических подробностей товара */}
                  <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4 text-[11px] text-stone-500 leading-relaxed font-mono space-y-1">
                    <div className="text-stone-400 uppercase text-[9px] font-extrabold pb-1 border-b border-stone-200">Информация о лоте</div>
                    <p>📦 Состояние одежды: Тщательный ручной отбор / Селекция</p>
                    <p>📦 Обмеры: Спросите у менеджера полный чертеж мерок</p>
                    <p>📦 Гарантия: 100% Оригинал</p>
                  </div>
                </div>

                {/* Кнопка действия - положить в корзину */}
                <div className="space-y-3 pt-4 border-t border-stone-100">
                  <button
                    onClick={() => {
                      handleAddToCart(selectedProduct, selectedSize);
                      setSelectedProduct(null);
                    }}
                    className="w-full py-4 bg-stone-900 hover:bg-emerald-600 hover:text-white text-white text-center rounded-xl font-mono text-xs font-bold transition duration-200 ease-out flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.98]"
                  >
                    <ShoppingCart className="w-4 h-4 text-emerald-400" />
                    Добавить в корзину
                  </button>

                  <p className="text-[10px] text-stone-400 text-center font-mono">
                    Вы сможете скорректировать размер или количество лотов в боковом выдвижном меню.
                  </p>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
