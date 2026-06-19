/**
 * Контекст управления данными каталога (State Management).
 * Централизует состояние товаров, фильтры, режимы просмотра и системные уведомления/диалоги.
 * Полностью исключает Prop-Drilling (Рекомендация №2) и предоставляет премиум Тосты и Подтверждения (Рекомендация №7).
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Product } from '../types';
import { catalogAPI } from '../services/catalog-db';
import { initCatalogService } from '../services/catalog-init';
import { validateAndNormalize } from '../services/product-normalizer';
import { useUrlFilters, parseUrlFilters } from '../hooks/useUrlFilters';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmBtnText?: string;
  cancelBtnText?: string;
  onConfirm: () => Promise<void> | void;
}

export interface CatalogDataContextType {
  products: Product[];
  filteredProducts: Product[];
  paginatedProducts: Product[];
  categories: string[];
  tags: string[];
  isLoading: boolean;
  updateProduct: (updated: Product) => Promise<void>;
  bulkUpdateProducts: (updatedList: Product[]) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  deleteSelected: () => Promise<void>;
  importProducts: (rawJson: any[], mode?: 'merge' | 'replace') => Promise<void>;
  resetAllEdits: () => Promise<void>;
  bulkApplyTags: (targetIds: string[], op: 'add' | 'remove' | 'replace', tags: string[]) => Promise<void>;
  toggleSelectAll: (select: boolean) => void;
  toggleStarAll: (star: boolean) => void;
  bulkApplyPriceAdjustment: (amount: number, type: 'add' | 'percent') => Promise<void>;
}

export interface CatalogUIContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  selectedTag: string;
  setSelectedTag: (tag: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  sortBy: 'price-asc' | 'price-desc' | 'id-desc';
  setSortBy: (sort: 'price-asc' | 'price-desc' | 'id-desc') => void;
  showStarredOnly: boolean;
  setShowStarredOnly: (val: boolean) => void;
  showModifiedOnly: boolean;
  setShowModifiedOnly: (val: boolean) => void;
  showSelectedOnly: boolean;
  setShowSelectedOnly: (val: boolean) => void;
  toasts: Toast[];
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  confirmConfig: ConfirmConfig | null;
  showConfirm: (config: ConfirmConfig) => void;
  closeConfirm: () => void;
}

export type CatalogContextType = CatalogDataContextType & CatalogUIContextType;

export const CatalogDataContext = createContext<CatalogDataContextType | undefined>(undefined);
export const CatalogUIContext = createContext<CatalogUIContextType | undefined>(undefined);

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Инициализация исходных параметров из URL (до рендера)
  const initialParams = useMemo(() => parseUrlFilters(), []);

  // Состояния данных
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Состояния фильтров
  const [searchQuery, setSearchQuery] = useState(initialParams.searchQuery || '');
  const [selectedCategory, setSelectedCategory] = useState(initialParams.selectedCategory || '');
  const [selectedTag, setSelectedTag] = useState(initialParams.selectedTag || '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showStarredOnly, setShowStarredOnly] = useState(initialParams.showStarredOnly || false);
  const [showModifiedOnly, setShowModifiedOnly] = useState(initialParams.showModifiedOnly || false);
  const [showSelectedOnly, setShowSelectedOnly] = useState(initialParams.showSelectedOnly || false);
  
  // Состояния пагинации и сортировки
  const [page, setPage] = useState(initialParams.page || 1);
  const [pageSize, setPageSize] = useState(initialParams.pageSize || 50);
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'id-desc'>(
    (initialParams.sortBy as any) || 'id-desc'
  );
  
  // Состояния Toasts и Confirm
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);

  // Активация URL-синхронизации
  useUrlFilters(
    {
      searchQuery,
      selectedCategory,
      selectedTag,
      sortBy,
      page,
      pageSize,
      showStarredOnly,
      showModifiedOnly,
      showSelectedOnly
    },
    {
      setSearchQuery,
      setSelectedCategory,
      setSelectedTag,
      setSortBy,
      setPage,
      setPageSize,
      setShowStarredOnly,
      setShowModifiedOnly,
      setShowSelectedOnly
    }
  );

  // Сброс страницы при изменении любого фильтра
  const prevFilterStateRef = useRef<string>('');
  useEffect(() => {
    const filterStateKey = [searchQuery, selectedCategory, selectedTag, showStarredOnly, showModifiedOnly, showSelectedOnly].join('|');
    if (prevFilterStateRef.current && prevFilterStateRef.current !== filterStateKey) {
      setPage(1);
    }
    prevFilterStateRef.current = filterStateKey;
  }, [searchQuery, selectedCategory, selectedTag, showStarredOnly, showModifiedOnly, showSelectedOnly]);

  // Добавление и удаление тостов
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Модальные подтверждения
  const showConfirm = useCallback((config: ConfirmConfig) => {
    setConfirmConfig(config);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmConfig(null);
  }, []);

  // Первичная инициализация каталога
  useEffect(() => {
    async function loadData() {
      try {
        const list = await initCatalogService();
        setProducts(list);
      } catch (err: any) {
        console.error('Ошибка инициализации каталога:', err);
        addToast('Критическая ошибка инициализации БД: ' + err.message, 'error');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [addToast]);

  // Оптимизированное вычисление доступных категорий и тегов (исключает перерасчет при кликах на чекбоксы/избранное)
  const categoriesDeps = useMemo(() => {
    return products.map((p) => `${p.product_id}:${p.group_products || ""}`).join("|");
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.group_products) {
        p.group_products.split(',').forEach((c) => {
          const trimmed = c.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set).sort();
  }, [categoriesDeps]);

  const tagsDeps = useMemo(() => {
    return products.map((p) => `${p.product_id}:${(p.tags || []).join(",")}`).join("|");
  }, [products]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      p.tags?.forEach((t) => {
        const trimmed = t.trim();
        if (trimmed) set.add(trimmed);
      });
    });
    return Array.from(set).sort();
  }, [tagsDeps]);

  // Фильтрация товаров по критериям
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Полнотекстовый поиск
      if (searchQuery.trim()) {
        const cleanQuery = searchQuery.toLowerCase();
        const matchesDesc = p.description?.toLowerCase().includes(cleanQuery);
        const matchesOriginal = p.original_text?.toLowerCase().includes(cleanQuery);
        const matchesId = String(p.product_id).toLowerCase().includes(cleanQuery);
        const matchesGroup = p.group_products?.toLowerCase().includes(cleanQuery);
        const matchesTags = p.tags?.some((t) => t.toLowerCase().includes(cleanQuery));
        if (!matchesDesc && !matchesOriginal && !matchesId && !matchesGroup && !matchesTags) {
          return false;
        }
      }
      
      // 2. Категория
      if (selectedCategory) {
        if (!p.group_products?.split(',').map((s) => s.trim()).includes(selectedCategory)) {
          return false;
        }
      }
      
      // 3. Тег
      if (selectedTag) {
        if (!p.tags?.includes(selectedTag)) {
          return false;
        }
      }
      
      // 4. Только избранные
      if (showStarredOnly && !p.starred) {
        return false;
      }
      
      // 5. Только изменённые
      if (showModifiedOnly && !p.is_modified) {
        return false;
      }
      
      // 6. Только выделенные
      if (showSelectedOnly && !p.selected) {
        return false;
      }

      return true;
    });
  }, [products, searchQuery, selectedCategory, selectedTag, showStarredOnly, showModifiedOnly, showSelectedOnly]);

  // Сортировка отфильтрованных товаров
  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts];
    if (sortBy === 'price-asc') {
      sorted.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      sorted.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'id-desc') {
      sorted.sort((a, b) => String(b.product_id).localeCompare(String(a.product_id), undefined, { numeric: true }));
    }
    return sorted;
  }, [filteredProducts, sortBy]);

  // Пагинация отсортированных и отфильтрованных товаров
  const paginatedProducts = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return sortedProducts.slice(startIndex, startIndex + pageSize);
  }, [sortedProducts, page, pageSize]);

  // --- МЕТОДЫ ИЗМЕНЕНИЯ СОСТОЯНИЯ (С автоматической синхронизацией с IDB) ---

  const updateProduct = useCallback(async (updated: Product) => {
    try {
      // Сначала оптимистично обновляем UI
      setProducts((prev) => prev.map((p) => (p.product_id === updated.product_id ? updated : p)));
      // Кладем в отложенную транзакционную очередь IDB
      await catalogAPI.upsert(updated);
    } catch (err: any) {
      // Откат стейта в случае ошибки (потребует чтения из БД)
      addToast('Ошибка синхронизации изменений: ' + err.message, 'error');
      const freshList = await catalogAPI.getAll();
      setProducts(freshList);
    }
  }, [addToast]);

  const bulkUpdateProducts = useCallback(async (updatedList: Product[]) => {
    try {
      const updateMap = new Map(updatedList.map((item) => [item.product_id, item]));
      setProducts((prev) => prev.map((p) => (updateMap.has(p.product_id) ? updateMap.get(p.product_id)! : p)));
      await catalogAPI.bulkUpsert(updatedList);
      await catalogAPI.forceSync();
    } catch (err: any) {
      addToast('Групповое обновление не удалось: ' + err.message, 'error');
      const freshList = await catalogAPI.getAll();
      setProducts(freshList);
    }
  }, [addToast]);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      setProducts((prev) => prev.filter((p) => p.product_id !== id));
      await catalogAPI.deleteById(id);
      addToast('Товар успешно удален', 'success');
    } catch (err: any) {
      addToast('Ошибка удаления товара: ' + err.message, 'error');
      const freshList = await catalogAPI.getAll();
      setProducts(freshList);
    }
  }, [addToast]);

  const deleteSelected = useCallback(async () => {
    const selectedIds = products.filter((p) => p.selected).map((p) => p.product_id);
    if (selectedIds.length === 0) return;

    try {
      setProducts((prev) => prev.filter((p) => !p.selected));
      for (const id of selectedIds) {
        await catalogAPI.deleteById(id);
      }
      addToast(`Успешно удалено ${selectedIds.length} выделенных товаров`, 'success');
    } catch (err: any) {
      addToast('Некоторые товары не удалось удалить: ' + err.message, 'error');
      const freshList = await catalogAPI.getAll();
      setProducts(freshList);
    }
  }, [products, addToast]);

  const importProducts = useCallback(async (rawJson: any[], mode: 'merge' | 'replace' = 'merge') => {
    try {
      const parsed = validateAndNormalize(rawJson);
      
      if (mode === 'replace') {
        setProducts(parsed);
        await catalogAPI.clear();
        await catalogAPI.bulkUpsert(parsed);
        await catalogAPI.forceSync();
        addToast(`Импорт завершен: База полностью перезаписана (${parsed.length} поз.).`, 'success');
        return;
      }
      
      // Сверка на дубликаты перед добавлением (режим Merge)
      const existingMap = new Map<string, Product>(products.map((p) => [p.product_id, p]));
      let newCount = 0;
      let updateCount = 0;
      
      const mergedList = parsed.map((item) => {
        if (existingMap.has(item.product_id)) {
          updateCount++;
          // Слияние тегов и сохранение признаков ручных правок, если они были
          const current = existingMap.get(item.product_id)!;
          return {
            ...item,
            starred: current.starred,
            selected: current.selected,
            tags: Array.from(new Set([...(current.tags || []), ...(item.tags || [])]))
          };
        } else {
          newCount++;
          return item;
        }
      });

      const nextProducts = [
        ...products.filter((p) => !mergedList.some((m) => m.product_id === p.product_id)),
        ...mergedList
      ];

      setProducts(nextProducts);
      await catalogAPI.bulkUpsert(mergedList);
      await catalogAPI.forceSync(); // Записываем сразу

      addToast(`Импорт завершен: ${newCount} добавлено, ${updateCount} обновлено.`, 'success');
    } catch (err: any) {
      addToast('Импорт прерван: ' + err.message, 'error');
      throw err;
    }
  }, [products, addToast]);

  // Сбросить кураторские правки (к исходной цене и размерам)
  const resetAllEdits = useCallback(async () => {
    const modifiedProducts = products.filter((p) => p.is_modified);
    if (modifiedProducts.length === 0) {
      addToast('Нет ранее измененных товаров!', 'info');
      return;
    }

    try {
      const updated = products.map((p) => {
        if (p.is_modified) {
          return {
            ...p,
            price: p.original_price,
            sizes: [...p.sizes_original],
            description: p.original_description || p.description,
            original_text: p.original_text_original || p.original_text,
            is_modified: false
          };
        }
        return p;
      });

      setProducts(updated);
      await catalogAPI.bulkUpsert(updated.filter(p => p.is_modified === false));
      addToast(`Сброшено правок для ${modifiedProducts.length} товаров.`, 'success');
    } catch (err: any) {
      addToast('Ошибка сброса правок: ' + err.message, 'error');
    }
  }, [products, addToast]);

  // Массовое изменение тегов товаров
  const bulkApplyTags = useCallback(async (targetIds: string[], op: 'add' | 'remove' | 'replace', tagsToApply: string[]) => {
    if (targetIds.length === 0) return;
    try {
      const normalizedToApply = tagsToApply.map(t => t.trim().toLowerCase()).filter(Boolean);
      const updated = products.map((p) => {
        if (!targetIds.includes(p.product_id)) return p;
        let newTags = [...(p.tags || [])];
        if (op === 'add') {
          newTags = Array.from(new Set([...newTags, ...normalizedToApply]));
        } else if (op === 'remove') {
          newTags = newTags.filter((t) => !normalizedToApply.includes(t.trim().toLowerCase()));
        } else {
          newTags = [...normalizedToApply];
        }
        return { ...p, tags: newTags, is_modified: true };
      });

      setProducts(updated);
      const affected = updated.filter((p) => targetIds.includes(p.product_id));
      await catalogAPI.bulkUpsert(affected);
      await catalogAPI.forceSync();
      addToast(`Теги успешно обновлены у ${targetIds.length} товаров.`, 'success');
    } catch (err: any) {
      addToast('Ошибка массового изменения тегов: ' + err.message, 'error');
      const freshList = await catalogAPI.getAll();
      setProducts(freshList);
    }
  }, [products, addToast]);

  // Групповые переключатели выделения
  const toggleSelectAll = useCallback((select: boolean) => {
    setProducts((prev) =>
      prev.map((p) => {
        // Выделяем только среди отфильтрованных, либо сбрасываем вообще у всех
        const isMatched = filteredProducts.some((fp) => fp.product_id === p.product_id);
        return {
          ...p,
          selected: select ? (isMatched ? true : p.selected) : false
        };
      })
    );
  }, [filteredProducts]);

  // Групповые переключатели избранного
  const toggleStarAll = useCallback((star: boolean) => {
    const updated = products.map((p) => {
      const isMatched = filteredProducts.some((fp) => fp.product_id === p.product_id);
      return {
        ...p,
        starred: star ? (isMatched ? true : p.starred) : (isMatched ? false : p.starred)
      };
    });
    setProducts(updated);
    catalogAPI.bulkUpsert(updated.filter((p) => filteredProducts.some((fp) => fp.product_id === p.product_id)));
  }, [products, filteredProducts]);

  // Групповая коррекция цен (рубли/проценты)
  const bulkApplyPriceAdjustment = useCallback(async (amount: number, type: 'add' | 'percent') => {
    const selectedProducts = products.filter((p) => p.selected);
    if (selectedProducts.length === 0) {
      addToast('Не выбрано ни одного товара для наценки!', 'info');
      return;
    }

    const updated = products.map((p) => {
      if (p.selected) {
        let currentPrice = p.price;
        if (type === 'add') {
          currentPrice = Math.max(0, currentPrice + amount);
        } else {
          currentPrice = Math.max(0, Math.round(currentPrice * (1 + amount / 100)));
        }
        
        const isModified = currentPrice !== p.original_price || 
                           p.is_modified || 
                           !(p.sizes?.length === p.sizes_original?.length && p.sizes?.every((v, i) => v === p.sizes_original[i]));

        return {
          ...p,
          price: currentPrice,
          is_modified: isModified
        };
      }
      return p;
    });

    try {
      setProducts(updated);
      await catalogAPI.bulkUpsert(updated.filter(p => p.selected));
      await catalogAPI.forceSync();
      addToast(`Применено начисление к ${selectedProducts.length} позициям.`, 'success');
    } catch (err: any) {
      addToast('Ошибка групповой переоценки: ' + err.message, 'error');
    }
  }, [products, addToast]);

  // Сборка оптимизированных провайдеров
  const dataValue = useMemo<CatalogDataContextType>(() => ({
    products,
    filteredProducts,
    paginatedProducts,
    categories,
    tags,
    isLoading,
    updateProduct,
    bulkUpdateProducts,
    deleteProduct,
    deleteSelected,
    importProducts,
    resetAllEdits,
    bulkApplyTags,
    toggleSelectAll,
    toggleStarAll,
    bulkApplyPriceAdjustment
  }), [
    products,
    filteredProducts,
    paginatedProducts,
    categories,
    tags,
    isLoading,
    updateProduct,
    bulkUpdateProducts,
    deleteProduct,
    deleteSelected,
    importProducts,
    resetAllEdits,
    bulkApplyTags,
    toggleSelectAll,
    toggleStarAll,
    bulkApplyPriceAdjustment
  ]);

  const uiValue = useMemo<CatalogUIContextType>(() => ({
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedTag,
    setSelectedTag,
    viewMode,
    setViewMode,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortBy,
    setSortBy,
    showStarredOnly,
    setShowStarredOnly,
    showModifiedOnly,
    setShowModifiedOnly,
    showSelectedOnly,
    setShowSelectedOnly,
    toasts,
    addToast,
    removeToast,
    confirmConfig,
    showConfirm,
    closeConfirm
  }), [
    searchQuery,
    selectedCategory,
    selectedTag,
    viewMode,
    page,
    pageSize,
    sortBy,
    showStarredOnly,
    showModifiedOnly,
    showSelectedOnly,
    toasts,
    addToast,
    removeToast,
    confirmConfig,
    showConfirm,
    closeConfirm
  ]);

  return (
    <CatalogDataContext.Provider value={dataValue}>
      <CatalogUIContext.Provider value={uiValue}>
        {children}
      </CatalogUIContext.Provider>
    </CatalogDataContext.Provider>
  );
};

export const useCatalogData = () => {
  const context = useContext(CatalogDataContext);
  if (context === undefined) {
    throw new Error('useCatalogData должен использоваться внутри CatalogProvider');
  }
  return context;
};

export const useCatalogUI = () => {
  const context = useContext(CatalogUIContext);
  if (context === undefined) {
    throw new Error('useCatalogUI должен использоваться внутри CatalogProvider');
  }
  return context;
};

export const useCatalog = (): CatalogContextType => {
  const data = useContext(CatalogDataContext);
  const ui = useContext(CatalogUIContext);
  if (data === undefined || ui === undefined) {
    throw new Error('useCatalog должен использоваться внутри CatalogProvider');
  }
  return useMemo(() => ({ ...data, ...ui }), [data, ui]);
};
