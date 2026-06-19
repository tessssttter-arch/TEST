# Архитектура модуля VETRINA

## 1. Общее описание
VETRINA — гибридный модуль, состоящий из двух независимых частей:
1. **Storefront (Astro + Tailwind)**: Статический сайт для демонстрации каталога.
2. **Backoffice/Logic (React + Vite)**: Модуль для предобработки данных перед публикацией (структурно близок к KATALOG).

## 2. Storefront (Astro)
- **Генерация**: Статическая (`output: 'static'`).
- **Data Source**: Читает JSON-файл из `public/data/catalog.json` на этапе сборки.
- **Интеграции**: `@astrojs/tailwind`.
- **UI-логика**: Vanilla JS в `index.astro` (фильтрация категорий на клиенте).

## 3. Backoffice (React)
- **Назначение**: Обработка и нормализация товаров перед экспортом в JSON для витрины.
- **Стек**: React, Vite, TypeScript.
- **Типы**: Описаны в `src/types.ts` (`ProductItem`, `CartItem`, `UserProfile`).

## 4. Интеграция
Витрина обновляется путем перезаписи `public/data/catalog.json` данными из каталога. 
Контракт данных: `ProductItem`.

