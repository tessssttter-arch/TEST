/**
 * Хук синхронизации состояния фильтров, пагинации и сортировки с URL-адресом (URL Search Params).
 * Позволяет делиться ссылками с сохранением текущего контекста просмотра (F5 safe).
 */

import { useEffect, useRef } from 'react';

interface UrlFiltersState {
  searchQuery: string;
  selectedCategory: string;
  selectedTag: string;
  sortBy: string;
  page: number;
  pageSize: number;
  showStarredOnly: boolean;
  showModifiedOnly: boolean;
  showSelectedOnly: boolean;
}

interface UrlFiltersSetters {
  setSearchQuery: (q: string) => void;
  setSelectedCategory: (cat: string) => void;
  setSelectedTag: (tag: string) => void;
  setSortBy: (sort: 'price-asc' | 'price-desc' | 'id-desc') => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setShowStarredOnly: (val: boolean) => void;
  setShowModifiedOnly: (val: boolean) => void;
  setShowSelectedOnly: (val: boolean) => void;
}

export function parseUrlFilters(): Partial<UrlFiltersState> {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  const state: Partial<UrlFiltersState> = {};

  if (params.has('q')) state.searchQuery = params.get('q') || '';
  if (params.has('category')) state.selectedCategory = params.get('category') || '';
  if (params.has('tag')) state.selectedTag = params.get('tag') || '';
  if (params.has('sort')) {
    const s = params.get('sort');
    if (s === 'price-asc' || s === 'price-desc' || s === 'id-desc') {
      state.sortBy = s;
    }
  }
  if (params.has('page')) {
    const p = Number(params.get('page'));
    if (!isNaN(p) && p > 0) state.page = p;
  }
  if (params.has('pageSize')) {
    const ps = Number(params.get('pageSize'));
    if (!isNaN(ps) && ps > 0) state.pageSize = ps;
  }
  if (params.has('starred')) state.showStarredOnly = params.get('starred') === 'true';
  if (params.has('modified')) state.showModifiedOnly = params.get('modified') === 'true';
  if (params.has('selected')) state.showSelectedOnly = params.get('selected') === 'true';

  return state;
}

export function useUrlFilters(
  state: UrlFiltersState,
  setters: UrlFiltersSetters
) {
  const isMounted = useRef(false);

  // Инициализация из URL при старте приложения
  useEffect(() => {
    const initial = parseUrlFilters();
    
    if (initial.searchQuery !== undefined) setters.setSearchQuery(initial.searchQuery);
    if (initial.selectedCategory !== undefined) setters.setSelectedCategory(initial.selectedCategory);
    if (initial.selectedTag !== undefined) setters.setSelectedTag(initial.selectedTag);
    if (initial.sortBy !== undefined) setters.setSortBy(initial.sortBy as any);
    if (initial.page !== undefined) setters.setPage(initial.page);
    if (initial.pageSize !== undefined) setters.setPageSize(initial.pageSize);
    if (initial.showStarredOnly !== undefined) setters.setShowStarredOnly(initial.showStarredOnly);
    if (initial.showModifiedOnly !== undefined) setters.setShowModifiedOnly(initial.showModifiedOnly);
    if (initial.showSelectedOnly !== undefined) setters.setShowSelectedOnly(initial.showSelectedOnly);
    
    isMounted.current = true;
  }, []);

  // Синхронизация стейта в URL при изменениях
  useEffect(() => {
    if (!isMounted.current) return;

    const params = new URLSearchParams();

    if (state.searchQuery) params.set('q', state.searchQuery);
    if (state.selectedCategory) params.set('category', state.selectedCategory);
    if (state.selectedTag) params.set('tag', state.selectedTag);
    if (state.sortBy !== 'id-desc') params.set('sort', state.sortBy);
    if (state.page > 1) params.set('page', String(state.page));
    if (state.pageSize !== 50) params.set('pageSize', String(state.pageSize));
    if (state.showStarredOnly) params.set('starred', 'true');
    if (state.showModifiedOnly) params.set('modified', 'true');
    if (state.showSelectedOnly) params.set('selected', 'true');

    const searchStr = params.toString();
    const newUrl = `${window.location.pathname}${searchStr ? '?' + searchStr : ''}`;
    
    window.history.pushState({ path: newUrl }, '', newUrl);
  }, [
    state.searchQuery,
    state.selectedCategory,
    state.selectedTag,
    state.sortBy,
    state.page,
    state.pageSize,
    state.showStarredOnly,
    state.showModifiedOnly,
    state.showSelectedOnly
  ]);
}
