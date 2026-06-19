# Архитектура модуля KATALOG

## 1. Общее описание
KATALOG — React + Vite SPA-приложение (V4.0) для управления каталогом товаров.
Основная цель: модерация товаров, полученных из парсера, их визуальная корректировка (цены, теги, размеры) и экспорт.
Хранилище: IndexedDB.

## 2. State Management
Приложение использует **двухуровневую систему контекстов** (реализована в `src/context/CatalogContext.tsx`):

### 2.1 CatalogDataContext
Управляет бизнес-логикой данных:
- `products`: Все загруженные товары (Product[]).
- `filteredProducts`/`paginatedProducts`: Вычисления для отображения.
- `Methods`: `updateProduct`, `bulkUpdateProducts`, `deleteProduct`, `importProducts`, `bulkApplyTags`, `bulkApplyPriceAdjustment`.
- `API Integration`: Синхронизация с IndexedDB через `catalogAPI`.

### 2.2 CatalogUIContext
Управляет состоянием интерфейса:
- Фильтры (поиск, категории, теги, статусы).
- Режимы отображения (`grid`/`list`).
- Пагинация (`page`, `pageSize`) и сортировка (`sortBy`).
- Системные уведомления (`toasts`) и модальные подтверждения (`confirmConfig`).

## 3. Слой данных (services/)
- `catalog-db.ts`: Обертка над IndexedDB (методы: `getAll`, `upsert`, `bulkUpsert`, `deleteById`).
- `product-normalizer.ts`: Валидация JSON при импорте. Обеспечивает структуру `Product`, нормализацию тегов, приведение типов.

## 4. Модель данных (types.ts)
`interface Product`:
- Обязательные поля: `product_id`, `price`.
- Кураторские флаги: `starred`, `selected`, `is_modified`.
- Метаданные: `tags`, `original_price`, `sizes`, `sizes_original`.

## 5. Особенности реализации
- **URL-синхронизация**: Состояние фильтров автоматически отражается в URL (`hooks/useUrlFilters`).
- **Массовые операции**: Групповые обновления, тегирование и наценка (BulkActionsPanel).
- **Оптимистичный UI**: Изменения применяются мгновенно в стейте, с последующей асинхронной записью в IndexedDB.
- **Интеграция**: Принимает JSON от модуля PARS.

## 6. Компоненты (components/)
- `ParserImportPanel`: Входная точка для JSON-данных.
- `ProductCard`: Интерактивная карточка с поддержкой редактирования.
- `StatsSummaryPanel`: Аналитика (ср. цена, кол-во).

## 7. Интеграция с PARS
PARS экспортирует JSON, который импортируется через `importProducts()`. 
Требуется контракт в `DOC/KATALOG/contracts/import.json` (в разработке).
